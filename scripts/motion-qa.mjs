import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Real browser motion checks. Evidence contains counts and UI states only.
// Never screenshot a measured report, export it, or collect network bodies.
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:5190/');
const target = /\/check\/?$/.test(base.pathname) ? base.href : new URL('check/', base.href).href;
const output = path.resolve(process.env.QA_OUTPUT || 'artifacts/motion');
await mkdir(output, { recursive: true, mode: 0o700 });
const evidence = { schema: 'motion-qa-1', cases: [], failures: [], measured_report_captured: false };
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  ...(process.env.QA_PROXY ? { proxy: { server: process.env.QA_PROXY } } : {}),
});

async function canvas(page) {
  return page.locator('#gate-canvas').evaluate(el => ({
    renderer: el.dataset.renderer, running: el.dataset.running,
    frames: Number(el.dataset.frames || 0), width: el.width, height: el.height,
  }));
}
async function grows(page) {
  const before = await canvas(page);
  await page.waitForFunction(n => Number(document.querySelector('#gate-canvas').dataset.frames) > n + 2, before.frames, { timeout: 5000 });
  const after = await canvas(page);
  assert.equal(after.renderer, 'webgl');
  assert.equal(after.running, 'true');
  return { before: before.frames, after: after.frames };
}
async function stationary(page) {
  await page.waitForTimeout(150);
  const before = await canvas(page);
  await page.waitForTimeout(450);
  const after = await canvas(page);
  assert.equal(after.frames, before.frames, 'decorative RAF must stop');
  assert.equal(after.running, 'false');
  return { before: before.frames, after: after.frames };
}
async function top(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('.hero').dataset.gateVisible === 'true');
}
async function bounds(page) {
  const result = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll_width: document.documentElement.scrollWidth }));
  assert.ok(result.scroll_width <= result.viewport, 'horizontal overflow');
  for (const id of ['start', 'motion-toggle', 'report-file']) assert.equal(await page.locator(`#${id}`).isEnabled(), true, `${id} remains usable`);
  return result;
}
async function newPage(viewport, fallback = false) {
  const context = await browser.newContext({ viewport });
  if (fallback) await context.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
      return get.call(this, type, ...args);
    };
  });
  const page = await context.newPage();
  const signals = { external_requests: 0, initial_external_requests: 0, local_failed_resources: [], page_errors: [], console_errors: 0 };
  page.on('request', request => { if (new URL(request.url()).origin !== base.origin) signals.external_requests++; });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === base.origin && response.status() >= 400) signals.local_failed_resources.push({ path: url.pathname, status: response.status() });
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.origin === base.origin) signals.local_failed_resources.push({ path: url.pathname, failed: true });
  });
  page.on('pageerror', error => signals.page_errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') signals.console_errors++; });
  await page.goto(target);
  await page.waitForFunction(() => !document.querySelector('#start')?.disabled);
  await page.waitForFunction(() => ['complete', 'static'].includes(document.documentElement.dataset.intro), null, { timeout: 10000 });
  signals.initial_external_requests = signals.external_requests;
  assert.equal(signals.initial_external_requests, 0, 'initial UI must not send probes');
  return { page, context, signals };
}
function errors(signals) {
  assert.deepEqual(signals.local_failed_resources, [], 'local resources');
  assert.deepEqual(signals.page_errors, [], 'uncaught page errors');
  assert.equal(signals.console_errors, 0, 'console errors');
}
async function runCase(name, fn) {
  const record = { name, passed: false };
  evidence.cases.push(record);
  try { await fn(record); record.passed = true; }
  catch (error) { record.failure = error.message; evidence.failures.push({ case: name, message: error.message }); }
}

try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await runCase(`motion-${viewport.width}`, async record => {
      const { page, context, signals } = await newPage(viewport);
      record.viewport = viewport; record.signals = signals;
      try {
        assert.equal((await canvas(page)).renderer, 'webgl', 'actual WebGL renderer required');
        record.initial_frames = await grows(page);
        record.layout = await bounds(page);
        await page.screenshot({ path: path.join(output, `initial-${viewport.width}.png`) });
        await page.locator('#motion-toggle').click();
        await page.waitForFunction(() => document.documentElement.dataset.motion === 'reduced');
        record.manual_pause = await stationary(page);
        await page.locator('#motion-toggle').click();
        record.manual_resume = await grows(page);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => document.documentElement.dataset.motion === 'reduced');
        record.system_reduce = await stationary(page);
        assert.equal(await page.locator('#motion-toggle').isDisabled(), true);
        assert.equal(await page.locator('#hero-title').isVisible(), true);
        assert.equal(await page.locator('#hero-title').evaluate(el => Number(getComputedStyle(el).opacity)), 1);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.waitForFunction(() => document.documentElement.dataset.motion === 'full');
        record.system_restore = await grows(page);
        await page.evaluate(() => window.scrollTo({ top: document.querySelector('#detector').offsetTop + 80, behavior: 'instant' }));
        await page.waitForFunction(() => document.querySelector('.hero').dataset.gateVisible === 'false');
        record.offscreen = await stationary(page);
        await page.locator('#start').click();
        await page.waitForFunction(() => document.querySelector('#run-journey').dataset.state === 'running');
        if (viewport.width === 390) {
          await page.locator('#cancel').click();
          await page.waitForFunction(() => !document.querySelector('#start').disabled);
          assert.equal(await page.locator('#run-journey').getAttribute('data-state'), 'stopped');
          assert.ok((await page.locator('#result-summary').textContent()).includes('尚未完整'));
          record.real_flow = { stopped: true, state: 'stopped' };
        } else {
          await page.waitForFunction(() => !document.querySelector('#start').disabled, null, { timeout: 16000 });
          assert.equal(await page.locator('#run-journey').getAttribute('data-state'), 'complete');
          record.real_flow = { collection_finished: true, state: 'complete', report_not_captured: true };
        }
        assert.ok(signals.external_requests > 0, 'real probe requests must exist');
        record.final_layout = await bounds(page);
        errors(signals);
      } finally { await context.close(); }
    });
  }
  await runCase('webgl-unavailable', async record => {
    const { page, context, signals } = await newPage({ width: 390, height: 844 }, true);
    record.signals = signals;
    try {
      assert.equal((await canvas(page)).renderer, 'fallback');
      assert.equal(await page.locator('.gate-fallback').isVisible(), true);
      record.frames = await stationary(page); record.layout = await bounds(page);
      await page.screenshot({ path: path.join(output, 'fallback-initial.png') });
      errors(signals);
    } finally { await context.close(); }
  });
  await runCase('webgl-context-loss', async record => {
    const { page, context, signals } = await newPage({ width: 1440, height: 1000 });
    record.signals = signals;
    try {
      const supported = await page.evaluate(() => {
        const gl = document.querySelector('#gate-canvas').getContext('webgl');
        const extension = gl?.getExtension('WEBGL_lose_context');
        if (!extension) return false;
        window.__motionQaLose = extension; extension.loseContext(); return true;
      });
      record.extension_supported = supported;
      if (supported) {
        await page.waitForFunction(() => document.querySelector('#gate-canvas').dataset.renderer === 'fallback');
        record.lost_frames = await stationary(page); record.controls = await bounds(page);
        await page.evaluate(() => window.__motionQaLose.restoreContext());
        await page.waitForFunction(() => document.querySelector('#gate-canvas').dataset.renderer === 'webgl', null, { timeout: 6000 });
        record.restored_frames = await grows(page);
      } else record.not_tested = 'WEBGL_lose_context extension unavailable';
      errors(signals);
    } finally { await context.close(); }
  });
  for (const width of [320, 360, 760, 900]) await runCase(`width-${width}`, async record => {
    const { page, context, signals } = await newPage({ width, height: 844 });
    record.signals = signals;
    try {
      record.top = await bounds(page);
      await page.locator('#detector').scrollIntoViewIfNeeded(); record.detector = await bounds(page);
      await page.locator('.local-section').scrollIntoViewIfNeeded(); record.local = await bounds(page);
      await top(page); errors(signals);
    } finally { await context.close(); }
  });
} finally {
  await browser.close();
  evidence.passed = evidence.failures.length === 0;
  await writeFile(path.join(output, 'motion-qa.json'), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ passed: evidence.passed, cases: evidence.cases.map(({ name, passed, failure }) => ({ name, passed, failure })), failures: evidence.failures }, null, 2));
}
if (!evidence.passed) process.exitCode = 1;

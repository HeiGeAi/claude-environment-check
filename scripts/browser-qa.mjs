import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5190/';
const output = path.resolve(process.env.QA_OUTPUT || 'artifacts/browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  ...(process.env.QA_PROXY ? { proxy: { server: process.env.QA_PROXY } } : {}),
});
const evidence = { browser: browser.version(), base, proxy_explicit: Boolean(process.env.QA_PROXY), viewports: [], network: [], checks: {} };
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = [], consoleErrors = [], failed = [], externalRequests = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) failed.push({ url: response.url(), status: response.status() }); });
    page.on('request', request => {
      if (!request.url().startsWith(base)) externalRequests.push({ url: request.url().split('?')[0], method: request.method() });
    });
    await page.goto(base);
    await page.locator('.s-hero__title').waitFor();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.s-hero__actions')).opacity) > .99);
    assert.equal(await page.locator('#main > section').count(), 18);
    assert.equal(await page.getByRole('link', { name: '环境检测', exact: true }).isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, `home-${viewport.width}.png`) });
    const manualTheme = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return Object.fromEntries(['--bg', '--amber', '--grad-warm', '--font-display', '--font-sans', '--font-mono'].map(name => [name, s.getPropertyValue(name).trim()])); });
    await page.getByRole('link', { name: '环境检测', exact: true }).click();
    await page.locator('#start').waitFor();
    await page.waitForLoadState('load');
    await page.waitForFunction(() => !document.querySelector('#start')?.disabled);
    await page.evaluate(() => document.fonts.ready);
    const checkTheme = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return Object.fromEntries(['--bg', '--amber', '--grad-warm', '--font-display', '--font-sans', '--font-mono'].map(name => [name, s.getPropertyValue(name).trim()])); });
    assert.deepEqual(checkTheme, manualTheme, 'detector and manual must share the actual theme tokens');
    assert.equal(await page.locator('meta[name="color-scheme"]').getAttribute('content'), 'dark');
    assert.equal(await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(7, 8, 12)');
    await page.evaluate(() => document.fonts.ready);
    assert.ok((await page.locator('h1').evaluate(node => getComputedStyle(node).fontFamily)).includes('GuideSerif'));
    evidence.checks.shared_manual_visual_system = true;
    assert.equal(externalRequests.length, 0, 'initial page must not contact probes');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('a[href="../"]').count() > 0, true);
    await page.screenshot({ path: path.join(output, `check-${viewport.width}.png`), fullPage: true });
    await page.locator('.endpoint-fold summary').click();
    assert.equal(await page.locator('.endpoints').isVisible(), true);
    await page.locator('.endpoint-fold summary').click();
    await page.locator('#start').click();
    await page.waitForFunction(() => !document.querySelector('#start').disabled && !document.querySelector('#results-section').hidden, null, { timeout: 22000 });
    const live = await page.locator('#checks .check').evaluateAll(rows => rows.map(row => ({ title: row.querySelector('h3').textContent, status: row.querySelector('.check-status').dataset.status })));
    assert.equal(live.length >= 10, true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, `results-${viewport.width}.png`), fullPage: true });
    const exportButton = page.locator('#export');
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const report = JSON.parse(await readFile(downloadPath, 'utf8'));
    assert.equal(report.run_location, 'browser');
    assert.ok(report.checks.some(item => item.id === 'scope.guard' && item.status === 'UNKNOWN'));
    assert.ok(!report.checks.some(item => item.id === 'browser.webrtc' && item.status === 'PASS'));
    evidence.network.push({ width: viewport.width, observations: live, exported_schema: report.schema_version, external_requests: externalRequests });
    // Cancellation uses real pending browser requests. Check previous results disappear immediately.
    await page.evaluate(() => { document.querySelector('#start').click(); document.querySelector('#cancel').click(); });
    await page.waitForFunction(() => !document.querySelector('#start').disabled, null, { timeout: 10000 });
    assert.ok((await page.locator('#result-summary').textContent()).includes('尚未完整'));
    evidence.checks.cancel = true;
    await page.locator('#webrtc-optin').check();
    await page.locator('#start').click();
    await page.waitForFunction(() => !document.querySelector('#start').disabled && !document.querySelector('#results-section').hidden, null, { timeout: 22000 });
    const rtc = await page.locator('#checks .check').evaluateAll(rows => rows.map(row => ({ title: row.querySelector('h3').textContent, status: row.querySelector('.check-status').dataset.status })).find(row => row.title === 'WebRTC 候选地址'));
    evidence.network.push({ width: viewport.width, actual_webrtc: rtc });
    await page.locator('#webrtc-optin').uncheck();
    if (process.env.QA_REPORT) {
      await page.locator('#report-file').setInputFiles(process.env.QA_REPORT);
      await page.locator('#import-notice').waitFor();
      assert.ok((await page.locator('#result-origin').textContent()).includes('LOCAL REPORT'));
      assert.equal(await page.locator('#import-error').isVisible(), false);
      evidence.checks.real_local_report_import = true;
    }
    const synthetic = { ...report, checks: [{ ...report.checks[0], id: 'synthetic_security_case', status: 'WARN', message: '<img src=x onerror="window.syntheticExecuted=true"> token=SYNTHETIC_SECRET', observed: { nested: '<script>window.syntheticExecuted=true</script>' } }] };
    await page.locator('#report-file').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(synthetic)) });
    await page.waitForFunction(() => document.querySelector('#checks h3')?.textContent === 'synthetic_security_case');
    assert.equal(await page.evaluate(() => Boolean(window.syntheticExecuted)), false);
    assert.equal(await page.locator('#checks img,#checks script').count(), 0);
    const sanitizedPromise = page.waitForEvent('download');
    await exportButton.click();
    const sanitized = await sanitizedPromise;
    assert.ok(!(await readFile(await sanitized.path(), 'utf8')).includes('SYNTHETIC_SECRET'));
    evidence.checks.synthetic_import_render_export = true;
    await page.locator('#report-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
    await page.locator('#import-error').waitFor();
    evidence.checks.invalid_json_rejected = true;
    await page.getByRole('link', { name: '返回手册', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('#main > section').length === 18);
    assert.equal(await page.locator('#main > section').count(), 18);
    await page.locator('#topbar [data-level="pro"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-pro')), true);
    await page.locator('#menu-btn').click();
    assert.equal(await page.locator('#chapter-menu').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.locator('#chapter-menu').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, `manual-${viewport.width}.png`) });
    const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].map(font => ({ family: font.family, status: font.status })); });
    assert.equal(fonts.every(font => font.status === 'loaded'), true);
    await page.getByRole('link', { name: '环境检测', exact: true }).click();
    await page.locator('#start').waitFor();
    assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
    assert.equal(consoleErrors.length, 0, JSON.stringify(consoleErrors));
    assert.equal(failed.length, 0, JSON.stringify(failed));
    evidence.viewports.push({ ...viewport, no_horizontal_overflow: true, no_page_errors: true, local_resource_failures: failed, console_errors: consoleErrors, manual_sections: 18, fonts });
    await context.close();
  }
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(new URL('check/', base).href);
  assert.equal(await page.locator('#start').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  evidence.checks.reduced_motion = true;
  await page.goto(new URL('manual/#privacy', base).href);
  await page.waitForURL(url => url.href === base + '#privacy');
  assert.equal(await page.locator('#privacy').count(), 1);
  evidence.checks.legacy_hash_redirect = true;
  await context.close();
  await writeFile(path.join(output, 'browser-qa.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }

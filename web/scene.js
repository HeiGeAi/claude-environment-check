// Decorative gate light uses the original manual shader. Only the courier and
// stage text follow actual collection phases; light streams are not telemetry.
import { mascot } from '../manual/src/core/mascot.js';
import { createGateRenderer } from '../manual/src/core/gate-renderer.js';

export function createScene() {
  const scene = document.getElementById('check-scene');
  const label = document.getElementById('scene-label');
  const art = document.getElementById('scene-art');
  const canvas = document.getElementById('gate-canvas');
  const hero = canvas?.closest('.hero') || scene?.closest('.hero');
  const brand = document.getElementById('brand-courier');
  if (!scene || !label || !art || !hero) return { update() {}, dispose() {} };
  // Trusted shared SVG only. No report data or machine information enters it.
  if (brand) brand.innerHTML = mascot({ size: 30 });
  art.innerHTML = `<div class="gate-fallback" aria-hidden="true"><i class="gate-fallback__door"></i></div><div class="scene-courier">${mascot({ size: 92 })}</div>`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isReduced = () => reduced.matches || document.documentElement.dataset.motion === 'reduced';
  let renderer = canvas ? createGateRenderer(canvas) : null;
  let visible = true, disposed = false, lost = false, raf = 0, last = 0;
  let slowFrames = 0, frames = 0, elapsed = 0, status = 'ready', stage = null;
  let scrollProgress = 0;
  let budget = innerWidth <= 760 ? 650000 : 1600000;
  let doorX = 0, doorY = 0, unit = 1;
  const S = { doorX: 0, doorY: 0, L: 1, time: 3.2, mx: -9999, my: -9999,
    mouseOn: 0, mouseTarget: 0, intro: 0, glow: 0, scroll: 0, glowTarget: 1, scrollTarget: 0, blocked: 0 };
  function fallback(value) {
    hero.classList.toggle('is-nogl', value);
    hero.dataset.gateRenderer = value ? 'fallback' : 'webgl';
    if (canvas) { canvas.dataset.renderer = value ? 'fallback' : 'webgl'; canvas.dataset.running = 'false'; canvas.dataset.frames = String(frames); }
  }
  fallback(!renderer);
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; if (canvas) canvas.dataset.running = 'false'; }
  function drawStatic() {
    if (!renderer || lost || disposed) return;
    S.intro = 1; S.glow = S.glowTarget; S.time = Math.max(6, S.time);
    renderer.draw(S);
  }
  function positionCourier() {
    const courier = art.querySelector('.scene-courier');
    if (!courier) return;
    const wide = hero.clientWidth > 760;
    const heroRect = hero.getBoundingClientRect(), artRect = art.getBoundingClientRect();
    const destinationX = heroRect.left + doorX - artRect.left;
    const destinationY = heroRect.top + doorY - artRect.top;
    const distances = wide ? [Math.min(210, unit * .36), Math.min(90, unit * .14)] : [Math.min(110, unit * .3), 30];
    let progress = status === 'complete' ? .88 : status === 'running' ? [.12, .38, .68, .88][Math.min(stage ?? 0, 3)] : status === 'stopped' ? .28 : 0;
    const width = courier.getBoundingClientRect().width || (wide ? 92 : 68);
    const x = destinationX - distances[0] * (1 - progress) - width / 2;
    const y = destinationY + distances[1] * (1 - progress) - width / 2;
    courier.style.left = '0'; courier.style.top = '0';
    courier.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
  function layout() {
    if (disposed) return;
    const w = hero.clientWidth, h = hero.clientHeight;
    const wide = w > 760;
    unit = Math.min(w * 1.25, h);
    doorX = w * (wide ? .76 : .5); doorY = h * (wide ? .48 : .24);
    hero.style.setProperty('--door-x', `${doorX}px`);
    hero.style.setProperty('--door-y', `${doorY}px`);
    hero.style.setProperty('--door-L', `${unit}px`);
    hero.style.setProperty('--door-w', `${unit * .116}px`);
    hero.style.setProperty('--door-h', `${unit * .188}px`);
    positionCourier();
    if (!canvas || !renderer) return;
    const allowed = Math.min(budget, wide ? 1600000 : 650000);
    const dpr = Math.min(devicePixelRatio || 1, wide ? 1.75 : 1.5);
    const scale = Math.min(dpr, Math.sqrt(allowed / Math.max(1, w * h)));
    canvas.width = Math.max(2, Math.floor(w * scale)); canvas.height = Math.max(2, Math.floor(h * scale));
    S.doorX = doorX * scale; S.doorY = (h - doorY) * scale; S.L = unit * scale;
    if (isReduced() || !raf) drawStatic();
  }
  function frame(now) {
    raf = 0;
    if (!renderer || disposed || lost || !visible || document.hidden || isReduced()) { stop(); return; }
    const dt = last ? Math.min(.06, (now - last) / 1000) : .016;
    last = now; elapsed += dt; S.time += dt;
    S.intro = Math.min(1, elapsed / 1.8); S.glow += (S.glowTarget - S.glow) * Math.min(1, dt * 5);
    S.mouseOn += (S.mouseTarget - S.mouseOn) * Math.min(1, dt * 4);
    S.scroll += (S.scrollTarget - S.scroll) * Math.min(1, dt * 5);
    renderer.draw(S);
    frames++;
    if (canvas) canvas.dataset.frames = String(frames);
    if (frames > 20) slowFrames = dt > .026 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 45 && budget > 300000) { budget = Math.max(300000, Math.floor(budget * .65)); slowFrames = 0; layout(); }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !renderer || disposed || lost || !visible || document.hidden || isReduced()) return;
    last = 0; if (canvas) canvas.dataset.running = 'true'; raf = requestAnimationFrame(frame);
  }
  const resize = new ResizeObserver(layout); resize.observe(hero); resize.observe(art);
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting || false;
    hero.dataset.gateVisible = String(visible);
    if (visible) start(); else stop();
  }, { threshold: 0 });
  intersection.observe(hero);
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  const onReduced = () => { if (isReduced()) { stop(); drawStatic(); } else start(); };
  const onMove = event => {
    if (!canvas || isReduced() || disposed) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / Math.max(1, rect.width);
    S.mx = (event.clientX - rect.left) * scale; S.my = (rect.bottom - event.clientY) * scale;
    S.mouseTarget = event.pointerType === 'touch' ? .6 : 1;
  };
  const onLeave = () => { S.mouseTarget = 0; };
  function syncScrollTarget() {
    const rect = hero.getBoundingClientRect();
    scrollProgress = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height)));
    const stageOffset = status === 'running' ? Math.min(.18, (stage ?? 0) * .055) : 0;
    S.scrollTarget = Math.min(.7, scrollProgress * .45 + stageOffset);
  }
  const onScroll = () => {
    syncScrollTarget();
    if (isReduced()) { S.scroll = S.scrollTarget; drawStatic(); }
    else start();
  };
  const onLost = event => {
    event.preventDefault(); lost = true; stop(); renderer?.dispose(); renderer = null; fallback(true);
  };
  const onRestored = () => {
    if (disposed || !canvas) return;
    lost = false; renderer = createGateRenderer(canvas); fallback(!renderer); layout(); start();
  };
  // Returning from the browser back/forward cache restores the same scene,
  // without keeping a renderer alive while the page is hidden in that cache.
  const onPageShow = event => {
    if (!event.persisted || !disposed) return;
    disposed = false; lost = false; renderer = canvas ? createGateRenderer(canvas) : null;
    fallback(!renderer); resize.observe(hero); resize.observe(art); intersection.observe(hero);
    attachListeners(); layout(); start();
  };
  const onPageHide = event => {
    dispose();
    if (event.persisted) window.addEventListener('pageshow', onPageShow, { once: true });
  };
  function dispose() {
    if (disposed) return;
    disposed = true; stop(); resize.disconnect(); intersection.disconnect(); renderer?.dispose(); renderer = null;
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('check:motion-change', onReduced);
    reduced.removeEventListener('change', onReduced); hero.removeEventListener('pointermove', onMove); hero.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('scroll', onScroll);
    canvas?.removeEventListener('webglcontextlost', onLost); canvas?.removeEventListener('webglcontextrestored', onRestored);
    window.removeEventListener('pagehide', onPageHide);
  }
  function attachListeners() {
    document.addEventListener('visibilitychange', onVisibility); reduced.addEventListener('change', onReduced);
    document.addEventListener('check:motion-change', onReduced);
    hero.addEventListener('pointermove', onMove, { passive: true }); hero.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    canvas?.addEventListener('webglcontextlost', onLost); canvas?.addEventListener('webglcontextrestored', onRestored);
    window.addEventListener('pagehide', onPageHide);
  }
  attachListeners();
  layout();
  syncScrollTarget();
  // Reset static initial rendering so the visible animation actually opens the gate.
  if (!isReduced()) { S.intro = 0; S.glow = 0; start(); }
  const messages = { ready: '小请求已就位', running: '小请求正在收集证据', complete: '本轮证据已整理', stopped: '小请求停下了，未完成项会保留', error: '本轮未完成，可以重新核对', import: '正在阅读本机生成的证据' };
  return {
    update(nextStatus = 'ready', step = null) {
      if (disposed) return;
      status = Object.hasOwn(messages, nextStatus) ? nextStatus : 'ready'; stage = step;
      scene.dataset.state = status;
      if (step === null) delete scene.dataset.step; else scene.dataset.step = String(step);
      label.textContent = messages[status];
      S.glowTarget = status === 'running' ? 1.22 : status === 'stopped' || status === 'error' ? .62 : 1;
      syncScrollTarget();
      positionCourier(); if (isReduced()) drawStatic(); else start();
    },
    dispose
  };
}

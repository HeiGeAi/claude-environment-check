import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { mascot } from '../manual/src/core/mascot.js';

gsap.registerPlugin(ScrollTrigger);

// Animation only presents DOM evidence. It cannot alter report data or probes.
export function createMotion() {
  const root = document.documentElement;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const toggle = document.getElementById('motion-toggle');
  const journey = document.getElementById('run-journey');
  const bar = document.querySelector('.reading-progress i');
  journey.querySelector('.journey-courier').innerHTML = mascot({ size: 44 });
  let userPaused = false, reduced = media.matches, context, generation = 0, disposed = false;
  let reportTween;
  const panelBindings = new WeakSet();
  const visualBlocks = [...document.querySelectorAll('.hero, .run-journey, .house-diagram')];
  const visibility = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) visibility.set(entry.target, entry.isIntersecting);
    pauseDecorations();
  }, { rootMargin: '0px' });
  for (const el of visualBlocks) { visibility.set(el, true); observer.observe(el); }
  function pauseDecorations() {
    for (const el of visualBlocks) el.dataset.offscreen = String(document.hidden || !visibility.get(el));
  }
  function readingProgress() {
    const length = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${length > 0 ? Math.min(1, Math.max(0, scrollY / length)) : 0})`;
  }
  function bindPanels() {
    for (const panel of document.querySelectorAll('.panel, .check')) {
      if (panelBindings.has(panel)) continue;
      panelBindings.add(panel);
      panel.addEventListener('pointermove', event => {
        if (reduced || !pointer.matches) return;
        const rect = panel.getBoundingClientRect();
        panel.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        panel.style.setProperty('--my', `${event.clientY - rect.top}px`);
      });
    }
  }
  for (const button of document.querySelectorAll('.button')) {
    button.addEventListener('pointermove', event => {
      if (reduced || !pointer.matches || button.disabled) return;
      const rect = button.getBoundingClientRect();
      button.style.setProperty('--pull-x', `${(event.clientX - rect.left - rect.width / 2) * .13}px`);
      button.style.setProperty('--pull-y', `${(event.clientY - rect.top - rect.height / 2) * .13}px`);
    });
    button.addEventListener('pointerleave', () => {
      button.style.setProperty('--pull-x', '0px'); button.style.setProperty('--pull-y', '0px');
    });
  }
  document.addEventListener('toggle', event => {
    if (reduced || !(event.target instanceof HTMLDetailsElement) || !event.target.open) return;
    const content = [...event.target.children].filter(el => el.tagName !== 'SUMMARY');
    gsap.killTweensOf(content);
    gsap.fromTo(content, { opacity: .4, y: 5 }, { opacity: 1, y: 0, duration: .3, clearProps: 'opacity,transform' });
    ScrollTrigger.refresh();
  }, true);
  function configure() {
    if (disposed) return;
    const id = ++generation;
    reduced = media.matches || userPaused;
    root.dataset.motion = reduced ? 'reduced' : 'full';
    toggle.setAttribute('aria-pressed', String(reduced));
    toggle.disabled = media.matches;
    toggle.title = media.matches ? '正在遵循系统的减少动态效果设置' : '切换动态或静态展示';
    document.getElementById('motion-label').textContent = reduced ? '动效：静态' : '动效：开';
    context?.revert(); reportTween?.kill();
    gsap.set(document.querySelectorAll('.motion-target, #checks .check'), { clearProps: 'opacity,transform' });
    for (const el of document.querySelectorAll('.button')) { el.style.removeProperty('--pull-x'); el.style.removeProperty('--pull-y'); }
    document.dispatchEvent(new CustomEvent('check:motion-change', { detail: { reduced } }));
    root.dataset.intro = reduced ? 'static' : 'pending';
    if (reduced) return;
    document.fonts.ready.then(() => {
      if (disposed || id !== generation || reduced) return;
      context = gsap.context(() => {
        const lines = document.querySelectorAll('.hero-title-line > span');
        const late = document.querySelectorAll('.hero-copy-block > .eyebrow, .hero-copy, .hero-meta, .hero-jump');
        for (const el of [...lines, ...late]) el.classList.add('motion-target');
        const intro = gsap.timeline({ onComplete: () => { root.dataset.intro = 'complete'; } });
        root.dataset.intro = 'running';
        intro.fromTo(lines, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2, stagger: .12, ease: 'expo.out' }, .2)
          .fromTo(late, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .08, ease: 'expo.out' }, .42);
        const heroCopy = document.querySelector('.hero-copy-block');
        gsap.to(heroCopy, { y: -48, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'bottom 75%', end: 'bottom top', scrub: .5 } });
        for (const section of document.querySelectorAll('.section:not(.results)')) {
          const targets = [...section.querySelectorAll(':scope > .section-heading, :scope > .detector-grid > *, :scope > .local-grid > *, :scope > div')];
          const unique = [...new Set(targets)];
          for (const el of unique) el.classList.add('motion-target');
          gsap.fromTo(unique, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: section, start: 'top 87%', once: true, onEnter: () => { section.dataset.revealed = 'true'; } } });
        }
      });
      ScrollTrigger.refresh();
    });
  }
  toggle.addEventListener('click', () => { userPaused = !userPaused; configure(); });
  media.addEventListener('change', configure);
  document.addEventListener('visibilitychange', pauseDecorations);
  addEventListener('scroll', readingProgress, { passive: true });
  addEventListener('resize', readingProgress, { passive: true });
  bindPanels(); readingProgress(); configure();
  const labels = { ready: '等待本轮出发', running: '正在收集本轮证据', stopped: '本轮已停止，保留未完成项', complete: '证据已整理，请逐项阅读', error: '本轮未完成，可以重试', import: '阅读已有记录，未执行网络探测' };
  return {
    state(status, step = null) {
      journey.dataset.state = status;
      if (step !== null) journey.dataset.step = String(step); else delete journey.dataset.step;
      journey.querySelector('.journey-note').textContent = labels[status] || labels.ready;
    },
    report(animate = true) {
      reportTween?.kill();
      const rows = [...document.querySelectorAll('#checks .check')];
      bindPanels(); readingProgress(); ScrollTrigger.refresh();
      if (reduced || !animate) return;
      reportTween = gsap.fromTo(rows, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .65, stagger: { each: .055, amount: Math.min(.7, rows.length * .055) }, ease: 'expo.out', clearProps: 'opacity,transform' });
    },
    reset() { reportTween?.kill(); this.state('ready'); ScrollTrigger.refresh(); readingProgress(); }
  };
}

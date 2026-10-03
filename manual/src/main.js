// ============================================================
// 入口：装配章节、顶栏、目录、两档阅读、氛围与声音
// ============================================================
import './styles/tokens.css'
import './styles/base.css'
import { gsap, ScrollTrigger, initSmoothScroll, reveal, scrollToTarget, lockScroll, prefersReduced } from './core/motion.js'
import { audio } from './core/audio.js'
import { setBaseMood } from './core/mood.js'
import { enhanceCodeBlocks, bindSfxDelegation, toast, bus } from './core/ui.js'
import { mascot, mascotCSS } from './core/mascot.js'

import hero from './sections/hero.js'
import truth from './sections/truth.js'
import words from './sections/words.js'
import journey from './sections/journey.js'
import modes from './sections/modes.js'
import layers from './sections/layers.js'
import domains from './sections/domains.js'
import fingerprint from './sections/fingerprint.js'
import report from './sections/report.js'
import build from './sections/build.js'
import gate from './sections/gatekeeper.js'
import drill from './sections/drill.js'
import fix from './sections/fix.js'
import privacy from './sections/privacy.js'
import myths from './sections/myths.js'
import appeal from './sections/appeal.js'
import checklist from './sections/checklist.js'
import sources from './sections/sources.js'

// 顺序即阅读顺序；hero 不编号，其余从 01 开始
const SECTIONS = [hero, truth, words, journey, modes, layers, domains, fingerprint, report, build, gate, drill, fix, privacy, myths, appeal, checklist, sources]

const LEVEL_KEY = 'guide:level'
const root = document.documentElement
root.classList.remove('no-js')

// 吉祥物公共样式
const st = document.createElement('style')
st.textContent = mascotCSS
document.head.appendChild(st)

/* ---------------- 两档阅读：小白 / 进阶 ---------------- */
function setLevel(level, { silent = false } = {}) {
  const pro = level === 'pro'
  root.classList.toggle('is-pro', pro)
  localStorage.setItem(LEVEL_KEY, pro ? 'pro' : 'newbie')
  document.querySelectorAll('.level-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === (pro ? 'pro' : 'newbie'))))
  bus.emit('level', { pro })
  requestAnimationFrame(() => ScrollTrigger.refresh())
  if (!silent) {
    audio.sfx(pro ? 'toggle-on' : 'toggle-off')
    toast(pro ? '进阶模式：显示技术细节、配置和代码' : '小白模式：只看比喻和结论')
  }
}
export const guide = { setLevel, isPro: () => root.classList.contains('is-pro') }
window.__guide = guide

/* ---------------- 章节装配 ---------------- */
const main = document.getElementById('main')
const chapters = []
SECTIONS.forEach((mod, i) => {
  const el = document.createElement('section')
  el.id = mod.id
  el.className = `section s-${mod.id}`
  el.dataset.mood = mod.mood || 'calm'
  const num = i === 0 ? '' : String(i).padStart(2, '0')
  el.dataset.num = num
  if (mod.nav) el.setAttribute('aria-label', mod.nav)
  main.appendChild(el)
  chapters.push({ mod, el, num })
})
chapters.forEach(({ mod, el, num }) => {
  try {
    mod.mount(el, { num, setLevel, isPro: guide.isPro })
  } catch (err) {
    console.error(`[guide] 章节 ${mod.id} 挂载失败`, err)
    el.innerHTML = `<div class="wrap"><p class="faint">本章加载失败：${mod.id}</p></div>`
  }
})

/* ---------------- 顶栏 ---------------- */
const topbar = document.getElementById('topbar')
topbar.innerHTML = `
  <div class="topbar__left">
    <a class="topbar__brand" href="#hero" data-jump="#hero" aria-label="回到开头">
    <span class="mark">${mascot({ size: 26, face: 'idle' })}</span>
    <span class="label">Claude 防封指南</span>
  </a>
    <a class="topbar__curator" href="https://www.heigeai.com" target="_blank" rel="noopener noreferrer" aria-label="整理人黑哥，访问 www.heigeai.com"><span class="k">整理人：</span><b>黑哥</b><span class="sep" aria-hidden="true">·</span><span class="u">www.heigeai.com</span></a>
  </div>
  <div class="topbar__chapter" aria-live="polite"><span class="n"></span><span class="t"></span></div>
  <div class="topbar__tools">
    <a class="topbar__github" href="https://github.com/HeiGeAi/claude-environment-check" target="_blank" rel="noopener noreferrer" aria-label="在 GitHub 查看开源项目">GitHub ↗</a>
    <a class="tool-btn tool-btn--check" href="./check/" aria-label="环境检测" data-sfx="click">环境检测</a>
    <div class="level-switch" role="group" aria-label="阅读深度">
      <button type="button" data-level="newbie" aria-pressed="true">小白</button>
      <button type="button" data-level="pro" aria-pressed="false">进阶</button>
    </div>
    <button class="tool-btn" type="button" id="sound-btn" aria-pressed="false" aria-label="声音开关">
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="label">声音</span>
    </button>
    <button class="tool-btn" type="button" id="menu-btn" aria-expanded="false" aria-controls="chapter-menu" data-sfx="open">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="label">目录</span>
    </button>
  </div>
  <i class="topbar__progress" aria-hidden="true"></i>`

topbar.querySelectorAll('.level-switch button').forEach((b) => b.addEventListener('click', () => setLevel(b.dataset.level)))

const soundBtn = topbar.querySelector('#sound-btn')
const syncSound = (on) => { soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.querySelector('.label').textContent = on ? '声音开' : '声音关' }
soundBtn.addEventListener('click', () => { const on = audio.toggle(); if (on) audio.sfx('toggle-on'); toast(on ? '声音已打开' : '声音已关闭') })
audio.onChange(syncSound)

/* ---------------- 目录 ---------------- */
const menu = document.getElementById('chapter-menu')
const menuBtn = topbar.querySelector('#menu-btn')
menu.innerHTML = `
  <button class="tool-btn chapter-menu__close" type="button" data-sfx="close" aria-label="关闭目录">关闭 ✕</button>
  <div class="chapter-menu__grid">
    ${chapters.map(({ mod, num }) => `<a href="#${mod.id}" data-jump="#${mod.id}" data-sfx-hover="hover"><span class="n">${num || '00'}</span><span class="t">${mod.nav}</span>${mod.desc ? `<span class="d">${mod.desc}</span>` : ''}</a>`).join('')}
  </div>`
function openMenu(open) {
  menu.hidden = !open
  menuBtn.setAttribute('aria-expanded', String(open))
  lockScroll(open)
  if (open) {
    gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.4 })
    gsap.from(menu.querySelectorAll('a'), { y: 24, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.025 })
    menu.querySelector('a.is-current, a')?.focus({ preventScroll: true })
  }
}
menuBtn.addEventListener('click', () => openMenu(menu.hidden))
menu.querySelector('.chapter-menu__close').addEventListener('click', () => openMenu(false))
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) openMenu(false) })

// 页内跳转统一走平滑滚动：任何元素加 data-jump="#id" 即可
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-jump]')
  if (!a) return
  e.preventDefault()
  if (!menu.hidden) openMenu(false)
  const target = a.dataset.jump
  if (a.dataset.level) setLevel(a.dataset.level)
  setTimeout(() => scrollToTarget(target), !menu.hidden ? 0 : 30)
})

/* ---------------- 滚动：进度条、顶栏、章节氛围 ---------------- */
const progress = topbar.querySelector('.topbar__progress')
const chapLabel = topbar.querySelector('.topbar__chapter')
let lastY = 0
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate: (self) => {
    progress.style.transform = `scaleX(${self.progress})`
    const y = self.scroll()
    topbar.classList.toggle('is-scrolled', y > 40)
    lastY = y
  },
})
chapters.forEach(({ mod, el, num }) => {
  ScrollTrigger.create({
    trigger: el, start: 'top 55%', end: 'bottom 55%',
    onToggle: (self) => {
      if (!self.isActive) return
      setBaseMood(mod.mood || 'calm')
      chapLabel.querySelector('.n').textContent = num
      chapLabel.querySelector('.t').textContent = num ? mod.nav : ''
      menu.querySelectorAll('a').forEach((a) => a.classList.toggle('is-current', a.dataset.jump === `#${mod.id}`))
    },
  })
})

/* ---------------- 启动 ---------------- */
setLevel(localStorage.getItem(LEVEL_KEY) === 'pro' ? 'pro' : 'newbie', { silent: true })
bindSfxDelegation()
enhanceCodeBlocks(document)
reveal(document)
setBaseMood('calm')
initSmoothScroll()
async function boot() {
  // 等字体就绪再开场，避免标题闪动（最多等 1.5 秒）
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))])
  // 阅读优先：直接进入手册，声音由顶部按钮主动开启。
  const sound = false
  audio.disable()
  syncSound(audio.isOn())
  lockScroll(false)
  ScrollTrigger.refresh()
  bus.emit('start', { sound })
  // 字体、图片、后挂载内容会改变页面高度，高度变化后刷新滚动触发点
  let rt
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 250) }).observe(main)
}
boot()

// 开发时方便调试
if (import.meta.env.DEV) window.__audio = audio

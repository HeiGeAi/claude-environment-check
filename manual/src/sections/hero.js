// ============================================================
// 封面：原生 WebGL 光流 + 逐字升起的标题
// 画面含义：暖金光流 = 受控路线，全部汇入同一扇发光的门（固定出口）；
// 少数红色光流想从旁边溜走，半路撞上一道看不见的墙，熄灭。
// 入场节奏与 opening.js 配合：start 事件后先点亮光门，约 0.9 秒后标题升起。
// ============================================================
import './hero.css'
import { createGateRenderer } from '../core/gate-renderer.js'
import { gsap, ScrollTrigger, whenVisible, magnetic, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { bus } from '../core/ui.js'

const LINES = [
  { text: '让每一个请求，', warm: [] },
  { text: '都只走那扇对的门。', warm: [3, 8] }, // 「那扇对的门」
]

/* ---------------- 夜色小城的剪影（细线 + 几扇亮着的窗） ---------------- */
function skyline() {
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  const W = 1600
  const H = 180
  let x = -10
  let body = ''
  let wins = ''
  while (x < W) {
    const bw = 46 + rnd() * 90
    const bh = 36 + rnd() * 110
    const top = H - bh
    const roof = rnd()
    if (roof < 0.34) {
      body += `M${x} ${H}V${top + 16}L${x + bw / 2} ${top - 10}L${x + bw} ${top + 16}V${H}`
    } else if (roof < 0.5) {
      body += `M${x} ${H}V${top}H${x + bw * 0.62}V${top - 22}H${x + bw * 0.8}V${top}H${x + bw}V${H}`
    } else {
      body += `M${x} ${H}V${top}H${x + bw}V${H}`
    }
    const cols = Math.max(1, Math.floor(bw / 22))
    const rows = Math.max(1, Math.floor((bh - 26) / 24))
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rnd() > 0.16) continue
        const wx = x + 10 + c * ((bw - 20) / cols)
        const wy = top + 20 + r * 24
        wins += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="7" height="9" rx="1.5" style="--d:${(rnd() * 6).toFixed(2)}s"/>`
      }
    }
    x += bw + 4 + rnd() * 16
  }
  return `<svg class="s-hero__city" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <path class="s-hero__city-line" d="${body}"/>
    <g class="s-hero__city-win">${wins}</g>
  </svg>`
}

function titleHTML() {
  return LINES.map(({ text, warm }) => {
    const chars = [...text]
    const [ws, we] = warm.length ? warm : [-1, -2]
    const n = we - ws
    const spans = chars.map((ch, i) => {
      const isWarm = i >= ws && i < we
      const style = isWarm && n > 1 ? ` style="background-position:${((i - ws) / (n - 1)) * 100}% 0;background-size:${n * 100}% 100%"` : ''
      return `<span class="s-hero__ch${isWarm ? ' is-warm' : ''}"${style}>${ch}</span>`
    }).join('')
    return `<span class="s-hero__line" aria-hidden="true"><span class="s-hero__line-in">${spans}</span></span>`
  }).join('')
}

const ICON = {
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.3 6.4a8 8 0 0 1 0 11.2"/></svg>',
  level: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="16" cy="12" r="2.6"/></svg>',
}

export default {
  id: 'hero',
  nav: '封面',
  desc: '',
  mood: 'calm',
  mount(el) {
    el.innerHTML = `
      <div class="s-hero__bg" aria-hidden="true">
        <div class="s-hero__fallback"><i class="s-hero__fb-door"></i></div>
        <canvas class="s-hero__gl"></canvas>
        ${skyline()}
        <div class="s-hero__shade"></div>
      </div>
      <div class="s-hero__door" aria-hidden="true">
        <span class="s-hero__door-tag"><i></i>受控出口<em>固定的快递代收点</em></span>
      </div>
      <div class="s-hero__content">
        <div class="wrap s-hero__wrap">
          <p class="s-hero__kicker"><span class="latin">Field Guide</span><span class="s-hero__bar"></span><span>Claude 防封指南 · 小白图解版</span></p>
          <h1 class="s-hero__title" tabindex="-1" aria-label="让每一个请求，都只走那扇对的门。">${titleHTML()}</h1>
          <p class="s-hero__sub">从零开始，用比喻和动画看懂：电脑为什么会「露馅」，哪些环节你能自己把好关。</p>
          <ul class="s-hero__meta">
            <li>${ICON.clock}约 15 分钟</li>
            <li>${ICON.sound}有声音</li>
            <li>${ICON.level}可切换进阶模式</li>
          </ul>
          <div class="s-hero__actions">
            <a class="btn btn--primary s-hero__go" href="#truth" data-jump="#truth" data-sfx="click">开始旅程 <span class="arrow" aria-hidden="true">↓</span></a>
            <a class="btn btn--ghost" href="#build" data-jump="#build" data-level="pro" data-sfx="click">我懂技术，直接看配置</a>
          </div>
          <div class="s-hero__foot">
            <p class="s-hero__credit">改编自「智能体先锋队」《Claude 防护方法手册 · 本机实战版 v3.0》（2026.09.26）</p>
            <ul class="s-hero__legend" aria-label="背景动画说明">
              <li><i class="is-gold"></i>暖金光流：受控路线，都汇入同一扇门</li>
              <li><i class="is-red"></i>红色光流：想绕路直连，半路被拦下</li>
              <li class="s-hero__demo">背景为示意动画</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="s-hero__cue" aria-hidden="true"><span>向下滚动</span><i></i></div>`

    const canvas = el.querySelector('.s-hero__gl')
    const inner = el.querySelector('.s-hero__wrap')
    const chars = el.querySelectorAll('.s-hero__line-in')
    const lateEls = el.querySelectorAll('.s-hero__kicker, .s-hero__sub, .s-hero__meta, .s-hero__actions, .s-hero__foot')
    const decoEls = el.querySelectorAll('.s-hero__door-tag, .s-hero__cue')
    magnetic(el.querySelector('.s-hero__go'), 0.22)

    /* ---------- 状态 ---------- */
    const S = {
      doorX: 0, doorY: 0, L: 1, time: 3.2,
      mx: -9999, my: -9999, mouseOn: 0, mouseTarget: 0,
      intro: 0, glow: 0, scroll: 0, scrollTarget: 0,
      scale: 1, dx: 0.74, dy: 0.4,
    }
    let started = false
    let running = false
    let visible = true
    let raf = 0

    const renderer = createGateRenderer(canvas)
    if (!renderer) el.classList.add('is-nogl')
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); el.classList.add('is-nogl') })

    /* ---------- 尺寸：DPR 上限 1.75，按像素预算降采样 ---------- */
    let budget = 1.6e6
    function layout() {
      const w = el.clientWidth
      const h = el.clientHeight
      const vh = Math.min(h, window.innerHeight || h)
      const wide = w >= 900
      const Lcss = Math.min(w * 1.25, vh)
      S.dx = wide ? 0.745 : 0.5
      // 门的纵向位置按视口算（窄屏的封面可以比一屏高，门仍留在首屏上部）
      const doorTop = wide ? vh * 0.4 : Math.max(150, vh * (vh / w > 1.5 ? 0.23 : 0.27))
      S.dy = doorTop / h
      el.style.setProperty('--door-x', `${S.dx * 100}%`)
      el.style.setProperty('--door-y', `${doorTop.toFixed(1)}px`)
      el.style.setProperty('--door-bottom', `${(doorTop + 0.15 * Lcss + 30).toFixed(1)}px`) // 门下沿 + 标签
      el.style.setProperty('--door-w', `${(0.26 * Lcss).toFixed(1)}px`)
      el.style.setProperty('--door-h', `${(0.3 * Lcss).toFixed(1)}px`)
      el.style.setProperty('--door-L', `${Lcss.toFixed(1)}px`)
      if (!renderer) return
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      S.scale = Math.min(dpr, Math.sqrt(budget / Math.max(1, w * h)))
      const cw = Math.max(2, Math.round(w * S.scale))
      const ch = Math.max(2, Math.round(h * S.scale))
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch }
      S.L = Lcss * S.scale
      S.doorX = S.dx * cw
      S.doorY = (1 - S.dy) * ch
      if (!running) renderer.draw(S)
    }
    const ro = new ResizeObserver(layout)
    ro.observe(el)
    layout()

    /* ---------- 循环：仅在开场后、可见时运行 ---------- */
    let last = 0
    let slowFrames = 0
    let frames = 0
    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
      last = now
      S.time += dt
      S.scroll += (S.scrollTarget - S.scroll) * Math.min(1, dt * 6)
      S.mouseOn += (S.mouseTarget - S.mouseOn) * Math.min(1, dt * 4)
      renderer.draw(S)
      // 集显保护：连续慢帧就降低渲染分辨率
      frames++
      if (frames > 20) slowFrames = dt > 0.026 ? slowFrames + 1 : Math.max(0, slowFrames - 1)
      if (slowFrames > 45 && budget > 4e5) { budget *= 0.6; slowFrames = 0; layout() }
    }
    function start() {
      if (running || !renderer || prefersReduced || !started || !visible) return
      running = true
      last = 0
      raf = requestAnimationFrame(frame)
    }
    function stop() {
      running = false
      cancelAnimationFrame(raf)
    }
    whenVisible(el, () => { visible = true; start() }, () => { visible = false; stop() }, '0px')
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start() })

    /* ---------- 指针 ---------- */
    el.addEventListener('pointermove', (e) => {
      if (!renderer || prefersReduced) return
      const r = canvas.getBoundingClientRect()
      S.mx = (e.clientX - r.left) * S.scale
      S.my = (r.bottom - e.clientY) * S.scale
      S.mouseTarget = e.pointerType === 'touch' ? 0.7 : 1
    })
    el.addEventListener('pointerleave', () => { S.mouseTarget = 0 })

    /* ---------- 初始态：开场前全部隐藏 ---------- */
    if (!prefersReduced) {
      gsap.set(chars, { yPercent: 115 })
      gsap.set(lateEls, { y: 26, opacity: 0 })
      gsap.set(decoEls, { opacity: 0 })
    }

    /* ---------- 入场 ---------- */
    bus.on('start', () => {
      if (started) return
      started = true
      if (prefersReduced) {
        S.intro = 1; S.glow = 1
        renderer?.draw(S)
        return
      }
      start()
      const tl = gsap.timeline()
      // 光门先点亮；约 0.72 秒时开场的小请求正好飞进门里，门闪一下
      tl.to(S, { glow: 1, duration: 0.7, ease: 'power2.out' }, 0.02)
        .to(S, { glow: 1.9, duration: 0.1, ease: 'power2.out' }, 0.72)
        .to(S, { glow: 1, duration: 0.9, ease: 'power2.out' }, 0.82)
        .to(S, { intro: 1, duration: 2.6, ease: 'power2.out' }, 0.25)
        .call(() => audio.sfx('whoosh'), null, 0.9)
        .to(chars, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.12 }, 0.9)
        .to(lateEls, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 1.15)
        .to(decoEls, { opacity: 1, duration: 1.2, ease: 'power2.out', stagger: 0.2 }, 1.8)
    })
    if (prefersReduced) { S.intro = 1; S.glow = 1; S.time = 6; renderer?.draw(S) }

    /* ---------- 滚动：标题视差 + 光流加速汇入 ---------- */
    ScrollTrigger.create({
      trigger: el, start: 'top top', end: 'bottom top',
      onUpdate: (self) => {
        S.scrollTarget = self.progress
        if (prefersReduced && renderer) { S.scroll = self.progress; renderer.draw(S) }
      },
    })
    if (!prefersReduced) {
      gsap.to(inner, { yPercent: -14, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true } })
    }
  },
}

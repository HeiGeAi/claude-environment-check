// 第 14 章 · 流言粉碎机
// 招牌：点击卡片，从点击处裂开成真实的碎片（DOM 克隆 + clip-path 多边形），带重力与三维旋转飞散，露出真相
import './myths.css'
import { gsap, reveal, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { mascot } from '../core/mascot.js'

const svg = (d, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const HAMMER = '<path d="M14.5 4.5l5 5-2.5 2.5-5-5z"/><path d="M12 7l-8.5 8.5a1.8 1.8 0 0 0 2.5 2.5L14.5 9.5"/>'

// 原版「常见说法 / 应该怎样看」
const MYTHS = [
  { t: '养 3 至 7 天再充值', v: '缺少因果证据', truth: '社区经验，缺少可靠的因果证据。不要把它当作安全保证。' },
  { t: '前 7 天不能访问 Portal', v: '无可靠依据', truth: '没有可靠依据证明，这个时间阈值能防封。' },
  { t: '用量没到黄色就安全', v: '用量不是风控线', truth: '用量界面，不是风控阈值。' },
  { t: '说自己住在出口所在地', v: '只说真实背景', truth: '出口地不等于居住地。只陈述你的真实背景。', more: '时区、语言、屏幕这些字段，同样不能证明真实居住地。' },
  { t: '邮件无痕打开就不泄漏', v: '无痕不隐藏 IP', truth: '无痕模式不隐藏 IP（门牌号）。先确认链接来源和当前网络。' },
  { t: '信任分 100、开训练就免封', v: '没有这样的保证', truth: '没有这样的保证。', more: '检测站的 100 分是那个工具自己的评分，不等于 Anthropic 的内部风控分数。开启模型改进，也没有经过证实的防封作用。' },
]

const HABITS = [
  { h: '本人使用，凭据不外借', p: '账号是你在对方那里的档案。钥匙只在你自己手里。', icon: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2"/>' },
  { h: '重要工作，持续备份', p: '成果随时可以恢复，心里才不慌。', icon: '<path d="M4 7h16v13H4z"/><path d="M4 7l2-3h12l2 3"/><path d="M12 10.5v6M9.5 14l2.5 2.5 2.5-2.5"/>' },
  { h: '遵守限制，变化留记录', p: '遵守产品实际限制。网络和设备有变化，就记下来。', icon: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/><path d="M15 3v3h3"/>' },
]

export default {
  id: 'myths',
  nav: '流言粉碎机',
  desc: '六个常见说法的真相',
  mood: 'calm',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>流言粉碎机</span></div>
        <h2 class="h2" data-reveal="lines">六个流言，<br><span class="text-warm">一敲就碎</span></h2>
        <p class="lead" data-reveal>社区里流传着不少「照做就安全」的说法。点一下卡片把它敲碎，看看背后站不站得住。</p>
      </header>

      <div class="my-bar" data-reveal>
        <div class="my-bar__count">
          <span class="my-bar__mascot" aria-hidden="true">${mascot({ size: 46, face: 'worried' })}</span>
          <span class="my-bar__label">已粉碎</span>
          <span class="my-bar__num" aria-live="polite"><b class="my-n">0</b><span> / ${MYTHS.length}</span></span>
          <span class="my-pips" aria-hidden="true">${MYTHS.map(() => '<i></i>').join('')}</span>
        </div>
        <div class="my-bar__tools">
          <button class="btn btn--ghost btn--xs" type="button" data-act="all">一口气全部敲碎</button>
          <button class="btn btn--ghost btn--xs" type="button" data-act="reset" data-sfx="click" hidden>重新摆好</button>
        </div>
      </div>

      <ul class="my-grid" data-reveal="stagger">
        ${MYTHS.map((m, i) => `
          <li class="my-cell" data-i="${i}">
            <div class="my-truth" aria-hidden="true">
              <div class="my-truth__top">
                <span class="my-truth__k">真相</span>
                <span class="tag tag--warn">${m.v}</span>
              </div>
              <p class="my-truth__t">${m.truth}</p>
              ${m.more ? `<p class="my-truth__more">${m.more}</p>` : ''}
            </div>
            <button class="my-card" type="button" aria-label="流言 ${i + 1}：${m.t}。点击粉碎，查看真相">
              ${faceHTML(m, i)}
            </button>
            <div class="my-fx" aria-hidden="true"></div>
          </li>`).join('')}
      </ul>

      <div class="my-summary" hidden>
        <span class="my-summary__mascot" aria-hidden="true">${mascot({ size: 88, face: 'happy', tint: 'safe' })}</span>
        <div>
          <p class="my-summary__k">六条全部粉碎</p>
          <p class="my-summary__t">它们都在许诺一条「做到就安全」的捷径。原版的态度很明确：<strong>没有这样的保证。</strong></p>
          <p class="muted">账号会不会被限制，由 Anthropic 决定。我们能做的，是把自己能验证的环节做好。</p>
        </div>
      </div>

      <section class="my-habits" aria-labelledby="my-habits-h">
        <h3 class="h3" id="my-habits-h" data-reveal="lines">把精力放在<br><span class="text-warm">可验证的习惯</span>上</h3>
        <ul class="my-habits__list" data-reveal="stagger">
          ${HABITS.map((h) => `
            <li class="my-habit">
              <span class="my-habit__ico">${svg(h.icon, 24)}</span>
              <h4 class="h4">${h.h}</h4>
              <p class="muted">${h.p}</p>
            </li>`).join('')}
        </ul>
        <div class="callout callout--warn my-habits__note" data-reveal>
          <p class="callout__title">${svg('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>', 18)}别从这里推出更多结论</p>
          <p>本人机器上的工具并发、多人共用与转售访问是不同场景，但不能据此推出「任意并发都没问题」。</p>
        </div>
      </section>
    </div>`

    reveal(el)
    initShatter(el)
  },
}

function faceHTML(m, i) {
  return `
    <span class="my-card__top">
      <span class="my-card__n">流言 ${String(i + 1).padStart(2, '0')}</span>
      <span class="my-card__hint">${svg(HAMMER, 16)}点击敲碎</span>
    </span>
    <span class="my-card__q" aria-hidden="true">“</span>
    <span class="my-card__t">${m.t}</span>
    <span class="my-card__src">常听到的说法</span>`
}

/* ============================================================
   碎片引擎：一个共享的 rAF，只在有碎片飞行时运行，飞完即停
   ============================================================ */
const shards = []
let raf = 0
let last = 0
const G = 2400 // 重力 px/s²

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
  last = now
  for (let k = shards.length - 1; k >= 0; k--) {
    const s = shards[k]
    // 以真实流逝时间为准：掉帧的设备也按时收场
    s.t = Math.max(s.t + dt, (now - s.born) / 1000)
    s.vy += G * dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.rz += s.vrz * dt
    s.rx += s.vrx * dt
    s.ry += s.vry * dt
    const fade = s.t < s.life * 0.55 ? 1 : Math.max(0, 1 - (s.t - s.life * 0.55) / (s.life * 0.45))
    s.el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) rotateX(${s.rx.toFixed(1)}deg) rotateY(${s.ry.toFixed(1)}deg) rotate(${s.rz.toFixed(1)}deg) scale(${(1 - s.t * 0.12).toFixed(3)})`
    s.el.style.opacity = fade.toFixed(3)
    if (s.t >= s.life) {
      s.el.remove()
      shards.splice(k, 1)
      if (!s.cell.querySelector('.my-shard')) s.cell.classList.remove('is-flying')
    }
  }
  raf = shards.length ? requestAnimationFrame(tick) : 0
}
function startEngine() {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(tick)
}

// 从点击点 P 发出的射线与矩形边界的交点
function rayHit(px, py, a, w, h) {
  const dx = Math.cos(a), dy = Math.sin(a)
  let t = Infinity
  if (dx > 1e-6) t = Math.min(t, (w - px) / dx)
  if (dx < -1e-6) t = Math.min(t, -px / dx)
  if (dy > 1e-6) t = Math.min(t, (h - py) / dy)
  if (dy < -1e-6) t = Math.min(t, -py / dy)
  return [px + dx * t, py + dy * t]
}

// 径向裂纹：按角度切成楔形，每块再按随机半径切成内外两片
function makePolys(px, py, w, h) {
  const n = 8 + Math.floor(Math.random() * 3)
  const off = Math.random() * Math.PI * 2
  const angles = Array.from({ length: n }, (_, i) => off + ((i + 0.5 + (Math.random() - 0.5) * 0.7) / n) * Math.PI * 2)
  const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => ({ x, y, a: Math.atan2(y - py, x - px) }))
  const norm = (a) => ((a - off) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
  const polys = []
  for (let i = 0; i < n; i++) {
    const a1 = angles[i], a2 = angles[(i + 1) % n] + (i === n - 1 ? Math.PI * 2 : 0)
    const b1 = rayHit(px, py, a1, w, h), b2 = rayHit(px, py, a2, w, h)
    const n1 = norm(a1), n2 = n1 + (a2 - a1)
    const mid = corners
      .map((c) => { let na = norm(c.a); if (na < n1) na += Math.PI * 2; return { ...c, na } })
      .filter((c) => c.na > n1 && c.na < n2)
      .sort((p, q) => p.na - q.na)
      .map((c) => [c.x, c.y])
    const f = 0.28 + Math.random() * 0.34
    const l1 = [px + (b1[0] - px) * f, py + (b1[1] - py) * f]
    const l2 = [px + (b2[0] - px) * f, py + (b2[1] - py) * f]
    polys.push({ pts: [[px, py], l1, l2], inner: true })
    polys.push({ pts: [l1, b1, ...mid, b2, l2], inner: false })
  }
  return { polys, angles }
}

function initShatter(el) {
  const cells = [...el.querySelectorAll('.my-cell')]
  const nEl = el.querySelector('.my-n')
  const pips = [...el.querySelectorAll('.my-pips i')]
  const barMascot = el.querySelector('.my-bar__mascot')
  const summary = el.querySelector('.my-summary')
  const btnAll = el.querySelector('[data-act="all"]')
  const btnReset = el.querySelector('[data-act="reset"]')
  let done = 0
  let face = 'worried'
  const timers = []

  const setFace = (f) => {
    if (f === face) return
    face = f
    barMascot.innerHTML = mascot({ size: 46, face: f, tint: f === 'happy' ? 'safe' : 'warm' })
  }

  const update = () => {
    nEl.textContent = String(done)
    pips.forEach((p, k) => p.classList.toggle('is-on', k < done))
    if (!prefersReduced) gsap.fromTo(nEl, { scale: 1.6, color: '#ffd08a' }, { scale: 1, color: '#f4efe6', duration: 0.7, ease: 'expo.out' })
    btnReset.hidden = done === 0
    btnAll.hidden = done === cells.length
    setFace(done === cells.length ? 'happy' : done > 0 ? 'idle' : 'worried')
    if (done === cells.length) {
      summary.hidden = false
      setTimeout(() => audio.sfx('chord'), 350)
      if (!prefersReduced) {
        gsap.fromTo(summary, { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'expo.out', delay: 0.25 })
        gsap.from(summary.querySelectorAll('.my-summary__k, .my-summary__t, .muted'), { opacity: 0, y: 16, duration: 0.9, ease: 'expo.out', stagger: 0.08, delay: 0.4 })
      }
    }
  }

  const shatter = (cell, cx, cy) => {
    if (cell.classList.contains('is-broken')) return
    cell.classList.add('is-broken')
    const card = cell.querySelector('.my-card')
    const fx = cell.querySelector('.my-fx')
    const truth = cell.querySelector('.my-truth')
    truth.removeAttribute('aria-hidden')
    card.setAttribute('aria-hidden', 'true')
    card.tabIndex = -1
    done++

    if (prefersReduced) {
      card.style.visibility = 'hidden'
      audio.sfx('shatter')
      update()
      return
    }

    const w = card.offsetWidth, h = card.offsetHeight
    const px = Math.max(8, Math.min(w - 8, cx)), py = Math.max(8, Math.min(h - 8, cy))
    const { polys, angles } = makePolys(px, py, w, h)

    // 1) 裂纹：从点击处射出的白线，一闪
    const cracks = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    cracks.setAttribute('class', 'my-cracks')
    cracks.setAttribute('viewBox', `0 0 ${w} ${h}`)
    cracks.setAttribute('width', w)
    cracks.setAttribute('height', h)
    cracks.style.left = `${card.offsetLeft}px`
    cracks.style.top = `${card.offsetTop}px`
    cracks.innerHTML = angles.map((a) => {
      const [bx, by] = rayHit(px, py, a, w, h)
      // 裂纹带一点折线，更像玻璃
      const mx = px + (bx - px) * 0.5 + (Math.random() - 0.5) * 14
      const my = py + (by - py) * 0.5 + (Math.random() - 0.5) * 14
      return `<path d="M${px} ${py} L${mx.toFixed(1)} ${my.toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)}" pathLength="1"/>`
    }).join('') + `<circle cx="${px}" cy="${py}" r="3"/>`
    fx.appendChild(cracks)
    cell.classList.add('is-flying')
    gsap.fromTo(cracks.querySelectorAll('path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.14, ease: 'power2.out', stagger: 0.008 })
    gsap.fromTo(card, { x: 0 }, { keyframes: { x: [-3, 3, -2, 0] }, duration: 0.16 })
    audio.sfx('click')

    // 2) 碎裂：原卡隐藏，换成一片片带真实文字的克隆碎片
    const t = setTimeout(() => {
      card.style.visibility = 'hidden'
      cracks.remove()
      audio.sfx('shatter')
      const html = card.innerHTML
      const baseL = card.offsetLeft, baseT = card.offsetTop
      polys.forEach(({ pts, inner }) => {
        const d = document.createElement('div')
        d.className = 'my-shard'
        d.innerHTML = `<div class="my-card my-card--clone">${html}</div>`
        d.style.cssText = `left:${baseL}px;top:${baseT}px;width:${w}px;height:${h}px;clip-path:polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`
        const gx = pts.reduce((s, p) => s + p[0], 0) / pts.length
        const gy = pts.reduce((s, p) => s + p[1], 0) / pts.length
        d.style.transformOrigin = `${gx.toFixed(1)}px ${gy.toFixed(1)}px`
        fx.appendChild(d)
        let dx = gx - px, dy = gy - py
        const len = Math.hypot(dx, dy) || 1
        dx /= len; dy /= len
        const sp = (inner ? 180 : 320) + Math.random() * 420
        shards.push({
          el: d, cell, t: 0, born: performance.now(), life: 1.05 + Math.random() * 0.5,
          x: 0, y: 0,
          vx: dx * sp + (Math.random() - 0.5) * 120,
          vy: dy * sp * 0.8 - 380 - Math.random() * 260,
          rz: 0, rx: 0, ry: 0,
          vrz: (Math.random() - 0.5) * 720,
          vrx: (Math.random() - 0.5) * 540,
          vry: (Math.random() - 0.5) * 540,
        })
      })
      startEngine()

      // 3) 闪光 + 真相浮现
      const flash = document.createElement('i')
      flash.className = 'my-flash'
      flash.style.left = `${baseL + px}px`
      flash.style.top = `${baseT + py}px`
      fx.appendChild(flash)
      gsap.fromTo(flash, { scale: 0.2, opacity: 0.9 }, { scale: 3.2, opacity: 0, duration: 0.6, ease: 'expo.out', onComplete: () => flash.remove() })
      gsap.fromTo(truth, { opacity: 0, scale: 0.92, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', delay: 0.08, clearProps: 'filter' })
      gsap.from(truth.querySelectorAll('.my-truth__top, .my-truth__t, .my-truth__more'), { y: 14, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07, delay: 0.16 })
      setTimeout(() => audio.sfx('reveal'), 260)
      update()
    }, 150)
    timers.push(t)
  }

  cells.forEach((cell) => {
    const card = cell.querySelector('.my-card')
    card.addEventListener('click', (e) => {
      const r = card.getBoundingClientRect()
      const kb = e.detail === 0 || (e.clientX === 0 && e.clientY === 0)
      const cx = kb ? r.width / 2 : e.clientX - r.left
      const cy = kb ? r.height / 2 : e.clientY - r.top
      shatter(cell, cx, cy)
    })
  })

  btnAll.addEventListener('click', () => {
    audio.sfx('click')
    const left = cells.filter((c) => !c.classList.contains('is-broken'))
    left.forEach((cell, k) => {
      timers.push(setTimeout(() => {
        const card = cell.querySelector('.my-card')
        shatter(cell, card.offsetWidth * (0.35 + Math.random() * 0.3), card.offsetHeight * (0.35 + Math.random() * 0.3))
      }, k * (prefersReduced ? 0 : 230)))
    })
  })

  btnReset.addEventListener('click', () => {
    timers.splice(0).forEach(clearTimeout)
    for (let k = shards.length - 1; k >= 0; k--) { if (el.contains(shards[k].el)) { shards[k].el.remove(); shards.splice(k, 1) } }
    done = 0
    summary.hidden = true
    cells.forEach((cell, k) => {
      cell.classList.remove('is-broken', 'is-flying')
      cell.querySelector('.my-fx').innerHTML = ''
      const card = cell.querySelector('.my-card')
      const truth = cell.querySelector('.my-truth')
      truth.setAttribute('aria-hidden', 'true')
      card.removeAttribute('aria-hidden')
      card.tabIndex = 0
      card.style.visibility = ''
      gsap.set(truth, { clearProps: 'all' })
      if (!prefersReduced) gsap.fromTo(card, { opacity: 0, y: -30, rotate: (k % 2 ? 3 : -3) }, { opacity: 1, y: 0, rotate: 0, duration: 0.9, ease: 'expo.out', delay: k * 0.06, clearProps: 'transform,opacity' })
    })
    update()
    audio.sfx('pop')
  })
}

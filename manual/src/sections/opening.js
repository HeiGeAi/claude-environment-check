// ============================================================
// 开场闸门：全屏遮罩 + 呼吸的小请求 + 两个入口
// mountOpening(root) → Promise<{ sound: boolean }>
//
// 转场设计（与 hero.js 的入场节奏配合）：
//   0.00s 点击：UI 退场，小请求开心地蹲一下再蹦起来（pop）
//   0.25s resolve：main 发出 start，封面的光门开始点亮
//   0.30s 遮罩在封面光门的位置开一个小洞，露出正在点亮的门
//   0.45s 小请求沿弧线飞进这扇门，身后拖着光尾
//   0.98s 进门（reveal），光圈从门口扩散，揭开整张封面
//   2.20s 移除遮罩
// ============================================================
import './opening.css'
import { gsap, prefersReduced, isTouch } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { mascot } from '../core/mascot.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** 遮罩上的光粒：绕着小请求慢慢转，点击后被吸进它身体里 */
function createMotes(canvas, getCenter) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { stop() {}, suck() {} }
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  let w = 0
  let h = 0
  let raf = 0
  let alive = true
  const state = { suck: 0, fade: 1 }

  // 预渲染一颗发光粒子
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 64
  const sg = sprite.getContext('2d')
  const grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,241,214,1)')
  grad.addColorStop(0.18, 'rgba(255,192,112,.85)')
  grad.addColorStop(0.5, 'rgba(255,122,82,.18)')
  grad.addColorStop(1, 'rgba(255,122,82,0)')
  sg.fillStyle = grad
  sg.fillRect(0, 0, 64, 64)

  const count = window.innerWidth < 700 ? 38 : 64
  const motes = Array.from({ length: count }, (_, i) => ({
    a: Math.random() * Math.PI * 2,
    r: 0.22 + Math.random() * 0.78,
    s: (0.02 + Math.random() * 0.05) * (i % 2 ? 1 : -1),
    z: 0.4 + Math.random() * 1.2,
    ph: Math.random() * Math.PI * 2,
    tw: 0.6 + Math.random() * 1.6,
  }))

  function resize() {
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  resize()
  window.addEventListener('resize', resize)

  let last = performance.now()
  let t = 0
  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    const c = getCenter()
    const R = Math.max(w, h) * 0.62
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    const k = state.suck
    for (const m of motes) {
      m.a += m.s * dt * (1 + k * 6)
      const rr = m.r * R * (1 - k) + 6 * k
      const x = c.x + Math.cos(m.a) * rr
      const y = c.y + Math.sin(m.a) * rr * 0.78
      const tw = 0.55 + 0.45 * Math.sin(t * m.tw + m.ph)
      const size = (3 + m.z * 5) * (1 - k * 0.6)
      ctx.globalAlpha = Math.min(1, (0.18 + 0.55 * tw) * (0.35 + m.z * 0.4) * state.fade * (1 - m.r * 0.35))
      ctx.drawImage(sprite, x - size, y - size, size * 2, size * 2)
    }
    ctx.globalAlpha = 1
    if (alive && !prefersReduced) raf = requestAnimationFrame(draw)
  }
  raf = requestAnimationFrame(draw)

  return {
    state,
    stop() {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    },
  }
}

/** 找到封面光门的中心；找不到或不在视口里时用屏幕中心 */
function doorTarget() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const el = document.querySelector('.s-hero__door')
  if (el) {
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    if (r.width > 0 && x > 0 && x < vw && y > 0 && y < vh) {
      return { x, y, r: Math.max(44, Math.min(130, Math.max(r.width, r.height) * 0.56)) }
    }
  }
  return { x: vw / 2, y: vh / 2, r: 80 }
}

export function mountOpening(root) {
  return new Promise((resolve) => {
    const brk = window.innerWidth < 640 ? '<br>' : ''
    root.innerHTML = `
      <div class="og" role="dialog" aria-modal="true" aria-labelledby="og-title" aria-describedby="og-sub">
        <div class="og__veil">
          <canvas class="og__motes" aria-hidden="true"></canvas>
          <div class="og__stage">
            <div class="og__portal" aria-hidden="true">
              <svg class="og__orbits" viewBox="-200 -200 400 400">
                <circle class="og__orbit og__orbit--a" r="118" />
                <circle class="og__orbit og__orbit--b" r="164" />
                <g class="og__sat og__sat--a"><circle cx="118" cy="0" r="3.2" /></g>
                <g class="og__sat og__sat--b"><circle cx="-164" cy="0" r="2.4" /></g>
              </svg>
              <span class="og__wave"></span><span class="og__wave"></span><span class="og__wave"></span>
              <div class="og__slot"></div>
            </div>
            <p class="og__kicker"><span class="latin">Field Guide</span><span class="og__bar"></span><span>Claude 防封指南 · 小白图解版</span></p>
            <h1 class="og__title" id="og-title"><span class="og__line"><span>一份会动、${brk}也会发声的小白指南</span></span></h1>
            <p class="og__sub" id="og-sub">建议戴上耳机，音量调到舒适</p>
            <div class="og__actions">
              <button type="button" class="btn btn--primary og__btn" data-choice="sound">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.3 6.4a8 8 0 0 1 0 11.2"/></svg>
                开启声音，进入
              </button>
              <button type="button" class="btn btn--ghost og__btn" data-choice="mute">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 10l4 4M20 10l-4 4"/></svg>
                安静地看
              </button>
            </div>
            ${isTouch ? '<p class="og__hint">进入后，右上角随时可以开关声音</p>' : '<p class="og__hint"><kbd>回车</kbd>开启声音<span class="og__dot"></span><kbd>Esc</kbd>安静地看<span class="og__dot"></span>右上角随时可以开关</p>'}
          </div>
        </div>
        <div class="og__fly" aria-hidden="true">
          <i class="og__ring"></i>
          <i class="og__trail"></i><i class="og__trail"></i><i class="og__trail"></i>
          <div class="og__hero">
            <div class="og__face og__face--idle">${mascot({ size: 184, face: 'idle' })}</div>
            <div class="og__face og__face--happy">${mascot({ size: 184, face: 'happy' })}</div>
          </div>
        </div>
      </div>`

    const og = root.querySelector('.og')
    const veil = og.querySelector('.og__veil')
    const slot = og.querySelector('.og__slot')
    const hero = og.querySelector('.og__hero')
    const ring = og.querySelector('.og__ring')
    const trails = [...og.querySelectorAll('.og__trail')]
    const btnSound = og.querySelector('[data-choice="sound"]')
    const btnMute = og.querySelector('[data-choice="mute"]')
    const buttons = [btnSound, btnMute]

    // 小请求放在不受遮罩影响的飞行层里，位置跟随舞台上的占位槽
    gsap.set([hero, ring, ...trails], { xPercent: -50, yPercent: -50 })
    const place = () => {
      const r = slot.getBoundingClientRect()
      gsap.set(hero, { left: r.left + r.width / 2, top: r.top + r.height / 2 })
    }
    place()
    window.addEventListener('resize', place)

    const center = () => {
      const r = hero.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const motes = createMotes(og.querySelector('.og__motes'), center)

    // 眼睛跟着指针看：把眼睛包进一层可平移的 <g>，不和眨眼动画打架
    const lookers = [...hero.querySelectorAll('.mascot__eyes')].map((eyes) => {
      const g = document.createElementNS(SVG_NS, 'g')
      eyes.parentNode.insertBefore(g, eyes)
      g.appendChild(eyes)
      return g
    })
    const look = { x: 0, y: 0 }
    const applyLook = () => lookers.forEach((g) => g.setAttribute('transform', `translate(${look.x.toFixed(2)} ${look.y.toFixed(2)})`))
    const onMove = (e) => {
      if (prefersReduced) return
      const c = center()
      const dx = e.clientX - c.x
      const dy = e.clientY - c.y
      const d = Math.hypot(dx, dy) || 1
      const k = Math.min(1, d / 260)
      gsap.to(look, { x: (dx / d) * 5 * k, y: (dy / d) * 4 * k, duration: 0.5, ease: 'power3.out', onUpdate: applyLook, overwrite: true })
    }
    window.addEventListener('pointermove', onMove)

    // 悬停 / 聚焦主按钮：开心脸 + 声波；悬停静音：安静呼吸
    const setIntent = (kind) => {
      og.classList.toggle('is-sound', kind === 'sound')
      og.classList.toggle('is-mute', kind === 'mute')
    }
    btnSound.addEventListener('pointerenter', () => setIntent('sound'))
    btnSound.addEventListener('focus', () => setIntent('sound'))
    btnMute.addEventListener('pointerenter', () => setIntent('mute'))
    btnMute.addEventListener('focus', () => setIntent('mute'))

    // 入场
    let intro = null
    const introEls = og.querySelectorAll('.og__kicker, .og__sub, .og__actions, .og__hint')
    if (!prefersReduced) {
      intro = gsap.timeline({ defaults: { ease: 'expo.out' } })
      intro
        .from(og.querySelector('.og__orbits'), { scale: 0.6, opacity: 0, rotate: -40, duration: 1.6 }, 0)
        .from(hero, { scale: 0.4, opacity: 0, duration: 1.3, ease: 'elastic.out(1, 0.55)' }, 0.1)
        .from(og.querySelector('.og__line > span'), { yPercent: 110, opacity: 0, duration: 1.2 }, 0.28)
        .from(introEls, { y: 22, opacity: 0, duration: 1, stagger: 0.08 }, 0.36)
    }

    // 焦点：默认落在主按钮，Tab 只在两个按钮间循环
    btnSound.focus({ preventScroll: true })
    setIntent('sound')

    let done = false
    const onKey = (e) => {
      if (done) return
      if (e.key === 'Tab') {
        e.preventDefault()
        const i = buttons.indexOf(document.activeElement)
        const next = buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length] || btnSound
        next.focus()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        choose(false, { gesture: false })
      } else if (e.key === 'Enter' && !buttons.includes(document.activeElement)) {
        // 焦点不在按钮上时，回车 = 开启声音；在按钮上时交给按钮自己的点击
        e.preventDefault()
        choose(true)
      }
    }
    document.addEventListener('keydown', onKey)

    btnSound.addEventListener('click', () => { audio.unlock(); choose(true) })
    btnMute.addEventListener('click', () => { audio.unlock(); choose(false) })

    function cleanup() {
      motes.stop()
      window.removeEventListener('resize', place)
      window.removeEventListener('pointermove', onMove)
      gsap.killTweensOf(look)
      root.innerHTML = ''
      // 键盘用户落到封面标题上，从头开始读
      document.querySelector('#hero h1')?.focus({ preventScroll: true })
    }

    function choose(sound, { gesture = true } = {}) {
      // 浏览器只允许在用户手势里启动声音，放在最前面（Esc 不算手势，静音也用不到声音，跳过）
      if (gesture) audio.unlock()
      if (done) return
      done = true
      document.removeEventListener('keydown', onKey)
      if (sound) audio.enable()
      og.classList.add('is-leaving')
      og.classList.toggle('is-sound', sound)
      og.classList.toggle('is-mute', !sound)
      og.setAttribute('aria-hidden', 'true')
      intro?.progress(1).kill()

      if (prefersReduced) {
        resolve({ sound })
        gsap.to(og, { opacity: 0, duration: 0.35, ease: 'power1.out', onComplete: cleanup })
        return
      }

      const target = doorTarget()
      const from = center()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const maxR = Math.hypot(Math.max(target.x, vw - target.x), Math.max(target.y, vh - target.y)) + 40
      const hole = { r: 0 }
      const setHole = () => {
        veil.style.setProperty('--hr', `${hole.r.toFixed(1)}px`)
        gsap.set(ring, { width: hole.r * 2, height: hole.r * 2 })
      }
      veil.style.setProperty('--hx', `${target.x}px`)
      veil.style.setProperty('--hy', `${target.y}px`)
      gsap.set(ring, { left: target.x, top: target.y, opacity: 0 })
      setHole()

      const dx = target.x - from.x
      const dy = target.y - from.y
      const tl = gsap.timeline({ onComplete: cleanup })
      tl
        // UI 退场
        .to(og.querySelectorAll('.og__kicker, .og__title, .og__sub, .og__actions, .og__hint'), { y: 18, opacity: 0, filter: 'blur(6px)', duration: 0.45, ease: 'power3.in', stagger: 0.03 }, 0)
        .to(og.querySelector('.og__orbits'), { scale: 1.25, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0)
        // 蹲一下，蹦起来
        .to(hero, { scaleX: 1.1, scaleY: 0.86, duration: 0.16, ease: 'power2.out' }, 0)
        .call(() => audio.sfx('pop'), null, 0.16)
        .to(hero, { scaleX: 1, scaleY: 1, y: -26, duration: 0.3, ease: 'power2.out' }, 0.16)
        .to(motes.state, { suck: 1, duration: 0.75, ease: 'power3.in' }, 0.12)
        .to(motes.state, { fade: 0, duration: 0.3 }, 0.7)
        // 通知封面开始点亮
        .call(() => resolve({ sound }), null, 0.25)
        // 门口先开一个小洞
        .to(hole, { r: target.r, duration: 0.7, ease: 'expo.out', onUpdate: setHole }, 0.3)
        .to(ring, { opacity: 1, duration: 0.3 }, 0.3)
        // 飞进门里：水平先慢后快，垂直走一条向上的弧
        .to(hero, { x: dx, duration: 0.56, ease: 'power3.in' }, 0.44)
        .to(hero, { keyframes: { y: [-26, -26 - Math.min(120, Math.abs(dx) * 0.18 + 40), dy], easeEach: 'sine.inOut' }, duration: 0.56, ease: 'power2.in' }, 0.44)
        .to(hero, { scale: 0.16, duration: 0.56, ease: 'power3.in' }, 0.44)
        .to(hero, { opacity: 0, duration: 0.12 }, 0.9)
        // 进门的一瞬：光圈扩散，揭开封面
        .call(() => audio.sfx('reveal'), null, 0.96)
        .to(ring, { scale: 1.07, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.94)
        .to(hole, { r: maxR, duration: 1.2, ease: 'power3.inOut', onUpdate: setHole }, 1.02)
        .to(ring, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 1.62)

      // 光尾：几颗越来越淡的残影追着小请求
      trails.forEach((tr, i) => {
        const lag = 0.035 * (i + 1)
        gsap.set(tr, { left: from.x, top: from.y - 26, opacity: 0 })
        tl.to(tr, { opacity: 0.55 - i * 0.14, duration: 0.1 }, 0.44 + lag)
          .to(tr, { left: target.x, duration: 0.56, ease: 'power3.in' }, 0.44 + lag)
          .to(tr, { keyframes: { top: [from.y - 26, from.y - 26 - Math.min(120, Math.abs(dx) * 0.18 + 40), target.y], easeEach: 'sine.inOut' }, duration: 0.56, ease: 'power2.in' }, 0.44 + lag)
          .to(tr, { scale: 0.2, duration: 0.56, ease: 'power3.in' }, 0.44 + lag)
          .to(tr, { opacity: 0, duration: 0.12 }, 0.9 + lag)
      })
    }
  })
}

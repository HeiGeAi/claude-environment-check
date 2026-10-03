// 08 · 读懂检测报告
// 招牌：左侧原图像一台「镜头」，右侧每滚到一步，镜头推近到对应区域，其余压暗并编号标记。
// 手机端：同一台镜头 + 下方横滑卡片，图上有编号热点。
import './report.css'
import reportImg from '../assets/report.webp'
import { gsap, ScrollTrigger, reveal, onEnter, prefersReduced, scrollToTarget, lockScroll, countUp } from '../core/motion.js'
import { audio } from '../core/audio.js'

const IMG_W = 1312
const IMG_H = 1920
const DESK = '(min-width: 900px)'

// 区域坐标按原图像素（x, y, w, h），已对照原图校准
const REGIONS = [
  {
    name: '三种出口探针', short: '出口探针', r: [18, 197, 1258, 188],
    see: '并排三格：「中国出口 IPv4」「Cloudflare 出口 IP」「Claude AI 出口 IP」。地址和归属地已遮挡。',
    mean: '三格是检测站自己派出的三个探针，各看一个出口。拿它来比对：路径和你预期的一样吗？别把「中国出口」这一格，当成 Anthropic 收到的来源地址。',
    tip: '分享截图时，哪怕只露出部分 IP 和归属地，也要遮住。',
  },
  {
    name: '信任评分', short: '信任评分', r: [18, 416, 405, 407],
    see: '分数 100，标签「极度纯净」；Claude 支持地区显示「正常」。',
    mean: '这是这个检测工具自己的评分和数据库标签。分数越高，只说明在它的口径里越好。',
    tip: '它不等于 Anthropic 的内部风控分数，也不保证免封。',
  },
  {
    name: '出口属性', short: '出口属性', r: [445, 416, 404, 407],
    see: 'IP 属性一栏标着「家庭住宅 IP」（ISP）。地区、城市、ASN 和运营商已遮挡。',
    mean: '检测站把这个出口归为住宅属性。只凭一个标签，下不了结论。',
    tip: '还要核对实际服务、出口稳定性，以及是否一直走同一条路径。',
  },
  {
    name: 'IP 安全检测', short: '安全检测', r: [871, 416, 405, 407],
    see: 'VPN、代理、Tor 都显示「未检测到」；机器人：否；滥用记录：无记录。',
    mean: '「未检测到」的意思是：这个工具没认出来。你正在走代理时，也可能看到这些标签。',
    tip: '所以别把它理解成「没有代理」。',
  },
  {
    name: '可用性', short: '可用性', r: [18, 855, 405, 284],
    see: 'claude.ai「良好」，anthropic.com「较慢」，Claude 服务状态「全部服务正常」。后面的毫秒数是当时的耗时。',
    mean: '这是检测那一刻能不能连上、要等多久。它和账号状态无关。',
    tip: '它也代替不了演练：代理掉线时包裹会不会被拦住，要另外测。',
  },
  {
    name: 'DNS 与 WebRTC', short: 'DNS · WebRTC', r: [445, 855, 831, 284],
    see: 'DNS 泄露检测：「未检测到泄露」。WebRTC 一栏：「WebRTC 已禁用或无泄露」。',
    mean: 'DNS 是查地址用的电话簿，WebRTC 是浏览器里的对讲机。注意那个「或」字：检测页没有区分「对讲机被关掉了」和「这一轮没发现泄漏」。',
    tip: '还要再复核 IPv6（侧门）、UDP、换网和代理失效这几种情况。',
  },
  {
    name: '设备信息', short: '设备信息', r: [18, 1172, 1258, 514],
    see: '时区一致、语言一致、Cookie 已启用；下面还列着 WebGL 渲染器、Canvas 指纹和 WebGL 指纹，具体值已遮住。',
    mean: '这一栏看的是你的长相和笔迹（浏览器指纹），和门牌号（IP）是两回事。检查这些字段稳不稳定就好。',
    tip: '具体设备、版本和指纹值，公开分享时用不上，遮住就好。',
  },
]

const FLOW = [
  { t: '先确认命中', d: '确认专用出口和目标连接都命中了，再打开检测页。', icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>' },
  { t: '记下结果', d: '记录评分、出口属性、DNS / WebRTC 和可用性。', icon: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>' },
  { t: '做反例测试', d: '在受控环境里，做断线、IPv6、新域名这些反例。', icon: '<path d="M12 3.5 21 19.5H3z"/><path d="M12 10v4.2M12 17.2v.1"/>' },
  { t: '留好证据', d: '保存时间、客户端版本、模式和脱敏后的连接证据。', icon: '<path d="M5 4.5h10l4 4v11H5z"/><path d="M15 4.5v4h4"/><path d="m9 14 2.2 2.2L15.5 12"/>' },
]

const pad = (n) => String(n).padStart(2, '0')
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export default {
  id: 'report',
  nav: '读懂检测报告',
  desc: '第三方历史截图，逐项解释',
  mood: 'focus',
  mount(el, { num }) {
    const hotspots = REGIONS.map((g, i) => {
      const [x, y] = g.r
      return `<button class="rp-hot" type="button" data-i="${i + 1}" style="left:${((x + 6) / IMG_W) * 100}%;top:${((y + 6) / IMG_H) * 100}%" aria-label="第 ${i + 1} 块：${g.name}"><span>${i + 1}</span></button>`
    }).join('')

    const ghostOutlines = REGIONS.map((g) => {
      const [x, y, w, h] = g.r
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22"/>`
    }).join('')

    const steps = [
      `<article class="rp-step is-active" data-i="0">
        <div class="rp-step__card rp-step__card--intro">
          <div class="rp-step__num"><span>00</span><i></i><em>全貌</em></div>
          <h3 class="h3">先看整页，一共七块</h3>
          <p class="muted">这是一整页检测结果，从上到下分成七个区域。<span class="rp-desk-only">往下滚，镜头会一块一块推近。</span><span class="rp-mob-only">左右滑动卡片，或点图上的编号，镜头会推近那一块。</span></p>
          <ol class="rp-legend">${REGIONS.map((g, i) => `<li><button type="button" data-go="${i + 1}"><b>${i + 1}</b>${g.short}</button></li>`).join('')}</ol>
        </div>
      </article>`,
      ...REGIONS.map((g, i) => `<article class="rp-step" data-i="${i + 1}">
        <div class="rp-step__card">
          <div class="rp-step__num"><span>${pad(i + 1)}</span><i></i><em>/ 07</em></div>
          <h3 class="h3">${g.name}</h3>
          <dl class="rp-step__dl">
            <div><dt><span class="rp-dot rp-dot--see"></span>图上显示</dt><dd>${g.see}</dd></div>
            <div><dt><span class="rp-dot rp-dot--mean"></span>该怎么理解</dt><dd>${g.mean}</dd></div>
          </dl>
          <p class="rp-step__tip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.6h5v-.6c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3.5z"/><path d="M9.8 20.5h4.4"/></svg><span>${g.tip}</span></p>
        </div>
      </article>`),
    ].join('')

    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head rp-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>读懂检测报告</span></div>
        <h2 class="h2" data-reveal="lines">一张检测截图示例，<br><span class="text-warm">一格一格看懂</span></h2>
        <p class="lead" data-reveal>这是第三方检测工具的历史截图，供理解报告字段。图中的评分与标签属于该工具当时的判断，不代表本项目的检测能力或您当前的环境；地址、归属地、设备值和指纹已经遮挡。</p>
        <div class="metaphor rp-metaphor" data-reveal><span>检测站像站在街口的一位路人，替你看一眼寄出去的包裹贴着什么地址。<strong>它只能说出它自己看到的</strong>，它的打分也不等于 Anthropic 的打分。</span></div>
      </header>

      <div class="rp-stage">
        <div class="rp-figcol">
          <figure class="rp-frame" aria-label="检测页原图（隐私已遮挡）">
            <div class="rp-cam">
              <img class="rp-img" src="${reportImg}" width="${IMG_W}" height="${IMG_H}" alt="Claude AI IP 风险检测页截图（隐私已遮挡）：三种出口探针、信任评分 100、出口属性为家庭住宅 IP、VPN 代理 Tor 均未检测到、可用性、DNS 与 WebRTC 未检测到泄露、设备信息。" decoding="async" draggable="false" />
              <svg class="rp-veil" viewBox="0 0 ${IMG_W} ${IMG_H}" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <mask id="rp-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${IMG_W}" height="${IMG_H}">
                    <rect width="${IMG_W}" height="${IMG_H}" fill="#fff"/>
                    <rect class="rp-hole" x="${IMG_W / 2}" y="${IMG_H / 2}" width="0" height="0" rx="22" fill="#000"/>
                  </mask>
                </defs>
                <rect class="rp-dim" width="${IMG_W}" height="${IMG_H}" fill="#05060a" mask="url(#rp-mask)"/>
                <g class="rp-ghosts">${ghostOutlines}</g>
                <rect class="rp-ring rp-ring--glow" x="${IMG_W / 2}" y="${IMG_H / 2}" width="0" height="0" rx="22"/>
                <rect class="rp-ring" x="${IMG_W / 2}" y="${IMG_H / 2}" width="0" height="0" rx="22"/>
              </svg>
              <div class="rp-hots">${hotspots}</div>
            </div>
            <figcaption class="rp-cap">
              <span class="rp-cap__n">00</span><span class="rp-cap__t">全貌 · 七个区域</span>
            </figcaption>
            <button class="rp-zoom" type="button" data-sfx="open" aria-label="查看完整原图">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span>原图</span>
            </button>
            <div class="rp-mini" aria-hidden="true"><img src="${reportImg}" alt="" draggable="false"/><i class="rp-mini__view"></i></div>
          </figure>
          <p class="rp-figsrc tiny faint">图 · 第三方历史截图示例，隐私信息已遮挡。</p>
        </div>

        <div class="rp-steps-wrap">
          <div class="rp-steps" role="list">${steps}</div>
          <div class="rp-pager rp-mob-only">
            <button type="button" class="rp-pager__btn" data-dir="-1" aria-label="上一块"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg></button>
            <div class="rp-pager__dots">${['00', ...REGIONS.map((_, i) => pad(i + 1))].map((n, i) => `<i data-i="${i}"></i>`).join('')}</div>
            <button type="button" class="rp-pager__btn" data-dir="1" aria-label="下一块"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg></button>
          </div>
        </div>
      </div>
      <p class="visually-hidden rp-live" aria-live="polite"></p>

      <section class="rp-remember" aria-label="两句要记住的话">
        <h3 class="h3 rp-sub" data-reveal="lines">这一章，记住两句话</h3>
        <div class="rp-quotes">
          <div class="rp-quote rp-quote--score" data-reveal="scale">
            <div class="rp-score" aria-hidden="true">
              <svg class="rp-gauge" viewBox="0 0 220 120">
                <defs><linearGradient id="rp-gauge-g" x1="0" x2="1"><stop offset="0" stop-color="#ff4d61"/><stop offset=".5" stop-color="#ffd166"/><stop offset="1" stop-color="#6ff0b8"/></linearGradient></defs>
                <path class="rp-gauge__track" d="M20 110a90 90 0 0 1 180 0"/>
                <path class="rp-gauge__fill" d="M20 110a90 90 0 0 1 180 0" pathLength="100"/>
              </svg>
              <div class="rp-score__val"><span class="rp-score__num">0</span><span class="rp-score__tag">极度纯净</span></div>
              <div class="rp-score__by">这个检测工具的打分</div>
            </div>
            <p class="rp-quote__text">检测站的 100 分，是这个工具自己的打分，<span class="rp-hl">不等于 Anthropic 的内部评分</span>，也不保证免封。</p>
            <ul class="rp-neq" aria-hidden="true">
              <li><b>≠</b><span>Anthropic 内部评分</span></li>
              <li><b>≠</b><span>免封保证</span></li>
            </ul>
          </div>

          <div class="rp-quote rp-quote--ghost" data-reveal="scale">
            <div class="rp-probe" aria-hidden="true">
              <div class="rp-probe__row"><span>代理 (Proxy)</span><b class="rp-pill">未检测到</b></div>
              <svg class="rp-probe__scene" viewBox="0 0 320 150">
                <defs>
                  <radialGradient id="rp-lamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd08a" stop-opacity=".9"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
                  <clipPath id="rp-lens-clip"><circle class="rp-lens-c" cx="70" cy="78" r="40"/></clipPath>
                </defs>
                <path class="rp-ground" d="M0 132h320"/>
                <g class="rp-depot">
                  <circle cx="160" cy="58" r="44" fill="url(#rp-lamp)" class="rp-depot__glow"/>
                  <path d="M118 132V76l42-28 42 28v56"/>
                  <path d="M140 132v-30h40v30"/>
                  <rect x="128" y="82" width="14" height="12" rx="2"/><rect x="178" y="82" width="14" height="12" rx="2"/>
                  <path d="M136 64h48" class="rp-depot__sign"/>
                  <text x="160" y="125" text-anchor="middle" class="rp-depot__label">代收点</text>
                </g>
                <g class="rp-lens">
                  <circle class="rp-lens-ring" cx="70" cy="78" r="40"/>
                  <path class="rp-lens-handle" d="M98 106l22 22"/>
                </g>
              </svg>
            </div>
            <p class="rp-quote__text">「未检测到代理」只是这个工具没认出来，<span class="rp-hl rp-hl--warn">你正在走代理时也可能出现</span>。</p>
            <p class="rp-quote__foot small faint">代收点就在那里，检测站只是没认出它。</p>
          </div>
        </div>
      </section>

      <section class="rp-flow" aria-label="怎样复现一轮有用的检测">
        <div class="rp-flow__head">
          <h3 class="h3" data-reveal="lines">怎样复现一轮有用的检测</h3>
          <p class="muted" data-reveal>一张截图只说明那一刻。按下面四步做，才知道「这次正常」具体覆盖了什么。</p>
        </div>
        <div class="rp-flow__track">
        <i class="rp-flow__line" aria-hidden="true"><i></i></i>
        <ol class="rp-flow__list">
          ${FLOW.map((f, i) => `<li class="rp-flow__item">
            <span class="rp-flow__node"><svg viewBox="0 0 24 24" aria-hidden="true">${f.icon}</svg></span>
            <span class="rp-flow__n">${pad(i + 1)}</span>
            <h4 class="h4">${f.t}</h4>
            <p class="small muted">${f.d}</p>
          </li>`).join('')}
        </ol>
        </div>
      </section>

      <p class="rp-note tiny faint" data-reveal>本图仅用于讲解第三方报告，不是当前用户的体检记录，也不是本项目的验收结果。隐私遮挡已固化在图片像素里。</p>
    </div>

    <dialog class="rp-lightbox" aria-label="检测页完整原图" data-lenis-prevent>
      <div class="rp-lightbox__bar">
        <span class="small">检测页完整原图 · 隐私已遮挡</span>
        <button type="button" class="tool-btn rp-lightbox__close" data-sfx="close">关闭</button>
      </div>
      <div class="rp-lightbox__body"><img src="${reportImg}" width="${IMG_W}" height="${IMG_H}" alt="检测页完整原图（隐私已遮挡）" /></div>
    </dialog>`

    /* ---------------- 镜头 ---------------- */
    const frame = el.querySelector('.rp-frame')
    const cam = el.querySelector('.rp-cam')
    const svg = el.querySelector('.rp-veil')
    const hole = svg.querySelector('.rp-hole')
    const rings = svg.querySelectorAll('.rp-ring')
    const dim = svg.querySelector('.rp-dim')
    const ghosts = svg.querySelector('.rp-ghosts')
    const hots = [...el.querySelectorAll('.rp-hot')]
    const stepEls = [...el.querySelectorAll('.rp-step')]
    const capN = el.querySelector('.rp-cap__n')
    const capT = el.querySelector('.rp-cap__t')
    const mini = el.querySelector('.rp-mini')
    const miniView = el.querySelector('.rp-mini__view')
    const live = el.querySelector('.rp-live')
    const track = el.querySelector('.rp-steps')
    const dots = [...el.querySelectorAll('.rp-pager__dots i')]
    const mqDesk = window.matchMedia(DESK)

    const state = { s: 1, tx: 0, ty: 0 }
    let active = -1

    function applyCam() {
      cam.style.transform = `translate3d(${state.tx}px, ${state.ty}px, 0) scale(${state.s})`
      cam.style.setProperty('--inv', (1 / state.s).toFixed(4))
      const fw = frame.clientWidth
      const fh = frame.clientHeight
      const k = fw / IMG_W
      const mw = mini.clientWidth
      const ms = mw / IMG_W
      const vx = clamp(-state.tx / (k * state.s), 0, IMG_W)
      const vy = clamp(-state.ty / (k * state.s), 0, IMG_H)
      const vw = Math.min(fw / (k * state.s), IMG_W - vx)
      const vh = Math.min(fh / (k * state.s), IMG_H - vy)
      miniView.style.transform = `translate(${vx * ms}px, ${vy * ms}px)`
      miniView.style.width = `${vw * ms}px`
      miniView.style.height = `${vh * ms}px`
    }

    function target(i) {
      const fw = frame.clientWidth
      const fh = frame.clientHeight
      const k = fw / IMG_W
      const s0 = Math.min(1, fh / (IMG_H * k))
      let s = s0
      let cx = IMG_W / 2
      let cy = IMG_H / 2
      if (i > 0) {
        const [x, y, w, h] = REGIONS[i - 1].r
        const p = 40
        s = clamp(Math.min(fw / ((w + p * 2) * k), fh / ((h + p * 2) * k)), s0, 2.35)
        cx = x + w / 2
        cy = y + h / 2
      }
      const iw = IMG_W * k * s
      const ih = IMG_H * k * s
      let tx = fw / 2 - cx * k * s
      let ty = fh / 2 - cy * k * s
      tx = iw >= fw ? clamp(tx, fw - iw, 0) : (fw - iw) / 2
      ty = ih >= fh ? clamp(ty, fh - ih, 0) : (fh - ih) / 2
      return { s, tx, ty }
    }

    function setActive(i, { instant = false, sound = true } = {}) {
      if (i === active) return
      const prev = active
      active = i
      const dur = instant || prefersReduced ? 0 : 1.15
      gsap.to(state, { ...target(i), duration: dur, ease: 'expo.out', overwrite: true, onUpdate: applyCam, onComplete: applyCam })
      if (dur === 0) applyCam()

      let box
      if (i === 0) box = { x: IMG_W / 2, y: IMG_H / 2, width: 0, height: 0 }
      else {
        const [x, y, w, h] = REGIONS[i - 1].r
        box = { x: x - 6, y: y - 6, width: w + 12, height: h + 12 }
      }
      const from = prev <= 0 && i > 0 ? (() => { const [x, y, w, h] = REGIONS[i - 1].r; return { x: x + w / 2, y: y + h / 2, width: 0, height: 0 } })() : null
      if (from) gsap.set([hole, ...rings], { attr: from })
      gsap.to([hole, ...rings], { attr: box, duration: dur ? 0.95 : 0, ease: 'expo.out', overwrite: true })
      gsap.to(dim, { opacity: i === 0 ? 0.14 : 0.84, duration: dur ? 0.6 : 0, ease: 'power2.out', overwrite: true })
      gsap.to(ghosts, { opacity: i === 0 ? 1 : 0, duration: dur ? 0.5 : 0, overwrite: true })
      gsap.to(rings, { opacity: i === 0 ? 0 : 1, duration: dur ? 0.4 : 0, overwrite: 'auto' })

      stepEls.forEach((s, n) => s.classList.toggle('is-active', n === i))
      hots.forEach((h, n) => { h.classList.toggle('is-active', n + 1 === i); h.classList.toggle('is-dim', i > 0 && n + 1 !== i) })
      dots.forEach((d, n) => d.classList.toggle('is-on', n === i))
      el.querySelectorAll('.rp-legend button').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.go) === i))
      capN.textContent = pad(i)
      capT.textContent = i === 0 ? '全貌 · 七个区域' : REGIONS[i - 1].name
      live.textContent = i === 0 ? '全貌：七个区域' : `第 ${i} 块：${REGIONS[i - 1].name}`
      if (!prefersReduced && dur) gsap.fromTo(el.querySelector('.rp-cap'), { y: -6, opacity: 0.3 }, { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out' })
      if (sound && prev !== -1) audio.sfx(i === 0 ? 'whoosh' : 'step')
    }

    requestAnimationFrame(() => setActive(0, { instant: true, sound: false }))
    const ro = new ResizeObserver(() => {
      gsap.killTweensOf(state)
      Object.assign(state, target(Math.max(active, 0)))
      applyCam()
    })
    ro.observe(frame)

    /* 桌面：滚动驱动；手机：横滑卡片驱动 */
    const mm = gsap.matchMedia()
    mm.add(DESK, () => {
      stepEls.forEach((s, i) => {
        ScrollTrigger.create({ trigger: s, start: 'top 58%', end: 'bottom 58%', onToggle: (self) => self.isActive && setActive(i) })
      })
    })

    let raf = 0
    track.addEventListener('scroll', () => {
      if (mqDesk.matches || raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const w = stepEls[0].offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0)
        setActive(clamp(Math.round(track.scrollLeft / w), 0, stepEls.length - 1))
      })
    }, { passive: true })

    function scrollTrackTo(i) {
      const w = stepEls[0].offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0)
      track.scrollTo({ left: i * w, behavior: prefersReduced ? 'auto' : 'smooth' })
    }

    function go(i) {
      if (mqDesk.matches) {
        scrollToTarget(stepEls[i], { offset: -Math.round(window.innerHeight * 0.3) })
      } else {
        scrollTrackTo(i)
      }
      setActive(i)
    }

    hots.forEach((h) => h.addEventListener('click', () => { audio.sfx('pop'); go(Number(h.dataset.i)) }))
    el.querySelectorAll('.rp-legend button').forEach((b) => b.addEventListener('click', () => { audio.sfx('click'); go(Number(b.dataset.go)) }))
    el.querySelectorAll('.rp-pager__btn').forEach((b) => b.addEventListener('click', () => {
      audio.sfx('click')
      const n = clamp(Math.max(active, 0) + Number(b.dataset.dir), 0, stepEls.length - 1)
      scrollTrackTo(n)
      setActive(n)
    }))

    /* ---------------- 原图灯箱 ---------------- */
    const dlg = el.querySelector('.rp-lightbox')
    el.querySelector('.rp-zoom').addEventListener('click', () => {
      if (typeof dlg.showModal !== 'function') return
      dlg.showModal()
      lockScroll(true)
      if (!prefersReduced) gsap.fromTo(dlg.querySelector('.rp-lightbox__body'), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out' })
    })
    el.querySelector('.rp-lightbox__close').addEventListener('click', () => dlg.close())
    dlg.addEventListener('click', (e) => { if (e.target === dlg) { audio.sfx('close'); dlg.close() } })
    dlg.addEventListener('close', () => lockScroll(false))

    /* ---------------- 两句话：分数与放大镜 ---------------- */
    const scoreCard = el.querySelector('.rp-quote--score')
    const numEl = scoreCard.querySelector('.rp-score__num')
    const fill = scoreCard.querySelector('.rp-gauge__fill')
    const neq = scoreCard.querySelectorAll('.rp-neq li')
    if (prefersReduced) {
      numEl.textContent = '100'
      fill.style.strokeDashoffset = '0'
      scoreCard.classList.add('is-struck')
    } else {
      gsap.set(neq, { opacity: 0, x: -14 })
      onEnter(scoreCard, () => {
        const tl = gsap.timeline()
        tl.call(() => audio.sfx('reveal'))
          .add(countUp(numEl, 100, { duration: 1.6 }), 0)
          .fromTo(fill, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power3.out' }, 0)
          .to(neq, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out', stagger: 0.22 }, 1.7)
          .call(() => { scoreCard.classList.add('is-struck'); audio.sfx('deny') }, null, 2.0)
      }, { start: 'top 72%' })
    }

    const ghostCard = el.querySelector('.rp-quote--ghost')
    const lens = ghostCard.querySelector('.rp-lens')
    if (!prefersReduced) {
      let sweep
      onEnter(ghostCard, () => {
        sweep = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.6 })
          .fromTo(lens, { x: -30 }, { x: 170, duration: 3.2, ease: 'sine.inOut' })
        ScrollTrigger.create({ trigger: ghostCard, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? sweep.play() : sweep.pause()) })
      }, { start: 'top 80%' })
    }

    /* ---------------- 复现四步：连线点亮 ---------------- */
    const flowLine = el.querySelector('.rp-flow__line i')
    const flowItems = el.querySelectorAll('.rp-flow__item')
    if (prefersReduced) {
      flowItems.forEach((f) => f.classList.add('is-on'))
      flowLine.style.transform = 'scale(1)'
    } else {
      gsap.set(flowItems, { opacity: 0, y: 30 })
      onEnter(el.querySelector('.rp-flow__track'), () => {
        const tl = gsap.timeline()
        tl.to(flowLine, { scale: 1, duration: 1.6, ease: 'expo.out' }, 0)
        flowItems.forEach((f, i) => {
          tl.to(f, { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, 0.12 + i * 0.16)
            .call(() => { f.classList.add('is-on'); audio.sfx('step') }, null, 0.3 + i * 0.16)
        })
      }, { start: 'top 78%' })
    }

    reveal(el)
  },
}

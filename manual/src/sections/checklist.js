// 24 项检查清单：环形进度、分组进度、勾选音阶、全部完成的彩纸
import './checklist.css'
import { gsap, ScrollTrigger, reveal, whenVisible, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { pushMood, popMood } from '../core/mood.js'
import { toast, esc } from '../core/ui.js'
import { mascot } from '../core/mascot.js'

const KEY = 'guide:checklist'

// 原版 24 项，标题与说明逐字
const GROUPS = [
  { name: '边界与入口', say: '先数清楚家里有几扇门，哪些程序会自己出门。', items: [
    ['明确模式 A / B', '守卫与接入模式一致。'],
    ['列出所有启动方式', '终端、IDE、Desktop、后台与更新器。'],
    ['登记子进程与远端', 'MCP、外部工具、SSH 和容器分别看。'],
    ['确认专用浏览器范围', '资料目录不自动等于独立进程。'],
  ] },
  { name: '出口与网络', say: '包裹只认一个代收点，侧门、电话簿和对讲机也要管住。', items: [
    ['锁定专用策略组', '没有 DIRECT 或自动回落其他出口。'],
    ['读回运行时规则', '进程和域名规则在宽泛直连之前。'],
    ['核对出口身份', '证据新鲜、路径一致、记录脱敏。'],
    ['检查 NO_PROXY / PAC', '无意外直连例外或回落。'],
    ['验证 IPv6 与新接口', '不能只测 IPv4。'],
    ['验证 DNS / WebRTC / UDP', 'DoH、QUIC 与 STUN 的路径明确。'],
  ] },
  { name: '阻断与门禁', say: '门卫、安检、巡逻都在岗，改防线的钥匙不乱给。', items: [
    ['确认独立阻断层', '业务进程不能任意直连外网。'],
    ['确认失败策略', '未知状态拒绝新启动。'],
    ['核对近期心跳', '旧 SAFE 与退出码 0 不是充分证据。'],
    ['检查实际内核规则', '语法、挂载、顺序和连接状态。'],
    ['保护高权限工具', '所有权、固定参数和最小 sudo。'],
    ['核对修改入口门禁', '清楚哪些执行入口受控。'],
  ] },
  { name: '环境与数据', say: '长相笔迹保持真实稳定，档案和资料自己保管好。', items: [
    ['复核浏览器环境', '语言、时区、WebGL 与变更记录。'],
    ['核对隐私偏好', '不把开训练当安全手段。'],
    ['核对遥测作用范围', '新会话、旧会话与后台分别看。'],
    ['保护凭据和工作资料', '不共享凭据，重要成果可恢复。'],
  ] },
  { name: '演练与维护', say: '定期演习一次，换了环境就复查，留好记录。', items: [
    ['做过代理掉线演练', '无敏感会话，观察物理出口。'],
    ['做过未知域名演练', '保护不能依赖有限域名名单。'],
    ['做过换网 / 升级复测', '接口、路径与规则无静默漂移。'],
    ['留存恢复和验收记录', '有时间、版本与恢复结果。'],
  ] },
]
const TOTAL = GROUPS.reduce((n, g) => n + g.items.length, 0)

// 外圈 24 段弧
const R = 104
const C = 2 * Math.PI * R
function arcPath(i, n, r, gapDeg = 3.2) {
  const span = 360 / n
  const a0 = ((i * span + gapDeg / 2 - 90) * Math.PI) / 180
  const a1 = (((i + 1) * span - gapDeg / 2 - 90) * Math.PI) / 180
  const p = (a) => `${(120 + r * Math.cos(a)).toFixed(2)} ${(120 + r * Math.sin(a)).toFixed(2)}`
  return `M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    const set = new Set(Array.isArray(raw) ? raw.filter((x) => Number.isInteger(x) && x >= 0 && x < TOTAL) : [])
    return set
  } catch { return new Set() }
}
function save(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set].sort((a, b) => a - b))); return true } catch { return false }
}

/* ---------------- 彩纸：canvas，离屏暂停，自动结束 ---------------- */
function confetti(host, origin) {
  const cv = document.createElement('canvas')
  cv.className = 'ck-confetti'
  cv.setAttribute('aria-hidden', 'true')
  host.appendChild(cv)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = window.innerWidth
  const H = window.innerHeight
  cv.width = W * dpr; cv.height = H * dpr
  const c = cv.getContext('2d')
  c.scale(dpr, dpr)
  const colors = ['#ffd08a', '#ffb35c', '#ff7a52', '#ff5d73', '#6ff0b8', '#f4efe6', '#8fb4ff']
  const N = W < 600 ? 110 : 180
  const parts = Array.from({ length: N }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25
    const sp = 7 + Math.random() * 11
    return {
      x: origin.x, y: origin.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
      w: 5 + Math.random() * 7, h: 3 + Math.random() * 5,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      k: Math.random() < 0.22 ? 'dot' : 'rect',
      col: colors[(Math.random() * colors.length) | 0],
      wob: Math.random() * 10, glow: Math.random() < 0.3,
    }
  })
  let raf = 0
  let running = false
  let last = 0
  let life = 0
  const MAX = 4.6
  const stopIO = whenVisible(host, () => start(), () => pause(), '0px')
  function start() { if (running || life >= MAX) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick) }
  function pause() { running = false; cancelAnimationFrame(raf) }
  function end() { pause(); stopIO(); cv.remove() }
  function tick(now) {
    if (!running) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    life += dt
    const f = dt * 60
    c.clearRect(0, 0, W, H)
    const fade = life > MAX - 1 ? Math.max(0, MAX - life) : 1
    let alive = 0
    for (const p of parts) {
      p.vx *= Math.pow(0.985, f); p.vy = p.vy * Math.pow(0.985, f) + 0.28 * f
      p.x += p.vx * f + Math.sin(life * 6 + p.wob) * 0.6
      p.y += p.vy * f
      p.r += p.vr * f
      if (p.y > H + 30) continue
      alive++
      c.save()
      c.globalAlpha = fade
      c.translate(p.x, p.y)
      c.rotate(p.r)
      c.fillStyle = p.col
      if (p.glow) { c.shadowColor = p.col; c.shadowBlur = 10 }
      if (p.k === 'dot') { c.beginPath(); c.arc(0, 0, p.h * 0.6, 0, Math.PI * 2); c.fill() }
      else { c.scale(1, Math.cos(life * 8 + p.wob)); c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h) }
      c.restore()
    }
    if (!alive || life >= MAX) { end(); return }
    raf = requestAnimationFrame(tick)
  }
  return end
}

/* ---------------- 打印：只打印清单本身 ---------------- */
function printChecklist(done) {
  let n = 0
  const body = GROUPS.map((g) => `<h2>${esc(g.name)}</h2><ul>${g.items.map(([t, d]) => {
    const i = n++
    return `<li><span class="b">${done.has(i) ? '✓' : ''}</span><b>${esc(t)}</b><span>${esc(d)}</span></li>`
  }).join('')}</ul>`).join('')
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Claude 防护 · 24 项检查清单</title><style>
    body{font:14px/1.6 -apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#111;margin:28px 36px}
    h1{font-size:22px;margin:0 0 4px}p{margin:0 0 14px;color:#555;font-size:12px}
    h2{font-size:15px;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #ccc}
    ul{list-style:none;margin:0;padding:0}li{display:grid;grid-template-columns:22px 190px 1fr;gap:10px;align-items:baseline;padding:4px 0;border-bottom:1px dotted #ddd;break-inside:avoid}
    .b{display:inline-block;width:14px;height:14px;border:1.4px solid #333;border-radius:3px;font-size:12px;line-height:13px;text-align:center}
    li span:last-child{color:#444}
  </style></head><body><h1>Claude 防护 · 24 项检查清单</h1><p>已勾选 ${done.size} / ${TOTAL}。勾选只记录人工检查进度，不会自动认证网络安全。改编自「智能体先锋队」《Claude 防护方法手册 · 本机实战版 v3.0》。</p>${body}</body></html>`
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc || !frame.contentWindow) { frame.remove(); window.print(); return }
  doc.open(); doc.write(html); doc.close()
  setTimeout(() => {
    try { frame.contentWindow.focus(); frame.contentWindow.print() } catch { window.print() }
    setTimeout(() => frame.remove(), 1500)
  }, 60)
}

export default {
  id: 'checklist',
  nav: '24 项清单',
  desc: '勾完一遍，心里有数',
  mood: 'safe',
  mount(el, { num }) {
    let idx = 0
    const groupsHTML = GROUPS.map((g, gi) => `
      <section class="ck-group" data-g="${gi}" aria-labelledby="ck-g${gi}">
        <header class="ck-group__head">
          <span class="ck-group__ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" class="t"/><circle cx="18" cy="18" r="14" class="p" pathLength="100"/></svg><i>${gi + 1}</i></span>
          <div class="ck-group__title">
            <h3 id="ck-g${gi}">${g.name}</h3>
            <p class="newbie-only">${g.say}</p>
          </div>
          <span class="ck-group__count" aria-live="polite"><b>0</b> / ${g.items.length}</span>
          <span class="ck-group__done tag tag--safe" aria-hidden="true"><span class="dot"></span>本组完成</span>
        </header>
        <ul class="ck-list">
          ${g.items.map(([t, d]) => {
            const i = idx++
            return `<li><label class="ck-item" data-i="${i}">
              <input type="checkbox" class="ck-input" data-i="${i}" aria-describedby="ck-d${i}">
              <span class="ck-box" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2L18.5 7.8" pathLength="24"/></svg><i class="ck-spark"></i></span>
              <span class="ck-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
              <span class="ck-text"><span class="ck-title">${t}</span><span class="ck-desc" id="ck-d${i}">${d}</span></span>
            </label></li>`
          }).join('')}
        </ul>
      </section>`).join('')

    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>24 项清单</span></div>
        <h2 class="h2" data-reveal="lines">最后，做成你的<br><span class="text-warm">检查清单。</span></h2>
        <p class="lead" data-reveal>前面讲过的每一道关，都浓缩成下面 24 个格子。一项项对着自己的电脑看，确认了再勾。</p>
        <div class="metaphor ck-metaphor" data-reveal><span>像每天出门前，挨个摸一遍<strong>门窗、侧门和代收点</strong>。一样样确认过，心里才有数。</span></div>
      </header>

      <div class="ck-layout">
        <aside class="ck-panel" aria-label="检查进度">
          <div class="ck-dial">
            <div class="ck-dial__mascot" aria-hidden="true">
              <span class="ck-face ck-face--idle">${mascot({ size: 84, face: 'idle' })}</span>
              <span class="ck-face ck-face--happy">${mascot({ size: 84, face: 'happy' })}</span>
            </div>
            <svg class="ck-ring" viewBox="0 0 240 240" aria-hidden="true">
              <defs>
                <linearGradient id="ck-grad" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="220" y2="220">
                  <stop offset="0" stop-color="#6ff0b8"/><stop offset=".55" stop-color="#ffd08a"/><stop offset="1" stop-color="#ff7a52"/>
                </linearGradient>
                <filter id="ck-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <g class="ck-segs">${Array.from({ length: TOTAL }, (_, i) => `<path d="${arcPath(i, TOTAL, R)}" data-seg="${i}"/>`).join('')}</g>
              <circle class="ck-track" cx="120" cy="120" r="88"/>
              <circle class="ck-arc" cx="120" cy="120" r="88" transform="rotate(-90 120 120)" stroke-dasharray="${(2 * Math.PI * 88).toFixed(2)}" stroke-dashoffset="${(2 * Math.PI * 88).toFixed(2)}" filter="url(#ck-glow)"/>
            </svg>
            <div class="ck-dial__center">
              <div class="ck-dial__num"><span class="ck-count">0</span><span class="ck-of">/ ${TOTAL}</span></div>
              <div class="ck-dial__label">项已检查</div>
            </div>
          </div>
          <p class="visually-hidden ck-live" aria-live="polite"></p>

          <ol class="ck-bars">
            ${GROUPS.map((g, gi) => `<li data-g="${gi}"><span class="ck-bars__name">${g.name}</span><span class="ck-bars__track"><i></i></span><span class="ck-bars__n">0/${g.items.length}</span></li>`).join('')}
          </ol>

          <div class="ck-finish" role="status">
            <strong>24 项都过了一遍。</strong>
            <span>勾选只是人工记录。换网、升级之后，记得重新看一遍。</span>
          </div>

          <div class="ck-actions">
            <button class="btn btn--ghost btn--sm ck-reset" type="button">重置勾选</button>
            <button class="btn btn--ghost btn--sm ck-print" type="button" data-sfx="click">打印这份清单</button>
          </div>
          <p class="ck-note">勾选记录人工检查进度，不会自动认证网络安全。<br>仅尝试保存到当前浏览器，不上传。</p>
        </aside>

        <div class="ck-groups">
          ${groupsHTML}
          <div class="ck-mini" aria-hidden="true"><span class="ck-mini__n"><b>0</b> / ${TOTAL}</span><span class="ck-mini__track"><i></i></span></div>
        </div>
      </div>
    </div>`

    const done = load()
    const inputs = [...el.querySelectorAll('.ck-input')]
    const segs = [...el.querySelectorAll('.ck-segs path')]
    const arc = el.querySelector('.ck-arc')
    const arcC = 2 * Math.PI * 88
    const countEl = el.querySelector('.ck-count')
    const live = el.querySelector('.ck-live')
    const panel = el.querySelector('.ck-panel')
    const miniN = el.querySelector('.ck-mini__n b')
    const miniBar = el.querySelector('.ck-mini__track i')
    const groupEls = [...el.querySelectorAll('.ck-group')]
    const barEls = [...el.querySelectorAll('.ck-bars li')]
    const ranges = []
    { let s = 0; GROUPS.forEach((g) => { ranges.push([s, s + g.items.length]); s += g.items.length }) }
    const groupDone = (gi) => { const [a, b] = ranges[gi]; let n = 0; for (let i = a; i < b; i++) if (done.has(i)) n++; return n }

    const shown = { v: 0 }
    let countTween = null
    let moodPushed = false
    let inView = false
    let stopConfetti = null

    function syncMood() {
      const want = inView && done.size === TOTAL
      if (want && !moodPushed) { pushMood('triumph'); moodPushed = true }
      else if (!want && moodPushed) { popMood(); moodPushed = false }
    }

    function render({ animate = true } = {}) {
      const n = done.size
      inputs.forEach((inp, i) => { inp.checked = done.has(i); inp.closest('.ck-item').classList.toggle('is-on', done.has(i)) })
      segs.forEach((s, i) => s.classList.toggle('is-on', i < n))
      const off = arcC * (1 - n / TOTAL)
      if (animate && !prefersReduced) gsap.to(arc, { attr: { 'stroke-dashoffset': off }, duration: 0.9, ease: 'expo.out' })
      else arc.setAttribute('stroke-dashoffset', off)
      countTween?.kill()
      if (animate && !prefersReduced) countTween = gsap.to(shown, { v: n, duration: 0.7, ease: 'power3.out', onUpdate: () => { countEl.textContent = Math.round(shown.v) } })
      else { shown.v = n; countEl.textContent = n }
      miniN.textContent = n
      miniBar.style.transform = `scaleX(${n / TOTAL})`
      GROUPS.forEach((g, gi) => {
        const k = groupDone(gi)
        const full = k === g.items.length
        groupEls[gi].querySelector('.ck-group__count b').textContent = k
        groupEls[gi].querySelector('.ck-group__ring .p').style.strokeDashoffset = String(100 - (k / g.items.length) * 100)
        groupEls[gi].classList.toggle('is-done', full)
        barEls[gi].querySelector('i').style.transform = `scaleX(${k / g.items.length})`
        barEls[gi].querySelector('.ck-bars__n').textContent = `${k}/${g.items.length}`
        barEls[gi].classList.toggle('is-done', full)
      })
      panel.classList.toggle('is-complete', n === TOTAL)
      el.classList.toggle('is-complete', n === TOTAL)
      syncMood()
    }

    function celebrate() {
      audio.sfx('celebrate')
      audio.duck?.(0.4, 1400)
      const dial = el.querySelector('.ck-dial')
      if (!prefersReduced) {
        const r = dial.getBoundingClientRect()
        stopConfetti?.()
        stopConfetti = confetti(el, { x: r.left + r.width / 2, y: r.top + r.height * 0.45 })
        gsap.fromTo(dial, { scale: 0.94 }, { scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.45)' })
      }
      toast('24 项全部勾完。心里有数，也别松劲')
    }

    el.querySelector('.ck-groups').addEventListener('change', (e) => {
      const inp = e.target.closest('.ck-input')
      if (!inp) return
      const i = Number(inp.dataset.i)
      const gi = ranges.findIndex(([a, b]) => i >= a && i < b)
      const before = groupDone(gi)
      if (inp.checked) done.add(i); else done.delete(i)
      if (!save(done)) toast('浏览器不允许保存，刷新后勾选会丢失')
      render()
      live.textContent = `已检查 ${done.size} / ${TOTAL}`
      if (inp.checked) {
        audio.sfx('ding', { pitch: done.size / TOTAL })
        const item = inp.closest('.ck-item')
        item.classList.remove('is-pop'); void item.offsetWidth; item.classList.add('is-pop')
        const nowFull = groupDone(gi) === GROUPS[gi].items.length && before < GROUPS[gi].items.length
        if (done.size === TOTAL) setTimeout(celebrate, 160)
        else if (nowFull) {
          setTimeout(() => audio.sfx('chord'), 140)
          const head = groupEls[gi].querySelector('.ck-group__done')
          if (!prefersReduced) gsap.fromTo(head, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2.4)' })
          toast(`「${GROUPS[gi].name}」这一组查完了`)
        }
      } else {
        audio.sfx('toggle-off')
      }
    })

    // 重置：点两次确认，避免误触
    const resetBtn = el.querySelector('.ck-reset')
    let armed = 0
    resetBtn.addEventListener('click', () => {
      if (!done.size) { toast('还没有勾选任何一项'); audio.sfx('click'); return }
      if (!armed) {
        armed = setTimeout(() => { armed = 0; resetBtn.textContent = '重置勾选'; resetBtn.classList.remove('is-armed') }, 3000)
        resetBtn.textContent = '再点一次确认'
        resetBtn.classList.add('is-armed')
        audio.sfx('click')
        return
      }
      clearTimeout(armed); armed = 0
      resetBtn.textContent = '重置勾选'
      resetBtn.classList.remove('is-armed')
      done.clear()
      save(done)
      stopConfetti?.()
      render()
      live.textContent = `已重置，已检查 0 / ${TOTAL}`
      audio.sfx('toggle-off')
      toast('已清空勾选')
    })

    el.querySelector('.ck-print').addEventListener('click', () => printChecklist(done))

    ScrollTrigger.create({
      trigger: el, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => { inView = self.isActive; syncMood() },
    })

    // 进入视口时，外圈 24 段依次点一遍底光，再落到当前进度
    render({ animate: false })
    if (!prefersReduced) {
      const segWrap = el.querySelector('.ck-segs')
      ScrollTrigger.create({
        trigger: el.querySelector('.ck-dial'), start: 'top 80%', once: true,
        onEnter: () => {
          gsap.fromTo(segs, { opacity: 0, scale: 0.9, transformOrigin: '120px 120px' }, { opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out', stagger: 0.025 })
          segWrap.classList.add('is-in')
          const n = done.size
          if (n) { shown.v = 0; countEl.textContent = '0'; arc.setAttribute('stroke-dashoffset', arcC); render() }
        },
      })
    }

    reveal(el)
  },
}

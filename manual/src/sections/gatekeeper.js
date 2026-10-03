// 10 门禁：不让 AI 助手拆掉防线
// 招牌：三色灯分拣小游戏（卡片飞入、点灯分类、盖章反馈、分数总结，可键盘操作）
import './gatekeeper.css'
import { gsap, reveal, whenVisible, prefersReduced, onEnter } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { codeBlock, enhanceCodeBlocks, esc } from '../core/ui.js'
import { mascot } from '../core/mascot.js'

/* ---------------- 图标（48 网格，细线条） ---------------- */
const ICONS = {
  route: '<rect x="8" y="10" width="32" height="28" rx="4"/><path d="M8 19h32M8 28h32M20 10v28"/>',
  guard: '<path d="M24 6l14 5v11c0 9-6 16-14 20-8-4-14-11-14-20V11z"/><path d="M16 24s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="24" cy="24" r="1.6"/>',
  hash: '<path d="M20 8l-4 32M32 8l-4 32M11 18h29M8 30h29"/>',
  sliders: '<path d="M8 14h32M8 24h32M8 34h32"/><circle class="f" cx="17" cy="14" r="3.6"/><circle class="f" cx="31" cy="24" r="3.6"/><circle class="f" cx="21" cy="34" r="3.6"/>',
  reload: '<path d="M24 6l14 5v11c0 9-6 16-14 20-8-4-14-11-14-20V11z"/><path d="M29.5 20.5a6 6 0 1 0 .6 5"/><path d="M30 15.5v5h-5"/>',
  sidedoor: '<path d="M6 22L21 10l15 12v18H6z"/><rect x="15" y="29" width="8" height="11" rx="1"/><path d="M36 26l7-3v17l-7 0"/><circle cx="40" cy="32" r=".8"/>',
  bypass: '<rect x="20" y="24" width="10" height="14" rx="2"/><path d="M6 31h9"/><path d="M15 31c0-14 6-17 13-17h14"/><path d="M37 9l5 5-5 5"/>',
  wall: '<rect x="6" y="14" width="36" height="24" rx="2"/><path d="M6 22h36M6 30h36M16 14v8M28 14v8M11 22v8M22 22v8M34 22v8M17 30v8M29 30v8"/><path class="d" d="M31 8l4 4M38 6l-2 5M42 12l-5 1"/>',
  unlock: '<rect x="11" y="22" width="26" height="18" rx="4"/><path d="M16 22v-6a8 8 0 0 1 15.4-3"/><circle cx="24" cy="30" r="2.2"/><path d="M24 32v3"/>',
  signpost: '<path d="M24 6v36"/><path d="M12 10h22l5 5-5 5H12z"/><path d="M36 25H14l-5 5 5 5h22z"/>',
  bot: '<rect x="6" y="9" width="36" height="30" rx="8"/><path d="M15 21l5 4-5 4M24 30h8"/>',
  check: '<path d="M12 25l8 8 16-18"/>',
  cross: '<path d="M14 14l20 20M34 14L14 34"/>',
}
const icon = (name, cls = '') => `<svg class="gk-ico ${cls}" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`

/* ---------------- 三色灯定义（原版「命令门禁的三类判定」） ---------------- */
const LIGHTS = {
  g: { key: '1', arrow: '←', color: '绿灯', cat: '只读检查', sub: '查看与验证', stamp: '放行', plain: '只看，不动手。可以直接做。', orig: '读授权范围内的脚本、查哈希、查语法、读脱敏状态。不越过私密目录边界。' },
  y: { key: '2', arrow: '↓', color: '黄灯', cat: '受控变更', sub: '改变网络与权限', stamp: '先审 diff', plain: '要动防线了。先把改动摆出来，审过再做。', orig: '改代理、PF、路由、IPv6、sudoers、launchd；停守卫、换出口，先审查具体 diff。' },
  r: { key: '3', arrow: '→', color: '红灯', cat: '禁止自动绕行', sub: '撤掉保护求可用', stamp: '禁止', plain: '为了能用把保护撤掉。一律不许自动做。', orig: '目标加 NO_PROXY、自动切 DIRECT、关闭 TLS 校验、异常时清空规则、伪造 SAFE。' },
}
const ORDER = ['g', 'y', 'r']

/* ---------------- 分拣卡片（10 张操作请求） ---------------- */
const DECK = [
  { t: '查看路由表', k: 'g', ico: 'route', why: '只看不改，属于只读检查。看到的内容对外要脱敏。' },
  { t: '修改代理配置', k: 'y', ico: 'sliders', why: '改代理会改变包裹的出门路线。先审查具体 diff，再动手。' },
  { t: '连不上时自动切直连', k: 'r', ico: 'bypass', why: '这就是自动切 DIRECT。连不上，可以；真实 IP 直连，不行。' },
  { t: '读守卫状态', k: 'g', ico: 'guard', why: '看一眼守卫在不在岗，什么都没改动。可以直接做。' },
  { t: '重载守卫服务', k: 'y', ico: 'reload', why: '守卫由 launchd 常驻管理，重载就是在动它。属于受控变更，先审查。' },
  { t: '出错就清空防火墙规则', k: 'r', ico: 'wall', why: '异常时清空规则，等于一出事就撤走门卫。确认不了路径，就先离线。' },
  { t: '检查脚本哈希', k: 'g', ico: 'hash', why: '查哈希是在确认脚本有没有被换过，只读不写。' },
  { t: '为了能用关掉证书校验', k: 'r', ico: 'unlock', why: '关闭 TLS 校验，是拿保护换可用。这一类一律红灯。' },
  { t: '调整 IPv6 设置', k: 'y', ico: 'sidedoor', why: 'IPv6 是那扇侧门。改它就是改门锁，先审查 diff 和回滚办法。' },
  { t: '把目标加进 NO_PROXY', k: 'r', ico: 'signpost', why: 'NO_PROXY 里的地址会绕开代收点。目标一加进去，就可能直连。' },
]

const STEPS = [
  ['圈定范围', '明确对象：哪些文件、进程、协议与接口受影响。'],
  ['留好退路', '保留旧配置与恢复入口；回滚不能先撤掉阻断。'],
  ['先验语法', '临时文件先验语法，失败不替换生效文件。'],
  ['读回再测', '应用后读回运行状态、规则和心跳，再做受控反例测试。'],
  ['记账脱敏', '记录版本、哈希、验收结论和下一次复核条件；对外材料全面脱敏。'],
]

const CONTRACT = String.raw`READ_ONLY -> 执行已授权的只读检查
CHANGE    -> 审查 diff、覆盖范围、回滚和验收
UNKNOWN   -> 保持已有保护，停止放宽
DENIED    -> 明确原因，不换命令绕过
APPLIED   -> 仅表示已加载，仍需验证
VERIFIED  -> 附时间、版本、覆盖范围与反例证据`

function shuffle(a) {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] }
  return b
}

function verdict(score, total) {
  if (score === total) return '全对。看可以，改要审，撤保护不行，你已经分得清了。'
  if (score >= 7) return '大部分分对了。再记一遍红灯：为了能用把保护撤掉，一律不许。'
  return '再来一轮。口诀：只看不改是绿灯，动防线是黄灯，撤保护是红灯。'
}

export default {
  id: 'gatekeeper',
  nav: '门禁',
  desc: '别让 AI 助手拆了防线',
  mood: 'tension',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>门禁</span></div>
        <h2 class="h2" data-reveal="lines">工具能执行，<br><span class="text-warm">不代表这次有权执行</span></h2>
        <p class="lead" data-reveal>网络门禁管「包从哪里走」，命令门禁管「谁能改防线」。这套规则要接在真实的执行入口上，只写在文档里不算数。</p>
      </header>

      <div class="gk-intro">
        <div class="gk-keys" aria-hidden="true" data-reveal="scale">${keysArt()}</div>
        <p class="metaphor" data-reveal><span>保洁阿姨有你家的钥匙，能进门打扫。<strong>有钥匙，不等于可以换锁。</strong>AI 助手也一样：它能跑命令，可一旦要动防线，就得先过门禁。</span></p>
      </div>

      <div class="gk-sub" data-reveal>
        <span class="gk-sub__k">Three lights</span>
        <h3 class="h3">每一个操作，先看亮哪盏灯</h3>
      </div>
      <div class="gk-signal" data-reveal="stagger">
        ${ORDER.map((k) => {
          const L = LIGHTS[k]
          return `<article class="gk-light gk-light--${k}">
            <div class="gk-light__bulb" aria-hidden="true"><i></i></div>
            <div class="gk-light__body">
              <p class="gk-light__name"><span>${L.color}</span>${L.cat}<em>${L.sub}</em></p>
              <p class="gk-light__plain">${L.plain}</p>
              <p class="gk-light__orig">${L.orig}</p>
            </div>
          </article>`
        }).join('')}
      </div>

      <div class="gk-game" data-reveal="scale" tabindex="-1" aria-label="门禁分拣游戏">
        <div class="gk-game__bar">
          <div class="gk-game__title">
            <span class="tag tag--warn"><span class="dot"></span>模拟请求</span>
            <span>门禁台 · 这件事该亮哪盏灯？</span>
          </div>
          <div class="gk-pips" aria-hidden="true">${DECK.map(() => '<i></i>').join('')}</div>
          <div class="gk-score" aria-live="polite">得分 <b>0</b><span>/ ${DECK.length}</span></div>
        </div>

        <div class="gk-game__main">
          <div class="gk-stage-col">
            <div class="gk-stage"></div>
            <p class="gk-feedback" aria-live="polite"></p>
            <div class="gk-lamps" role="group" aria-label="选择灯色">
              ${ORDER.map((k) => `<button type="button" class="gk-lamp gk-lamp--${k}" data-k="${k}" disabled>
                <span class="gk-lamp__bulb" aria-hidden="true"></span>
                <span class="gk-lamp__txt"><b>${LIGHTS[k].color}</b><span>${LIGHTS[k].cat}</span></span>
                <kbd aria-hidden="true">${LIGHTS[k].key}</kbd>
              </button>`).join('')}
            </div>
            <p class="gk-hint tiny faint">键盘：按 1 / 2 / 3 选灯；焦点在游戏里时也可用方向键 ← ↓ →；回车看下一张。</p>
          </div>
          <aside class="gk-ledger" aria-label="判定记录">
            <p class="gk-ledger__h">判定记录</p>
            <ol class="gk-log"></ol>
          </aside>
        </div>
      </div>
      <p class="gk-demo-note tiny faint" data-reveal>分拣游戏是演示，卡片全部是模拟请求，不执行、也不改变任何系统设置。</p>

      <div class="gk-sub" data-reveal>
        <span class="gk-sub__k">Five steps</span>
        <h3 class="h3">一次合格变更，走满五步</h3>
        <p class="muted">黄灯的事可以做，只是要按顺序来。</p>
      </div>
      <ol class="gk-steps">
        ${STEPS.map(([h, d], i) => `<li class="gk-step">
          <span class="gk-step__n">0${i + 1}</span>
          <span class="gk-step__dot" aria-hidden="true"></span>
          <h4 class="gk-step__h">${h}</h4>
          <p class="gk-step__d">${d}</p>
        </li>`).join('')}
      </ol>

      <div class="gk-hook" data-reveal>
        <div class="gk-hook__art" aria-hidden="true">${hookArt()}</div>
        <div class="gk-hook__text">
          <div class="callout callout--warn">
            <p class="callout__title">${icon('guard', 'gk-ico--sm')}Hook 要与系统权限配合</p>
            <p class="gk-hook__plain">Hook 像装在门口的检查员。哪个门没装，哪个门就可能被绕过去。</p>
            <p>没有挂 Hook 的入口可能绕过命令检查。文件所有权、最小 sudo 和系统网络策略是独立约束。给普通用户可修改的脚本授予 NOPASSWD，会破坏这道边界。</p>
            <p class="small faint">打个比方：谁都能改的脚本还免密提权，等于把换锁的钥匙挂在了门外。</p>
          </div>
        </div>
      </div>

      <div class="pro-only gk-pro">
        <div class="gk-sub">
          <span class="pro-badge">进阶</span>
          <h3 class="h3">门禁返回契约</h3>
          <p class="muted">门禁每次判定后给一个状态。注意 APPLIED 只表示已加载；附上时间、版本、覆盖范围与反例证据，才算 VERIFIED。</p>
        </div>
        ${codeBlock({ code: CONTRACT, lang: 'text', title: '门禁返回契约', note: '流程约定 · 不是已安装的命令' })}
      </div>
    </div>`

    reveal(el)
    enhanceCodeBlocks(el)
    initGame(el)
    initSteps(el)
    const signal = el.querySelector('.gk-signal')
    onEnter(signal, () => signal.classList.add('is-lit'), { start: 'top 72%' })
  },
}

/* ---------------- 插图 ---------------- */
function keysArt() {
  // 一串钥匙：一把「开门」发暖光，一把「换锁」被红圈挡住
  return `<svg viewBox="0 0 220 160" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <defs>
      <radialGradient id="gkKeyGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb35c" stop-opacity=".35"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="72" cy="76" r="62" fill="url(#gkKeyGlow)"/>
    <circle cx="110" cy="26" r="12" stroke="rgba(244,239,230,.35)" stroke-width="2"/>
    <g class="gk-keys__a" stroke="#ffd08a" stroke-width="2.2">
      <circle cx="72" cy="58" r="15"/><circle cx="72" cy="58" r="5"/>
      <path d="M72 73v58M72 104h12M72 118h9"/>
      <path d="M86 46l18-14" stroke="rgba(244,239,230,.35)" stroke-width="2"/>
    </g>
    <text x="72" y="152" text-anchor="middle" font-size="12" fill="#ffd08a" stroke="none" font-weight="700">开门打扫</text>
    <g class="gk-keys__b" stroke="#ff8594" stroke-width="2.2">
      <circle cx="152" cy="58" r="15"/><path d="M147 58h10"/>
      <path d="M152 73v58M152 100h12M152 112h8M152 124h12"/>
      <path d="M138 46l-18-14" stroke="rgba(244,239,230,.35)" stroke-width="2"/>
      <circle cx="152" cy="98" r="36" stroke="#ff4d61" stroke-width="2.4" opacity=".9"/>
      <path d="M127 123l50-50" stroke="#ff4d61" stroke-width="2.4"/>
    </g>
    <text x="152" y="152" text-anchor="middle" font-size="12" fill="#ff8594" stroke="none" font-weight="700">换锁要审批</text>
  </svg>`
}

function hookArt() {
  // 一面墙三个门：两个挂了检查员（Hook），第三个没挂，红色虚线从那里溜过去
  return `<svg viewBox="0 0 360 230" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 196h332" stroke="rgba(244,239,230,.16)" stroke-width="2"/>
    <rect x="30" y="60" width="300" height="136" rx="6" fill="rgba(20,24,36,.7)" stroke="rgba(244,239,230,.22)" stroke-width="1.6"/>
    <path d="M22 64L180 18l158 46" stroke="rgba(244,239,230,.3)" stroke-width="1.8"/>
    ${[0, 1, 2].map((i) => {
      const x = 70 + i * 100
      const ok = i < 2
      return `<g class="gk-door ${ok ? 'is-ok' : 'is-open'}">
        <rect x="${x}" y="116" width="40" height="80" rx="4" fill="${ok ? 'rgba(255,179,92,.08)' : 'rgba(255,77,97,.06)'}" stroke="${ok ? 'rgba(255,208,138,.7)' : 'rgba(255,77,97,.7)'}" stroke-width="1.8"/>
        ${ok
          ? `<circle cx="${x + 20}" cy="98" r="9" fill="rgba(111,240,184,.18)" stroke="#6ff0b8" stroke-width="1.8"/><path d="M${x + 16} 98l3 3 5-6" stroke="#6ff0b8" stroke-width="1.8"/>
             <text x="${x + 20}" y="80" text-anchor="middle" font-size="11" fill="#6ff0b8" stroke="none" font-weight="700">挂了 Hook</text>`
          : `<circle cx="${x + 20}" cy="98" r="9" stroke="rgba(244,239,230,.3)" stroke-width="1.6" stroke-dasharray="3 3"/>
             <text x="${x + 20}" y="80" text-anchor="middle" font-size="11" fill="#ff8594" stroke="none" font-weight="700">没挂 Hook</text>`}
      </g>`
    }).join('')}
    <path class="gk-sneak" d="M290 186c20 0 34-4 50-18" stroke="#ff4d61" stroke-width="2.2" stroke-dasharray="5 6"/>
    <path d="M334 164l7 3-3 7" stroke="#ff4d61" stroke-width="2.2"/>
    <text x="180" y="220" text-anchor="middle" font-size="12" fill="rgba(244,239,230,.5)" stroke="none">没装检查员的门，命令检查管不到</text>
  </svg>`
}

/* ---------------- 五步：连线随滚动点亮 ---------------- */
function initSteps(el) {
  const list = el.querySelector('.gk-steps')
  const items = [...list.children]
  if (prefersReduced) { items.forEach((li) => li.classList.add('is-on')); list.classList.add('is-on'); return }
  gsap.set(items, { opacity: 0, y: 36 })
  onEnter(list, () => {
    list.classList.add('is-on')
    gsap.to(items, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.09 })
    items.forEach((li, i) => gsap.delayedCall(0.25 + i * 0.16, () => li.classList.add('is-on')))
  }, { start: 'top 80%' })
}

/* ---------------- 分拣游戏 ---------------- */
function initGame(el) {
  const game = el.querySelector('.gk-game')
  const stage = game.querySelector('.gk-stage')
  const feedback = game.querySelector('.gk-feedback')
  const lamps = [...game.querySelectorAll('.gk-lamp')]
  const pips = [...game.querySelectorAll('.gk-pips i')]
  const scoreEl = game.querySelector('.gk-score b')
  const log = game.querySelector('.gk-log')

  let deck = DECK.slice()
  let idx = 0
  let score = 0
  let state = 'intro' // intro | ask | answered | done
  let current = null
  let busy = false
  let inView = false
  const results = []

  whenVisible(game, () => (inView = true), () => (inView = false), '0px')

  const setLamps = (on) => lamps.forEach((b) => { b.disabled = !on; b.classList.remove('is-picked', 'is-answer') })

  function renderLog() {
    log.innerHTML = deck.map((c, i) => {
      const r = results[i]
      if (!r) return `<li class="gk-log__row is-empty"><span class="gk-log__n">${String(i + 1).padStart(2, '0')}</span><span class="gk-log__t">${i === idx && state !== 'intro' && state !== 'done' ? '分拣中…' : '待分拣'}</span></li>`
      return `<li class="gk-log__row ${r.ok ? 'is-ok' : 'is-bad'}">
        <span class="gk-log__n">${String(i + 1).padStart(2, '0')}</span>
        <span class="gk-log__t">${esc(c.t)}</span>
        <span class="gk-chip gk-chip--${c.k}">${LIGHTS[c.k].color}</span>
        ${icon(r.ok ? 'check' : 'cross', 'gk-ico--xs')}
      </li>`
    }).join('')
  }

  function renderPips() {
    pips.forEach((p, i) => {
      p.className = ''
      const r = results[i]
      if (r) p.classList.add(r.ok ? 'is-ok' : 'is-bad')
      else if (i === idx && (state === 'ask' || state === 'answered')) p.classList.add('is-cur')
    })
    scoreEl.textContent = score
  }

  function introCard() {
    stage.innerHTML = `<div class="gk-deck">
      <div class="gk-deck__stack" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="gk-deck__front">
        <div class="gk-deck__bot">${icon('bot')}</div>
        <p class="gk-deck__h">AI 助手递来 ${DECK.length} 张操作单</p>
        <p class="gk-deck__p">每张都问一句：这件事该亮哪盏灯？答对答错都会告诉你原因。</p>
        <button type="button" class="btn btn--primary btn--sm gk-start" data-sfx="click">开始分拣 <span class="arrow">→</span></button>
      </div>
    </div>`
    stage.querySelector('.gk-start').addEventListener('click', start)
    feedback.textContent = ''
    feedback.className = 'gk-feedback'
  }

  function cardHTML(c, i) {
    return `<div class="gk-card" data-k="${c.k}">
      <div class="gk-card__top">
        <span class="gk-card__from">${icon('bot', 'gk-ico--xs')}AI 助手想执行</span>
        <span class="gk-card__no">No.${String(i + 1).padStart(2, '0')} / ${deck.length}</span>
      </div>
      <div class="gk-card__body">
        <span class="gk-card__ico">${icon(c.ico)}</span>
        <p class="gk-card__t">${esc(c.t)}</p>
      </div>
      <div class="gk-card__perf" aria-hidden="true"></div>
      <p class="gk-card__q">这件事，该亮哪盏灯？</p>
      <span class="gk-stamp" aria-hidden="true"></span>
    </div>`
  }

  function showCard() {
    const c = deck[idx]
    stage.insertAdjacentHTML('beforeend', cardHTML(c, idx))
    current = stage.lastElementChild
    state = 'ask'
    feedback.className = 'gk-feedback'
    feedback.textContent = `第 ${idx + 1} 张：${c.t}。请选择灯色。`
    setLamps(true)
    renderPips(); renderLog()
    if (prefersReduced) return
    audio.sfx('whoosh')
    gsap.fromTo(current, { x: 120, y: -50, rotate: 8, opacity: 0, scale: 0.94 }, { x: 0, y: 0, rotate: -1.2, opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out' })
    gsap.fromTo(current.querySelectorAll('.gk-card__ico, .gk-card__t'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.07, delay: 0.12 })
  }

  function start() {
    if (busy) return
    deck = state === 'intro' && !results.length ? DECK.slice() : shuffle(DECK)
    idx = 0; score = 0; results.length = 0
    const old = stage.firstElementChild
    const go = () => { stage.innerHTML = ''; stage.classList.remove('is-result'); showCard(); game.focus({ preventScroll: true }) }
    if (old && !prefersReduced) {
      busy = true
      gsap.to(old, { y: 40, opacity: 0, scale: 0.96, duration: 0.35, ease: 'power3.in', onComplete: () => { busy = false; go() } })
    } else go()
  }

  function answer(k) {
    if (state !== 'ask' || busy) return
    const c = deck[idx]
    const ok = k === c.k
    if (ok) score++
    results[idx] = { ok, pick: k }
    state = 'answered'
    lamps.forEach((b) => {
      b.disabled = true
      if (b.dataset.k === k) b.classList.add('is-picked')
      if (b.dataset.k === c.k) b.classList.add('is-answer')
    })
    const stamp = current.querySelector('.gk-stamp')
    stamp.textContent = LIGHTS[c.k].stamp
    current.classList.add('is-done', ok ? 'is-ok' : 'is-bad')
    const L = LIGHTS[c.k]
    feedback.className = `gk-feedback is-${ok ? 'ok' : 'bad'}`
    feedback.innerHTML = `${icon(ok ? 'check' : 'cross', 'gk-ico--xs')}<span><b>${ok ? '答对了' : `应该是${L.color}`}</b> · ${L.cat}。${esc(c.why)}</span>
      <button type="button" class="gk-next" data-sfx="click">${idx + 1 < deck.length ? '下一张' : '看结果'} <span aria-hidden="true">→</span></button>`
    feedback.querySelector('.gk-next').addEventListener('click', next)
    audio.sfx(ok ? 'success' : 'deny')
    renderPips(); renderLog()
    if (!prefersReduced) {
      gsap.fromTo(stamp, { scale: 2.4, opacity: 0, rotate: -24 }, { scale: 1, opacity: 1, rotate: -12, duration: 0.55, ease: 'expo.out' })
      if (ok) gsap.fromTo(current, { y: 0 }, { keyframes: [{ y: 5, duration: 0.08 }, { y: 0, duration: 0.5, ease: 'expo.out' }] })
      else gsap.fromTo(current, { x: 0 }, { keyframes: [{ x: -12, duration: 0.06 }, { x: 10, duration: 0.07 }, { x: -7, duration: 0.07 }, { x: 4, duration: 0.07 }, { x: 0, duration: 0.2, ease: 'expo.out' }] })
      gsap.fromTo(feedback, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'expo.out' })
    }
    feedback.querySelector('.gk-next').focus({ preventScroll: true })
  }

  function next() {
    if (state !== 'answered' || busy) return
    const c = deck[idx]
    const out = current
    const dir = { g: { x: -160, rotate: -10 }, y: { y: 90, rotate: 2 }, r: { x: 160, rotate: 10 } }[c.k]
    const proceed = () => {
      out.remove()
      idx++
      if (idx < deck.length) showCard()
      else finish()
      busy = false
      if (!game.contains(document.activeElement) || document.activeElement === document.body) game.focus({ preventScroll: true })
    }
    busy = true
    if (prefersReduced) proceed()
    else gsap.to(out, { ...dir, opacity: 0, scale: 0.8, duration: 0.42, ease: 'power3.in', onComplete: proceed })
  }

  function finish() {
    state = 'done'
    setLamps(false)
    renderPips(); renderLog()
    const perfect = score === deck.length
    const by = ORDER.map((k) => {
      const all = deck.filter((c) => c.k === k).length
      const hit = deck.filter((c, i) => c.k === k && results[i]?.ok).length
      return `<li class="gk-chip-row"><span class="gk-chip gk-chip--${k}">${LIGHTS[k].color}</span><span>${LIGHTS[k].cat}</span><b>${hit} / ${all}</b></li>`
    }).join('')
    stage.classList.add('is-result')
    stage.innerHTML = `<div class="gk-result">
      <div class="gk-result__m">${mascot({ size: 96, face: perfect ? 'happy' : score >= 7 ? 'idle' : 'worried', tint: perfect ? 'safe' : 'warm' })}</div>
      <p class="gk-result__score"><span class="gk-result__n">0</span><span class="gk-result__of">/ ${deck.length}</span></p>
      <p class="gk-result__v">${verdict(score, deck.length)}</p>
      <ul class="gk-result__by">${by}</ul>
      <button type="button" class="btn btn--ghost btn--sm gk-again" data-sfx="click">再玩一次（打乱顺序）</button>
    </div>`
    feedback.className = 'gk-feedback'
    feedback.textContent = `分拣结束，得分 ${score} / ${deck.length}。`
    const n = stage.querySelector('.gk-result__n')
    stage.querySelector('.gk-again').addEventListener('click', start)
    audio.sfx(perfect ? 'celebrate' : 'chord')
    if (prefersReduced) { n.textContent = score; return }
    const o = { v: 0 }
    gsap.to(o, { v: score, duration: 1.2, ease: 'power3.out', onUpdate: () => (n.textContent = Math.round(o.v)) })
    gsap.from(stage.querySelectorAll('.gk-result > *'), { y: 26, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08 })
  }

  lamps.forEach((b) => b.addEventListener('click', () => answer(b.dataset.k)))

  const MAP = { '1': 'g', '2': 'y', '3': 'r' }
  const ARROWS = { ArrowLeft: 'g', ArrowDown: 'y', ArrowRight: 'r' }
  document.addEventListener('keydown', (e) => {
    if (!inView || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target
    if (t && (t.closest?.('input, textarea, select, [contenteditable="true"]'))) return
    const menu = document.getElementById('chapter-menu')
    if (menu && !menu.hidden) return
    const focusedIn = game.contains(document.activeElement)
    let k = MAP[e.key]
    if (!k && focusedIn) k = ARROWS[e.key]
    if (k && state === 'ask') { e.preventDefault(); answer(k); return }
    if (e.key === 'Enter' && focusedIn && state === 'intro' && document.activeElement === game) { e.preventDefault(); start(); return }
    if (e.key === 'Enter' && state === 'answered' && (focusedIn || t === document.body)) {
      if (t?.closest?.('button, a')) return // 按钮自身会响应回车
      e.preventDefault(); next()
    }
  })

  introCard()
  renderLog(); renderPips()
}

// 第 07 章 · IP 与指纹
// 招牌：三根分开的灯柱（门牌号 / 长相笔迹 / 档案）。
// 「试一试」：点一招常见的补救，灯柱之间看它修到了哪里、哪里一点没动，红章落下。
// 本机自检面板：只在点击后读取语言、时区、UA、WebGL 渲染器，逐行打字机显示；
// 不计算 Canvas 指纹、不发 STUN 请求、不联网、不保存。
import './fingerprint.css'
import { gsap, reveal, onEnter, scrollToTarget, prefersReduced, isTouch } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { esc } from '../core/ui.js'

/* ---------------- 三根灯柱的插画 ---------------- */
const ART = {
  ip: `<svg viewBox="0 0 160 130" aria-hidden="true">
    <path class="ln" d="M22 60 L80 18 L138 60"/>
    <path class="ln" d="M34 52 V116 H126 V52"/>
    <rect class="ln" x="68" y="78" width="24" height="38" rx="3"/>
    <circle class="fill" cx="86" cy="98" r="1.8"/>
    <rect class="ln" x="42" y="66" width="18" height="16" rx="2"/>
    <rect class="ln" x="100" y="66" width="18" height="16" rx="2"/>
    <g class="plate"><rect class="hl" x="54" y="36" width="52" height="22" rx="4"/><path class="hl" d="M62 47h8M74 47h4M82 47h16"/></g>
    <path class="ln dim" d="M8 116 H152"/>
  </svg>`,
  fp: `<svg viewBox="0 0 160 130" aria-hidden="true">
    <g transform="translate(62 62)">
      <path class="hl" d="M-6 0a6 6 0 0 1 12 0c0 10-2 18-6 26"/>
      <path class="ln" d="M-16 2a16 16 0 0 1 32 0c0 12-2 22-8 32"/>
      <path class="ln" d="M-26 6a26 26 0 0 1 52-4c0 14-2 26-8 38"/>
      <path class="ln" d="M-36 12a36 36 0 0 1 70-14"/>
      <path class="ln dim" d="M-14 16c0 10-2 18-6 24M4 10c0 12-2 22-8 32"/>
    </g>
    <path class="hl sign" d="M102 96c6-10 10-18 8-22-3-4-9 8-8 16 1 7 8 2 12-6 2-4 4 4 8 2 4-2 6-8 10-6"/>
    <path class="ln dim" d="M100 108 H148"/>
  </svg>`,
  acct: `<svg viewBox="0 0 160 130" aria-hidden="true">
    <path class="ln" d="M28 30 H66 L74 40 H132 V110 H28 Z"/>
    <path class="ln dim" d="M28 50 H132"/>
    <g class="card"><rect class="hl" x="46" y="60" width="68" height="40" rx="5"/><circle class="hl" cx="62" cy="76" r="7"/><path class="hl" d="M54 92c2-5 14-5 16 0M78 72h26M78 82h18M78 92h22"/></g>
  </svg>`,
}

const PILLARS = [
  { k: 'ip', tag: 'IP', title: '门牌号', from: '来自网络连接', plain: '网站看到的「你从哪来」，就是它。', color: '#ffb35c' },
  { k: 'fp', tag: '指纹', title: '长相与笔迹', from: '来自浏览器和设备特征的组合', plain: '能认出「还是这台设备」。和门牌号是两回事。', color: '#8fb4ff' },
  { k: 'acct', tag: '账号身份', title: '档案', from: '来自登录、支付与历史记录', plain: '你在对方那里留下的记录。', color: '#c7a6ff' },
]

// 「试一试」：原版结论「改 WebGL 字符串不能修复 IPv6 直连，清 Cookie 也不会撤回服务端历史」
const TRIALS = {
  webgl: {
    label: '改 WebGL 字符串', hit: 'fp', miss: 'ip',
    hitNote: '只改了长相里的一个字段', missNote: 'IPv6 直连还在',
    verdict: '改 WebGL 字符串，动的是「长相」。IPv6 直连属于门牌号，一点没修好。单独改一个字段，还可能制造矛盾。',
  },
  cookie: {
    label: '清 Cookie', hit: 'fp', miss: 'acct',
    hitNote: '清掉了本地的记录', missNote: '服务端历史还在',
    verdict: '清 Cookie，只清掉你浏览器里的记录。对方服务端留下的历史在「档案」里，撤不回。',
  },
}

/* ---------------- 检查项（原版表，逐项保留） ---------------- */
const ICONS = {
  gpu: `<rect x="6" y="9" width="20" height="14" rx="2"/><rect x="11" y="13" width="10" height="6" rx="1"/><path d="M10 5v4M16 5v4M22 5v4M10 23v4M16 23v4M22 23v4"/>`,
  canvas: `<path d="M5 24c3-6 6-14 9-14s2 10 5 10 4-7 8-9"/><path d="M5 28h22"/><path d="M22 5l5 5"/>`,
  ua: `<rect x="5" y="7" width="22" height="18" rx="3"/><path d="M5 12h22"/><path d="M10 17v3a2 2 0 0 0 4 0v-3M17 21l2.5-5 2.5 5M18 19.6h3"/>`,
  tz: `<circle cx="16" cy="16" r="11"/><path d="M16 9v7l5 3"/>`,
  rtc: `<rect x="10" y="10" width="12" height="18" rx="3"/><path d="M13 10V4"/><path d="M13 16h6M13 20h6"/><path d="M25 8a6 6 0 0 1 0 8M28 5a10 10 0 0 1 0 14"/>`,
  cookie: `<path d="M26 17a10 10 0 1 1-11-11 4 4 0 0 0 5 5 4 4 0 0 0 6 6z"/><circle cx="12" cy="15" r="1.2"/><circle cx="17" cy="21" r="1.2"/><circle cx="11" cy="21" r="1"/>`,
  geo: `<path d="M16 28s-8-8-8-14a8 8 0 0 1 16 0c0 6-8 14-8 14z"/><circle cx="16" cy="14" r="3"/>`,
}
const CHECKS = [
  { i: 'gpu', k: 'WebGL / GPU', say: '显卡怎么画图，会留下特征。', expose: '渲染器、驱动或图形后端信息；渲染差异', how: '保留真实且稳定的运行环境；更新后复核。禁用或限制 API 会影响 3D 与可视化，不等于隐身。' },
  { i: 'canvas', k: 'Canvas / 字体 / Audio', say: '写字、画画、出声音的细微差别，拼起来能认人。', expose: '文字绘制与音频处理差异形成组合特征', how: '减少无必要扩展；不堆叠来路不明的随机指纹插件。' },
  { i: 'ua', k: 'UA / Client Hints', say: '浏览器的自我介绍：什么版本，什么系统。', expose: '浏览器版本、平台等环境信号', how: '不单独伪造一个字段制造矛盾；升级后重新记录基线。' },
  { i: 'tz', k: '时区 / 语言 / 屏幕', say: '你的时间、语言和屏幕设置。', expose: '时区、语言偏好、分辨率、缩放等', how: '按真实工作偏好保持稳定；这些字段不能证明真实居住地。' },
  { i: 'rtc', k: 'WebRTC / ICE / STUN', say: '浏览器里的对讲机，可能绕开代收点报出地址。', expose: '候选地址与潜在直连路径；UDP 可能绕过普通 HTTP 代理', how: '在受控网络内验证。限制非代理 UDP 或关闭所需 API；视频通话和实时功能可能受影响。', hot: '可能露出地址' },
  { i: 'cookie', k: 'Cookie / 存储 / 扩展', say: '网站存在你浏览器里的记录。', expose: '会话与偏好跨访问持续存在', how: '专用资料用于分离工作环境；无痕不隐藏 IP，不用于伪装「新设备」。' },
  { i: 'geo', k: '定位权限', say: '允许网站知道你的具体位置。', expose: '授权后可能提供精确位置', how: '按实际需求授权；关闭系统定位不阻止服务端通过 IP 推断大致位置。' },
]

const RULES = [
  { t: '保持真实且稳定的环境', d: '按真实工作偏好来，升级后复核。' },
  { t: '不堆叠来路不明的随机指纹插件', d: '减少无必要的扩展。' },
  { t: '不单独伪造一个字段', d: '单独改一处，会和其他字段矛盾。' },
  { t: '无痕不隐藏 IP', d: '开了无痕，门牌号照样看得见。' },
]

const RTC_STEPS = [
  '先看你用的浏览器是否已有受控策略。别为了「装了插件」重复叠加。',
  '如果用扩展，核对作者、权限和更新状态。原版教程截图只作操作参考。',
  '测试正常网络与代理失效两种状态。观察 IPv4、IPv6 和候选类型，别只看一行绿色结果。',
  '换资料、换浏览器、升级、恢复权限后，都要重测。mDNS 隐藏了本地地址，也证明不了公网没泄漏。',
]

/* ---------------- 本机只读：点击后才调用 ---------------- */
function readRenderer() {
  let gl = null
  try {
    const c = document.createElement('canvas')
    gl = c.getContext('webgl') || c.getContext('experimental-webgl')
    if (!gl) return null
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null
    return r ? String(r) : null
  } catch {
    return null
  } finally {
    try { gl?.getExtension('WEBGL_lose_context')?.loseContext() } catch {}
  }
}
function readLocal() {
  const NONE = '浏览器没有给出'
  let tz = null
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch {}
  const langs = (navigator.languages && navigator.languages.length ? navigator.languages.join(', ') : navigator.language) || null
  return [
    { k: '语言', v: langs || NONE, none: !langs },
    { k: '时区', v: tz || NONE, none: !tz },
    { k: 'UA', v: navigator.userAgent || NONE, none: !navigator.userAgent },
    { k: 'WebGL 渲染器', v: readRenderer() || NONE, none: false },
  ].map((r) => ({ ...r, none: r.v === NONE }))
}

export default {
  id: 'fingerprint',
  nav: 'IP 与指纹',
  desc: '三件事，分开看',
  mood: 'focus',
  mount(el, { num }) {
    el.innerHTML = `
<div class="wrap">
  <header class="chapter-head">
    <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>IP 与指纹</span></div>
    <h2 class="h2" data-reveal="lines">门牌号、长相、档案，<br><span class="text-warm">三件事分开看</span></h2>
    <p class="lead" data-reveal>图形指纹能认出你的环境，它和网络路线是两回事。先分清出问题的是哪一件，再对症处理。</p>
  </header>

  <div class="fp-trio">
    ${PILLARS.map((p, i) => `
    ${i ? '<span class="fp-sep" aria-hidden="true"><i></i><b>≠</b><i></i></span>' : ''}
    <button type="button" class="fp-pillar" data-k="${p.k}" style="--c:${p.color}" aria-pressed="false">
      <span class="fp-pillar__beam" aria-hidden="true"></span>
      <span class="fp-pillar__art">${ART[p.k]}</span>
      <span class="fp-pillar__tag">${p.tag}</span>
      <span class="fp-pillar__title">${p.title}</span>
      <span class="fp-pillar__from">${p.from}</span>
      <span class="fp-pillar__plain">${p.plain}</span>
      <span class="fp-pillar__note" aria-hidden="true"></span>
      <span class="fp-stamp" aria-hidden="true"></span>
    </button>`).join('')}
  </div>

  <div class="fp-trial" data-reveal>
    <p class="fp-trial__q"><span class="fp-trial__k">试一试</span>这两招常见的补救，修到了哪件事？</p>
    <div class="fp-trial__btns" role="group" aria-label="选一招补救">
      ${Object.entries(TRIALS).map(([k, t]) => `<button type="button" class="btn btn--ghost btn--sm fp-try" data-try="${k}" aria-pressed="false">${t.label}</button>`).join('')}
    </div>
    <p class="fp-trial__verdict" aria-live="polite">点一招，看看它落在哪根柱子上。</p>
  </div>

  <section class="fp-checks" aria-labelledby="fp-checks-t">
    <div class="fp-checks__head">
      <h3 class="h3" id="fp-checks-t" data-reveal="lines">浏览器会透露的七件事</h3>
      <p class="muted" data-reveal>每一行：它能暴露什么，原作者怎么处理。</p>
    </div>
    <ol class="fp-rows" data-reveal="stagger">
      ${CHECKS.map((c, i) => `
      <li class="fp-row${c.hot ? ' is-hot' : ''}">
        <span class="fp-row__n latin">${String(i + 1).padStart(2, '0')}</span>
        <span class="fp-row__icon" aria-hidden="true"><svg viewBox="0 0 32 32">${ICONS[c.i]}</svg></span>
        <div class="fp-row__name">
          <p class="fp-row__k">${c.k}${c.hot ? ` <span class="tag tag--danger"><span class="dot"></span>${c.hot}</span>` : ''}</p>
          <p class="fp-row__say">${c.say}</p>
        </div>
        <div class="fp-row__col"><span class="fp-row__lab">能暴露什么</span><p>${c.expose}</p></div>
        <div class="fp-row__col"><span class="fp-row__lab is-how">我的处理方式</span><p>${c.how}</p></div>
      </li>`).join('')}
    </ol>
    <div class="fp-rules" data-reveal="stagger">
      ${RULES.map((r) => `<div class="fp-rule"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><p><b>${r.t}</b><span>${r.d}</span></p></div>`).join('')}
    </div>
  </section>

  <section class="fp-mirror" aria-labelledby="fp-mirror-t">
    <div class="fp-mirror__intro">
      <p class="fp-mirror__eyebrow"><span class="latin">Local inspection</span> · 自愿点击</p>
      <h3 class="h3" id="fp-mirror-t" data-reveal="lines">看看你的浏览器<br>愿意透露什么</h3>
      <p class="muted" data-reveal>像照一面镜子：只看这个页面本来就能看到的四样东西。</p>
      <ul class="fp-promise" data-reveal="stagger">
        <li>只读取本页可见的语言、时区、UA 与 WebGL 渲染器</li>
        <li>不计算 Canvas 指纹，不发 STUN 请求</li>
        <li>不联网，不保存结果，刷新即消失</li>
        <li>这个面板<b>不检测出口 IP</b></li>
      </ul>
      <p class="small faint" data-reveal>WebGL 信息机制见 <a class="fp-link" href="https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info" target="_blank" rel="noopener noreferrer">MDN · WEBGL_debug_renderer_info ↗</a>。能不能读到，取决于浏览器的隐私策略；没有读到值，不代表没有其他指纹。</p>
    </div>

    <div class="fp-term" data-reveal="scale">
      <div class="fp-term__bar">
        <span class="fp-term__dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="fp-term__title">本地读取 · 仅显示在本页</span>
        <span class="fp-term__led" aria-hidden="true"></span>
      </div>
      <div class="fp-term__body" aria-live="polite">
        <p class="fp-term__idle">尚未读取。点击后，结果只显示在本页。</p>
      </div>
      <div class="fp-term__foot">
        <button type="button" class="btn btn--primary btn--sm fp-read">在本地读取</button>
        <button type="button" class="btn btn--ghost btn--sm fp-clear" disabled>清除显示结果</button>
      </div>
      <div class="fp-term__pro pro-only">
        <p class="pro-badge">进阶 · 本面板实际调用</p>
        <p class="mono small">navigator.languages · Intl.DateTimeFormat().resolvedOptions().timeZone · navigator.userAgent · WEBGL_debug_renderer_info → UNMASKED_RENDERER_WEBGL</p>
      </div>
    </div>
  </section>

  <section class="fp-rtc" aria-labelledby="fp-rtc-t">
    <div class="fp-rtc__art" data-reveal="blur">
      <svg viewBox="0 0 520 300" role="img" aria-label="示意图：对讲机的声音可能绕开代收点，直接报出自家地址">
        <defs>
          <radialGradient id="fpRtcGlow"><stop offset="0%" stop-color="#ffb35c" stop-opacity=".5"/><stop offset="100%" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
        </defs>
        <path class="fp-rtc__ground" d="M10 250 H510"/>
        <g class="fp-rtc__house">
          <path d="M40 170 L90 130 L140 170"/><path d="M50 162 V250 H130 V162"/><rect x="78" y="204" width="24" height="46" rx="3"/>
          <rect x="60" y="178" width="16" height="14" rx="2" class="win"/><rect x="104" y="178" width="16" height="14" rx="2" class="win"/>
        </g>
        <text x="90" y="278" text-anchor="middle" class="fp-rtc__t">你家</text>
        <g class="fp-rtc__hub">
          <circle cx="262" cy="204" r="46" fill="url(#fpRtcGlow)"/>
          <path d="M232 250 V196 L262 176 L292 196 V250"/><path d="M250 250 V222 H274 V250"/>
          <path d="M240 196 H284" class="dim"/>
        </g>
        <text x="262" y="278" text-anchor="middle" class="fp-rtc__t">代收点</text>
        <g class="fp-rtc__isle">
          <path d="M404 240 Q420 222 446 224 Q470 214 494 240 Z"/><path d="M444 226 V196 M436 204 H452" /><circle cx="444" cy="190" r="5" class="lamp"/>
        </g>
        <text x="448" y="278" text-anchor="middle" class="fp-rtc__t">Claude</text>
        <path class="fp-rtc__ok" d="M132 218 C180 206 206 206 224 212"/>
        <path class="fp-rtc__ok" d="M300 212 C340 204 370 208 404 226"/>
        <path class="fp-rtc__leak" d="M104 150 C170 40 360 30 438 176"/>
        <g class="fp-rtc__talkie" transform="translate(96 108)">
          <rect x="-11" y="-18" width="22" height="34" rx="5"/><path d="M-5 -18 V-30"/><path d="M-5 -6 H5 M-5 2 H5"/>
          <path class="wave" d="M16 -14 a10 10 0 0 1 0 14"/><path class="wave w2" d="M22 -20 a18 18 0 0 1 0 26"/>
        </g>
        <g class="fp-rtc__warn" transform="translate(270 50)">
          <rect x="-70" y="-16" width="140" height="30" rx="15"/>
          <text x="0" y="5" text-anchor="middle">可能绕开代收点</text>
        </g>
      </svg>
      <p class="tiny faint">示意图：浏览器里的对讲机（WebRTC）可能走 UDP，绕开普通 HTTP 代理。这里不发任何请求。</p>
    </div>
    <div class="fp-rtc__txt">
      <h3 class="h3" id="fp-rtc-t" data-reveal="lines">对讲机的四步复核</h3>
      <p class="muted" data-reveal>WebRTC 是浏览器里的对讲机，视频通话要用它。它可能绕开代收点，直接报出地址。所以要单独复核。</p>
      <ol class="steps fp-rtc__steps" data-reveal="stagger">
        ${RTC_STEPS.map((s) => `<li>${s}</li>`).join('')}
      </ol>
    </div>
  </section>
</div>`

    /* ---------------- 灯柱：悬停 / 点按 ---------------- */
    const trio = el.querySelector('.fp-trio')
    const pillars = [...el.querySelectorAll('.fp-pillar')]
    // 入场自己做：CSS 过渡只在入场结束后启用，避免和 GSAP 抢同一个属性
    if (prefersReduced) trio.classList.add('is-ready')
    else {
      const parts = trio.children
      gsap.set(parts, { opacity: 0, y: 40 })
      onEnter(trio, () => gsap.to(parts, {
        opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, clearProps: 'opacity,transform',
        onComplete: () => trio.classList.add('is-ready'),
      }), { start: 'top 86%' })
    }
    let focusK = null
    const light = (k) => {
      trio.dataset.focus = k || ''
      if (!k) delete trio.dataset.focus
      pillars.forEach((p) => p.classList.toggle('is-lit', p.dataset.k === k))
    }
    pillars.forEach((p) => {
      p.addEventListener('click', () => {
        focusK = focusK === p.dataset.k ? null : p.dataset.k
        pillars.forEach((q) => q.setAttribute('aria-pressed', String(q.dataset.k === focusK)))
        light(focusK)
        audio.sfx(focusK ? 'toggle-on' : 'toggle-off')
      })
      if (!isTouch) {
        p.addEventListener('pointerenter', () => { if (!trio.dataset.trial) light(p.dataset.k) })
        p.addEventListener('pointerleave', () => { if (!trio.dataset.trial) light(focusK) })
      }
    })

    /* ---------------- 试一试 ---------------- */
    const tryBtns = el.querySelectorAll('.fp-try')
    const verdict = el.querySelector('.fp-trial__verdict')
    let trialTl = null
    function runTrial(key) {
      const t = TRIALS[key]
      trialTl?.kill()
      trio.dataset.trial = key
      tryBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.try === key)))
      pillars.forEach((p) => {
        p.classList.remove('is-hit', 'is-miss', 'is-idle')
        p.querySelector('.fp-pillar__note').textContent = ''
        p.querySelector('.fp-stamp').textContent = ''
        const k = p.dataset.k
        p.classList.add(k === t.hit ? 'is-hit' : k === t.miss ? 'is-miss' : 'is-idle')
      })
      light(null)
      const hitEl = pillars.find((p) => p.dataset.k === t.hit)
      const missEl = pillars.find((p) => p.dataset.k === t.miss)
      const stamp = missEl.querySelector('.fp-stamp')
      hitEl.querySelector('.fp-pillar__note').textContent = t.hitNote
      stamp.textContent = t.missNote
      verdict.textContent = t.verdict
      // 手机上灯柱在按钮上方：落章那根柱子不在视口里时，带读者过去看
      const r = missEl.getBoundingClientRect()
      if (r.top < 64 || r.bottom > window.innerHeight) scrollToTarget(missEl, { offset: -90, duration: 0.9 })

      if (prefersReduced) { audio.sfx('deny'); return }
      trialTl = gsap.timeline()
      trialTl
        .call(() => audio.sfx('whoosh'))
        .fromTo(hitEl.querySelector('.fp-pillar__beam'), { opacity: 0, scaleY: 0 }, { opacity: 1, scaleY: 1, duration: 0.7, ease: 'expo.out', transformOrigin: '50% 100%' }, 0)
        .fromTo(hitEl.querySelector('.fp-pillar__note'), { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }, 0.25)
        .fromTo(stamp, { scale: 2.4, rotate: -22, opacity: 0 }, { scale: 1, rotate: -9, opacity: 1, duration: 0.42, ease: 'back.out(2.2)' }, 0.75)
        .call(() => audio.sfx('deny'), null, 0.8)
        .fromTo(missEl, { x: 0 }, { keyframes: { x: [-7, 6, -4, 3, 0] }, duration: 0.42, ease: 'none' }, 0.82)
        .fromTo(verdict, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, 0.9)
    }
    tryBtns.forEach((b) => b.addEventListener('click', () => runTrial(b.dataset.try)))

    /* ---------------- 本机自检：打字机 ---------------- */
    const body = el.querySelector('.fp-term__body')
    const readBtn = el.querySelector('.fp-read')
    const clearBtn = el.querySelector('.fp-clear')
    const term = el.querySelector('.fp-term')
    const IDLE = '<p class="fp-term__idle">尚未读取。点击后，结果只显示在本页。</p>'
    let run = 0
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

    async function typeInto(node, text, speed) {
      const id = run
      if (prefersReduced) { node.textContent = text; return true }
      for (let i = 0; i < text.length; i++) {
        if (id !== run) return false
        node.textContent += text[i]
        if (i % 2 === 0) audio.sfx('type')
        await sleep(speed)
      }
      return true
    }

    async function inspect() {
      const id = ++run
      readBtn.disabled = true
      clearBtn.disabled = false
      term.classList.add('is-reading')
      audio.sfx('click')
      body.innerHTML = ''
      const rows = readLocal()
      const head = document.createElement('p')
      head.className = 'fp-term__cmd'
      body.appendChild(head)
      if (!(await typeInto(head, '$ 读取本页可见的四项 · 不联网', 16))) return
      for (const r of rows) {
        if (id !== run) return
        await sleep(prefersReduced ? 0 : 160)
        const line = document.createElement('div')
        line.className = 'fp-term__row' + (r.none ? ' is-none' : '')
        line.innerHTML = `<span class="fp-term__k">${esc(r.k)}</span><span class="fp-term__v"></span>`
        body.appendChild(line)
        const v = line.querySelector('.fp-term__v')
        const speed = r.v.length > 60 ? 7 : 22
        if (!(await typeInto(v, r.v, speed))) return
      }
      if (id !== run) return
      await sleep(prefersReduced ? 0 : 240)
      const end = document.createElement('div')
      end.className = 'fp-term__end'
      end.innerHTML = `<p><span class="ok">✓</span> 读取完成。没有联网，没有保存。</p><p><span class="warn">!</span> 这里看不到你的出口 IP。没读到的值，不代表没有其他指纹。</p>`
      body.appendChild(end)
      if (!prefersReduced) gsap.from(end.children, { opacity: 0, y: 8, duration: 0.6, ease: 'expo.out', stagger: 0.12 })
      audio.sfx('success')
      term.classList.remove('is-reading')
      term.classList.add('is-done')
      readBtn.disabled = false
      readBtn.textContent = '再读一次'
    }
    function clearAll() {
      run++
      body.innerHTML = IDLE
      term.classList.remove('is-reading', 'is-done')
      readBtn.disabled = false
      readBtn.textContent = '在本地读取'
      clearBtn.disabled = true
      audio.sfx('close')
    }
    readBtn.addEventListener('click', inspect)
    clearBtn.addEventListener('click', clearAll)

    reveal(el)
  },
}

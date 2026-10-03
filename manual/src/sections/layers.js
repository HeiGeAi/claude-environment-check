// 第 05 章 · 四道防线
// 招牌：桌面端 pin 住的滚动叙事，房子外面一圈圈亮起四道防线；手机端退化为纵向卡片。
// 警示：「定时补救」计时器，数到 6 秒时，红色的第一个包早已飞到对面。
import './layers.css'
import { gsap, ScrollTrigger, reveal, whenVisible, prefersReduced, lenis } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { pushMood, popMood } from '../core/mood.js'
import { mascot } from '../core/mascot.js'

/* ------------------------------------------------------------
   四道防线的数据（事实来自原版第 01 章与第 04 章）
   ------------------------------------------------------------ */
const STEPS = [
  {
    t: '流量先收进来',
    orig: 'TUN 或系统代理＋CLI 注入，覆盖浏览器、桌面端和后台任务。',
    meta: '家里所有要寄的包裹，先集中到<strong>前厅</strong>。浏览器、桌面端、后台任务，一个都别落在外面。',
    tags: [['TUN', 'warm'], ['系统代理', 'warm'], ['CLI 注入', 'warm']],
  },
  {
    t: '出口保持受控',
    orig: '进程、路径、域名交叉匹配；专用策略组不自动回落 DIRECT。',
    meta: '只认<strong>一个代收点</strong>。代收点关门了，包裹宁可不寄，也不许自己从家门口寄。',
    tags: [['进程', 'warm'], ['路径', 'warm'], ['域名', 'warm'], ['不自动回落 DIRECT', 'danger']],
  },
  {
    t: '失败时挡在外面',
    orig: '启动门禁、持续守卫、系统级阻断，分别负责准入、发现和拦截。',
    meta: '出门前有<strong>安检</strong>，平时有保安<strong>巡逻</strong>，出了事直接<strong>锁门</strong>。',
    trio: [['安检', '启动门禁', '准入'], ['巡逻', '持续守卫', '发现'], ['锁门', '系统级阻断', '拦截']],
  },
  {
    t: '防止防线被自己拆掉',
    orig: '配置权限、变更审批、升级验收、恢复演练，让自动化也受约束。',
    meta: '<strong>钥匙不乱给</strong>，包括替你干活的 AI 助手。谁想改防线，都要先过审批。',
    tags: [['配置权限', 'info'], ['变更审批', 'info'], ['升级验收', 'info'], ['恢复演练', 'info']],
  },
]

const STRICT = [
  ['圈定保护集合', '把要保护的程序一个个登记清楚，一个都别漏。', 'CLI、Desktop 全部 Helper、专用浏览器、后台 supervisor、自动更新、MCP 与外部调用工具逐一登记。云端或 SSH 远端任务另有出口，本机防火墙管不到。'],
  ['建立独立的出站限制', '另请一位系统级的门卫，整棵进程树都归它管。', '选择能覆盖整个进程树的系统网络过滤方案，或把工具放进仅能访问代理网关的隔离环境。虚拟机本身不自动安全，关键在网关拒绝任意直连。'],
  ['只给代理进程上游权限', '只有代收点能往外寄。业务程序只能把包裹交给代收点。', '业务进程只可连接指定本地代理 / 网关；代理只可连已审核的上游。DNS、IPv6、UDP / QUIC 要么纳入受控路径，要么明确阻断。'],
  ['先封住，再启动', '先确认门卫在岗、代收点在线，再开工。宁可多等一会儿。', '启动前检查阻断层生效、配置代际、代理健康、出口身份；UNKNOWN / DEGRADED 在严格策略下拒绝新会话。需要接受不可用时间增加。'],
  ['持续校验并用反例验收', '故意制造掉线、换网这些意外，确认照样漏不出去。', '代理崩溃、换网、新网卡、睡眠唤醒、更新改路径、新域名都必须无法从业务进程直连。保留物理接口抓包与出口接收日志。'],
]

const DEFENSE = [
  ['CLI 启动门禁', '设计示例：wrapper 调用预检，失败 exit 78', '能阻止经过此入口的新启动；不能拦截直接执行原二进制或其他启动器'],
  ['route-guard', 'SAFE / DEGRADED / LEAK', '需要另行实现与验收，可判定路由异常并调用阻断与停进程；严格模式下未知状态拒绝新启动；运行期由独立阻断层守住'],
  ['net-guard', '出口 / IPv6 / 路由锁，NET_MODE', '需要另行实现与验收，周期检查与自愈负责发现漂移，发包前阻断由系统层负责'],
  ['PF 与路由锁', 'IPv4 / IPv6 已知段、语法预检', '地址集合只作补充；所有未知目标由独立进程出站约束覆盖'],
  ['全目的地出口约束<em>建议补强</em>', '进程感知防火墙或隔离网关', '需要独立部署与逐协议演练；选型后必须单独部署并完成反例测试'],
]

/* ------------------------------------------------------------
   同心圆防线插画
   ------------------------------------------------------------ */
const C = 300
const R = [100, 156, 212, 270]
const polar = (r, deg) => { const a = (deg * Math.PI) / 180; return [+(C + r * Math.sin(a)).toFixed(2), +(C - r * Math.cos(a)).toFixed(2)] }
const arc = (r, a0, a1) => { const [x0, y0] = polar(r, a0); const [x1, y1] = polar(r, a1); return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}` }
const ringPath = (r) => `${arc(r, 0, 180)} ${arc(r, 180, 359.9).replace(/^M [^A]+/, '')}`

const ICON = {
  check: '<path d="M-6 0.5l4 4 8-8.5"/>',
  lock: '<rect x="-7" y="-2" width="14" height="10" rx="2"/><path d="M-4 -2v-3a4 4 0 0 1 8 0v3"/>',
  key: '<circle cx="-3" cy="0" r="4"/><path d="M1 0h8M6 0v3M9 0v2"/>',
  scan: '<path d="M-7 -3v-4h4M7 -3v-4h-4M-7 3v4h4M7 3v4h-4M-5 0h10"/>',
}
const gIcon = (k, x, y, cls = '') => `<g class="ly-ico ${cls}" transform="translate(${x} ${y})">${ICON[k]}</g>`

function ringsSVG({ uid, mini = false, lit = 0 }) {
  const pkg = Array.from({ length: 8 }, (_, i) => `<g transform="rotate(${i * 45 + 22.5} ${C} ${C})"><circle cx="${C}" cy="${C - R[0] - 30}" r="4.2" class="ly-pkg" style="animation-delay:${(-i * 0.37).toFixed(2)}s"/></g>`).join('')
  const [gx, gy] = polar(R[1], 45)
  const [dx, dy] = polar(R[1], 270)
  const keys = [[90, '配置权限'], [135, '变更审批'], [225, '升级验收'], [270, '恢复演练']]
  const cls = (i) => `ly-ring ly-r${i + 1}${lit >= i + 1 ? ' is-lit' : ''}${lit === i + 1 ? ' is-focus' : ''}`
  return `<svg class="ly-svg${mini ? ' ly-svg--mini' : ''}" viewBox="-50 -50 700 700" aria-hidden="true" data-lit="${lit}">
    <defs>
      <radialGradient id="${uid}-core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb35c" stop-opacity=".32"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
      <linearGradient id="${uid}-house" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e2334"/><stop offset="1" stop-color="#11141e"/></linearGradient>
    </defs>
    <circle cx="${C}" cy="${C}" r="330" class="ly-grid"/>
    ${R.map((r) => `<circle cx="${C}" cy="${C}" r="${r}" class="ly-base"/>`).join('')}
    <circle cx="${C}" cy="${C}" r="130" fill="url(#${uid}-core)"/>

    <!-- 第 4 道：钥匙与审批（最外） -->
    <g class="${cls(3)}" data-ring="4">
      <circle cx="${C}" cy="${C}" r="${R[3]}" class="ly-crenel"/>
      <path d="${ringPath(R[3])}" pathLength="1" class="ly-line"/>
      ${keys.map(([a, t]) => { const [x, y] = polar(R[3], a); const w = t.length * 15 + 38; return `<g class="ly-chip" transform="translate(${x} ${y})"><rect x="${-w / 2}" y="-15" width="${w}" height="30" rx="15"/>${gIcon('key', -w / 2 + 18, 0)}<text x="${9}" y="5" text-anchor="middle" class="ly-txt">${t}</text></g>` }).join('')}
    </g>

    <!-- 第 3 道：安检、巡逻、锁门 -->
    <g class="${cls(2)}" data-ring="3">
      <path d="${ringPath(R[2])}" pathLength="1" class="ly-line"/>
      <g class="ly-patrol"><path d="${arc(R[2], -40, 0)}" class="ly-patrol__trail"/><circle cx="${C}" cy="${C - R[2]}" r="8" class="ly-patrol__dot"/></g>
      ${[[205, 'scan', '安检'], [155, 'lock', '锁门']].map(([a, ic, t]) => { const [x, y] = polar(R[2], a); return `<g class="ly-node" transform="translate(${x} ${y})"><circle r="19"/>${gIcon(ic, 0, 0)}<text y="44" text-anchor="middle" class="ly-txt">${t}</text></g>` }).join('')}
      ${(() => { const [x, y] = polar(R[2] + 30, 300); return `<text x="${x}" y="${y}" text-anchor="middle" class="ly-txt ly-txt--safe">巡逻</text>` })()}
    </g>

    <!-- 第 2 道：只认一个代收点 -->
    <g class="${cls(1)}" data-ring="2">
      <path d="${arc(R[1], 57, 393)}" pathLength="1" class="ly-line"/>
      <path d="M ${C + 20} ${C - 20} L ${gx} ${gy} L 548 52" class="ly-exit"/>
      <g class="ly-kiosk" transform="translate(572 28)">
        <rect x="-30" y="-18" width="60" height="44" rx="5"/>
        <path d="M -36 -18 L 36 -18 L 30 -32 L -30 -32 Z" class="ly-kiosk__awn"/>
        <rect x="-10" y="6" width="20" height="20" rx="2" class="ly-kiosk__door"/>
        <text x="0" y="52" text-anchor="middle" class="ly-txt ly-txt--warm">代收点</text>
      </g>
      <g class="ly-direct" transform="translate(${dx} ${dy})">
        <rect x="-44" y="-15" width="88" height="30" rx="15"/>
        <text x="0" y="5" text-anchor="middle" class="ly-txt">DIRECT</text>
        <path d="M -34 0 L 34 0"/>
      </g>
    </g>

    <!-- 第 1 道：前厅 -->
    <g class="${cls(0)}" data-ring="1">
      <path d="${ringPath(R[0])}" pathLength="1" class="ly-line"/>
      <g class="ly-pkgs">${pkg}</g>
    </g>

    <!-- 房子 -->
    <g class="ly-house">
      <path d="M 238 292 L 300 238 L 362 292 Z" class="ly-house__roof"/>
      <rect x="250" y="286" width="100" height="70" rx="6" fill="url(#${uid}-house)" class="ly-house__body"/>
      <rect x="288" y="318" width="24" height="38" rx="3" class="ly-house__door"/>
      <rect x="262" y="300" width="18" height="16" rx="2" class="ly-house__win"/>
      <rect x="320" y="300" width="18" height="16" rx="2" class="ly-house__win"/>
      <text x="${C}" y="384" text-anchor="middle" class="ly-txt ly-txt--house">你的电脑</text>
    </g>

    <!-- 序号刻度 -->
    ${R.map((r, i) => `<g class="ly-badge${lit >= i + 1 ? ' is-lit' : ''}" data-badge="${i + 1}" transform="translate(${C} ${C - r})"><circle r="15"/><text y="5" text-anchor="middle">0${i + 1}</text></g>`).join('')}
  </svg>`
}

function laneSVG() {
  return `<svg class="ly-lane" viewBox="0 0 560 240" aria-hidden="true">
    <path d="M 150 150 C 250 30 370 30 440 118" class="ly-lane__road"/>
    <path d="M 150 150 C 250 30 370 30 440 118" pathLength="1" class="ly-lane__trail"/>
    <g class="ly-lane__house" transform="translate(96 200)">
      <path d="M -62 -64 L 0 -112 L 62 -64 Z" class="ly-house__roof"/>
      <rect x="-52" y="-66" width="104" height="66" rx="6" class="ly-lane__body"/>
      <rect x="-12" y="-38" width="24" height="38" rx="3" class="ly-house__door"/>
      <text x="0" y="26" text-anchor="middle" class="ly-txt ly-txt--sm">你的电脑</text>
      <g class="ly-lane__kill"><rect x="-64" y="-154" width="128" height="34" rx="17"/><text x="0" y="-132" text-anchor="middle">进程已结束</text><path d="M 0 -122 L 0 -114" /></g>
    </g>
    <g class="ly-lane__island" transform="translate(478 150)">
      <ellipse rx="70" ry="14" class="ly-lane__top"/>
      <path d="M -68 2 C -48 34 -22 56 0 62 C 22 56 48 34 68 2 Z" class="ly-lane__rock"/>
      <rect x="10" y="-62" width="24" height="62" rx="3" class="ly-lane__tower"/>
      <text x="0" y="86" text-anchor="middle" class="ly-txt ly-txt--sm">对面的服务</text>
    </g>
    <g class="ly-lane__got" transform="translate(456 58)"><rect x="-98" y="-18" width="196" height="36" rx="18"/><text x="0" y="6" text-anchor="middle">第一个包：已经送达</text></g>
    <g class="ly-lane__keep"><text x="300" y="30" text-anchor="middle">既有连接也可能继续有效</text></g>
    <g class="ly-lane__pkt"><g transform="translate(-30 -32.3)">${mascot({ size: 60, face: 'leak', tint: 'danger' })}</g></g>
  </svg>`
}

function dialSVG() {
  const [nx, ny] = [100 + 84 * Math.sin(0.12), 100 - 84 * Math.cos(0.12)]
  return `<svg class="ly-dial" viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="100" r="92" class="ly-dial__outer"/>
    ${Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; const r0 = i % 5 ? 88 : 84; return `<line x1="${(100 + r0 * Math.sin(a)).toFixed(1)}" y1="${(100 - r0 * Math.cos(a)).toFixed(1)}" x2="${(100 + 92 * Math.sin(a)).toFixed(1)}" y2="${(100 - 92 * Math.cos(a)).toFixed(1)}" class="ly-dial__tick"/>` }).join('')}
    <circle cx="100" cy="100" r="74" class="ly-dial__track"/>
    <path d="M 100 26 A 74 74 0 1 1 99.99 26" pathLength="1" class="ly-dial__prog"/>
    <g class="ly-dial__notch"><circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="5.5"/></g>
  </svg>`
}

const ipIcons = {
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6M12 8v4.5l3 2"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4M10 12h5M10 15.5h5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/>',
}
const ico = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ipIcons[k]}</svg>`

export default {
  id: 'layers',
  nav: '四道防线',
  desc: '从收拢流量到防止自己拆墙',
  mood: 'focus',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>四道防线</span></div>
        <h2 class="h2" data-reveal="lines">把「绝不直连」<br>建成<span class="text-warm">四道防线</span></h2>
        <p class="lead" data-reveal>每一道只管一件事，各有覆盖范围，也各有验收标准。往下滚，看它们在房子外面一圈圈亮起来。</p>
      </header>
    </div>

    <div class="s-layers__pin">
      <div class="wrap s-layers__stage">
        <div class="s-layers__art">${ringsSVG({ uid: 'lyA' })}</div>
        <div class="s-layers__story">
          <ol class="s-layers__rail" aria-label="四道防线">
            ${STEPS.map((s, i) => `<li><button type="button" data-go="${i + 1}"><span class="latin">0${i + 1}</span><span class="t">${s.t}</span></button></li>`).join('')}
          </ol>
          <div class="s-layers__steps">
            ${STEPS.map((s, i) => `
            <article class="s-layers__step" data-step="${i + 1}">
              <div class="s-layers__mini" aria-hidden="true">${ringsSVG({ uid: `lyM${i}`, mini: true, lit: i + 1 })}</div>
              <div class="s-layers__step-body">
                <span class="s-layers__n latin">0${i + 1}<small>/ 04</small></span>
                <h3 class="s-layers__t">${s.t}</h3>
                <p class="s-layers__orig">${s.orig}</p>
                <div class="metaphor"><span>${s.meta}</span></div>
                ${s.tags ? `<ul class="s-layers__tags">${s.tags.map(([t, c]) => `<li class="tag tag--${c}">${t}</li>`).join('')}</ul>` : ''}
                ${s.trio ? `<ul class="s-layers__trio">${s.trio.map(([a, b, c]) => `<li><b>${a}</b><span>${b}</span><em>负责${c}</em></li>`).join('')}</ul>` : ''}
              </div>
            </article>`).join('')}
          </div>
        </div>
      </div>
      <p class="s-layers__scrollhint tiny" aria-hidden="true">继续滚动</p>
    </div>

    <div class="wrap">
      <section class="s-layers__goal" aria-label="设计目标">
        <header class="s-layers__sub" data-reveal>
          <span class="s-layers__eyebrow">设计目标 · 一张图说清</span>
          <h3 class="h3">要保护的程序，只有一条路</h3>
        </header>
        <div class="s-layers__lanes" data-reveal="stagger">
          <div class="s-layers__lane s-layers__lane--ok">
            <span class="s-layers__node"><span class="s-layers__m">${mascot({ size: 46, face: 'happy' })}</span>被保护进程</span>
            <span class="s-layers__flow" aria-hidden="true"><i></i></span>
            <span class="s-layers__node s-layers__node--end">受控代理<b class="tag tag--safe"><span class="dot"></span>放行</b></span>
          </div>
          <div class="s-layers__lane s-layers__lane--no">
            <span class="s-layers__node"><span class="s-layers__m">${mascot({ size: 46, face: 'blocked', tint: 'ghost' })}</span>其他出口</span>
            <span class="s-layers__flow" aria-hidden="true"><i></i><em></em></span>
            <span class="s-layers__node s-layers__node--end">拒绝<b class="tag tag--danger"><span class="dot"></span>不放行</b></span>
          </div>
        </div>
        <ul class="s-layers__rules" data-reveal="stagger">
          <li>禁止自动退回 DIRECT。</li>
          <li>新域名也不能获得例外。</li>
          <li>代理自身拥有最小的上游连接权限。</li>
          <li>业务进程没有直接访问物理网络的权限。</li>
        </ul>
      </section>

      <section class="s-layers__warn" aria-label="定时补救的警示">
        <div class="s-layers__warn-head" data-reveal>
          <span class="tag tag--danger"><span class="dot"></span>警示</span>
          <h3 class="h3">定时补救，不叫「死都不漏」</h3>
          <p class="muted">守卫隔 6 秒、20 秒或 120 秒发现问题，再去杀进程。可第一个包，可能在这之前就已经发出去了。</p>
        </div>
        <div class="s-layers__timer">
          <div class="s-layers__clock">
            ${dialSVG()}
            <div class="s-layers__digits"><b>0.0</b><span>秒</span></div>
            <div class="s-layers__clock-cap">守卫计时</div>
            <div class="s-layers__notch-cap"><i></i>红点：第一个包发出的时刻</div>
          </div>
          <div class="s-layers__lane-wrap">${laneSVG()}</div>
        </div>
        <div class="s-layers__timer-bar">
          <div class="segmented" role="group" aria-label="守卫多久出手">
            ${[6, 20, 120].map((n, i) => `<button type="button" data-sec="${n}" aria-pressed="${i === 0}">${n} 秒<span class="s-layers__sec-l">后杀进程</span></button>`).join('')}
          </div>
          <button type="button" class="btn btn--primary btn--sm" data-act="timer">开始计时</button>
          <span class="tiny faint">演示已加速，不读取你电脑的网络。</span>
        </div>
        <p class="s-layers__verdict" aria-live="polite"></p>
        <div class="callout callout--danger s-layers__base">
          <div class="callout__title">严格防护，必须在发包前拒绝</div>
          <p>严格防护的底座必须在发包前拒绝，守卫只是补充。<span class="pro-only">对 PF state 的处理应限于受影响连接，避免全局清空打断其他任务。</span></p>
        </div>
      </section>

      <section class="s-layers__strict" aria-label="严格版五步">
        <header class="s-layers__sub" data-reveal>
          <span class="s-layers__eyebrow">严格版</span>
          <h3 class="h3">让漏掉的域名也没有路可走</h3>
          <p class="muted">域名名单总会漏。严格版的思路是：就算有地址没写进名单，业务程序也找不到直连的路。</p>
        </header>
        <ol class="s-layers__five" data-reveal="stagger">
          ${STRICT.map(([t, easy, full], i) => `<li><span class="s-layers__five-n latin">0${i + 1}</span><div><b>${t}</b><p class="newbie-only">${easy}</p><p class="pro-only">${full}</p></div></li>`).join('')}
        </ol>
      </section>

      <section class="s-layers__ip" aria-label="IP 隐藏的边界">
        <header class="s-layers__sub" data-reveal>
          <span class="s-layers__eyebrow">IP 隐藏的边界</span>
          <h3 class="h3">代收点能换掉寄件地址，管不了的也要知道</h3>
        </header>
        <div class="s-layers__ip-grid">
          <div class="s-layers__ip-can" data-reveal>
            <span class="s-layers__ip-ico">${ico('swap')}</span>
            <b>能做到</b>
            <p>改变服务端看到的网络来源。对方只看得到代收点的地址。</p>
          </div>
          <ul class="s-layers__ip-cant" data-reveal="stagger">
            <li><span class="s-layers__ip-ico">${ico('history')}</span><div><b>撤不回</b><p>过去已经被记录下的地址。</p></div></li>
            <li><span class="s-layers__ip-ico">${ico('doc')}</span><div><b>挡不住</b><p>IP 被写进日志、提示词，或者出现在上传的截图里。</p></div></li>
            <li><span class="s-layers__ip-ico">${ico('eye')}</span><div><b>还看得到</b><p>前置代理和出口提供商，仍可能看到连接元数据。</p></div></li>
          </ul>
        </div>
        <div class="callout callout--warn s-layers__tls" data-reveal>
          <div class="callout__title">${ico('lock')}保持端到端 TLS</div>
          <p>不安装来源不明的拦截证书。<span class="pro-only">透明转发若插入带真实地址的请求头，也会破坏目标。</span></p>
        </div>
      </section>

      <section class="pro-only s-layers__pro" aria-label="防线表">
        <header class="s-layers__sub">
          <span class="pro-badge">进阶 · 防线表</span>
          <h3 class="h3">每道防线能做什么，不能做什么</h3>
        </header>
        <div class="s-layers__dt" role="table" aria-label="防线表">
          <div class="s-layers__dr s-layers__dr--head" role="row"><span role="columnheader">防线</span><span role="columnheader">实施要求</span><span role="columnheader">能做 / 不能做</span></div>
          ${DEFENSE.map(([a, b, c]) => `<div class="s-layers__dr" role="row"><span role="rowheader"><b>${a}</b></span><span role="cell"><code>${b}</code></span><span role="cell">${c}</span></div>`).join('')}
        </div>
      </section>
    </div>`

    /* ---------------- 滚动叙事：四道防线 ---------------- */
    const pin = el.querySelector('.s-layers__pin')
    const art = el.querySelector('.s-layers__art .ly-svg')
    const stepEls = el.querySelectorAll('.s-layers__step')
    const railBtns = el.querySelectorAll('[data-go]')
    const rings = art.querySelectorAll('.ly-ring')
    const badges = art.querySelectorAll('.ly-badge')
    let cur = -1
    let st = null

    function setStep(n, withSound) {
      if (n === cur) return
      cur = n
      art.dataset.lit = n
      art.parentElement.dataset.lit = n
      rings.forEach((r) => {
        const i = +r.dataset.ring
        r.classList.toggle('is-lit', i <= n)
        r.classList.toggle('is-focus', i === n)
      })
      badges.forEach((b) => b.classList.toggle('is-lit', +b.dataset.badge <= n))
      stepEls.forEach((s) => s.classList.toggle('is-on', +s.dataset.step === Math.max(1, n)))
      railBtns.forEach((b) => b.setAttribute('aria-current', String(+b.dataset.go === n)))
      if (withSound && n > 0) {
        audio.sfx('step')
        if (n === 4) gsap.delayedCall(0.35, () => audio.sfx('chord'))
      }
    }

    const mm = gsap.matchMedia()
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      el.classList.add('is-pinned')
      setStep(0, false)
      st = ScrollTrigger.create({
        trigger: pin,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * 2.8)}`,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          el.style.setProperty('--ly-p', self.progress.toFixed(4))
          setStep(Math.min(4, Math.floor(self.progress * 4.0001) + 1), true)
        },
        onLeaveBack: () => setStep(0, false),
      })
      // 入场：四个圈从中心浮现
      gsap.from(art.querySelectorAll('.ly-base, .ly-house, .ly-badge'), { opacity: 0, scale: 0.9, svgOrigin: `${C} ${C}`, duration: 1.2, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: pin, start: 'top 80%', once: true } })
      return () => {
        el.classList.remove('is-pinned')
        st = null
        setStep(4, false)
      }
    })
    mm.add('(max-width: 899px), (prefers-reduced-motion: reduce)', () => { setStep(4, false) })

    railBtns.forEach((b) => b.addEventListener('click', () => {
      const n = +b.dataset.go
      audio.sfx('click')
      if (!st) return
      const y = st.start + ((n - 0.5) / 4) * (st.end - st.start)
      if (lenis) lenis.scrollTo(y, { duration: 1.2 })
      else window.scrollTo({ top: y, behavior: prefersReduced ? 'auto' : 'smooth' })
    }))

    /* ---------------- 定时补救计时器 ---------------- */
    const secBtns = el.querySelectorAll('[data-sec]')
    const timerBtn = el.querySelector('[data-act="timer"]')
    const warn = el.querySelector('.s-layers__warn')
    const digits = el.querySelector('.s-layers__digits b')
    const prog = el.querySelector('.ly-dial__prog')
    const lane = el.querySelector('.ly-lane')
    const pkt = lane.querySelector('.ly-lane__pkt')
    const trail = lane.querySelector('.ly-lane__trail')
    const verdict = el.querySelector('.s-layers__verdict')
    const LANE = 'M 150 150 C 250 30 370 30 440 118'
    let sec = 6
    let ttl = null
    let tMood = false

    const endMood = () => { if (tMood) { popMood(); tMood = false } }

    function resetTimer() {
      ttl?.kill(); ttl = null
      endMood()
      warn.classList.remove('is-run', 'is-done', 'is-sent')
      digits.textContent = '0.0'
      gsap.set(prog, { strokeDashoffset: 1 })
      gsap.set(trail, { strokeDashoffset: 1 })
      gsap.set(pkt, { x: 150, y: 150, opacity: 0, scale: 1 })
      verdict.textContent = ''
    }

    function playTimer() {
      resetTimer()
      const n = sec
      const obj = { v: 0 }
      const D = 3.4
      ttl = gsap.timeline({ onComplete: () => gsap.delayedCall(1.4, endMood) })
      ttl.call(() => { warn.classList.add('is-run'); audio.sfx('click'); pushMood('tension'); tMood = true }, null, 0)
      ttl.to(obj, { v: n, duration: D, ease: 'none', onUpdate: () => { digits.textContent = obj.v < 10 ? obj.v.toFixed(1) : Math.floor(obj.v).toString() } }, 0.1)
      ttl.to(prog, { strokeDashoffset: 0, duration: D, ease: 'none' }, 0.1)
      for (let k = 1; k <= 6; k++) ttl.call(() => audio.sfx('heartbeat'), null, 0.1 + (D * k) / 6 - 0.05)
      // 第一个包：刚开始计时就已经飞出去
      ttl.set(pkt, { opacity: 1 }, 0.18)
      ttl.call(() => audio.sfx('whoosh'), null, 0.18)
      ttl.to(pkt, { motionPath: { path: LANE }, duration: 0.95, ease: 'power3.inOut' }, 0.18)
      ttl.to(trail, { strokeDashoffset: 0, duration: 0.95, ease: 'power3.inOut' }, 0.18)
      ttl.call(() => { warn.classList.add('is-sent'); audio.sfx('alarm'); audio.duck(0.4, 1200) }, null, 1.13)
      // 守卫出手，但已经晚了
      ttl.call(() => { warn.classList.add('is-done'); audio.sfx('gate') }, null, D + 0.15)
      ttl.call(() => {
        audio.sfx('deny')
        verdict.innerHTML = `守卫在 <b>${n} 秒</b>时出手，结束了进程。<b class="text-danger">可第一个包，早就飞到对面了。</b>`
      }, null, D + 0.45)
      if (prefersReduced) { ttl.progress(1, false); endMood() }
    }

    secBtns.forEach((b) => b.addEventListener('click', () => {
      sec = +b.dataset.sec
      secBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      audio.sfx('click')
      resetTimer()
    }))
    timerBtn.addEventListener('click', () => playTimer())
    resetTimer()
    let autoDone = false
    whenVisible(el.querySelector('.s-layers__timer'), null, () => { if (ttl && ttl.progress() < 1) { resetTimer(); autoDone = false } endMood() })
    whenVisible(el.querySelector('.s-layers__timer'), () => { if (!autoDone) { autoDone = true; playTimer() } }, null, '0px 0px -30% 0px')

    // 离屏暂停所有循环动画
    whenVisible(el, () => el.classList.remove('is-offscreen'), () => { el.classList.add('is-offscreen'); endMood() }, '200px')

    reveal(el)
  },
}

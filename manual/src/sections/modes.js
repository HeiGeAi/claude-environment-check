// 第 04 章 · 两种接入方式：A 围墙（TUN） / B 告示牌（系统代理）
// 招牌：五个带标签的小请求出门。B 模式下后台更新器不看告示，从侧窗溜走；
// 打开「出站限制」后，门卫在门外把它拦住。A 模式下围墙把它引回唯一的大门，
// 再模拟 TUN 掉线，看门卫在不在岗。
import './modes.css'
import { gsap, reveal, whenVisible, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { pushMood, popMood } from '../core/mood.js'
import { mascot } from '../core/mascot.js'

/* ------------------------------------------------------------
   场景数据：两套布局（宽屏横排 / 手机竖排），坐标都在各自 viewBox 内
   ------------------------------------------------------------ */
const WALKERS = [
  { k: 'browser', label: '浏览器' },
  { k: 'cli', label: '终端 CLI' },
  { k: 'desktop', label: '桌面端' },
  { k: 'mcp', label: 'MCP 工具' },
  { k: 'updater', label: '后台更新器', rogue: true },
]

const p2 = (p) => `${p[0]} ${p[1]}`
const sY = (a, b) => { const m = (a[1] + b[1]) / 2; return `C ${a[0]} ${m} ${b[0]} ${m} ${p2(b)}` }
const sX = (a, b) => { const m = (a[0] + b[0]) / 2; return `C ${m} ${a[1]} ${m} ${b[1]} ${p2(b)}` }

const WIDE = {
  key: 'wide', vb: [1100, 560], size: 96,
  house: { x: 40, y: 150, w: 350, h: 300, roof: '20,160 215,46 410,160', chimney: [318, 74, 24, 52], door: [188, 376, 54, 74], win: [372, 252, 18, 56], floorY: 292, label: [215, 128] },
  homes: { browser: [110, 238], cli: [215, 238], desktop: [320, 238], mcp: [118, 352], updater: [312, 352] },
  D: [215, 446], R: [236, 492], F: [470, 496], P: [660, 452], T: [952, 414], G: [546, 514], T2: [1024, 420], settle: (i) => [884 + i * 32, 420 + (i % 2) * 5],
  board: { x: 62, y: 470, w: 122, h: 34 },
  wall: 'M 188 470 L 48 470 Q 12 470 12 434 L 12 64 Q 12 28 48 28 L 392 28 Q 428 28 428 64 L 428 434 Q 428 470 392 470 L 242 470',
  pins: [[112, 28, '排除项'], [318, 28, 'IPv6'], [428, 150, '掉线行为']],
  proxy: [660, 470], island: [975, 440], eye: [1012, 318],
  guard: { bar: [572, 480, 572, 548], booth: [592, 500], label: [614, 476] },
  directLabel: [790, 546, 'middle'],
  toProxy: (h, L) => `M ${p2(h)} ${sY(h, L.D)} L ${p2(L.R)} L ${p2(L.F)} ${sX(L.F, L.P)}`,
  toTarget: (L, e = L.T) => `M ${p2(L.P)} ${sX(L.P, e)}`,
  direct: (h, L) => `M ${p2(h)} ${sY(h, L.D)} L ${p2(L.R)} L ${p2(L.F)} ${sX(L.F, L.G)}`,
  fromG: (L, t2) => `M ${p2(L.G)} ${sX(L.G, t2)}`,
  rogueOut: 'M 312 352 C 352 352 380 300 394 280',
  rogueSide: 'M 394 280 C 452 280 472 330 480 420 C 486 482 510 514 546 514',
  rogueBump: 'M 312 352 C 350 352 390 322 410 302',
  rogueWall: 'M 410 302 L 412 440 Q 412 460 390 460 L 242 460 Q 215 460 215 478 Q 215 492 236 492 L 470 496 C 565 496 565 452 660 452',
  bumpVec: [10, 0],
  spark: [426, 300],
  sideRoad: 'M 394 280 C 452 280 472 330 480 420 C 486 482 510 514 546 514',
}

const TALL = {
  key: 'tall', vb: [400, 936], size: 88,
  house: { x: 30, y: 120, w: 340, h: 270, roof: '14,130 200,24 386,130', chimney: [290, 50, 22, 50], door: [174, 320, 52, 70], win: [352, 196, 18, 54], floorY: 248, label: [200, 104] },
  homes: { browser: [90, 200], cli: [200, 200], desktop: [310, 200], mcp: [104, 304], updater: [296, 304] },
  D: [200, 388], R: [200, 426], F: [200, 462], P: [200, 618], T: [180, 776], G: [346, 552], T2: [256, 782], settle: (i) => [126 + i * 27, 782 + (i % 2) * 5],
  board: { x: 24, y: 414, w: 124, h: 34 },
  wall: 'M 176 408 L 40 408 Q 8 408 8 376 L 8 46 Q 8 14 40 14 L 360 14 Q 392 14 392 46 L 392 376 Q 392 408 360 408 L 224 408',
  pins: [[112, 14, '排除项'], [74, 408, 'IPv6'], [326, 408, '掉线行为']],
  proxy: [200, 640], island: [200, 800], eye: [246, 706],
  guard: { bar: [316, 578, 376, 578], booth: [292, 592], label: [314, 656] },
  directLabel: [334, 700, 'end'],
  toProxy: (h, L) => `M ${p2(h)} ${sY(h, L.D)} L ${p2(L.R)} L ${p2(L.F)} L ${p2(L.P)}`,
  toTarget: (L, e = L.T) => `M ${p2(L.P)} C 200 690 ${e[0]} 720 ${p2(e)}`,
  direct: (h, L) => `M ${p2(h)} ${sY(h, L.D)} L ${p2(L.R)} L ${p2(L.F)} C 262 462 346 480 ${p2(L.G)}`,
  fromG: (L, t2) => `M ${p2(L.G)} C 346 680 ${t2[0] + 60} 760 ${p2(t2)}`,
  rogueOut: 'M 296 304 C 330 300 360 250 372 222',
  rogueSide: 'M 372 222 C 398 226 396 300 386 380 C 376 460 346 480 346 552',
  rogueBump: 'M 296 304 C 330 300 360 262 378 244',
  rogueWall: 'M 378 244 L 380 380 Q 380 398 360 398 L 226 398 Q 200 398 200 420 L 200 462 L 200 618',
  bumpVec: [0, 10],
  spark: [392, 244],
  sideRoad: 'M 372 222 C 398 226 396 300 386 380 C 376 460 346 480 346 552',
}

/* 伪随机星星（固定种子，每次渲染一致） */
function stars(w, h, n) {
  let s = 7
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = (r() * w).toFixed(1), y = (r() * h * 0.62).toFixed(1), rad = (0.6 + r() * 1.3).toFixed(2)
    out += `<circle cx="${x}" cy="${y}" r="${rad}" style="animation-delay:${(-r() * 4).toFixed(2)}s"/>`
  }
  return out
}

function walkerSVG(w, L, face, tint) {
  const S = L.size
  return `<g transform="translate(${-S / 2} ${(-S * 70) / 130})">${mascot({ size: S, face, tint, label: w.label })}</g>`
}

function proxySVG([cx, base]) {
  return `<g class="md-proxy" transform="translate(${cx} ${base})">
    <ellipse cx="0" cy="4" rx="96" ry="10" class="md-shadow"/>
    <rect x="-70" y="-112" width="140" height="112" rx="6" class="md-proxy__body"/>
    <path d="M -80 -112 L 80 -112 L 70 -134 L -70 -134 Z" class="md-proxy__awning"/>
    <path d="M -56 -134 L -64 -112 M -28 -134 L -32 -112 M 0 -134 L 0 -112 M 28 -134 L 32 -112 M 56 -134 L 64 -112" class="md-proxy__stripes"/>
    <rect x="-44" y="-160" width="88" height="24" rx="12" class="md-proxy__sign"/>
    <text x="0" y="-143" text-anchor="middle" class="md-proxy__signtext">代收点</text>
    <rect x="-26" y="-60" width="52" height="60" rx="4" class="md-proxy__door"/>
    <rect x="-58" y="-96" width="30" height="24" rx="3" class="md-proxy__win"/>
    <rect x="28" y="-96" width="30" height="24" rx="3" class="md-proxy__win"/>
    <circle cx="0" cy="-86" r="5" class="md-proxy__lamp"/>
  </g>`
}

function islandSVG([cx, cy], eye) {
  return `<g class="md-island">
    <g transform="translate(${cx} ${cy})">
      <ellipse cx="0" cy="0" rx="96" ry="18" class="md-island__top"/>
      <path d="M -94 2 C -70 40 -30 74 0 84 C 26 74 70 40 94 2 Z" class="md-island__rock"/>
      <path d="M -40 30 L -20 30 M 10 48 L 34 48 M -10 64 L 8 64" class="md-island__lines"/>
      <rect x="10" y="-86" width="30" height="86" rx="4" class="md-island__tower"/>
      <rect x="18" y="-72" width="14" height="10" rx="2" class="md-island__lit"/>
      <rect x="18" y="-52" width="14" height="10" rx="2" class="md-island__lit"/>
      <path d="M 25 -86 L 25 -104" class="md-island__mast"/>
      <circle cx="25" cy="-108" r="5" class="md-island__beacon"/>
      <text x="0" y="112" text-anchor="middle" class="md-label">目标服务</text>
    </g>
    <g class="md-eye" transform="translate(${eye[0]} ${eye[1]})">
      <path d="M -22 0 Q 0 -16 22 0 Q 0 16 -22 0 Z" class="md-eye__lid"/>
      <circle r="6" class="md-eye__ball"/>
    </g>
  </g>`
}

function houseSVG(L) {
  const h = L.house
  const [dx, dy, dw, dh] = h.door
  const [wx, wy, ww, wh] = h.win
  const [cx, cy, cw, ch] = h.chimney
  return `<g class="md-house">
    <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="3" class="md-house__chim"/>
    <polygon points="${h.roof}" class="md-house__roof"/>
    <rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" rx="8" class="md-house__body"/>
    <path d="M ${h.x + 14} ${h.floorY} L ${h.x + h.w - 14} ${h.floorY}" class="md-house__floor"/>
    <rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="3" class="md-house__win"/>
    <rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" rx="4" class="md-house__door"/>
    <text x="${h.label[0]}" y="${h.label[1]}" text-anchor="middle" class="md-label md-label--house">你的电脑</text>
  </g>`
}

function sceneSVG(L) {
  const [W, H] = L.vb
  const b = L.board
  const g = L.guard
  const [bx1, by1, bx2, by2] = g.bar
  const [ox, oy] = g.booth
  return `<svg class="md-svg md-svg--${L.key}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="md-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2131"/><stop offset="1" stop-color="#10131c"/></linearGradient>
      <radialGradient id="md-door" cx="50%" cy="80%" r="80%"><stop offset="0" stop-color="#ffd08a"/><stop offset=".6" stop-color="#ff9a55"/><stop offset="1" stop-color="#b8502e"/></radialGradient>
      <radialGradient id="md-moon" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fff4dd"/><stop offset="1" stop-color="#f1c98a"/></radialGradient>
    </defs>
    <g class="md-stars">${stars(W, H, L.key === 'wide' ? 60 : 44)}</g>
    <circle cx="${L.key === 'wide' ? 800 : 62}" cy="${L.key === 'wide' ? 96 : 560}" r="${L.key === 'wide' ? 26 : 16}" fill="url(#md-moon)" class="md-moon"/>

    <!-- 道路 -->
    <path d="M ${p2(L.D)} L ${p2(L.R)} L ${p2(L.F)} ${L.key === 'wide' ? sX(L.F, L.P) : `L ${p2(L.P)}`}" class="md-road md-road--ctrl"/>
    <path d="${L.toTarget(L)}" class="md-road md-road--ctrl"/>
    <path d="M ${p2(L.F)} ${L.key === 'wide' ? sX(L.F, L.G) : `C 262 462 346 480 ${p2(L.G)}`} ${L.fromG(L, L.T2).replace(/^M [^C]+/, '')}" class="md-road md-road--direct"/>
    <path d="${L.sideRoad}" class="md-road md-road--side"/>
    <text x="${L.directLabel[0]}" y="${L.directLabel[1]}" text-anchor="${L.directLabel[2]}" class="md-label md-label--danger">直连小路</text>

    ${proxySVG(L.proxy)}
    ${islandSVG(L.island, L.eye)}
    ${houseSVG(L)}

    <!-- B：告示牌 -->
    <g class="md-board">
      <path d="M ${b.x + 18} ${b.y + b.h} L ${b.x + 18} ${b.y + b.h + 26} M ${b.x + b.w - 18} ${b.y + b.h} L ${b.x + b.w - 18} ${b.y + b.h + 26}" class="md-board__post"/>
      <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" class="md-board__plate"/>
      <text x="${b.x + b.w / 2 - 6}" y="${b.y + 22}" text-anchor="middle" class="md-board__text">寄件请走代收点</text>
      <path d="M ${b.x + b.w - 14} ${b.y + 12} l 6 5 l -6 5" class="md-board__arrow"/>
    </g>

    <!-- A：围墙 -->
    <g class="md-wall">
      <path d="${L.wall}" class="md-wall__glow"/>
      <path d="${L.wall}" class="md-wall__line" pathLength="1"/>
      <path d="${L.wall}" class="md-wall__brick"/>
      ${L.pins.map(([x, y, t]) => `<g class="md-pin" transform="translate(${x} ${y})"><rect x="${-t.length * 7 - 12}" y="-12" width="${t.length * 14 + 24}" height="24" rx="12"/><text x="0" y="5" text-anchor="middle">${t}</text></g>`).join('')}
      <g class="md-wall__down" transform="translate(${L.key === 'wide' ? '220 18' : '300 34'})"><rect x="-58" y="-13" width="116" height="26" rx="13"/><text x="0" y="5" text-anchor="middle">TUN 掉线</text></g>
    </g>

    <!-- 门卫（出站限制） -->
    <g class="md-guard">
      <line x1="${bx1}" y1="${by1}" x2="${bx2}" y2="${by2}" class="md-guard__bar"/>
      <g transform="translate(${ox} ${oy})">
        <path d="M -4 0 L 22 -14 L 48 0 Z" class="md-guard__roof"/>
        <rect x="0" y="0" width="44" height="44" rx="4" class="md-guard__booth"/>
        <rect x="9" y="9" width="26" height="14" rx="2" class="md-guard__win"/>
        <path d="M 22 28 m -7 0 a 7 7 0 0 1 14 0 v 8 h -14 Z" class="md-guard__shield"/>
      </g>
      <text x="${g.label[0]}" y="${g.label[1]}" text-anchor="middle" class="md-label md-label--safe">门卫</text>
    </g>

    <g class="md-fx"></g>
    <g class="md-walkers">
      ${WALKERS.map((w) => `<g class="md-walker" data-k="${w.k}"><g class="md-walker__in">${walkerSVG(w, L, 'idle', w.rogue ? 'ghost' : 'warm')}</g></g>`).join('')}
    </g>
    <g class="md-stamps"></g>
  </svg>`
}

/* ------------------------------------------------------------
   章节模块
   ------------------------------------------------------------ */
const NOTES = {
  B: {
    title: '告示牌：三处都要到位',
    sub: '系统代理、终端环境、启动包装器（wrapper），缺一处就有程序没看见告示。',
    items: [
      ['浏览器、桌面端', '看告示走代收点：系统的 HTTP / HTTPS / SOCKS 代理，管得住遵循系统设置的程序。'],
      ['交互终端', '新开的终端会读取代理变量；已经打开的终端不会自动更新。'],
      ['命令行 CLI', '用 wrapper 重新注入大小写代理变量，免得旧终端和宿主环境里缺了它。'],
      ['后台与子进程', 'IDE、launchd、更新器、MCP、后台 supervisor 要单独查。没经过 wrapper 的进程，不在它的保护范围内。'],
    ],
    end: '系统代理没有强制隔离的能力。不读系统设置、也不读环境变量的程序，仍可以自己直接发包。',
  },
  A: {
    title: '围墙：大部分自动走门，缝隙要自己查',
    sub: '在路由层把流量收进来。如果你的版本和网络下 TUN 正常，可以继续用。',
    items: [
      ['自动接管', '墙修在路由层，大部分程序不用单独设置，自然只能从那扇门出去。'],
      ['排除项', '被排除在外的路由、没被接管的协议，仍可能从墙缝绕出去。'],
      ['IPv6', '侧门也要算进去。开 TUN 不等于所有协议、接口和进程都被覆盖。'],
      ['掉线行为', '关掉 TUN 时也必须保持系统阻断：墙没了，门卫还得在岗。'],
    ],
    end: '开启 TUN 并不自动等于全部覆盖。自动路由、排除路由、DNS 劫持与 IPv6，都要逐项核对。',
  },
}

const COMPARE = [
  ['流量入口', '包裹从哪儿被收进来', '靠系统设置加各个应用自己的配置；不听话的程序可能绕过去。', '在路由层统一接管；被排除的路由和没接管的协议，仍可能绕过。'],
  ['DNS', '查地址的电话簿', '系统 DNS 可能返回真实地址。这件事本身不等于业务连接泄漏。', '核对 dns-hijack、DoH 与 IPv6 解析路径。'],
  ['进程识别', '认出是谁在寄件', '只对进入 mihomo、并且能认出来的连接起作用。', '需要足够权限；网络栈和版本会影响能拿到的信息。'],
  ['故障底线', '代收点出事时', '代收点联系不上就拒绝业务，不能悄悄直连。', 'TUN 消失后，仍由独立的阻断层拦住。'],
  ['适用判断', '适合什么情况', '不依赖 TUN，但每个应用都要自己管，工作量更大。', '适合已经验证接管正常的机器；不按版本日期一刀切。'],
]

const ICONS = {
  browser: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3.2 3 13.8 0 17M12 3.5c-3 3.2-3 13.8 0 17"/>',
  term: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M7 10l3 2.5L7 15M12.5 15.5H17"/>',
  cli: '<path d="M5 7l5 5-5 5M12 17h7"/>',
  bg: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M6 18l2.1-2.1M15.9 8.1L18 6"/>',
  wall: '<path d="M3 20V8l9-4.5L21 8v12"/><path d="M3 12h18M3 16h18M8 12v4M16 12v4M12 16v4"/>',
  gap: '<path d="M4 20V6M20 20V6M4 12h5M15 12h5"/><path d="M11 9l2 3-2 3" />',
  side: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M15 12h.01M9 3.5v17"/>',
  guard: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
}
const iconOf = { B: ['browser', 'term', 'cli', 'bg'], A: ['wall', 'gap', 'side', 'guard'] }
const svgIcon = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`

export default {
  id: 'modes',
  nav: '两种接入方式',
  desc: '围墙和告示牌，各有什么坑',
  mood: 'calm',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>两种接入方式</span></div>
        <h2 class="h2" data-reveal="lines">两种接入方式，<br><span class="text-warm">一条底线</span></h2>
        <p class="lead" data-reveal>模式 A 给整栋房子修一圈围墙（TUN）。模式 B 在家门口贴一张告示（系统代理）。先看包裹实际走哪条路，再看开关是什么颜色。</p>
      </header>

      <div class="s-modes__rule" data-reveal>
        <span class="s-modes__rule-k latin">the bottom line</span>
        <p class="s-modes__rule-t">不管选哪种，<b>代收点联系不上时，业务宁可停下，也不能悄悄从自家门口寄出（直连）。</b></p>
      </div>

      <figure class="s-modes__stage" data-reveal="scale">
        <div class="s-modes__bar">
          <div class="segmented" role="group" aria-label="选择接入方式">
            <button type="button" data-mode="B" aria-pressed="true">B · 告示牌<span class="sub">系统代理</span></button>
            <button type="button" data-mode="A" aria-pressed="false">A · 围墙<span class="sub">TUN</span></button>
          </div>
          <div class="s-modes__toggles">
            <button type="button" class="s-modes__switch" role="switch" aria-checked="false" data-toggle="guard"><span class="s-modes__knob" aria-hidden="true"></span><span>出站限制<span class="s-modes__switch-sub">（门卫）</span></span></button>
            <button type="button" class="s-modes__switch s-modes__switch--warn" role="switch" aria-checked="false" data-toggle="tun" hidden><span class="s-modes__knob" aria-hidden="true"></span><span>模拟 TUN 掉线</span></button>
          </div>
          <button type="button" class="btn btn--ghost btn--xs s-modes__replay" data-act="replay"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>再放一遍</button>
        </div>
        <div class="s-modes__canvas"></div>
        <figcaption class="s-modes__cap" data-tone="idle">
          <span class="s-modes__cap-dot" aria-hidden="true"></span>
          <span class="s-modes__cap-t" aria-live="polite">滚到这里会自动播放一次。可以切换方式、打开门卫，再看一遍。</span>
        </figcaption>
        <p class="s-modes__demo tiny">这里是逻辑演示，不读取你电脑的网络。</p>
      </figure>

      <div class="s-modes__notes">
        ${['B', 'A'].map((m) => `
        <section class="s-modes__panel" data-panel="${m}" ${m === 'A' ? 'hidden' : ''} aria-label="${m === 'B' ? '模式 B 要点' : '模式 A 要点'}">
          <div class="s-modes__panel-head">
            <span class="tag ${m === 'B' ? 'tag--warm' : 'tag--info'}"><span class="dot"></span>MODE ${m}</span>
            <h3 class="h3">${NOTES[m].title}</h3>
            <p class="muted">${NOTES[m].sub}</p>
          </div>
          <ol class="s-modes__items">
            ${NOTES[m].items.map(([t, d], i) => `<li><span class="s-modes__ico">${svgIcon(iconOf[m][i])}</span><div><b>${t}</b><p>${d}</p></div></li>`).join('')}
          </ol>
          <div class="callout ${m === 'B' ? 'callout--danger' : 'callout--warn'} s-modes__end">
            <div class="callout__title">${m === 'B' ? '一句话结论' : '别把开关当结果'}</div>
            <p>${NOTES[m].end}</p>
          </div>
        </section>`).join('')}
      </div>

      <section class="s-modes__compare" aria-label="两种方式对照">
        <header class="s-modes__sub-head" data-reveal>
          <h3 class="h3">同一张检查表，两种方式分别怎么看</h3>
          <p class="muted">原版叫「检查面」。这里换成白话，左边是告示牌，右边是围墙。</p>
        </header>
        <div class="s-modes__table" role="table" aria-label="检查面对照">
          <div class="s-modes__tr s-modes__tr--head" role="row">
            <span role="columnheader">检查什么</span>
            <span role="columnheader" class="is-b">B · 告示牌（纯代理）</span>
            <span role="columnheader" class="is-a">A · 围墙（TUN）</span>
          </div>
          ${COMPARE.map(([k, hint, b, a]) => `
          <div class="s-modes__tr" role="row" data-reveal>
            <span role="rowheader" class="s-modes__k"><b>${k}</b><small>${hint}</small></span>
            <span role="cell" class="s-modes__c is-b"><em class="s-modes__c-l">B · 告示牌</em>${b}</span>
            <span role="cell" class="s-modes__c is-a"><em class="s-modes__c-l">A · 围墙</em>${a}</span>
          </div>`).join('')}
        </div>
      </section>

      <section class="s-modes__exit card card--flat" aria-label="准备固定出口" data-reveal>
        <div class="s-modes__exit-art" aria-hidden="true">${exitArt()}</div>
        <div class="s-modes__exit-body">
          <h3 class="h3">准备一个可验证的固定出口</h3>
          <p class="muted">也就是先挑好一个靠得住的代收点。动手前，先核对这五件事：</p>
          <ul class="s-modes__chips" data-reveal="stagger">
            ${['地区', '稳定性', '上游协议', '可用性', '日志政策'].map((t) => `<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>${t}</li>`).join('')}
          </ul>
          <p class="small faint">本文不对任何供应商的价格、标签准确性或账号结果作保证。</p>
        </div>
      </section>

      <section class="pro-only s-modes__pro" aria-label="进阶细节">
        <div class="s-modes__pro-grid">
          <div class="card card--info pro-block">
            <span class="pro-badge">进阶 · MODE B / EXPLICIT PROXY</span>
            <h4 class="h4">系统代理、终端环境、启动包装器，三处都要到位</h4>
            <p>纯代理方案适合明确管理每种应用入口的环境。本文示例本地端口为 <code>127.0.0.1:7897</code>，TUN 关闭、系统代理开启。这个端口只是示例，按实际监听端口填写。</p>
            <ul class="bullets small">
              <li>GUI：系统 HTTP / HTTPS / SOCKS 代理覆盖遵循系统设置的应用。</li>
              <li>交互终端：新 shell 读取代理环境变量；已经打开的终端不会自动更新。</li>
              <li>CLI：wrapper 重新注入大小写代理变量，避免旧终端与宿主环境缺失。</li>
              <li>后台与子进程：单独查 IDE、launchd、更新器、MCP、后台 supervisor。没有通过 wrapper 的进程不在它的保护承诺内。</li>
            </ul>
          </div>
          <div class="card card--info pro-block">
            <span class="pro-badge">进阶 · MODE A / TUN</span>
            <h4 class="h4">在路由层接管，但仍要检查排除项、IPv6 和掉线行为</h4>
            <ul class="bullets small">
              <li>确认实际 TUN 接口和路由，别照抄 <code>utun9</code>。</li>
              <li>守卫配置与模式一致：<code>REQUIRE_TUN=1</code>；网络守卫用明确的 <code>NET_MODE=tun</code>，防止 TUN 掉线后 auto 误当纯代理。</li>
              <li>对 IPv4、IPv6、UDP 分别演练。支持 IPv6 的 TUN 可以配置接管；「TUN 天生只支持 IPv4」是不准确的。</li>
              <li>多个 utun 可以正常共存；只有路由、抓包与故障复现才能确认冲突，不能见到两个就杀进程。</li>
            </ul>
            <p class="small">机制参考：<a class="s-modes__link" href="https://wiki.metacubex.one/config/inbound/tun/" target="_blank" rel="noopener noreferrer">mihomo TUN 官方文档 ↗</a></p>
          </div>
        </div>
        <div class="callout callout--info s-modes__migrate">
          <div class="callout__title">模式切换必须连带更新守卫</div>
          <p>迁移前逐项核对 <code>NET_MODE</code>、socket 路径、探测的代理入口与 DNS 判定。系统 DNS 返回真实地址，在纯代理下可能是正常行为，不能直接当作业务流量泄漏。</p>
        </div>
      </section>
    </div>`

    /* ---------------- 交互与动画 ---------------- */
    const canvas = el.querySelector('.s-modes__canvas')
    const cap = el.querySelector('.s-modes__cap')
    const capT = el.querySelector('.s-modes__cap-t')
    const modeBtns = el.querySelectorAll('[data-mode]')
    const guardBtn = el.querySelector('[data-toggle="guard"]')
    const tunBtn = el.querySelector('[data-toggle="tun"]')
    const panels = el.querySelectorAll('[data-panel]')
    const state = { mode: 'B', guard: false, tunDown: false }
    const mq = window.matchMedia('(max-width: 760px)')
    let L = mq.matches ? TALL : WIDE
    let svg, tl, moodTimer, moodPushed = false, played = false, quiet = false

    const sfx = (n, o) => { if (!quiet) audio.sfx(n, o) }
    const q = (s) => svg.querySelector(s)
    const walkerEl = (k) => svg.querySelector(`.md-walker[data-k="${k}"]`)

    function render() {
      canvas.innerHTML = sceneSVG(L)
      svg = canvas.querySelector('svg')
      reset()
    }

    function setFace(k, face, tint) {
      const w = WALKERS.find((x) => x.k === k)
      walkerEl(k).querySelector('.md-walker__in').innerHTML = walkerSVG(w, L, face, tint)
    }

    function releaseMood() {
      moodTimer?.kill(); moodTimer = null
      if (moodPushed) { popMood(); moodPushed = false }
    }

    function reset() {
      tl?.kill(); tl = null
      releaseMood()
      svg.dataset.mode = state.mode
      svg.classList.toggle('is-guard', state.guard)
      svg.classList.toggle('is-tundown', state.mode === 'A' && state.tunDown)
      svg.classList.remove('is-leak', 'is-safe')
      q('.md-fx').innerHTML = ''
      q('.md-stamps').innerHTML = ''
      q('.md-eye').classList.remove('is-open')
      WALKERS.forEach((w) => {
        const h = L.homes[w.k]
        const g = walkerEl(w.k)
        gsap.set(g, { x: h[0], y: h[1], opacity: 1 })
        g.classList.remove('is-settled')
        gsap.set(g.querySelector('.md-walker__in'), { scale: 1, svgOrigin: '0 0' })
        setFace(w.k, 'idle', w.rogue && state.mode === 'B' ? 'ghost' : 'warm')
      })
    }

    function setCap(tone, text) {
      cap.dataset.tone = tone
      capT.textContent = text
    }

    function outcome() {
      if (state.mode === 'B') {
        return state.guard
          ? ['safe', '门卫在门外拦住了后台更新器。它连不上，门牌号也没露。连不上，可以；真实 IP 直连，不行。']
          : ['danger', '后台更新器没看告示，从侧窗溜出去，门牌号被对方看见了。告示只管得住听话的程序。']
      }
      if (!state.tunDown) return ['warm', '它想翻窗，撞上围墙，只能从唯一的门去代收点。墙修好了，但排除项、IPv6 和掉线行为仍要检查。']
      return state.guard
        ? ['safe', 'TUN 掉了，门卫还在岗：谁也出不去，门牌号也没露。所以关掉 TUN 时，也必须保持系统阻断。']
        : ['danger', 'TUN 一掉，又没有系统阻断，所有程序都从自家门口直接出门。这就是必须保留独立阻断层的原因。']
    }

    const startCap = () => state.mode === 'B'
      ? '门口贴着告示：寄件请走代收点。听话的程序照做，后台更新器从来不看告示。'
      : state.tunDown ? '模拟 TUN 掉线：围墙消失了。看看这时谁在守门。' : '围墙修好了，整栋房子只留一扇门，通向代收点。'

    /* 剧情片段 */
    function spark([x, y], cls = '') {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('class', `md-spark ${cls}`)
      g.setAttribute('transform', `translate(${x} ${y})`)
      g.innerHTML = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<line x1="${Math.cos(a) * 8}" y1="${Math.sin(a) * 8}" x2="${Math.cos(a) * 20}" y2="${Math.sin(a) * 20}"/>` }).join('') + '<circle r="10"/>'
      q('.md-fx').appendChild(g)
      gsap.set(g, { svgOrigin: `${x} ${y}` })
      gsap.fromTo(g, { scale: 0.3, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 0.7, ease: 'expo.out', onComplete: () => g.remove() })
    }

    function stamp([x, y], text, tone) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('class', `md-stamp md-stamp--${tone}`)
      const w = text.length * 15 + 30
      g.innerHTML = `<g transform="translate(${x} ${y})"><rect x="${-w / 2}" y="-16" width="${w}" height="32" rx="16"/><text x="0" y="6" text-anchor="middle">${text}</text></g>`
      q('.md-stamps').appendChild(g)
      gsap.set(g, { svgOrigin: `${x} ${y}` })
      gsap.fromTo(g, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)' })
    }

    function plate(from) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('class', 'md-plate')
      g.innerHTML = `<rect x="-52" y="-15" width="104" height="30" rx="8"/><text x="0" y="5" text-anchor="middle">真实门牌号</text>`
      q('.md-fx').appendChild(g)
      gsap.fromTo(g, { x: from[0], y: from[1] - 20, opacity: 0, scale: 0.6 }, { x: L.eye[0], y: L.eye[1] - 40, opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out' })
    }

    function blockAt(k, back, t, idx = 0) {
      const g = walkerEl(k)
      const [bx, by] = L.bumpVec
      tl.to(g, { x: `+=${bx}`, y: `+=${by}`, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1 }, t)
      tl.call(() => {
        setFace(k, 'blocked', WALKERS.find((w) => w.k === k).rogue && state.mode === 'B' ? 'ghost' : 'warm')
        svg.classList.add('is-block')
        gsap.delayedCall(0.5, () => svg?.classList.remove('is-block'))
        if (idx === 0) { sfx('gate'); gsap.delayedCall(0.14, () => sfx('deny')); stamp(L.key === 'wide' ? [L.G[0] + 10, L.G[1] - 58] : [L.G[0] - 70, L.G[1] - 4], '拦下了', 'safe') }
      }, null, t + 0.05)
      tl.to(g, { motionPath: { path: back, start: 1, end: 0 }, duration: 1.5, ease: 'power2.inOut' }, t + 0.7)
    }

    function leakAt(k, t, t2, first, crowd = false) {
      const g = walkerEl(k)
      tl.to(g, { motionPath: { path: L.fromG(L, t2) }, duration: 1.1, ease: 'power2.in' }, t)
      if (crowd) {
        tl.to(g.querySelector('.md-walker__in'), { scale: 0.7, duration: 0.5, ease: 'expo.out' }, t + 0.8)
        tl.call(() => g.classList.add('is-settled'), null, t + 0.7)
      }
      tl.call(() => {
        setFace(k, 'leak', 'danger')
        if (first) plate(t2)
        q('.md-eye').classList.add('is-open')
        svg.classList.add('is-leak')
        if (first) {
          sfx('alarm')
          audio.duck(0.4, 1400)
          if (!moodPushed && !quiet) { pushMood('tension'); moodPushed = true }
          moodTimer?.kill()
          moodTimer = gsap.delayedCall(3.2, releaseMood)
        }
      }, null, t + 1.1)
    }

    function arrive(k, t, i) {
      const g = walkerEl(k)
      tl.to(g, { motionPath: { path: L.toTarget(L, L.settle(i)) }, duration: 1.05, ease: 'power2.inOut' }, t)
      tl.to(g.querySelector('.md-walker__in'), { scale: 0.7, duration: 0.6, ease: 'expo.out' }, t + 0.7)
      tl.call(() => g.classList.add('is-settled'), null, t + 0.6)
      tl.call(() => { setFace(k, 'happy', 'warm'); q('.md-island').classList.remove('is-pulse'); void q('.md-island').getBoundingClientRect(); q('.md-island').classList.add('is-pulse') }, null, t + 1.05)
    }

    function run() {
      played = true
      reset()
      setCap('run', startCap())
      tl = gsap.timeline({ paused: true })
      const normals = WALKERS.filter((w) => !w.rogue)
      const rogue = WALKERS.find((w) => w.rogue)
      tl.call(() => sfx('whoosh'), null, 0.1)

      if (state.mode === 'A' && state.tunDown) {
        // 围墙消失：所有程序都走自家门口
        WALKERS.forEach((w, i) => {
          const t0 = 0.4 + i * 0.34
          const path = L.direct(L.homes[w.k], L)
          tl.to(walkerEl(w.k), { motionPath: { path }, duration: 1.7, ease: 'power1.inOut' }, t0)
          if (state.guard) blockAt(w.k, path, t0 + 1.7, i)
          else leakAt(w.k, t0 + 1.72, L.settle(i), i === 0, true)
        })
      } else {
        normals.forEach((w, i) => {
          const t0 = 0.4 + i * 0.32
          tl.to(walkerEl(w.k), { motionPath: { path: L.toProxy(L.homes[w.k], L) }, duration: 1.8, ease: 'power1.inOut' }, t0)
          tl.call(() => sfx('step'), null, t0 + 1.8)
          if (state.mode === 'B' && i === 0) tl.call(() => { const b = q('.md-board'); b.classList.remove('is-read'); void b.getBoundingClientRect(); b.classList.add('is-read') }, null, t0 + 0.6)
          arrive(w.k, t0 + 1.95, i)
        })
        const r = rogue.k
        const rg = walkerEl(r)
        if (state.mode === 'B') {
          tl.to(rg, { motionPath: { path: L.rogueOut }, duration: 0.7, ease: 'power2.in' }, 1.0)
          tl.call(() => sfx('whoosh'), null, 1.6)
          tl.to(rg, { motionPath: { path: L.rogueSide }, duration: 1.3, ease: 'power1.inOut' }, 1.7)
          if (state.guard) {
            blockAt(r, L.rogueOut + ' ' + L.rogueSide.replace(/^M [\d.]+ [\d.]+/, ''), 3.0)
          } else {
            leakAt(r, 3.02, L.T2, true)
          }
        } else {
          tl.to(rg, { motionPath: { path: L.rogueBump }, duration: 0.7, ease: 'power2.in' }, 1.0)
          tl.call(() => { spark(L.spark); setFace(r, 'blocked', 'warm'); sfx('deny'); q('.md-wall').classList.remove('is-hit'); void q('.md-wall').getBoundingClientRect(); q('.md-wall').classList.add('is-hit') }, null, 1.7)
          tl.to(rg, { x: `-=${L.bumpVec[0] * 1.4}`, y: `-=${L.bumpVec[1] * 1.4}`, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 }, 1.7)
          tl.call(() => setFace(r, 'idle', 'warm'), null, 2.3)
          tl.to(rg, { motionPath: { path: L.rogueWall }, duration: 2.0, ease: 'power1.inOut' }, 2.2)
          tl.call(() => sfx('step'), null, 4.2)
          arrive(r, 4.3, 4)
        }
      }
      tl.call(() => {
        const [tone, text] = outcome()
        setCap(tone, text)
        svg.classList.toggle('is-safe', tone === 'safe')
        if (tone === 'safe') sfx('success')
        guardBtn.classList.toggle('is-hint', state.mode === 'B' && !state.guard)
        tunBtn.classList.toggle('is-hint', state.mode === 'A' && !state.tunDown)
      })

      const r = canvas.getBoundingClientRect()
      const onScreen = r.bottom > 0 && r.top < window.innerHeight
      if (prefersReduced || !onScreen) {
        quiet = true
        tl.progress(1, false)
        quiet = false
        const [tone] = outcome()
        if (onScreen) audio.sfx(tone === 'danger' ? 'alarm' : tone === 'safe' ? 'success' : 'step')
      } else {
        tl.play(0)
      }
    }

    /* 控件 */
    function syncControls() {
      modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)))
      guardBtn.setAttribute('aria-checked', String(state.guard))
      tunBtn.setAttribute('aria-checked', String(state.tunDown))
      tunBtn.hidden = state.mode !== 'A'
      panels.forEach((p) => {
        const on = p.dataset.panel === state.mode
        if (on && p.hidden) {
          p.hidden = false
          if (!prefersReduced) gsap.fromTo(p.querySelectorAll('.s-modes__panel-head, .s-modes__items > li, .s-modes__end'), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.06 })
        } else if (!on) p.hidden = true
      })
    }

    modeBtns.forEach((b) => b.addEventListener('click', () => {
      if (state.mode === b.dataset.mode) return
      state.mode = b.dataset.mode
      if (state.mode === 'B') state.tunDown = false
      audio.sfx('click')
      syncControls()
      run()
    }))
    guardBtn.addEventListener('click', () => {
      state.guard = !state.guard
      guardBtn.classList.remove('is-hint')
      audio.sfx(state.guard ? 'toggle-on' : 'toggle-off')
      syncControls()
      run()
    })
    tunBtn.addEventListener('click', () => {
      state.tunDown = !state.tunDown
      tunBtn.classList.remove('is-hint')
      audio.sfx(state.tunDown ? 'toggle-on' : 'toggle-off')
      syncControls()
      run()
    })
    el.querySelector('[data-act="replay"]').addEventListener('click', () => { audio.sfx('click'); run() })

    mq.addEventListener('change', () => {
      L = mq.matches ? TALL : WIDE
      render()
      if (played) run()
    })

    render()
    syncControls()
    whenVisible(canvas, () => { if (!played) run() }, null, '0px 0px -28% 0px')

    // 离屏时暂停场景里的循环动画（星星、道路流光、吉祥物呼吸）
    whenVisible(canvas, () => el.classList.remove('is-offscreen'), () => {
      el.classList.add('is-offscreen')
      if (tl && tl.progress() < 1) { quiet = true; tl.progress(1, false); quiet = false }
      releaseMood()
    })

    reveal(el)
  },
}

function exitArt() {
  return `<svg viewBox="0 0 220 160" width="220" height="160">
    <defs><radialGradient id="md-exit-g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb35c" stop-opacity=".45"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient></defs>
    <circle cx="110" cy="88" r="74" fill="url(#md-exit-g)"/>
    <g transform="translate(110 132)">
      <ellipse cx="0" cy="4" rx="80" ry="8" fill="rgba(0,0,0,.35)"/>
      <rect x="-54" y="-86" width="108" height="86" rx="6" fill="#171b28" stroke="rgba(255,179,92,.55)" stroke-width="1.6"/>
      <path d="M -62 -86 L 62 -86 L 54 -104 L -54 -104 Z" fill="#ff9a55" opacity=".9"/>
      <path d="M -40 -104 L -46 -86 M -14 -104 L -16 -86 M 14 -104 L 16 -86 M 40 -104 L 46 -86" stroke="#1d0f06" stroke-width="5" opacity=".35"/>
      <rect x="-20" y="-46" width="40" height="46" rx="3" fill="#ffc070" opacity=".85"/>
      <rect x="-34" y="-126" width="68" height="20" rx="10" fill="#07080c" stroke="#ffb35c" stroke-width="1.4"/>
      <text x="0" y="-112" text-anchor="middle" font-size="11" font-weight="800" fill="#ffd08a" font-family="-apple-system,PingFang SC,sans-serif">固定出口</text>
    </g>
    <g fill="none" stroke="#6ff0b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="184" cy="42" r="14" fill="rgba(111,240,184,.1)"/><path d="M177 42l5 5 9-10"/>
    </g>
  </svg>`
}

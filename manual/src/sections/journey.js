// ============================================================
// 04 · 请求的旅程（全站招牌互动）
// 夜色小城剖面：你家 → 准入闸门 → 代收点 → 跨海大桥 → Claude 岛，再沿原连接回家。
// 四个场景 × 是否有防护，共 8 段剧情，全部由一条可暂停、可逐步、可跳站的 GSAP 时间轴驱动。
// 桌面端横向剖面，窄屏自动换成竖向路线（两套几何，同一套美术与剧本）。
// ============================================================
import './journey.css'
import { gsap, reveal, onEnter, whenVisible, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { pushMood, popMood } from '../core/mood.js'
import { mascot } from '../core/mascot.js'

/* ---------------- 几何：宽屏（横向剖面）与窄屏（竖向路线） ---------------- */
const WIDE = {
  name: 'wide',
  vb: [1200, 640],
  vy: 84,
  M: 104,
  home: [200, 448],
  house: [200, 410],
  gate: [380, 448],
  gateRot: 0,
  proxy: [570, 410],
  tower: [992, 410],
  newb: [1135, 410],
  newT: [1135, 448],
  island: [1040, 448],
  bill: [1092, 176],
  billScale: 1,
  bubble: [404, 262],
  card: [380, 312],
  stopBar: [340, 262],
  stopLock: [132, 288],
  barrierT: 0.1,
  stopAt: 0.74,
  pills: { home: [200, 562], gate: [380, 562], proxy: [570, 562], island: [1040, 562] },
  paths: {
    outA: 'M200 448 H380',
    outB: 'M380 448 H570',
    outC: 'M570 448 H1040',
    outD: 'M1040 448 H1135',
    turn: 'M1040 448 C1074 448 1074 502 1040 502',
    turnNew: 'M1135 448 C1169 448 1169 502 1135 502',
    backNew: 'M1135 502 H1040',
    backA: 'M1040 502 H570',
    backB: 'M570 502 H200',
    next: 'M200 502 C164 502 164 448 200 448',
    direct: 'M200 448 C262 448 302 408 330 340 S480 172 660 164 S1010 262 1040 448',
    sideGo: 'M200 448 C176 448 152 438 142 404',
    side: 'M142 404 C110 474 150 592 272 592 H930 C1002 592 1032 520 1040 448',
  },
}

const TALL = {
  name: 'tall',
  vb: [400, 880],
  vy: -34,
  M: 86,
  home: [160, 232],
  house: [160, 200],
  gate: [160, 320],
  gateRot: 90,
  proxy: [322, 500],
  tower: [334, 858],
  newb: [70, 830],
  newT: [160, 760],
  island: [160, 690],
  bill: [320, 588],
  billScale: 0.74,
  bubble: [306, 120],
  bubbleScale: 0.78,
  card: [298, 276],
  stopBar: [206, 62],
  stopLock: [206, 62],
  barrierT: 0.11,
  stopAt: 0.66,
  pills: { home: [290, 232], gate: [92, 320], proxy: [92, 460], island: [236, 866] },
  paths: {
    outA: 'M160 232 V320',
    outB: 'M160 320 V460',
    outC: 'M160 460 V690',
    outD: 'M160 690 V760',
    turn: 'M160 690 C160 720 216 720 216 690',
    turnNew: 'M160 760 C160 790 216 790 216 760',
    backNew: 'M216 760 V690',
    backA: 'M216 690 V460',
    backB: 'M216 460 V232',
    next: 'M216 232 C216 210 160 210 160 232',
    direct: 'M160 232 C92 234 38 300 42 430 S74 680 160 690',
    sideGo: 'M160 232 C140 232 112 222 102 196',
    side: 'M102 196 C58 202 14 244 14 330 V740 C14 800 108 790 160 690',
  },
}

const LANES_OUT = ['outA', 'outB', 'outC', 'outD']
const LANES_BACK = ['turn', 'turnNew', 'backNew', 'backA', 'backB']

/* ---------------- 美术：全部自绘，局部坐标 ---------------- */
const txt = (x, y, s, cls = 'j-t', extra = '') => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${s}</text>`

function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function artHouse() {
  return `
  <g class="j-house">
    <rect class="j-wall2" x="42" y="-168" width="16" height="42" rx="2"/>
    <path class="j-roof" d="M-102 -116 L0 -180 L102 -116 Z"/>
    <path class="j-roof-edge" d="M-102 -116 L0 -180 L102 -116"/>
    <rect class="j-wall" x="-88" y="-120" width="176" height="120" rx="3"/>
    <rect class="j-win-glass is-dim" x="-78" y="-106" width="30" height="34" rx="4"/>
    <path class="j-win-frame" d="M-63 -106 V-72 M-78 -89 H-48"/>
    <g class="j-win" transform="translate(58 -88)">
      <rect class="j-win-glass" x="-26" y="-20" width="52" height="40" rx="5"/>
      <rect class="j-win-glow" data-el="winGlow" x="-26" y="-20" width="52" height="40" rx="5"/>
      <rect class="j-win-screen" x="-17" y="-13" width="34" height="21" rx="2"/>
      <path class="j-win-stand" d="M-5 13 H5 M0 8 V13"/>
      <path class="j-win-prompt" d="M-12 -7 l4 3 l-4 3 M-5 0 h7"/>
    </g>
    <rect class="j-door" x="-16" y="-56" width="32" height="56" rx="4"/>
    <circle class="j-knob" cx="9" cy="-27" r="2.2"/>
    <rect class="j-step" x="-26" y="-3" width="52" height="5" rx="2"/>
    <g class="j-plate" transform="translate(0 -72)">
      <rect x="-37" y="-11" width="74" height="22" rx="6"/>
      ${txt(0, 4.5, '你家门牌号', 'j-t j-t--plate')}
    </g>
    <g class="j-sidedoor" transform="translate(-58 0)">
      <rect class="j-sidedoor__glow" data-el="sideGlow" x="-19" y="-50" width="38" height="56" rx="8"/>
      <rect class="j-sidedoor__door" x="-11" y="-42" width="22" height="42" rx="2"/>
      <circle cx="6" cy="-20" r="1.6" class="j-knob"/>
      <g class="j-sidedoor__tag" data-el="sideTag">
        <rect x="-110" y="-38" width="74" height="22" rx="11"/>
        <path class="j-sidedoor__arrow" d="M-34 -27 H-20"/>
        ${txt(-73, -23, '侧门 IPv6', 'j-t j-t--tag j-t--warn')}
      </g>
    </g>
    <g class="j-notice" transform="translate(40 -40)"><g data-el="notice">
      <rect x="-2" y="-26" width="44" height="40" rx="3"/>
      ${txt(20, -11, '寄件请', 'j-t j-t--notice')}
      ${txt(20, 5, '走代收点', 'j-t j-t--notice')}
    </g></g>
  </g>`
}

function artProxy() {
  return `
  <g class="j-proxy">
    <rect class="j-wall j-wall--proxy" x="-74" y="-122" width="148" height="122" rx="3"/>
    <path class="j-awning" d="M-84 -92 H84 L76 -72 H-76 Z"/>
    <path class="j-awning-stripes" d="M-60 -92 L-56 -72 M-36 -92 L-34 -72 M-12 -92 L-11 -72 M12 -92 L11 -72 M36 -92 L34 -72 M60 -92 L56 -72"/>
    <g class="j-shelf" transform="translate(-44 -40)">
      <rect class="j-win-glass is-dim" x="-20" y="-24" width="40" height="40" rx="3"/>
      <rect class="j-parcel-s" x="-14" y="-4" width="12" height="10" rx="1.5"/>
      <rect class="j-parcel-s" x="2" y="-10" width="12" height="16" rx="1.5"/>
      <rect class="j-parcel-s" x="-9" y="-18" width="10" height="9" rx="1.5"/>
    </g>
    <g class="j-shelf" transform="translate(44 -40)">
      <rect class="j-win-glass is-dim" x="-20" y="-24" width="40" height="40" rx="3"/>
      <rect class="j-parcel-s" x="-12" y="-6" width="14" height="12" rx="1.5"/>
      <rect class="j-parcel-s" x="4" y="-14" width="10" height="20" rx="1.5"/>
    </g>
    <rect class="j-door" x="-17" y="-60" width="34" height="60" rx="3"/>
    <rect class="j-step" x="-26" y="-3" width="52" height="5" rx="2"/>
    <g class="j-plate j-plate--proxy" transform="translate(0 -106)">
      <rect x="-40" y="-10" width="80" height="20" rx="6"/>
      ${txt(0, 4.5, '代收点门牌', 'j-t j-t--plate')}
    </g>
    <path class="j-sign-post" d="M-44 -122 V-132 M44 -122 V-132"/>
    <rect class="j-sign-off" x="-64" y="-168" width="128" height="38" rx="10"/>
    ${txt(0, -142, '代收点', 'j-t j-t--sign is-off')}
    <g class="j-lamp" data-el="lampOn">
      <rect class="j-sign-glow" x="-74" y="-178" width="148" height="58" rx="16"/>
      <rect class="j-sign-on" x="-64" y="-168" width="128" height="38" rx="10"/>
      ${txt(0, -142, '代收点', 'j-t j-t--sign')}
      <rect class="j-win-lit" x="-64" y="-64" width="40" height="40" rx="3"/>
      <rect class="j-win-lit" x="24" y="-64" width="40" height="40" rx="3"/>
      <rect class="j-door-lit" x="-17" y="-60" width="34" height="60" rx="3"/>
    </g>
    <g class="j-closed" transform="translate(0 -30)"><g data-el="closed">
      <rect x="-30" y="-11" width="60" height="22" rx="4"/>
      ${txt(0, 5, '已关门', 'j-t j-t--closed')}
    </g></g>
  </g>`
}

function artGate(rot) {
  const booth = rot ? '' : `
    <g class="j-booth" transform="translate(64 -38)">
      <rect class="j-wall" x="-18" y="-46" width="36" height="46" rx="3"/>
      <path class="j-roof" d="M-24 -44 L0 -60 L24 -44 Z"/>
      <rect class="j-win-lit is-soft" x="-10" y="-36" width="20" height="14" rx="2"/>
    </g>`
  const light = rot ? 'translate(72 -46)' : 'translate(0 -98)'
  return `
  <g class="j-gate">
    ${booth}
    <g transform="rotate(${rot})">
      <rect class="j-gate__post" x="-38" y="-78" width="8" height="104" rx="3"/>
      <rect class="j-gate__post" x="30" y="-78" width="8" height="104" rx="3"/>
      <rect class="j-gate__beam" x="-44" y="-88" width="88" height="14" rx="5"/>
      <g class="j-gate__bar" data-el="gateBar">
        <path d="M-18 -72 V24 M0 -72 V24 M18 -72 V24 M-28 -24 H28"/>
      </g>
    </g>
    <g transform="${light}">
      <circle class="j-gate__lamp" r="9"/>
      <circle class="j-gate__red" data-el="gateRed" r="6"/>
      <circle class="j-gate__green" data-el="gateGreen" r="6"/>
    </g>
  </g>`
}

function artBarrier() {
  return `
  <g class="j-barrier" data-el="barrier">
    <g data-el="barShake">
      <g class="j-barrier__bar" data-el="bar">
        <rect x="-8" y="-60" width="16" height="120" rx="5"/>
        <path d="M-8 -40 L8 -48 M-8 -14 L8 -22 M-8 12 L8 4 M-8 38 L8 30"/>
      </g>
      <rect class="j-barrier__flash" data-el="barFlash" x="-18" y="-68" width="36" height="136" rx="12"/>
    </g>
    <g class="j-ghost" data-el="ghostBar">
      <rect x="-8" y="-60" width="16" height="120" rx="5"/>
    </g>
  </g>`
}

function artLock() {
  return `
  <g class="j-lock">
    <g data-el="planks" class="j-planks"><path d="M-17 -46 L17 2 M17 -46 L-17 2"/></g>
    <g data-el="padlock" class="j-padlock" transform="translate(0 -18)">
      <path class="j-padlock__shackle" data-el="shackle" d="M-8 -4 V-11 a8 8 0 0 1 16 0 V-4"/>
      <rect class="j-padlock__body" x="-12" y="-5" width="24" height="19" rx="4"/>
      <circle cx="0" cy="4" r="2.4" class="j-padlock__hole"/>
    </g>
    <g class="j-ghost" data-el="ghostLock"><rect x="-19" y="-48" width="38" height="52" rx="6"/></g>
  </g>`
}

function artStop(key) {
  return `
  <g class="j-stop" data-el="${key}">
    <path class="j-stop__post" d="M0 20 V56"/>
    <rect class="j-stop__board" x="-96" y="-24" width="192" height="48" rx="14"/>
    <g transform="translate(-68 0)">
      <path class="j-stop__oct" d="M-7 -16 H7 L16 -7 V7 L7 16 H-7 L-16 7 V-7 Z"/>
      <path class="j-stop__bar" d="M-8 0 H8"/>
    </g>
    ${txt(14, 6.5, '停！这里不放行', 'j-t j-t--stop')}
  </g>`
}

function artTower() {
  return `
  <g class="j-tower">
    <g class="j-beam"><path d="M0 -150 L-300 -196 L-300 -104 Z"/></g>
    <path class="j-tower__body" d="M-20 0 L-12 -130 H12 L20 0 Z"/>
    <path class="j-tower__stripe" d="M-18 -30 H18 M-16 -62 H16 M-14 -94 H14"/>
    <rect class="j-tower__room" x="-15" y="-156" width="30" height="26" rx="4"/>
    <path class="j-tower__cap" d="M-20 -156 L0 -176 L20 -156 Z"/>
    <circle class="j-tower__light" cx="0" cy="-143" r="6"/>
  </g>`
}

function artNewBuilding() {
  return `
  <g class="j-newb" data-el="newb">
    <rect class="j-wall j-wall--new" x="-32" y="-74" width="64" height="74" rx="3"/>
    <path class="j-roof" d="M-38 -72 L0 -98 L38 -72 Z"/>
    <rect class="j-win-lit is-soft" x="-12" y="-54" width="24" height="26" rx="3"/>
    ${txt(0, -34, '？', 'j-t j-t--q')}
    <g transform="translate(0 -116)">
      <rect class="j-newb__sign" x="-34" y="-12" width="68" height="24" rx="12"/>
      ${txt(0, 5, '新地址', 'j-t j-t--tag j-t--warn')}
    </g>
  </g>`
}

function artBillboard() {
  return `
  <g class="j-bill">
    <path class="j-bill__pole" d="M0 46 V${150}"/>
    <rect class="j-bill__panel" x="-104" y="-46" width="208" height="92" rx="16"/>
    <rect class="j-bill__panel is-safe" data-el="billSafe" x="-104" y="-46" width="208" height="92" rx="16"/>
    <rect class="j-bill__panel is-danger" data-el="billDanger" x="-104" y="-46" width="208" height="92" rx="16"/>
    <g transform="translate(-78 -20)" class="j-bill__eye">
      <path d="M-11 0 Q0 -9 11 0 Q0 9 -11 0 Z"/><circle r="3.4"/>
    </g>
    ${txt(8, -15, '岛上看到的来源', 'j-t j-t--bill-h')}
    ${txt(0, 24, '还没有来访', 'j-t j-t--bill-v is-none', 'data-el="billNone"')}
    ${txt(0, 24, '代收点门牌', 'j-t j-t--bill-v is-safe', 'data-el="billProxy"')}
    ${txt(0, 24, '你家门牌号', 'j-t j-t--bill-v is-danger', 'data-el="billHome"')}
  </g>`
}

function artBubble() {
  return `
  <g class="j-bubble" data-el="bubble">
    <rect x="-112" y="-30" width="224" height="60" rx="16"/>
    ${txt(0, -6, '被保护的应用', 'j-t j-t--bubble-h')}
    ${txt(0, 17, 'CLI · 浏览器 · Helper', 'j-t j-t--bubble')}
  </g>`
}

function artCard() {
  return `
  <g class="j-card" data-el="cardList">
    <rect x="-96" y="-20" width="192" height="40" rx="12" class="is-warn"/>
    ${txt(0, 6, '域名名单上：没有它', 'j-t j-t--card j-t--warn')}
  </g>
  <g class="j-card" data-el="cardProc">
    <rect x="-96" y="-20" width="192" height="40" rx="12" class="is-safe"/>
    ${txt(0, 6, '认程序：只走代收点', 'j-t j-t--card j-t--safe')}
  </g>`
}

function artRider(M) {
  const r = (M * 30) / 130
  const face = (f, tint) => `<g class="j-face" data-face="${f}" transform="translate(${-M / 2} ${-M * 0.538})">${mascot({ size: M, face: f, tint })}</g>`
  return `
  <g class="j-rider" data-el="rider">
    <g data-el="riderScale">
      ${face('idle', 'warm')}${face('happy', 'warm')}${face('worried', 'warm')}${face('blocked', 'warm')}${face('leak', 'danger')}
    </g>
    <g class="j-headplate" transform="translate(0 ${-(r + 16)})">
      <g data-el="headProxy"><rect x="-40" y="-11" width="80" height="22" rx="6"/>${txt(0, 4.5, '代收点门牌', 'j-t j-t--plate')}</g>
    </g>
    <g class="j-headplate is-danger" transform="translate(0 ${-(r + 16)})">
      <g data-el="headHome"><rect x="-40" y="-11" width="80" height="22" rx="6"/>${txt(0, 4.5, '你家门牌号', 'j-t j-t--plate')}</g>
    </g>
    <g class="j-parcel" transform="translate(${r + 6} ${r * 0.35})">
      <g data-el="parcel"><rect x="-10" y="-9" width="20" height="18" rx="3"/><path d="M-10 -2 H10 M0 -9 V9"/></g>
    </g>
  </g>`
}

function artFlyPlates() {
  return `
  <g class="j-headplate j-fly" data-el="flyProxy"><rect x="-40" y="-11" width="80" height="22" rx="6"/>${txt(0, 4.5, '代收点门牌', 'j-t j-t--plate')}</g>
  <g class="j-headplate j-fly is-danger" data-el="flyHome"><rect x="-40" y="-11" width="80" height="22" rx="6"/>${txt(0, 4.5, '你家门牌号', 'j-t j-t--plate')}</g>`
}

function pill(key, label, [x, y], anchor = 'middle') {
  const w = label.length * 14 + 26
  const cx = anchor === 'end' ? x - w / 2 : anchor === 'start' ? x + w / 2 : x
  return `<g class="j-pill" data-pill="${key}" transform="translate(${cx} ${y})"><rect x="${-w / 2}" y="-14" width="${w}" height="28" rx="14"/>${txt(0, 5, label, 'j-t j-t--pill')}</g>`
}

function sky(G) {
  const [W, H] = G.vb
  const r = rng(G.name === 'wide' ? 7 : 11)
  const maxY = G.name === 'wide' ? 360 : 130
  let stars = ''
  for (let i = 0; i < (G.name === 'wide' ? 70 : 26); i++) {
    const x = (r() * W).toFixed(1), y = (r() * maxY).toFixed(1), s = (0.5 + r() * 1.3).toFixed(2)
    const tw = r() > 0.72 ? ` class="j-star is-tw" style="animation-delay:${(-r() * 4).toFixed(2)}s"` : ' class="j-star"'
    stars += `<circle cx="${x}" cy="${y}" r="${s}"${tw}/>`
  }
  return stars
}

function skyline(G) {
  if (G.name !== 'wide') return ''
  const r = rng(3)
  let out = '<g class="j-skyline">'
  let x = -10
  while (x < 690) {
    const w = 26 + r() * 46, h = 40 + r() * 120
    if (!(x > 90 && x < 300) && !(x > 480 && x < 660)) {
      out += `<rect x="${x.toFixed(0)}" y="${(410 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/>`
      for (let wy = 410 - h + 10; wy < 400; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r() > 0.84) out += `<rect class="j-skyline__win" x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="4" height="6"/>`
    } else {
      out += `<rect x="${x.toFixed(0)}" y="${(410 - h * 0.35).toFixed(0)}" width="${w.toFixed(0)}" height="${(h * 0.35).toFixed(0)}" class="is-far"/>`
    }
    x += w + 4
  }
  return out + '</g>'
}

function sceneryWide() {
  return `
  <rect width="1200" height="640" fill="url(#jr-sky)"/>
  <g class="j-stars">${sky(WIDE)}</g>
  <g class="j-moon" transform="translate(70 168)"><circle r="30" class="j-moon__halo"/><circle r="20" class="j-moon__disc"/><circle cx="9" cy="-6" r="17" class="j-moon__cut"/></g>
  <rect x="660" y="386" width="320" height="254" fill="url(#jr-sea)"/>
  <path class="j-horizon" d="M660 386 H980"/>
  <g class="j-waves" clip-path="url(#jr-seaclip)">
    <path d="M620 548 q15 -5 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0"/>
    <path d="M600 590 q15 -5 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0"/>
    <path d="M640 622 q15 -5 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0"/>
  </g>
  ${skyline(WIDE)}
  <path class="j-land" d="M0 410 H690 C700 470 694 560 676 640 H0 Z"/>
  <path class="j-land j-land--island" d="M1200 410 H956 C948 470 952 560 972 640 H1200 Z"/>
  <g class="j-bridge">
    <path class="j-bridge__cable" d="M690 418 L745 300 Q825 404 905 300 L960 418"/>
    <path class="j-bridge__hangers" d="M765 332 V418 M785 356 V418 M805 370 V418 M825 374 V418 M845 370 V418 M865 356 V418 M885 332 V418"/>
    <rect class="j-bridge__tower" x="739" y="292" width="12" height="238" rx="3"/>
    <rect class="j-bridge__tower" x="899" y="292" width="12" height="238" rx="3"/>
    <path class="j-bridge__pier" d="M760 530 V640 M825 530 V640 M890 530 V640"/>
    <g class="j-bridge__lights">${[745, 765, 785, 805, 825, 845, 865, 885, 905].map((x, i) => `<circle cx="${x}" cy="${[300, 332, 356, 370, 374, 370, 356, 332, 300][i]}" r="2.6" style="animation-delay:${(i * 0.18).toFixed(2)}s"/>`).join('')}</g>
  </g>
  <rect class="j-road" x="20" y="418" width="1150" height="112" rx="18"/>
  <path class="j-road__edge" d="M38 418 H1152"/>
  <path class="j-road__mid" d="M60 475 H1150"/>
  ${txt(1085, 612, 'Claude 岛', 'j-t j-t--isle')}
  ${txt(825, 612, '海', 'j-t j-t--sea')}`
}

function sceneryTall() {
  return `
  <rect y="-34" width="400" height="914" fill="url(#jr-ground)"/>
  <g class="j-stars">${sky(TALL)}</g>
  <g class="j-moon" transform="translate(360 16)"><circle r="24" class="j-moon__halo"/><circle r="15" class="j-moon__disc"/><circle cx="7" cy="-5" r="13" class="j-moon__cut"/></g>
  <rect x="0" y="530" width="400" height="120" fill="url(#jr-sea-t)"/>
  <g class="j-waves" clip-path="url(#jr-seaclip)">
    <path d="M-40 556 q12 -4 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0"/>
    <path d="M-60 592 q12 -4 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0"/>
    <path d="M-30 628 q12 -4 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0"/>
  </g>
  <path class="j-land j-land--island" d="M0 648 C90 634 310 634 400 648 V880 H0 Z"/>
  <path class="j-shore" d="M0 530 C120 522 280 522 400 530"/>
  <rect class="j-road" x="132" y="206" width="112" height="624" rx="20"/>
  <path class="j-road__mid" d="M188 244 V820"/>
  <g class="j-bridge__lights">${[545, 575, 605, 635].map((y, i) => `<circle cx="128" cy="${y}" r="2.6" style="animation-delay:${(i * 0.2).toFixed(2)}s"/><circle cx="248" cy="${y}" r="2.6" style="animation-delay:${(i * 0.2 + 0.1).toFixed(2)}s"/>`).join('')}</g>
  <path class="j-bridge__rail" d="M128 534 V644 M248 534 V644"/>
  ${txt(318, 694, 'Claude 岛', 'j-t j-t--isle')}
  ${txt(40, 600, '海', 'j-t j-t--sea')}`
}

function defs(G) {
  const [W, H] = G.vb
  const seaClip = G.name === 'wide' ? '<rect x="660" y="386" width="320" height="254"/>' : '<rect x="0" y="530" width="400" height="120"/>'
  return `<defs>
    <linearGradient id="jr-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#070b18"/><stop offset=".55" stop-color="#0f1730"/><stop offset=".64" stop-color="#1c1d33"/><stop offset="1" stop-color="#0b0e18"/>
    </linearGradient>
    <linearGradient id="jr-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1022"/><stop offset=".3" stop-color="#0d1326"/><stop offset="1" stop-color="#0a0d18"/>
    </linearGradient>
    <linearGradient id="jr-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b2748"/><stop offset=".4" stop-color="#101a36"/><stop offset="1" stop-color="#070b18"/>
    </linearGradient>
    <linearGradient id="jr-sea-t" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#132142"/><stop offset=".5" stop-color="#172a52"/><stop offset="1" stop-color="#101b38"/>
    </linearGradient>
    <linearGradient id="jr-beam" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="#ffd08a" stop-opacity=".5"/><stop offset="1" stop-color="#ffd08a" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="jr-alarm" cx="50%" cy="50%" r="75%">
      <stop offset=".45" stop-color="#ff4d61" stop-opacity="0"/><stop offset="1" stop-color="#ff4d61" stop-opacity=".55"/>
    </radialGradient>
    <filter id="jr-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="jr-glow-line" filterUnits="userSpaceOnUse" x="-40" y="${(G.vy || 0) - 40}" width="${W + 80}" height="${H - (G.vy || 0) + 80}"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="jr-glow-lg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="jr-seaclip">${seaClip}</clipPath>
    <clipPath id="jr-frame"><rect y="${G.vy || 0}" width="${W}" height="${H - (G.vy || 0)}"/></clipPath>
  </defs>`
}

function stageSVG(G) {
  const [W, H] = G.vb
  const vy = G.vy || 0
  const tr = ([x, y], extra = '') => `transform="translate(${x} ${y})${extra}"`
  const lanes = Object.entries(G.paths).map(([k, d]) => {
    const kind = LANES_OUT.includes(k) ? 'out' : LANES_BACK.includes(k) ? 'back' : k
    return `<path class="j-lane j-lane--${kind}" data-path="${k}" d="${d}"/>`
  }).join('')
  const lits = Object.entries(G.paths).map(([k, d]) => {
    const red = k === 'direct' || k === 'side' || k === 'sideGo'
    return `<path class="j-lit ${red ? 'is-red' : ''}" data-lit="${k}" d="${d}" pathLength="1"/>`
  }).join('')
  const P = G.pills
  const pills = G.name === 'wide'
    ? pill('home', '01 你家', P.home) + pill('gate', '02 准入闸门', P.gate) + pill('proxy', '03 代收点', P.proxy) + pill('island', '04 Claude 岛', P.island)
    : pill('home', '01 你家', P.home, 'start') + pill('gate', '02 准入', P.gate, 'middle') + pill('proxy', '03 代收点', P.proxy, 'middle') + pill('island', '04 Claude 岛', P.island, 'middle')
  return `<svg class="j-svg" viewBox="0 ${vy} ${W} ${H - vy}" role="img" aria-label="请求旅程示意图：你家、准入闸门、代收点、跨海大桥与 Claude 岛" preserveAspectRatio="xMidYMid meet">
    ${defs(G)}
    <g clip-path="url(#jr-frame)">
      <g class="j-scenery">${G.name === 'wide' ? sceneryWide() : sceneryTall()}</g>
      <g ${tr(G.tower)}${G.name === 'tall' ? '' : ''}><g transform="scale(${G.name === 'tall' ? 0.78 : 1})">${artTower()}</g></g>
      <g ${tr(G.newb)}>${artNewBuilding()}</g>
      <g ${tr(G.bill)}><g transform="scale(${G.billScale})">${artBillboard()}</g></g>
      <g class="j-lanes">${lanes}</g>
      <g class="j-lits">${lits}</g>
      <g ${tr(G.house)}>${artHouse()}</g>
      <g ${tr(G.proxy)}>${artProxy()}</g>
      <g ${tr(G.gate)}>${artGate(G.gateRot)}</g>
      <g class="j-pills">${pills}</g>
      <g data-el="barrierPos">${artBarrier()}</g>
      <g ${tr([G.house[0] - 58, G.house[1]])}>${artLock()}</g>
      <g ${tr(G.bubble)}><g transform="scale(${G.bubbleScale || 1})">${artBubble()}</g></g>
      <g ${tr(G.card)}>${artCard()}</g>
      ${artRider(G.M)}
      ${artFlyPlates()}
      <g ${tr(G.stopBar)}>${artStop('stopBar')}</g>
      <g ${tr(G.stopLock)}>${artStop('stopLock')}</g>
      <rect class="j-alarm" data-el="alarm" y="${vy}" width="${W}" height="${H - vy}" fill="url(#jr-alarm)"/>
    </g>
  </svg>`
}

/* ---------------- 剧本：8 段（4 场景 × 有无防护） ---------------- */
const SC_NAME = { normal: '正常路径', down: '代理掉线', newdomain: '新域名', ipv6: 'IPv6 旁路' }

const STEP_START = { k: '发起请求', t: '小请求出发啦', d: '请求先进入被保护的应用（CLI、浏览器、Helper）。无论目标域名叫什么，都不能自己选择直连。', st: 'home' }
const STEP_GATE = { k: '准入通过', t: '准入通过', d: '先检查，再放行。出门前的安检确认代收点在线、地址对，闸门才抬起来。', st: 'gate' }
const STEP_PROXY = { k: '代理在线', t: '代理在线', d: '到了代收点，也就是固定受控出口。从这里寄出，对方只看得到代收点的地址。', st: 'proxy' }
const STEP_ISLAND = { k: '目标服务', t: '抵达目标服务', d: '从受控出口过海，抵达 Claude 岛。岛上看到的是代收点门牌，你家门牌号没露。', st: 'island' }
const STEP_BACK = { k: '原连接返回', t: '原连接返回', d: '回信沿原来的连接返回，仍然经过同一个代收点。', st: 'back' }
const STEP_HOME = { k: '收到结果', t: '收到结果', d: '结果送到家。下一次请求出门，还要再检查一遍。', st: 'home' }
const STEP_LEAKED = { k: '门牌号露了', t: '门牌号露了', d: 'Claude 岛直接看到了你家门牌号（真实 IP）。这就是「露馅」。', st: 'island', tension: true }
const STEP_COMPARE = (d) => ({ k: '对照一下', t: '对照一下', d, st: null, tension: true })

const STORIES = {
  normal: [
    { ...STEP_START, run: 'start' },
    { ...STEP_GATE, run: 'gate' },
    { ...STEP_PROXY, run: 'proxy' },
    { ...STEP_ISLAND, run: 'island' },
    { ...STEP_BACK, run: 'back' },
    { ...STEP_HOME, run: 'home' },
  ],
  down: [
    { ...STEP_START, run: 'start' },
    { ...STEP_GATE, run: 'gate' },
    { k: '代收点熄灯', t: '代收点熄灯了', d: '走到代收点，灯灭了，门也关了。包裹寄不出去。', st: 'proxy', run: 'proxyDown' },
    { k: '想走自家门口', t: '想从自家门口溜出去', d: '它想绕开代收点，从自家门口直接寄出。这就是直连，门牌号会露。', st: 'home', run: 'tryDirect' },
    { k: '闸门落下', t: '停！这里不放行', d: '闸门在出门前落下，拦住了它。代收点关门时，包裹宁可不寄。', st: 'home', run: 'slamBarrier', hold: 1.6 },
    { k: '乖乖回家', t: '乖乖回家', d: '连不上，可以；真实 IP 直连，不行。它回家等代收点重新开门。', st: 'home', run: 'goHomeBar', hold: 2.4 },
  ],
  newdomain: [
    { k: '发起请求', t: '要去一个新地址', d: '这次的目标是一个没见过的新地址。名单上还没有它。', st: 'home', run: 'startNew' },
    { k: '按程序放行', t: '规则认的是程序', d: '被保护的程序出门，只能走代收点。名单里有没有这个地址，都一样。', st: 'gate', run: 'gateNew', hold: 1.4 },
    { ...STEP_PROXY, d: '照样先到代收点，换上代收点的门牌。新地址也拿不到例外。', run: 'proxy' },
    { k: '抵达新地址', t: '抵达新地址', d: '从受控出口抵达新地址。对方看到的，依然是代收点门牌。', st: 'island', run: 'islandNew' },
    { ...STEP_BACK, run: 'backNew' },
    { ...STEP_HOME, run: 'home' },
  ],
  ipv6: [
    { ...STEP_START, run: 'start' },
    { k: '发现侧门', t: '发现一扇侧门', d: '家里还有一扇平时没注意的侧门，叫 IPv6。只锁正门（IPv4）不够。', st: 'home', run: 'findSide' },
    { k: '想走侧门', t: '想从侧门溜出去', d: '从侧门出去，就绕开了代收点，门牌号一样会露。', st: 'home', run: 'trySide' },
    { k: '侧门上锁', t: '停！这里不放行', d: '系统级阻断把侧门也锁死了。正门、侧门，一个都不许绕。', st: 'home', run: 'lockSide', hold: 1.6 },
    { k: '乖乖回家', t: '乖乖回家', d: '连不上，可以；真实 IP 直连，不行。IPv4 安全，不能代替 IPv6 验收。', st: 'home', run: 'goHomeSide', hold: 2.4 },
  ],
  'normal-leak': [
    { k: '没装防护', t: '一次没有防护的出门', d: '这次家门口只贴了一张告示「寄件请走代收点」，没有闸门，也没有门卫。', st: 'home', run: 'startNotice' },
    { k: '直接出门', t: '不看告示，直接出门', d: '有的程序不看告示，照样自己出门。没人拦它，它从自家门口直奔 Claude 岛。', st: 'home', run: 'leakDirect' },
    { ...STEP_LEAKED, run: 'leakReveal', hold: 1.6 },
    { ...STEP_COMPARE('有防护时，这一刻闸门会落下。告示只是提醒，门卫才会真拦。'), run: 'compareBar', hold: 2.6 },
  ],
  'down-leak': [
    { k: '没装防护', t: '一次没有防护的出门', d: '这次家里没装闸门，也没有门卫。小请求照常出发。', st: 'home', run: 'start' },
    { k: '代收点熄灯', t: '代收点熄灯了', d: '走到代收点，灯灭了。没有人让它停下来等。', st: 'proxy', run: 'proxyDownLeak' },
    { k: '走自家门口', t: '掉头走自家门口', d: '它掉头回家，从自家门口直接寄出。没有闸门，它不会停。', st: 'home', run: 'leakDirectBack' },
    { ...STEP_LEAKED, run: 'leakReveal', hold: 1.6 },
    { ...STEP_COMPARE('有防护时，这一刻闸门会落下。连不上，可以；真实 IP 直连，不行。'), run: 'compareBar', hold: 2.6 },
  ],
  'newdomain-leak': [
    { k: '只有名单', t: '只靠一份名单', d: '这次没有防护，只有一份域名名单。新地址不在名单上。', st: 'home', run: 'startNewLeak' },
    { k: '名单外直连', t: '名单外，就走自家门口', d: '名单管不到的地址，没人管。它直接从自家门口出门。', st: 'home', run: 'leakDirectNew' },
    { ...STEP_LEAKED, d: '新地址直接看到了你家门牌号（真实 IP）。这就是「露馅」。', run: 'leakRevealNew', hold: 1.6 },
    { ...STEP_COMPARE('有防护时，规则认的是程序，新地址也要走代收点。名单补不完，靠名单挡不住。'), run: 'compareBar', hold: 2.6 },
  ],
  'ipv6-leak': [
    { k: '侧门没锁', t: '只锁了正门', d: '这次只管了正门（IPv4），侧门（IPv6）没人管。', st: 'home', run: 'startSideLeak' },
    { k: '走侧门', t: '从侧门溜出去', d: '它发现侧门开着，直接从侧门出了门，一路绕开代收点。', st: 'home', run: 'leakSide' },
    { ...STEP_LEAKED, run: 'leakReveal', hold: 1.6 },
    { ...STEP_COMPARE('有防护时，侧门也会被锁死。IPv4 安全，不能代替 IPv6 验收。'), run: 'compareLock', hold: 2.6 },
  ],
}

const INTRO = { t: '准备出发', d: '点「播放」，或者滚到这里，小请求就会出门。也可以点下面任意一站，逐步看。' }

/* ---------------- 章节模块 ---------------- */
export default {
  id: 'journey',
  nav: '请求的旅程',
  desc: '动画看懂一次请求怎样安全出门',
  mood: 'journey',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>请求的旅程</span></div>
        <h2 class="h2" data-reveal="lines">跟着一个小请求，<br><span class="text-warm">安全地跑完一圈</span></h2>
        <p class="lead" data-reveal>它从你家出发，过安检，到代收点，跨海到 Claude 岛，再沿原路回家。换一个场景，看看出事的时候，它会怎么做。</p>
      </header>

      <div class="j-top" data-reveal>
        <div class="segmented j-scenes" role="group" aria-label="选择场景">
          ${Object.entries(SC_NAME).map(([k, v], i) => `<button type="button" data-scenario="${k}" aria-pressed="${i === 0}" data-sfx="click">${v}</button>`).join('')}
        </div>
        <button type="button" class="j-switch" role="switch" aria-checked="false" data-act="leak">
          <span class="j-switch__track" aria-hidden="true"><i></i></span>
          <span class="j-switch__label">如果没有防护</span>
        </button>
      </div>

      <div class="j-stagecard" data-reveal="scale">
        <div class="j-stage" data-sc="normal" data-leak="0"></div>
        <div class="j-badges" aria-hidden="true">
          <span class="j-badge"><i class="dot"></i>逻辑演示 · 不读取你电脑的网络</span>
          <span class="j-badge j-badge--leak"><i class="dot"></i>演示：没有防护</span>
        </div>
        <div class="j-verdict" data-el="verdictOk" aria-hidden="true">
          <span class="v-ok">连不上，可以。</span><span class="v-no">真实 IP 直连，不行。</span>
        </div>
        <div class="j-verdict j-verdict--leak" data-el="verdictLeak" aria-hidden="true">
          <span class="v-leak">门牌号露了</span><span class="v-sub">对方看到的，是你家的真实地址</span>
        </div>
      </div>

      <div class="j-console">
        <div class="j-caption" aria-live="polite" aria-atomic="true">
          <div class="j-caption__meta"><span class="j-caption__num">00 / 06</span><span class="j-caption__sc">正常路径</span></div>
          <h3 class="j-caption__title">${INTRO.t}</h3>
          <p class="j-caption__text">${INTRO.d}</p>
        </div>
        <div class="j-controls">
          <button type="button" class="btn btn--primary btn--sm j-play" data-act="play" data-sfx="click">
            <svg class="i-play" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 2.2 L11.5 7 L3.5 11.8 Z" fill="currentColor"/></svg>
            <svg class="i-pause" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2.5 V11.5 M10 2.5 V11.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
            <span class="j-play__label">播放</span>
          </button>
          <button type="button" class="btn btn--ghost btn--sm" data-act="next" data-sfx="click">下一步 <span class="arrow">→</span></button>
          <button type="button" class="btn btn--ghost btn--sm" data-act="replay" data-sfx="click" aria-label="重播当前场景">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.6 7 A4.4 4.4 0 1 0 4 3.8 M2.4 1.6 V4.4 H5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            重播
          </button>
        </div>
      </div>
      <ol class="j-rail" aria-label="逐步查看"></ol>

      <div class="j-foot">
        <ul class="j-legend">
          <li><i class="lg lg--out"></i>暖金灯带：请求出门的路</li>
          <li><i class="lg lg--back"></i>下方回路：沿原连接返回</li>
          <li><i class="lg lg--next"></i>虚线：下一次请求</li>
          <li><i class="lg lg--direct"></i>红线：直连，门牌号会露</li>
        </ul>
        <p class="j-note">这里是逻辑演示，不读取你电脑的网络。</p>
      </div>

      <div class="j-after">
        <div class="metaphor" data-reveal>
          <span>被保护的程序只认一个代收点。代收点关门时，包裹<strong>宁可不寄</strong>，也不从自家门口寄。换个新地址、找到一扇侧门，规矩都一样。</span>
        </div>
        <div class="pro-only j-pro" data-reveal>
          <div class="j-pro__head"><span class="pro-badge">进阶</span><span class="j-pro__title">四个场景，各对应哪条要求</span></div>
          <dl class="j-pro__list">
            <div><dt>正常路径</dt><dd>被保护进程进入代理，再从固定出口访问服务；响应沿原连接，仍经过同一代理返回。</dd></div>
            <div><dt>代理掉线</dt><dd>专用策略组不自动回落 DIRECT。启动门禁、持续守卫、系统级阻断，分别负责准入、发现和拦截。</dd></div>
            <div><dt>新域名</dt><dd>进程、路径、域名交叉匹配；新域名也不能获得例外。对「任何新域名也不直连」的要求，要由业务进程的全目的地出站限制实现；不能靠无限补名单实现同等保证。</dd></div>
            <div><dt>IPv6 旁路</dt><dd>DNS、IPv6、UDP / QUIC 要么纳入受控路径，要么明确阻断。IPv4 安全不能代替 IPv6 验收。</dd></div>
          </dl>
        </div>
      </div>
    </div>`

    const $ = (s) => el.querySelector(s)
    const stageCard = $('.j-stagecard')
    const stage = $('.j-stage')
    const capNum = $('.j-caption__num'), capSc = $('.j-caption__sc'), capTitle = $('.j-caption__title'), capText = $('.j-caption__text')
    const rail = $('.j-rail')
    const playBtn = $('[data-act="play"]')
    const leakBtn = $('[data-act="leak"]')
    const verdictOk = $('[data-el="verdictOk"]'), verdictLeak = $('[data-el="verdictLeak"]')
    const mq = window.matchMedia('(max-width: 720px)')

    let G = mq.matches ? TALL : WIDE
    let sc = 'normal'
    let leak = false
    let tl = null
    let story = STORIES.normal
    let ends = []
    let cur = -1
    let mode = 'auto'
    let moodOn = false
    let started = false
    let visible = false
    let resumeOnShow = false
    let moodTimer = null
    let R = {}, P = {}, L = {}, F = {}

    const sfx = (n) => audio.sfx(n)
    const pt = (a) => ({ x: a[0], y: a[1] })

    function setMood(on) {
      if (on && !moodOn) { pushMood('tension'); moodOn = true }
      else if (!on && moodOn) { popMood(); moodOn = false }
    }

    /* ---- 渲染舞台 ---- */
    function render() {
      stage.dataset.layout = G.name
      stage.dataset.sc = sc
      stage.dataset.leak = leak ? '1' : '0'
      stageCard.classList.toggle('is-leak', leak)
      stageCard.dataset.layout = G.name
      stage.innerHTML = stageSVG(G)
      R = {}; P = {}; L = {}; F = {}
      stage.querySelectorAll('[data-el]').forEach((n) => { R[n.dataset.el] = n })
      stage.querySelectorAll('[data-path]').forEach((n) => { P[n.dataset.path] = n })
      stage.querySelectorAll('[data-lit]').forEach((n) => { L[n.dataset.lit] = n })
      stage.querySelectorAll('[data-face]').forEach((n) => { F[n.dataset.face] = n })
      R.verdictOk = verdictOk; R.verdictLeak = verdictLeak

      // 闸门放在直连小路上，垂直于路线
      const d = P.direct, len = d.getTotalLength(), at = len * G.barrierT
      const p0 = d.getPointAtLength(at), p1 = d.getPointAtLength(at + 2)
      const ang = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI
      R.barrierPos.setAttribute('transform', `translate(${p0.x.toFixed(1)} ${p0.y.toFixed(1)}) rotate(${ang.toFixed(1)})`)

      // 初始状态
      gsap.set(R.rider, { x: G.home[0], y: G.home[1] })
      gsap.set(R.riderScale, { scale: 0, opacity: 0, transformOrigin: '50% 50%' })
      gsap.set(Object.values(F), { opacity: 0 })
      gsap.set(F.idle, { opacity: 1 })
      gsap.set([R.headProxy, R.headHome, R.parcel, R.flyProxy, R.flyHome], { opacity: 0 })
      gsap.set([R.billSafe, R.billDanger, R.billProxy, R.billHome, R.gateGreen, R.bubble, R.cardList, R.cardProc, R.stopBar, R.stopLock, R.alarm, R.sideGlow, R.sideTag, R.barFlash, R.ghostBar, R.ghostLock, R.closed, R.winGlow], { opacity: 0 })
      gsap.set(R.bar, { y: -130, opacity: 0 })
      gsap.set(R.planks, { scale: 0, opacity: 0, transformOrigin: '50% 50%' })
      gsap.set(R.padlock, { y: -80, opacity: 0 })
      gsap.set(R.newb, { scaleY: 0, opacity: 0, transformOrigin: '50% 100%' })
      gsap.set(R.notice, { opacity: 0, scale: 0.6, transformOrigin: '50% 0%' })
      gsap.set(R.flyProxy, { transformOrigin: '50% 50%' }); gsap.set(R.flyHome, { transformOrigin: '50% 50%' })
      gsap.set(Object.values(L), { strokeDasharray: '1 1', strokeDashoffset: 1 })
      gsap.set([P.outD, P.turnNew, P.backNew, P.side, P.sideGo], { opacity: 0 })
      // 变换原点在挂载后一次性设定（避免在时间轴跳转时才测量包围盒）
      gsap.set([R.stopBar, R.stopLock, R.headProxy, R.headHome], { transformOrigin: '50% 100%' })
      gsap.set([R.bubble, R.cardList, R.cardProc, R.closed, R.parcel, R.sideTag, R.billProxy, R.billHome], { transformOrigin: '50% 50%' })
      gsap.set([verdictOk, verdictLeak], { opacity: 0, y: 16 })
      gsap.set([...verdictOk.children, ...verdictLeak.children], { opacity: 0, y: 18 })
    }

    /* ---- 时间轴小工具 ---- */
    const call = (tl, fn, args, pos) => tl.call(fn, args, pos)
    const ride = (tl, key, dur, o = {}) => {
      const { start = 0, end = 1, ease = 'sine.inOut', lit = true, pos = '>' } = o
      tl.to(R.rider, { duration: dur, ease, motionPath: { path: P[key], start, end } }, pos)
      if (lit && L[key]) tl.fromTo(L[key], { strokeDashoffset: 1 - start }, { strokeDashoffset: 1 - end, duration: dur, ease, immediateRender: false }, '<')
    }
    const face = (tl, f, pos = '>') => {
      tl.set(Object.values(F), { opacity: 0 }, pos)
      tl.set(F[f], { opacity: 1 }, '<')
    }
    const popIn = (tl, target, pos = '>', o = {}) => tl.fromTo(target, { opacity: 0, scale: o.from ?? 0.5, y: o.y ?? 8 }, { opacity: 1, scale: 1, y: 0, duration: o.dur ?? 0.7, ease: o.ease ?? 'back.out(2)', immediateRender: false }, pos)
    const fadeOut = (tl, target, pos = '>', dur = 0.3) => tl.to(target, { opacity: 0, duration: dur }, pos)
    const bob = (tl, pos = '>') => tl.fromTo(R.riderScale, { y: 0 }, { y: -10, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.out', immediateRender: false }, pos)
    const shake = (tl, target, amt = 6, pos = '>') => tl.fromTo(target, { x: 0 }, { x: amt, duration: 0.05, repeat: 7, yoyo: true, ease: 'none', immediateRender: false }, pos)
    const headPt = (p) => ({ x: p.x, y: p.y - ((G.M * 30) / 130 + 16) })
    const billPt = () => ({ x: G.bill[0], y: G.bill[1] + 24 * G.billScale })
    const verdict = (tl, v, pos = '>') => {
      tl.to(v, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, pos)
      tl.to(v.children, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.28 }, '<')
    }
    const flyPlate = (tl, plate, from, to, grow = 1.2) => {
      const mid = { x: (from.x + to.x) / 2 + (G.name === 'wide' ? -40 : -30), y: Math.min(from.y, to.y) - (G.name === 'wide' ? 90 : 60) }
      tl.set(plate, { x: from.x, y: from.y, opacity: 1, scale: 1 })
      tl.to(plate, { duration: 1, ease: 'power2.inOut', motionPath: { path: [from, mid, to], curviness: 1.2 } })
      tl.to(plate, { scale: grow, duration: 1, ease: 'power2.inOut' }, '<')
      tl.to(plate, { opacity: 0, scale: grow * 1.15, duration: 0.25 })
    }
    const intoDoor = (tl) => {
      tl.to(R.riderScale, { scale: 0.62, duration: 0.6, ease: 'expo.out' })
      tl.to(R.rider, { y: `-=${G.name === 'wide' ? 26 : 20}`, duration: 0.6, ease: 'expo.out' }, '<')
    }

    /* ---- 每一段剧情 ---- */
    const RUN = {
      start(tl) {
        popIn(tl, R.riderScale, '>', { from: 0, y: 0, dur: 1, ease: 'expo.out' })
        call(tl, sfx, ['pop'], '<')
        tl.fromTo(R.winGlow, { opacity: 0 }, { opacity: 1, duration: 0.35, yoyo: true, repeat: 3, immediateRender: false }, '<')
        popIn(tl, R.bubble, '<0.25', { y: 12 })
        bob(tl, '>-0.2')
      },
      startNotice(tl) {
        RUN.start(tl)
        popIn(tl, R.notice, '<0.2', { from: 0.4, y: -6, origin: '50% 0%' })
        call(tl, sfx, ['pop'], '<')
      },
      startNew(tl) {
        RUN.start(tl)
        tl.fromTo(R.newb, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 1.1, ease: 'expo.out', immediateRender: false }, '<0.3')
        call(tl, sfx, ['reveal'], '<')
        tl.to([P.outD, P.turnNew, P.backNew], { opacity: 1, duration: 0.6 }, '<0.3')
      },
      startNewLeak(tl) {
        RUN.startNew(tl)
        popIn(tl, R.cardList, '<0.4')
        call(tl, sfx, ['heartbeat'], '<')
      },
      startSideLeak(tl) {
        RUN.start(tl)
        tl.to(R.sideGlow, { opacity: 1, duration: 0.6 }, '<0.4')
        popIn(tl, R.sideTag, '<')
        tl.to([P.side, P.sideGo], { opacity: 1, duration: 0.6 }, '<')
      },
      gate(tl) {
        fadeOut(tl, R.bubble, '>')
        ride(tl, 'outA', 1.2, { pos: '<' })
        call(tl, sfx, ['step'])
        tl.to(R.gateRed, { opacity: 0, duration: 0.2 }, '+=0.15')
        tl.to(R.gateGreen, { opacity: 1, duration: 0.2 }, '<')
        call(tl, sfx, ['toggle-on'], '<')
        tl.to(R.gateBar, { y: -70, opacity: 0, duration: 0.7, ease: 'expo.out' }, '<')
        face(tl, 'happy', '<')
        bob(tl, '<0.1')
        face(tl, 'idle', '+=0.5')
      },
      gateNew(tl) {
        ride(tl, 'outA', 1.2)
        call(tl, sfx, ['step'])
        popIn(tl, R.cardList, '>')
        call(tl, sfx, ['heartbeat'], '<')
        face(tl, 'worried', '<')
        fadeOut(tl, R.cardList, '+=0.9', 0.25)
        popIn(tl, R.cardProc, '>')
        call(tl, sfx, ['success'], '<')
        tl.to(R.gateRed, { opacity: 0, duration: 0.2 }, '+=0.2')
        tl.to(R.gateGreen, { opacity: 1, duration: 0.2 }, '<')
        tl.to(R.gateBar, { y: -70, opacity: 0, duration: 0.7, ease: 'expo.out' }, '<')
        call(tl, sfx, ['toggle-on'], '<')
        face(tl, 'happy', '<')
        fadeOut(tl, R.cardProc, '+=0.6')
        face(tl, 'idle', '<')
      },
      proxy(tl) {
        ride(tl, 'outB', 1.2)
        call(tl, sfx, ['step'])
        tl.fromTo(R.lampOn, { opacity: 1 }, { opacity: 0.55, duration: 0.14, yoyo: true, repeat: 1, immediateRender: false })
        popIn(tl, R.headProxy, '<', { from: 0.3, y: 10, origin: '50% 100%' })
        call(tl, sfx, ['pop'], '<')
        face(tl, 'happy', '<')
        face(tl, 'idle', '+=0.6')
      },
      proxyDown(tl) {
        ride(tl, 'outB', 1.2)
        call(tl, sfx, ['step'])
        tl.to(R.lampOn, { keyframes: { opacity: [1, 0.15, 0.9, 0.08, 0.5, 0] }, duration: 1, ease: 'none' }, '+=0.2')
        call(tl, sfx, ['heartbeat'], '<')
        popIn(tl, R.closed, '>-0.1', { from: 0.6 })
        face(tl, 'worried', '<')
        bob(tl, '<0.1')
      },
      proxyDownLeak(tl) {
        ride(tl, 'outA', 1.1)
        RUN.proxyDown(tl)
      },
      tryDirect(tl) {
        tl.to([L.outA, L.outB], { opacity: 0.25, duration: 0.5 })
        ride(tl, 'outB', 0.8, { start: 1, end: 0, lit: false, ease: 'power2.inOut', pos: '<' })
        ride(tl, 'outA', 0.8, { start: 1, end: 0, lit: false, ease: 'power2.inOut' })
        tl.fromTo(L.direct, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', immediateRender: false })
        tl.to(L.direct, { opacity: 0.45, duration: 0.3 })
        ride(tl, 'direct', 0.7, { end: G.barrierT * G.stopAt, lit: false, ease: 'power2.in', pos: '<' })
      },
      slamBarrier(tl) {
        tl.fromTo(R.bar, { y: -130, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power4.in', immediateRender: false })
        call(tl, sfx, ['gate'])
        tl.fromTo(R.barFlash, { opacity: 0.9 }, { opacity: 0, duration: 0.5, immediateRender: false })
        shake(tl, R.barShake, 4, '<')
        face(tl, 'blocked', '<')
        ride(tl, 'direct', 0.4, { start: G.barrierT * G.stopAt, end: G.barrierT * 0.3, lit: false, ease: 'power3.out', pos: '<' })
        tl.to(L.direct, { opacity: 0.12, duration: 0.4 }, '<')
        popIn(tl, R.stopBar, '<0.15', { from: 0, y: 20, origin: '50% 100%', ease: 'back.out(2.4)', dur: 0.8 })
        call(tl, sfx, ['deny'], '<')
      },
      goHomeBar(tl) {
        ride(tl, 'direct', 0.5, { start: G.barrierT * 0.3, end: 0, lit: false, ease: 'power2.inOut' })
        face(tl, 'worried', '<')
        intoDoor(tl)
        face(tl, 'idle', '<0.3')
        call(tl, sfx, ['reveal'], '<')
        verdict(tl, verdictOk, '<')
      },
      findSide(tl) {
        fadeOut(tl, R.bubble, '>')
        tl.to(R.sideGlow, { opacity: 1, duration: 0.5 }, '<')
        tl.fromTo(R.sideGlow, { opacity: 1 }, { opacity: 0.45, duration: 0.4, yoyo: true, repeat: 3, immediateRender: false })
        popIn(tl, R.sideTag, '<')
        call(tl, sfx, ['heartbeat'], '<')
        face(tl, 'worried', '<')
        tl.to(R.riderScale, { rotation: -12, duration: 0.4, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<')
        tl.to([P.side, P.sideGo], { opacity: 1, duration: 0.6 }, '<0.4')
      },
      trySide(tl) {
        ride(tl, 'sideGo', 1.1, { ease: 'power2.inOut' })
        tl.fromTo(L.side, { strokeDashoffset: 1 }, { strokeDashoffset: 0.55, duration: 1.1, ease: 'power2.inOut', immediateRender: false }, '<0.4')
      },
      lockSide(tl) {
        tl.fromTo(R.planks, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)', immediateRender: false })
        call(tl, sfx, ['gate'], '<')
        tl.fromTo(R.padlock, { y: -80, opacity: 0 }, { y: -18, opacity: 1, duration: 0.5, ease: 'bounce.out', immediateRender: false }, '<0.1')
        tl.fromTo(R.shackle, { y: -5 }, { y: 0, duration: 0.15, ease: 'power3.in', immediateRender: false }, '>')
        face(tl, 'blocked', '<')
        ride(tl, 'sideGo', 0.4, { start: 1, end: 0.7, lit: false, ease: 'power3.out', pos: '<' })
        tl.to(L.side, { opacity: 0.15, duration: 0.4 }, '<')
        popIn(tl, R.stopLock, '<0.1', { from: 0, y: 20, origin: '50% 100%', ease: 'back.out(2.4)', dur: 0.8 })
        call(tl, sfx, ['deny'], '<')
        tl.to(R.sideGlow, { opacity: 0, duration: 0.5 }, '<')
      },
      goHomeSide(tl) {
        ride(tl, 'sideGo', 0.7, { start: 0.7, end: 0, lit: false, ease: 'power2.inOut' })
        face(tl, 'worried', '<')
        intoDoor(tl)
        face(tl, 'idle', '<0.3')
        call(tl, sfx, ['reveal'], '<')
        verdict(tl, verdictOk, '<')
      },
      island(tl, newT = false) {
        ride(tl, 'outC', G.name === 'wide' ? 2.1 : 1.7)
        if (newT) ride(tl, 'outD', 0.7)
        call(tl, sfx, ['step'])
        const at = newT ? G.newT : G.island
        tl.set(R.headProxy, { opacity: 0 }, '+=0.1')
        flyPlate(tl, R.flyProxy, headPt(pt(at)), billPt(), G.name === 'wide' ? 1.25 : 1.1)
        tl.set(R.billNone, { opacity: 0 }, '<')
        tl.to(R.billSafe, { opacity: 1, duration: 0.3 }, '<')
        popIn(tl, R.billProxy, '<', { from: 0.6, y: 0 })
        call(tl, sfx, ['success'], '<')
        face(tl, 'happy', '<')
        bob(tl, '<')
      },
      islandNew(tl) { RUN.island(tl, true) },
      back(tl, newT = false) {
        popIn(tl, R.parcel, '>', { from: 0.2, y: 0 })
        call(tl, sfx, ['pop'], '<')
        face(tl, 'idle', '<')
        if (newT) { ride(tl, 'turnNew', 0.6, { ease: 'sine.in' }); ride(tl, 'backNew', 0.5, { ease: 'none' }) }
        else ride(tl, 'turn', 0.6, { ease: 'sine.in' })
        ride(tl, 'backA', G.name === 'wide' ? 1.9 : 1.6, { ease: 'sine.out' })
        call(tl, sfx, ['step'])
      },
      backNew(tl) { RUN.back(tl, true) },
      home(tl) {
        ride(tl, 'backB', 1.4)
        call(tl, sfx, ['success'])
        tl.to(R.parcel, { opacity: 0, scale: 0.3, duration: 0.5, ease: 'power2.in' })
        tl.fromTo(R.winGlow, { opacity: 0 }, { opacity: 1, duration: 0.3, yoyo: true, repeat: 1, immediateRender: false }, '<0.3')
        face(tl, 'happy', '<')
        bob(tl, '<')
        tl.fromTo(L.next, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'sine.inOut', immediateRender: false }, '+=0.3')
        ride(tl, 'next', 0.9, { lit: false, pos: '<' })
        face(tl, 'idle', '>')
        tl.to(L.next, { opacity: 0.35, duration: 0.6 })
      },
      leakDirect(tl) {
        fadeOut(tl, R.bubble, '>')
        popIn(tl, R.headHome, '<', { from: 0.3, y: 10, origin: '50% 100%' })
        call(tl, sfx, ['pop'], '<')
        ride(tl, 'direct', G.name === 'wide' ? 2.6 : 2.1, { ease: 'power1.inOut', pos: '+=0.3' })
        call(tl, sfx, ['whoosh'], '<')
        call(tl, sfx, ['step'])
      },
      leakDirectBack(tl) {
        tl.to(R.headProxy, { opacity: 0, duration: 0.2 })
        ride(tl, 'outB', 0.8, { start: 1, end: 0, lit: false, ease: 'power2.inOut' })
        ride(tl, 'outA', 0.7, { start: 1, end: 0, lit: false, ease: 'power2.inOut' })
        tl.to([L.outA, L.outB], { opacity: 0.2, duration: 0.5 }, '<')
        popIn(tl, R.headHome, '>', { from: 0.3, y: 10, origin: '50% 100%' })
        call(tl, sfx, ['pop'], '<')
        ride(tl, 'direct', G.name === 'wide' ? 2.4 : 2, { ease: 'power1.inOut', pos: '+=0.2' })
        call(tl, sfx, ['whoosh'], '<')
      },
      leakDirectNew(tl) {
        fadeOut(tl, R.cardList, '>')
        fadeOut(tl, R.bubble, '<')
        popIn(tl, R.headHome, '<', { from: 0.3, y: 10, origin: '50% 100%' })
        call(tl, sfx, ['pop'], '<')
        ride(tl, 'direct', G.name === 'wide' ? 2.5 : 2, { ease: 'power1.in', pos: '+=0.3' })
        call(tl, sfx, ['whoosh'], '<')
        tl.to(R.rider, { x: G.newT[0], y: G.newT[1], duration: 0.6, ease: 'power2.out' })
      },
      leakSide(tl) {
        fadeOut(tl, R.bubble, '>')
        popIn(tl, R.headHome, '<', { from: 0.3, y: 10, origin: '50% 100%' })
        call(tl, sfx, ['pop'], '<')
        ride(tl, 'sideGo', 0.9, { ease: 'power2.in', pos: '+=0.2' })
        ride(tl, 'side', G.name === 'wide' ? 2.4 : 2, { ease: 'power1.out' })
        call(tl, sfx, ['whoosh'], '<')
      },
      leakReveal(tl, at = G.island) {
        tl.set(R.headHome, { opacity: 0 }, '+=0.15')
        flyPlate(tl, R.flyHome, headPt(pt(at)), billPt(), G.name === 'wide' ? 1.6 : 1.3)
        tl.set(R.billNone, { opacity: 0 }, '<')
        tl.to(R.billDanger, { opacity: 1, duration: 0.2 }, '<')
        popIn(tl, R.billHome, '<', { from: 0.4, y: 0, ease: 'back.out(3)' })
        call(tl, sfx, ['alarm'], '<')
        tl.fromTo(R.alarm, { opacity: 0 }, { opacity: 1, duration: 0.22, repeat: 5, yoyo: true, ease: 'sine.inOut', immediateRender: false }, '<')
        shake(tl, R.billDanger.parentNode, 5, '<')
        face(tl, 'leak', '<')
        tl.to(R.alarm, { opacity: 0.6, duration: 0.3 })
        verdict(tl, verdictLeak, '<')
      },
      leakRevealNew(tl) { RUN.leakReveal(tl, G.newT) },
      compareBar(tl) {
        tl.to(verdictLeak, { opacity: 0, y: -10, duration: 0.4 })
        tl.fromTo(R.ghostBar, { opacity: 0 }, { opacity: 1, duration: 0.4, repeat: 3, yoyo: true, immediateRender: false }, '<')
        tl.to(R.ghostBar, { opacity: 1, duration: 0.3 })
        call(tl, sfx, ['heartbeat'], '<')
        verdict(tl, verdictOk, '<')
      },
      compareLock(tl) {
        tl.to(verdictLeak, { opacity: 0, y: -10, duration: 0.4 })
        tl.fromTo(R.ghostLock, { opacity: 0 }, { opacity: 1, duration: 0.4, repeat: 3, yoyo: true, immediateRender: false }, '<')
        tl.to(R.ghostLock, { opacity: 1, duration: 0.3 })
        call(tl, sfx, ['heartbeat'], '<')
        verdict(tl, verdictOk, '<')
      },
    }

    /* ---- 装配时间轴 ---- */
    function build() {
      if (tl) tl.kill()
      clearTimeout(moodTimer)
      setMood(false)
      render()
      story = STORIES[leak ? `${sc}-leak` : sc]
      ends = []
      cur = -1
      tl = gsap.timeline({ paused: true, onComplete: done })
      tl.to({}, { duration: 0.01 })
      story.forEach((step, i) => {
        tl.addLabel(`s${i}`, i === 0 ? 0.01 : '+=0.02')
        tl.call(enter, [i])
        if (i > 0) tl.to(R.bubble, { opacity: 0, duration: 0.3 }, '<')
        RUN[step.run](tl)
        tl.to({}, { duration: step.hold ?? 1.1 })
        ends.push(tl.duration())
        tl.call(boundary, [i])
      })
      renderRail()
      intro()
    }

    function intro() {
      capNum.textContent = `00 / ${String(story.length).padStart(2, '0')}`
      capSc.textContent = SC_NAME[sc] + (leak ? ' · 没有防护' : '')
      capTitle.textContent = INTRO.t
      capText.textContent = INTRO.d
      rail.querySelectorAll('button').forEach((b) => b.removeAttribute('aria-current'))
      stage.querySelectorAll('.j-pill').forEach((p) => p.classList.remove('is-on'))
      stage.classList.remove('is-back')
    }

    function renderRail() {
      rail.innerHTML = story.map((s, i) => `<li><button type="button" data-step="${i}" data-sfx="click"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${s.k}</span></button></li>`).join('')
      rail.style.setProperty('--n', story.length)
    }

    function enter(i) {
      cur = i
      const s = story[i]
      capNum.textContent = `${String(i + 1).padStart(2, '0')} / ${String(story.length).padStart(2, '0')}`
      capSc.textContent = SC_NAME[sc] + (leak ? ' · 没有防护' : '')
      capTitle.textContent = s.t
      capText.textContent = s.d
      rail.querySelectorAll('button').forEach((b, j) => {
        if (j === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current')
        b.classList.toggle('is-done', j < i)
      })
      stage.querySelectorAll('.j-pill').forEach((p) => p.classList.toggle('is-on', p.dataset.pill === s.st))
      stage.classList.toggle('is-back', s.st === 'back')
      setMood(!!s.tension)
    }

    function boundary(i) {
      if (mode === 'step') { tl.pause(); sync() }
      if (i === story.length - 1) done()
    }

    function done() {
      sync()
      if (moodOn) { clearTimeout(moodTimer); moodTimer = setTimeout(() => setMood(false), 2400) }
    }

    function sync() {
      const playing = tl && !tl.paused() && tl.progress() < 1
      playBtn.classList.toggle('is-playing', playing)
      playBtn.querySelector('.j-play__label').textContent = playing ? '暂停' : (tl && tl.progress() >= 1 ? '再看一遍' : '播放')
      playBtn.setAttribute('aria-pressed', String(playing))
    }

    /* ---- 播放控制 ---- */
    function play() {
      if (prefersReduced) { goStep(story.length - 1); return }
      clearTimeout(moodTimer)
      mode = 'auto'
      if (tl.progress() >= 1) { setMood(false); tl.restart() }
      else tl.play()
      sync()
    }
    function pause() { tl.pause(); sync() }
    function goStep(i, run = true) {
      clearTimeout(moodTimer)
      i = Math.max(0, Math.min(story.length - 1, i))
      if (prefersReduced) {
        tl.pause(); tl.seek(ends[i], true); enter(i); sync()
        if (story[i].tension) moodTimer = setTimeout(() => setMood(false), 2400)
        return
      }
      tl.pause()
      tl.seek(`s${i}`, true)
      enter(i)
      mode = 'step'
      if (run) tl.play()
      sync()
    }
    function next() {
      if (cur >= story.length - 1 && (tl.progress() >= 1 || tl.paused())) { goStep(0); return }
      goStep(cur + 1)
    }
    function replay() {
      clearTimeout(moodTimer)
      setMood(false)
      if (prefersReduced) { goStep(story.length - 1); return }
      mode = 'auto'
      tl.restart()
      sync()
    }

    function switchTo(nextSc, nextLeak, autoplay = true) {
      sc = nextSc
      leak = nextLeak
      el.querySelectorAll('[data-scenario]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scenario === sc)))
      leakBtn.setAttribute('aria-checked', String(leak))
      build()
      if (prefersReduced) { goStep(story.length - 1); return }
      if (autoplay) { started = true; play() }
      else sync()
    }

    /* ---- 事件 ---- */
    el.querySelector('.j-scenes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-scenario]')
      if (!b || b.dataset.scenario === sc) return
      switchTo(b.dataset.scenario, leak)
    })
    leakBtn.addEventListener('click', () => {
      const on = !leak
      audio.sfx(on ? 'toggle-on' : 'toggle-off')
      switchTo(sc, on)
    })
    playBtn.addEventListener('click', () => { started = true; (tl && !tl.paused() && tl.progress() < 1) ? pause() : play() })
    el.querySelector('[data-act="next"]').addEventListener('click', () => { started = true; next() })
    el.querySelector('[data-act="replay"]').addEventListener('click', () => { started = true; replay() })
    rail.addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]')
      if (!b) return
      started = true
      goStep(Number(b.dataset.step))
    })

    const onLayout = () => {
      const g = mq.matches ? TALL : WIDE
      if (g === G) return
      const was = cur
      G = g
      build()
      if (was >= 0) { goStep(was, false); if (!prefersReduced) { tl.seek(ends[was], true) } }
    }
    mq.addEventListener ? mq.addEventListener('change', onLayout) : mq.addListener(onLayout)

    // 离屏暂停：时间轴 + 所有 CSS 循环（星光、海浪、灯塔、吉祥物呼吸）
    whenVisible(stageCard, () => {
      visible = true
      stage.classList.remove('is-paused')
      if (resumeOnShow) { resumeOnShow = false; tl.play(); sync() }
    }, () => {
      visible = false
      stage.classList.add('is-paused')
      if (tl && !tl.paused() && tl.progress() < 1) { tl.pause(); resumeOnShow = true; sync() }
      clearTimeout(moodTimer)
      setMood(false)
    }, '0px')

    build()
    if (prefersReduced) goStep(story.length - 1)

    // 进入视口时自动播放一次正常路径
    onEnter(stageCard, () => {
      if (started) return
      started = true
      if (prefersReduced) return
      play()
    }, { start: 'top 62%' })

    reveal(el)
  },
}

// 吉祥物「小请求」：一颗会发光的暖色小圆球，有一双眼睛。
// 它代表电脑发出的每一个网络请求。全站所有地方都用这一个函数画它，保证形象一致。
//
//   mascot({ size: 64, face: 'idle' })         返回 SVG 字符串
//   face: 'idle' 平常 | 'happy' 开心(^ ^) | 'worried' 担心 | 'blocked' 被拦(> <) | 'leak' 泄漏(红色惊慌)
//   tint: 'warm'（默认） | 'danger'（红，泄漏时） | 'safe'（绿，通过时） | 'ghost'（灰，未受保护的程序）
//   label: 可选，头顶小牌子文字，如 'CLI'、'浏览器'
//
// CSS 钩子：.mascot 外层；.mascot__body 身体；.mascot__eyes 眼睛（自带眨眼动画）；.mascot__halo 光晕

let uid = 0

const TINTS = {
  warm: ['#fff1d6', '#ffc070', '#ff7a52'],
  danger: ['#ffe0e4', '#ff6b7d', '#d9243c'],
  safe: ['#e6fff4', '#7ff5c2', '#1fbf85'],
  ghost: ['#e9e9ee', '#9aa0b4', '#5b6175'],
}

function eyes(face) {
  switch (face) {
    case 'happy':
      return `<path d="M-13 -2 q5 -7 10 0" /><path d="M3 -2 q5 -7 10 0" />`
    case 'blocked':
      return `<path d="M-13 -6 l9 5 l-9 5" /><path d="M13 -6 l-9 5 l9 5" />`
    case 'worried':
      return `<ellipse cx="-8" cy="0" rx="3.4" ry="4.6" class="mascot__pupil"/><ellipse cx="8" cy="0" rx="3.4" ry="4.6" class="mascot__pupil"/><path d="M-13 -9 l8 3" /><path d="M13 -9 l-8 3" />`
    case 'leak':
      return `<circle cx="-8" cy="0" r="4.4" class="mascot__pupil"/><circle cx="8" cy="0" r="4.4" class="mascot__pupil"/><ellipse cx="0" cy="12" rx="4" ry="3" class="mascot__pupil"/>`
    default:
      return `<ellipse cx="-8" cy="0" rx="3.4" ry="4.8" class="mascot__pupil"/><ellipse cx="8" cy="0" rx="3.4" ry="4.8" class="mascot__pupil"/>`
  }
}

export function mascot({ size = 64, face = 'idle', tint = 'warm', label = '', className = '' } = {}) {
  const id = `m${++uid}`
  const [c0, c1, c2] = TINTS[tint] || TINTS.warm
  const tag = label
    ? `<g class="mascot__tag" transform="translate(0 -52)"><rect x="${-label.length * 6 - 10}" y="-12" width="${label.length * 12 + 20}" height="22" rx="11" fill="rgba(7,8,12,.78)" stroke="${c1}" stroke-opacity=".6"/><text x="0" y="4" text-anchor="middle" font-size="12" font-weight="700" fill="${c0}" font-family="-apple-system,PingFang SC,sans-serif">${label}</text></g>`
    : ''
  return `<svg class="mascot mascot--${face} mascot--${tint} ${className}" width="${size}" height="${size}" viewBox="-60 -70 120 130" aria-hidden="true" overflow="visible">
    <defs>
      <radialGradient id="${id}b" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="${c0}"/><stop offset="45%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
      </radialGradient>
      <radialGradient id="${id}h" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${c1}" stop-opacity=".55"/><stop offset="100%" stop-color="${c1}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle class="mascot__halo" r="56" fill="url(#${id}h)"/>
    <g class="mascot__body">
      <circle r="30" fill="url(#${id}b)"/>
      <ellipse cx="-11" cy="-15" rx="8" ry="5" fill="#fff" opacity=".55" transform="rotate(-25 -11 -15)"/>
      <g class="mascot__eyes" fill="#2a1408" stroke="#2a1408" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${eyes(face)}</g>
      ${face === 'happy' ? '<ellipse cx="-17" cy="8" rx="5" ry="3" fill="#ff5d73" opacity=".45"/><ellipse cx="17" cy="8" rx="5" ry="3" fill="#ff5d73" opacity=".45"/>' : ''}
    </g>
    ${tag}
  </svg>`
}

export const mascotCSS = `
.mascot { overflow: visible; }
.mascot__halo { animation: mascot-breathe 3.2s ease-in-out infinite; transform-origin: center; }
.mascot__body { animation: mascot-bob 2.6s ease-in-out infinite; transform-origin: center; }
.mascot__eyes { animation: mascot-blink 4.8s infinite; transform-origin: 0 0; transform-box: fill-box; }
.mascot__pupil { stroke: none; }
.mascot--happy .mascot__eyes, .mascot--blocked .mascot__eyes { fill: none; animation: none; }
.mascot--worried .mascot__eyes path { fill: none; }
@keyframes mascot-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes mascot-breathe { 0%,100% { opacity: .75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
@keyframes mascot-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
`

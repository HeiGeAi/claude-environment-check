// 第 06 章 · 域名与进程
// 招牌：域名星图。中心是 Claude 岛，五组域名在外圈缓缓摆动环绕；
// 点分组高亮、其余变暗；不时有一个「？新域名」从夜空里冒出来，
// 先是名单上没有的警示色，随后被进程规则接住、连上受控路线。
import './domains.css'
import { gsap, reveal, onEnter, whenVisible, prefersReduced, isTouch } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { esc } from '../core/ui.js'
import { mascot } from '../core/mascot.js'

/* ---------------- 数据：域名逐字照搬原版表格 ---------------- */
const GROUPS = [
  {
    key: 'core', name: '核心与登录', color: '#ffb35c', deg: 180,
    domains: ['claude.ai', 'claude.com', 'api.anthropic.com', 'platform.claude.com'],
    plain: '最常用的入口：网页、登录和 API 都在这一组。',
    action: '三个主域后缀覆盖其子域；登录重定向也走相同出口。',
  },
  {
    key: 'update', name: '连接器与更新', color: '#ff7a52', deg: -112,
    domains: ['mcp-proxy.anthropic.com', 'downloads.claude.ai'],
    plain: '连接器和软件更新会用到。更新程序常驻后台，最容易被忘。',
    action: '新版本、安装器、常驻更新进程单独验证。',
  },
  {
    key: 'bridge', name: '浏览器桥与内容', color: '#8fb4ff', deg: -36,
    domains: ['bridge.claudeusercontent.com', '*.frame.claudeusercontent.com', 'assets-proxy.anthropic.com'],
    plain: '浏览器扩展、网页里展示的内容会用到。',
    action: '扩展、Artifact、桌面页面不可遗漏。',
  },
  {
    key: 'telemetry', name: '可选运行遥测', color: '#ffd166', deg: 38,
    domains: ['http-intake.logs.us5.datadoghq.com', 'browser-intake-us5-datadoghq.com'],
    plain: '可选的运行遥测：程序把运行情况报回去的通道。',
    action: '与业务请求分开管理。关闭遥测，也替代不了出口防护。',
  },
  {
    key: 'public', name: '公共分发依赖', color: '#c7a6ff', deg: 112,
    domains: ['github.com', 'raw.githubusercontent.com', 'registry.npmjs.org', 'storage.googleapis.com'],
    plain: '安装和下载时会用到的公共服务。',
    action: '这些是共享的第三方服务。Anthropic 并不独占这些网段。',
  },
]
const TOTAL = GROUPS.reduce((n, g) => n + g.domains.length, 0)

/* ---------------- 星图几何 ---------------- */
const W = 1200, H = 720, CX = 600, CY = 360, RX = 338, RY = 226
const SP = 36 // 同组节点竖向间距
// 「？新域名」可能出现的空位；lab = 标签在点的上方(-1)还是下方(1)
const SPOTS = [
  { x: 772, y: 92, lab: -1 },
  { x: 1046, y: 372, lab: 1 },
  { x: 150, y: 184, lab: -1 },
  { x: 1052, y: 636, lab: 1 },
]

const rad = (d) => (d * Math.PI) / 180
function anchorOf(g, sway = 0) {
  const a = rad(g.deg) + sway
  return { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) }
}
function nodeOffset(g, i) {
  const n = g.domains.length
  const side = Math.cos(rad(g.deg)) >= 0 ? 1 : -1
  return { dx: (i % 2 ? 1 : -1) * 13 * side, dy: (i - (n - 1) / 2) * SP }
}
function spokeD(x, y) {
  const dx = x - CX, dy = y - CY, len = Math.hypot(dx, dy) || 1
  const sx = CX + (dx / len) * 74, sy = CY + (dy / len) * 50
  const mx = (sx + x) / 2 - (dy / len) * 26, my = (sy + y) / 2 + (dx / len) * 26
  return `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
}

/* ---------------- 自绘图标 ---------------- */
const ICON = {
  name: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 6v10M40 6v10" /><rect x="14" y="14" width="36" height="44" rx="7"/><circle cx="32" cy="30" r="6"/><path d="M22 46h20M26 52h12"/><path d="M26 14h12" class="hl"/></svg>`,
  path: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 18h16l4 5h28v29a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"/><path d="M18 36h8l4 6h16" class="hl"/><circle cx="46" cy="42" r="3" class="hl"/></svg>`,
  domain: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 58V20"/><path d="M16 12h30l8 7-8 7H16z" class="hl"/><path d="M48 30H20l-8 7 8 7h28z"/><path d="M24 58h16"/></svg>`,
  browser: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="10" width="52" height="42" rx="6"/><path d="M6 20h52"/><circle cx="13" cy="15" r="1.4" class="fill"/><circle cx="18" cy="15" r="1.4" class="fill"/><path d="M20 36l6-6 6 6 6-6 6 6" class="hl"/></svg>`,
}

export default {
  id: 'domains',
  nav: '域名与进程',
  desc: '只记 claude.ai 远远不够',
  mood: 'focus',
  mount(el, { num }) {
    el.innerHTML = `
<div class="wrap">
  <header class="chapter-head">
    <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>域名与进程</span></div>
    <h2 class="h2" data-reveal="lines">只记住 claude.ai，<br><span class="text-warm">保护范围一定不够</span></h2>
    <p class="lead" data-reveal>Claude 的产品要访问好多个域名。登录、API、下载、扩展桥接、用户内容、遥测，各有各的地址。客户端一升级，这张表还可能变。</p>
  </header>

  <div class="dm-stage" data-reveal="blur">
    <div class="dm-stage__top">
      <div class="dm-chips" role="group" aria-label="按用途选一组域名">
        ${GROUPS.map((g) => `<button type="button" class="dm-chip" data-g="${g.key}" aria-pressed="false" style="--c:${g.color}" data-sfx="click"><i class="dm-chip__dot"></i>${g.name}<span class="dm-chip__n">${g.domains.length}</span></button>`).join('')}
      </div>
      <span class="dm-counter" aria-hidden="true"><i></i>名单外 <b>+0</b></span>
    </div>

    <div class="dm-map" data-state="idle">
      <svg class="dm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="域名星图：中心是 Claude，外圈五组域名。示意图，不读取你电脑的网络。">
        <defs>
          <radialGradient id="dmCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffc070" stop-opacity=".55"/>
            <stop offset="45%" stop-color="#ff7a52" stop-opacity=".16"/>
            <stop offset="100%" stop-color="#ff7a52" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="dmIsle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2a2f45"/><stop offset="100%" stop-color="#0e1119"/>
          </linearGradient>
          <linearGradient id="dmBeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ffd08a" stop-opacity=".35"/><stop offset="100%" stop-color="#ffd08a" stop-opacity="0"/></linearGradient>
          <filter id="dmBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
        </defs>

        <g class="dm-rings" aria-hidden="true">
          <ellipse cx="${CX}" cy="${CY}" rx="${RX * 0.52}" ry="${RY * 0.52}"/>
          <ellipse cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}"/>
          <ellipse cx="${CX}" cy="${CY}" rx="${RX * 1.42}" ry="${RY * 1.42}" class="is-outer"/>
        </g>
        <g class="dm-dust" aria-hidden="true"></g>

        <g class="dm-groups"></g>

        <g class="dm-new" aria-hidden="true" opacity="0">
          <path class="dm-new__spoke" d=""/>
          <g class="dm-new__node">
            <circle class="dm-new__pulse" r="16"/>
            <circle class="dm-new__ring" r="13"/>
            <circle class="dm-new__dot" r="5.5"/>
            <text class="dm-new__label" text-anchor="middle" y="34">？新域名</text>
            <text class="dm-new__sub" text-anchor="middle" y="56">名单上还没有</text>
          </g>
        </g>

        <g class="dm-core" transform="translate(${CX} ${CY})" aria-hidden="true">
          <circle r="150" fill="url(#dmCoreGlow)" class="dm-core__glow"/>
          <g class="dm-core__beam"><path d="M0 -36 L210 -58 L210 -14 Z"/></g>
          <ellipse cx="0" cy="26" rx="78" ry="18" class="dm-core__sea"/>
          <path d="M-62 26 Q-44 6 -20 8 Q0 -2 22 6 Q48 4 64 26 Q0 40 -62 26Z" fill="url(#dmIsle)" class="dm-core__isle"/>
          <path d="M-40 14v-12h10v12M-26 12v-18h9v18M26 12v-14h10v14M40 16v-8h8v8" class="dm-core__houses"/>
          <path d="M-6 10 L-4 -30 L4 -30 L6 10Z" class="dm-core__tower"/>
          <circle cy="-36" r="7" class="dm-core__lamp"/>
          <circle cy="-36" r="16" class="dm-core__lamp-halo" filter="url(#dmBlur)"/>
          <text y="66" text-anchor="middle" class="dm-core__name">Claude</text>
        </g>
      </svg>
      <p class="dm-map__note tiny">示意图：不读取你电脑的网络。点分组或点星星，看这一组为什么要单独管。</p>
    </div>

    <p class="dm-ticker small" aria-live="polite"></p>

    <div class="dm-detail" aria-live="polite"></div>

    <ul class="dm-list" aria-label="按用途分组的域名清单">
      ${GROUPS.map((g) => `
      <li><button type="button" class="dm-item" data-g="${g.key}" style="--c:${g.color}" aria-pressed="false">
        <span class="dm-item__head"><i class="dm-chip__dot"></i><b>${g.name}</b><span class="dm-chip__n">${g.domains.length}</span></span>
        <span class="dm-item__domains">${g.domains.map((d) => `<code>${esc(d)}</code>`).join('')}</span>
        <span class="dm-item__plain">${g.plain}</span>
        <span class="dm-item__act">维护动作：${g.action}</span>
      </button></li>`).join('')}
    </ul>

    <p class="dm-source small" data-reveal>这是查阅时的<b>入口清单</b>，不完整，也不永久。桌面端、网页与第三方工具还需补查。来源：<a href="https://code.claude.com/docs/en/network-config" target="_blank" rel="noopener noreferrer">Claude Code 官方网络配置 ↗</a></p>
  </div>

  <p class="dm-verdict" data-reveal="lines">维护名单是日常工作。<br><span class="dm-verdict__em">进程级防护，用来兜住名单之外的请求。</span></p>

  <section class="dm-holes" aria-labelledby="dm-holes-t">
    <div class="dm-holes__head">
      <h3 class="h3" id="dm-holes-t" data-reveal="lines">进程、路径、域名，各补一个洞</h3>
      <div class="metaphor" data-reveal><span>你没法把全城每个路口都写进名单。但你可以规定：<strong>这个人出门，只能坐指定的车。</strong>「这个人」就是程序，「指定的车」就是通往代收点的路。</span></div>
    </div>
    <div class="dm-holes__grid">
      <article class="dm-hole" style="--c:#ffb35c">
        <div class="dm-hole__icon">${ICON.name}</div>
        <p class="dm-hole__k"><span class="latin">01</span>认名字 · 进程名</p>
        <p class="dm-hole__t"><code>claude</code>、Claude Desktop 及 Helper 子进程。</p>
        <p class="dm-hole__d">更新、重命名、Node 启动形态，都要复核。</p>
      </article>
      <article class="dm-hole" style="--c:#8fb4ff">
        <div class="dm-hole__icon">${ICON.path}</div>
        <p class="dm-hole__k"><span class="latin">02</span>认住址 · 进程路径</p>
        <p class="dm-hole__t">识别应用包和实际的 CLI 二进制文件。</p>
        <p class="dm-hole__d">避免把所有 <code>node</code> 一网打尽。</p>
      </article>
      <article class="dm-hole" style="--c:#c7a6ff">
        <div class="dm-hole__icon">${ICON.domain}</div>
        <p class="dm-hole__k"><span class="latin">03</span>认目的地 · 域名</p>
        <p class="dm-hole__t">兜住浏览器，以及无法可靠识别的连接。</p>
        <p class="dm-hole__d">规则放在宽泛直连（DIRECT）与最终兜底规则（MATCH）前面。</p>
      </article>
    </div>
  </section>

  <aside class="dm-browser card card--flat" data-reveal>
    <div class="dm-browser__art" aria-hidden="true">
      <div class="dm-browser__win">${ICON.browser}</div>
      <div class="dm-browser__who">${mascot({ size: 76, face: 'worried', tint: 'ghost', label: 'Helper' })}</div>
      <span class="dm-browser__tag">名字里没有 Claude</span>
    </div>
    <div class="dm-browser__txt">
      <h3 class="h4">专用浏览器，要单独看</h3>
      <ul class="bullets">
        <li>浏览器干活的进程，可能是它自己的 Helper，名字里并没有 Claude。</li>
        <li>普通 Chrome 的资料目录，不等于独立的进程身份。</li>
        <li>要求严格时，用可以独立管控的浏览器实例，或者隔离环境。</li>
      </ul>
    </div>
  </aside>

  <div class="dm-pro pro-only is-grid">
    <div class="dm-pro__item pro-block">
      <p class="pro-badge">进阶 · 边界</p>
      <h3 class="h4">进程规则管不到代理外面</h3>
      <p class="small muted">代理内的进程规则，只会处理已经进入代理的流量。它替代不了操作系统的出口限制。</p>
    </div>
    <div class="dm-pro__item pro-block">
      <p class="pro-badge">进阶 · GeoSite</p>
      <h3 class="h4">GeoSite 只算补充，别当免维护保险</h3>
      <p class="small muted">规则集可能缺条目、更新失败或格式不兼容。检查运行时规则与真实连接命中；不要只验证 YAML 文本。UDP 不被节点支持时，也要核对后续规则，避免落到宽泛 DIRECT。</p>
    </div>
    <div class="dm-pro__item pro-block">
      <p class="pro-badge">进阶 · 扩展规则集的线索</p>
      <h3 class="h4">这些只是关键词</h3>
      <p class="dm-clues">${['claudeusercontent.net', 'claudemcpclient', 'claudemcpcontent', 'claude-static'].map((k) => `<span class="dm-clue">${k}</span>`).join('')}<span class="dm-clue is-etc">等</span></p>
      <p class="small muted">后几项是素材中的关键词，不能直接当完整域名抄入配置。要从连接证据确认真实 FQDN。</p>
    </div>
  </div>
</div>`

    /* ---------------- 构建星图 ---------------- */
    const map = el.querySelector('.dm-map')
    const svg = el.querySelector('.dm-svg')
    const gRoot = svg.querySelector('.dm-groups')
    const NS = 'http://www.w3.org/2000/svg'
    const mk = (tag, attrs = {}, parent) => {
      const n = document.createElementNS(NS, tag)
      for (const k in attrs) n.setAttribute(k, attrs[k])
      if (parent) parent.appendChild(n)
      return n
    }

    const nodes = [] // { g, i, el, inner, spoke, ox, oy, phase }
    const groupEls = {}
    GROUPS.forEach((g, gi) => {
      const side = Math.cos(rad(g.deg)) >= 0 ? 1 : -1
      const grp = mk('g', { class: 'dm-g', 'data-g': g.key, style: `--c:${g.color}` }, gRoot)
      const spokes = mk('g', { class: 'dm-spokes' }, grp)
      const line = mk('polyline', { class: 'dm-constel' }, grp)
      const name = mk('text', { class: 'dm-gname', 'text-anchor': side > 0 ? 'start' : 'end' }, grp)
      name.textContent = g.name
      groupEls[g.key] = { grp, line, name, side }
      g.domains.forEach((d, i) => {
        const { dx, dy } = nodeOffset(g, i)
        const spoke = mk('path', { class: 'dm-spoke' }, spokes)
        const outer = mk('g', { class: 'dm-node', tabindex: '-1' }, grp)
        const inner = mk('g', { class: 'dm-node__in' }, outer)
        mk('circle', { class: 'dm-node__halo', r: 13 }, inner)
        mk('circle', { class: 'dm-node__dot', r: 4.6 }, inner)
        const t = mk('text', { class: 'dm-label', x: side * 16, y: 4.5, 'text-anchor': side > 0 ? 'start' : 'end' }, inner)
        t.textContent = d
        nodes.push({ g, gi, i, el: outer, inner, spoke, ox: dx, oy: dy, phase: gi * 1.7 + i * 0.9 })
      })
    })

    // 夜空里慢慢绕圈的光点（真正「环绕」的层）
    const dustRoot = svg.querySelector('.dm-dust')
    const dust = Array.from({ length: 34 }, (_, k) => {
      const ring = [0.52, 1, 1.42][k % 3]
      const c = mk('circle', { r: (0.8 + (k * 37 % 10) / 7).toFixed(2) }, dustRoot)
      return { c, rx: RX * ring, ry: RY * ring, a: (k * 2.39996) % (Math.PI * 2), s: (0.018 + ((k * 13) % 7) / 260) * (k % 2 ? 1 : 0.7) }
    })

    function layout(t) {
      const sway = prefersReduced ? 0 : Math.sin(t * 0.00011) * 0.055
      const bobA = prefersReduced ? 0 : 1
      GROUPS.forEach((g) => {
        const a = anchorOf(g, sway)
        g._a = a
      })
      const pts = {}
      nodes.forEach((n) => {
        const a = n.g._a
        const x = a.x + n.ox + Math.sin(t * 0.0007 + n.phase) * 3 * bobA
        const y = a.y + n.oy + Math.cos(t * 0.0006 + n.phase) * 3.4 * bobA
        n.el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
        n.spoke.setAttribute('d', spokeD(x, y))
        ;(pts[n.g.key] ||= []).push(`${x.toFixed(1)},${y.toFixed(1)}`)
        if (n.i === 0) n.g._top = { x, y }
      })
      GROUPS.forEach((g) => {
        const ge = groupEls[g.key]
        ge.line.setAttribute('points', pts[g.key].join(' '))
        const top = g._top
        ge.name.setAttribute('x', (g._a.x - ge.side * 18).toFixed(1))
        ge.name.setAttribute('y', (top.y - 28).toFixed(1))
      })
      dust.forEach((d) => {
        const a = d.a + (prefersReduced ? 0 : t * 0.001 * d.s)
        d.c.setAttribute('cx', (CX + d.rx * Math.cos(a)).toFixed(1))
        d.c.setAttribute('cy', (CY + d.ry * Math.sin(a)).toFixed(1))
      })
    }
    const beam = svg.querySelector('.dm-core__beam')
    const layoutAll = (t) => {
      layout(t)
      // 灯塔光束慢慢扫一圈（约 12 秒）
      beam.setAttribute('transform', `rotate(${prefersReduced ? -18 : ((t * 0.03) % 360).toFixed(1)} 0 -36)`)
    }
    layoutAll(0)

    /* ---------------- 选择分组 ---------------- */
    const chips = el.querySelectorAll('.dm-chip')
    const items = el.querySelectorAll('.dm-item')
    const detail = el.querySelector('.dm-detail')
    let active = null

    function renderDetail(key) {
      const g = GROUPS.find((x) => x.key === key)
      if (!g) {
        detail.innerHTML = `<div class="dm-detail__idle"><span class="latin">${GROUPS.length}</span><span>组 ·</span><span class="latin">${TOTAL}</span><span>个入口。点一组，看它为什么要单独管。</span></div>`
        detail.style.removeProperty('--c')
        return
      }
      detail.style.setProperty('--c', g.color)
      detail.innerHTML = `
        <div class="dm-detail__col">
          <p class="dm-detail__name"><i class="dm-chip__dot"></i>${g.name}<span class="dm-chip__n">${g.domains.length} 个入口</span></p>
          <p class="dm-detail__plain">${g.plain}</p>
        </div>
        <ul class="dm-detail__domains">${g.domains.map((d) => `<li><code>${esc(d)}</code></li>`).join('')}</ul>
        <p class="dm-detail__act"><span>维护动作</span>${g.action}</p>`
      if (!prefersReduced) gsap.from(detail.children, { y: 14, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.06 })
    }

    function paint(key) {
      if (key) svg.dataset.active = key
      else delete svg.dataset.active
      Object.entries(groupEls).forEach(([k, ge]) => ge.grp.classList.toggle('is-on', k === key))
    }
    function setActive(key, { sound = true } = {}) {
      active = key === active ? null : key
      paint(active)
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.g === active)))
      items.forEach((c) => {
        const on = c.dataset.g === active
        c.setAttribute('aria-pressed', String(on))
        c.classList.toggle('is-on', on)
      })
      renderDetail(active)
      if (sound) audio.sfx(active ? 'open' : 'close')
    }
    renderDetail(null)

    chips.forEach((c) => {
      c.addEventListener('click', () => setActive(c.dataset.g, { sound: false }))
      if (!isTouch) {
        c.addEventListener('pointerenter', () => paint(c.dataset.g))
        c.addEventListener('pointerleave', () => paint(active))
      }
    })
    items.forEach((c) => c.addEventListener('click', () => { setActive(c.dataset.g); if (active) map.scrollIntoView?.({ block: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' }) }))
    Object.entries(groupEls).forEach(([k, ge]) => {
      ge.grp.addEventListener('click', () => setActive(k))
      if (!isTouch) {
        ge.grp.addEventListener('pointerenter', () => paint(k))
        ge.grp.addEventListener('pointerleave', () => paint(active))
      }
    })

    /* ---------------- 「？新域名」 ---------------- */
    const newG = svg.querySelector('.dm-new')
    const newNode = newG.querySelector('.dm-new__node')
    const newSpoke = newG.querySelector('.dm-new__spoke')
    const newLabel = newG.querySelector('.dm-new__label')
    const newSub = newG.querySelector('.dm-new__sub')
    const newPulse = newG.querySelector('.dm-new__pulse')
    const counter = el.querySelector('.dm-counter')
    const counterB = counter.querySelector('b')
    const ticker = el.querySelector('.dm-ticker')
    let spotI = 0
    let found = 0
    let newTl = null
    let newWait = null
    let visible = false

    function placeLabels(s) {
      const dir = s.lab
      newLabel.setAttribute('y', dir > 0 ? 36 : -24)
      newSub.setAttribute('y', dir > 0 ? 58 : -46)
    }
    function setPhase(p) {
      map.dataset.state = p
      if (p === 'unknown') { newSub.textContent = '名单上还没有'; ticker.textContent = '刚冒出一个新域名，名单上还没有它。' }
      if (p === 'caught') { newSub.textContent = '按程序认，照样走代收点'; ticker.textContent = '被保护的程序发出的请求，照样被带去代收点。' }
    }

    function cycle() {
      const s = SPOTS[spotI++ % SPOTS.length]
      const dx = s.x - CX, dy = s.y - CY, len = Math.hypot(dx, dy)
      placeLabels(s)
      newSpoke.setAttribute('d', spokeD(s.x, s.y))
      const L = newSpoke.getTotalLength()
      gsap.set(newSpoke, { strokeDasharray: L, strokeDashoffset: L })
      gsap.set(newNode, { x: s.x + (dx / len) * 160, y: s.y + (dy / len) * 160 })
      gsap.set(newG, { opacity: 1 })
      gsap.set(newNode, { opacity: 0 })
      setPhase('unknown')
      newTl = gsap.timeline({ onComplete: () => { newWait = gsap.delayedCall(2.4, cycle); if (!visible) newWait.pause() } })
      newTl
        .to(newNode, { x: s.x, y: s.y, opacity: 1, duration: 1.1, ease: 'expo.out' })
        .call(() => { audio.sfx('pop'); found++; counterB.textContent = `+${found}`; counter.classList.remove('is-bump'); void counter.offsetWidth; counter.classList.add('is-bump') }, null, 0.25)
        .fromTo(newPulse, { attr: { r: 8 }, opacity: 0.9 }, { attr: { r: 44 }, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0.25)
        .call(() => setPhase('caught'), null, 2.0)
        .to(newSpoke, { strokeDashoffset: 0, duration: 1.1, ease: 'expo.out' }, 2.0)
        .fromTo(newPulse, { attr: { r: 10 }, opacity: 0.8 }, { attr: { r: 36 }, opacity: 0, duration: 1, ease: 'expo.out' }, 2.05)
        .to(newG, { opacity: 0, duration: 0.7, ease: 'power2.in' }, 5.4)
        .call(() => setPhase('idle'), null, 6.1)
    }

    function showStatic() {
      const s = SPOTS[0]
      placeLabels(s)
      newSpoke.setAttribute('d', spokeD(s.x, s.y))
      newNode.setAttribute('transform', `translate(${s.x} ${s.y})`)
      newG.setAttribute('opacity', '1')
      setPhase('caught')
      counterB.textContent = '+1'
    }

    /* ---------------- 循环：离屏暂停 ---------------- */
    let raf = 0
    const loop = (t) => { layoutAll(t); raf = requestAnimationFrame(loop) }
    let introDone = prefersReduced

    if (prefersReduced) {
      showStatic()
    } else {
      gsap.set(el.querySelectorAll('.dm-node__in'), { opacity: 0 })
      gsap.set(el.querySelectorAll('.dm-spokes, .dm-constel, .dm-gname'), { opacity: 0 })
      onEnter(map, () => {
        const tl = gsap.timeline({ onComplete: () => { introDone = true; if (visible && !newTl) newWait = gsap.delayedCall(1.2, cycle) } })
        tl.from(svg.querySelector('.dm-core'), { opacity: 0, duration: 1.2, ease: 'expo.out' })
          .from(svg.querySelectorAll('.dm-rings ellipse'), { opacity: 0, duration: 1.4, stagger: 0.12, ease: 'expo.out' }, 0)
          .to(el.querySelectorAll('.dm-node__in'), { opacity: 1, duration: 0.9, stagger: 0.045, ease: 'expo.out' }, 0.3)
          .to(el.querySelectorAll('.dm-spokes, .dm-constel, .dm-gname'), { opacity: 1, duration: 1.2, stagger: 0.08, ease: 'expo.out' }, 0.5)
          .call(() => audio.sfx('reveal'), null, 0.3)
      }, { start: 'top 70%' })
    }

    if (!prefersReduced) {
      whenVisible(map, () => {
        visible = true
        map.classList.remove('is-paused')
        if (!raf) raf = requestAnimationFrame(loop)
        if (newTl && newTl.paused()) newTl.resume()
        if (newWait && newWait.paused()) newWait.resume()
        if (introDone && !newTl && !newWait) newWait = gsap.delayedCall(1.2, cycle)
      }, () => {
        visible = false
        map.classList.add('is-paused')
        cancelAnimationFrame(raf); raf = 0
        newTl?.pause()
        newWait?.pause()
      })
    }

    // 三张卡的入场：CSS 过渡在入场结束后才启用，避免和 GSAP 抢 transform
    const holes = el.querySelector('.dm-holes__grid')
    if (prefersReduced) holes.classList.add('is-ready')
    else {
      gsap.set(holes.children, { opacity: 0, y: 40 })
      onEnter(holes, () => gsap.to(holes.children, {
        opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, clearProps: 'opacity,transform',
        onComplete: () => holes.classList.add('is-ready'),
      }), { start: 'top 86%' })
    }

    reveal(el)
  },
}

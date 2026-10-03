// 11 失败演练：断线时，也不能偷偷直连
// 招牌：10 张考题卡 3D 翻面揭晓（盖章 + reveal 音），计数器；月历节奏条；观察哨小演示
import './drill.css'
import { gsap, reveal, whenVisible, prefersReduced, onEnter } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { codeBlock, enhanceCodeBlocks } from '../core/ui.js'
import { mascot } from '../core/mascot.js'

const ICONS = {
  proxyDown: '<path d="M7 21L24 9l17 12"/><rect x="11" y="21" width="26" height="19" rx="2"/><path class="x" d="M19 26l10 9M29 26l-10 9"/>',
  newDomain: '<path d="M24 42s-12-11-12-21a12 12 0 0 1 24 0c0 10-12 21-12 21z"/><path d="M20.5 17.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3"/><circle cx="24" cy="27" r=".8"/>',
  sideDoor: '<path d="M5 22L20 10l15 12v18H5z"/><rect x="14" y="29" width="8" height="11" rx="1"/><path d="M35 26l8-3v17h-8"/><circle cx="39.5" cy="32" r=".8"/>',
  radio: '<rect x="14" y="15" width="18" height="27" rx="4"/><path d="M19 15V6"/><path d="M18 22h10M18 27h10"/><circle cx="23" cy="35" r="2.4"/><path d="M36 13a8 8 0 0 1 0 10M39.5 9a13 13 0 0 1 0 18"/>',
  wifi: '<path d="M7 19a24 24 0 0 1 34 0M12.5 25a16 16 0 0 1 23 0M18 31a8.5 8.5 0 0 1 12 0"/><circle cx="24" cy="37" r="2"/>',
  windows: '<rect x="5" y="8" width="26" height="19" rx="3"/><rect x="17" y="20" width="26" height="20" rx="3" class="f"/><path d="M17 26h26M5 14h26"/>',
  hourglass: '<path d="M14 6h20M14 42h20"/><path d="M16 6c0 9 7 12 8 18 1-6 8-9 8-18M16 42c0-9 7-12 8-18 1 6 8 9 8 18"/><path d="M20 38h8"/>',
  gear: '<circle cx="24" cy="24" r="6.5"/><path d="M24 7v5M24 36v5M7 24h5M36 24h5M12 12l3.5 3.5M32.5 32.5L36 36M12 36l3.5-3.5M32.5 15.5L36 12"/><path class="x" d="M30 6l-3 7 4 2-3 6"/>',
  chain: '<rect x="5" y="18" width="21" height="12" rx="6"/><rect x="22" y="18" width="21" height="12" rx="6"/>',
  refresh: '<path d="M38 18a15 15 0 0 0-27-4M10 30a15 15 0 0 0 27 4"/><path d="M11 7v7h7M37 41v-7h-7"/>',
  check: '<path d="M12 25l8 8 16-18"/>',
  eye: '<path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24z"/><circle cx="24" cy="24" r="5"/>',
  warn: '<path d="M24 7L43 40H5z"/><path d="M24 19v10"/><circle cx="24" cy="34" r=".9"/>',
}
const icon = (n, cls = '') => `<svg class="dr-ico ${cls}" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`

/* 原版「09 验证」表格 10 行：场景 / 通过标准 / 排查方向（逐字） */
const CASES = [
  { ico: 'proxyDown', say: '代收点突然关门', scene: '代理进程退出 / 端口不可达', pass: '请求失败，物理接口无业务目标直连包', dir: '应用、PAC、库是否存在 DIRECT 回落' },
  { ico: 'newDomain', say: '要去一个没见过的地址', scene: '新域名 / IP 字面量 / 非 443 端口', pass: '未知目的地同样被代理或拒绝', dir: '不能仅依赖有限域名或端口列表' },
  { ico: 'sideDoor', say: '侧门，和新开的门', scene: 'IPv6 / AAAA / 新网卡', pass: '所有接口都遵守相同出口约束', dir: 'IPv4 安全不能代替 IPv6 验收' },
  { ico: 'radio', say: '对讲机，和别的小路', scene: 'WebRTC / UDP / QUIC', pass: '受控转发或明确失败，无旁路', dir: 'HTTP 代理之外的传输路径' },
  { ico: 'wifi', say: '换了网，或者电脑刚睡醒', scene: '换 Wi-Fi / 热点 / VPN / 唤醒', pass: '阻断先恢复，业务后恢复', dir: '旧接口绑定、恢复顺序与时间窗口' },
  { ico: 'windows', say: '不在前台的那些程序', scene: '后台 / IDE / MCP / 更新器', pass: '每个启动方式都被保护', dir: '进程树、PATH 以外的二进制入口' },
  { ico: 'hourglass', say: '查不清现在安不安全', scene: '探测超时 / 429 / API 不可用', pass: '严格策略拒绝新会话，不解封', dir: '把未知状态当作已安全' },
  { ico: 'gear', say: '配置坏了，或者刚重启', scene: '配置错误 / 权限失败 / 重启', pass: '旧有效保护保留；无规则则不启动业务', dir: '加载失败后的默认行为' },
  { ico: 'chain', say: '早就出了门的包裹', scene: '已经建立的连接', pass: '收紧策略后仍按设计阻断', dir: 'state / socket 是否绕过新规则' },
  { ico: 'refresh', say: '门口的告示换了新版', scene: '订阅更新 / 客户端升级', pass: '组、优先级与路径仍然正确', dir: '生成配置覆盖与进程识别漂移' },
]

const TEMPLATE = String.raw`时间 / 时区：
OS / 客户端版本 / 配置哈希：
接入模式 / 启动入口 / 进程树：
场景：正常 / 代理退出 / 新域名 / IPv6 / 换网 / …
预期：代理或拒绝，禁止业务直连
实际：
物理接口证据（脱敏）：
代理入口与接收端证据（脱敏）：
既有连接是否处理：
恢复过程与结果：
结论：通过 / 失败 / 未验证
下次复核触发条件：`

/* 月历条：30 天，每天一个点；变更日；月末演练 */
const EVENTS = [
  { d: 4, t: '换网' }, { d: 10, t: '升级' }, { d: 15, t: '唤醒' }, { d: 21, t: '重启代理' }, { d: 26, t: '插网卡' },
]

export default {
  id: 'drill',
  nav: '失败演练',
  desc: '断线时也不能偷偷直连',
  mood: 'tension',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>失败演练</span></div>
        <h2 class="h2" data-reveal="lines">断线的时候，<br><span class="text-warm">也不能偷偷直连</span></h2>
        <p class="lead" data-reveal>用无账号、无密钥的受控测试，证明保护真的有效。</p>
      </header>

      <div class="dr-how">
        <div class="dr-how__text">
          <p class="metaphor" data-reveal><span>像消防演习：点的是假火，烧不到真房子。演练用的是<strong>不带账号、不带钥匙的测试包裹</strong>。故意让代收点关门，看它会不会从自家门口溜出去。</span></p>
          <ol class="dr-how__list" data-reveal="stagger">
            <li><span>01</span>先暂停敏感业务，使用独立测试进程与自己控制的接收端。</li>
            <li><span>02</span>一起观察物理接口、代理入口和接收端。</li>
            <li><span>03</span>正常时路径正确，失败时没有直连包。</li>
            <li><span>04</span>测试记录只保存必要元数据。</li>
          </ol>
        </div>
        <figure class="dr-obs" data-state="ok" data-reveal="scale">
          <div class="dr-obs__bar">
            <div class="segmented" role="group" aria-label="演示场景">
              <button type="button" data-s="ok" aria-pressed="true" data-sfx="click">平时</button>
              <button type="button" data-s="down" aria-pressed="false">代收点关门</button>
            </div>
          </div>
          ${obsArt()}
          <figcaption class="dr-obs__cap" aria-live="polite"></figcaption>
          <p class="dr-obs__note tiny faint">逻辑演示，不读取你电脑的网络。</p>
        </figure>
      </div>

      <div class="dr-sub" data-reveal>
        <span class="dr-sub__k">Ten drills</span>
        <h3 class="h3">10 道考题，翻开看合格线</h3>
        <p class="muted">每张卡是一种「出意外」的场景。先猜一猜该怎样才算过关，再点「揭晓」。</p>
      </div>

      <div class="dr-board">
        <div class="dr-counter" aria-live="polite">
          <p class="dr-counter__txt">已揭晓 <b class="dr-counter__n">0</b><span> / ${CASES.length}</span></p>
          <div class="dr-counter__bar" aria-hidden="true">${CASES.map(() => '<i></i>').join('')}</div>
          <div class="dr-counter__tools">
            <button type="button" class="btn btn--ghost btn--xs dr-all" data-sfx="click">全部揭晓</button>
            <button type="button" class="btn btn--ghost btn--xs dr-reset" data-sfx="close">全部盖回</button>
          </div>
        </div>
        <p class="dr-done" aria-live="polite"></p>
        <ol class="dr-grid">
          ${CASES.map((c, i) => cardHTML(c, i)).join('')}
        </ol>
      </div>

      <div class="dr-sub" data-reveal>
        <span class="dr-sub__k">Rhythm</span>
        <h3 class="h3">演练的节奏：天天看，变了就测，每月练一次</h3>
      </div>
      <div class="dr-rhythm" data-reveal="scale">
        <div class="dr-rhythm__scroll" tabindex="0" aria-label="一个月的演练节奏图，可横向滑动">${rhythmArt()}</div>
        <p class="dr-rhythm__hint tiny faint">左右滑动看完整一个月</p>
        <div class="dr-rhythm__cols">
          <article class="dr-beat dr-beat--day">
            <p class="dr-beat__k"><i aria-hidden="true"></i>每天 · 2 分钟</p>
            <p class="dr-beat__plain">像出门前看一眼门锁。</p>
            <p class="dr-beat__orig">看最近心跳、当前模式、出口身份与近期变更；过期 SAFE 不算当前健康。</p>
          </article>
          <article class="dr-beat dr-beat--chg">
            <p class="dr-beat__k"><i aria-hidden="true"></i>每次变更后</p>
            <p class="dr-beat__plain">家里动过东西，就再走一遍。</p>
            <p class="dr-beat__orig">换网、升级、唤醒、重启代理、插网卡后复测相关路径。</p>
          </article>
          <article class="dr-beat dr-beat--mon">
            <p class="dr-beat__k"><i aria-hidden="true"></i>每月</p>
            <p class="dr-beat__plain">每月一次完整的消防演习。</p>
            <p class="dr-beat__orig">维护窗口执行一次无敏感会话的失效演练，核对新依赖与恢复步骤。</p>
          </article>
        </div>
      </div>

      <div class="pro-only dr-pro">
        <div class="dr-sub">
          <span class="pro-badge">进阶</span>
          <h3 class="h3">验收记录模板</h3>
          <p class="muted">每次演练都填一份。哪一栏空着，就当那一项没验证。</p>
        </div>
        ${codeBlock({ code: TEMPLATE, lang: 'text', title: '验收记录模板', note: '记录模板 · 留空不代表通过' })}
      </div>

      <aside class="dr-warn" data-reveal>
        <div class="dr-warn__tape" aria-hidden="true"></div>
        <div class="dr-warn__body">
          <div class="dr-warn__m" aria-hidden="true">${mascot({ size: 120, face: 'worried' })}</div>
          <div>
            <p class="dr-warn__k">${icon('warn', 'dr-ico--sm')}演练警示</p>
            <h3 class="dr-warn__h">不拿真实登录会话做负例</h3>
            <p class="dr-warn__plain">演练用假包裹。别拿正在用的真账号去试。</p>
            <p class="dr-warn__orig">不要把正在使用的 Claude 组故意切成 DIRECT。未知域名与断线测试先在无凭据的隔离测试集合里完成，再进入批准的维护窗口验证整体策略。</p>
          </div>
        </div>
      </aside>
    </div>`

    reveal(el)
    enhanceCodeBlocks(el)
    initCards(el)
    initObs(el)
    initRhythm(el)
  },
}

function cardHTML(c, i) {
  const n = String(i + 1).padStart(2, '0')
  return `<li class="dr-card" style="--i:${i}">
    <div class="dr-card__inner">
      <div class="dr-face dr-face--front">
        <div class="dr-face__top"><span class="dr-no">${n}</span><span class="dr-tag">考题</span></div>
        <span class="dr-card__ico">${icon(c.ico)}</span>
        <p class="dr-card__say">${c.say}</p>
        <p class="dr-card__scene">${c.scene}</p>
        <button type="button" class="dr-flip" aria-expanded="false">揭晓<span aria-hidden="true">↻</span></button>
      </div>
      <div class="dr-face dr-face--back" inert>
        <div class="dr-face__top"><span class="dr-no">${n}</span></div>
        <p class="dr-card__scene dr-card__scene--sm">${c.scene}</p>
        <div class="dr-stamp" aria-hidden="true">
          <svg viewBox="0 0 100 100"><defs><path id="drStampArc${i}" d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0"/></defs>
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3"/>
            <circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" stroke-width="1.5"/>
            <text font-size="11.5" font-weight="800" fill="currentColor" letter-spacing="3"><textPath href="#drStampArc${i}">失败演练 · 通过标准 · DRILL ·</textPath></text>
            <path d="M38 51l8 8 16-17" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="dr-k dr-k--pass">通过标准</p>
        <p class="dr-pass">${c.pass}</p>
        <p class="dr-k">排查方向</p>
        <p class="dr-dir">${c.dir}</p>
        <button type="button" class="dr-flip dr-flip--back" aria-label="盖回第 ${n} 张">盖回</button>
      </div>
    </div>
  </li>`
}

function obsArt() {
  // 自家房子 → 代收点 → 接收端；三个观察哨
  return `<svg class="dr-obs__svg" viewBox="0 0 640 260" fill="none" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="观察物理接口、代理入口和接收端的示意图">
    <defs>
      <radialGradient id="drPkt" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff1d6"/><stop offset=".5" stop-color="#ffc070"/><stop offset="1" stop-color="#ff7a52" stop-opacity="0"/></radialGradient>
    </defs>
    <path d="M20 214h600" stroke="rgba(244,239,230,.12)" stroke-width="1.6"/>
    <!-- 路线 -->
    <path id="drRouteOk" class="dr-route dr-route--ok" d="M122 176 C 200 176, 220 130, 300 130 L 330 130 C 420 130, 440 176, 520 176" stroke="rgba(255,179,92,.55)" stroke-width="2.4" stroke-dasharray="2 9"/>
    <path class="dr-route dr-route--direct" d="M122 196 C 260 236, 400 236, 520 196" stroke="rgba(255,77,97,.5)" stroke-width="2" stroke-dasharray="6 7"/>
    <g class="dr-nodirect"><circle cx="321" cy="226" r="11" fill="#0b0d13" stroke="#ff4d61" stroke-width="2"/><path d="M316 221l10 10M326 221l-10 10" stroke="#ff4d61" stroke-width="2"/><text x="340" y="252" class="dr-lbl dr-lbl--no">物理接口：没有直连包</text></g>
    <!-- 房子 -->
    <g class="dr-house">
      <path d="M40 214V150l46-38 46 38v64z" fill="#141824" stroke="rgba(244,239,230,.4)" stroke-width="1.8"/>
      <rect x="54" y="160" width="18" height="16" rx="2" fill="rgba(255,208,138,.55)"/>
      <rect x="100" y="174" width="20" height="40" rx="2" fill="#0b0d13" stroke="rgba(244,239,230,.35)" stroke-width="1.6"/>
      <text x="86" y="240" text-anchor="middle" class="dr-lbl">你的电脑</text>
    </g>
    <!-- 代收点 -->
    <g class="dr-proxy">
      <path d="M262 214v-86h118v86" fill="#141824" stroke="rgba(255,208,138,.6)" stroke-width="1.8"/>
      <path d="M252 130l69-38 69 38" stroke="rgba(255,208,138,.6)" stroke-width="1.8"/>
      <rect class="dr-proxy__win" x="280" y="148" width="26" height="20" rx="2"/>
      <rect class="dr-proxy__win" x="336" y="148" width="26" height="20" rx="2"/>
      <rect x="306" y="180" width="30" height="34" rx="2" fill="#0b0d13" stroke="rgba(255,208,138,.5)" stroke-width="1.6"/>
      <text x="321" y="84" text-anchor="middle" class="dr-lbl">代收点</text>
      <g class="dr-closed"><rect x="286" y="186" width="70" height="20" rx="4" fill="#ff4d61"/><text x="321" y="200" text-anchor="middle" class="dr-lbl dr-lbl--dark">暂停营业</text></g>
    </g>
    <!-- 接收端 -->
    <g class="dr-recv">
      <path d="M520 214v-58h64v58z" fill="#141824" stroke="rgba(143,180,255,.55)" stroke-width="1.8"/>
      <path d="M552 156v-26M540 118a16 16 0 0 1 24 0M533 110a26 26 0 0 1 38 0" stroke="rgba(143,180,255,.7)" stroke-width="1.8"/>
      <text x="552" y="240" text-anchor="middle" class="dr-lbl">自己的接收端</text>
    </g>
    <!-- 观察哨 -->
    ${[[86, 84, '物理接口'], [321, 44, '代理入口'], [552, 84, '接收端']].map(([x, y, t], i) => `<g class="dr-eye" style="--d:${i * 0.4}s" transform="translate(${x} ${y})">
      <circle r="15" fill="#0b0d13" stroke="rgba(111,240,184,.7)" stroke-width="1.6"/>
      <path d="M-8 0s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" stroke="#6ff0b8" stroke-width="1.5"/><circle r="1.8" fill="#6ff0b8"/>
      <circle class="dr-eye__ping" r="15" stroke="#6ff0b8" stroke-width="1.2"/>
      <text y="${i === 1 ? -22 : -22}" text-anchor="middle" class="dr-lbl dr-lbl--eye">${t}</text>
    </g>`).join('')}
    <!-- 小包裹 -->
    <g class="dr-pkt dr-pkt--ok"><circle r="13" fill="url(#drPkt)"/><circle r="5" fill="#fff4de"/>
      <animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#drRouteOk"/></animateMotion></g>
    <g class="dr-pkt dr-pkt--down"><circle r="13" fill="url(#drPkt)"/><circle r="5" fill="#fff4de"/>
      <animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="0;0.42;0.42" keyTimes="0;0.55;1" calcMode="linear"><mpath href="#drRouteOk"/></animateMotion></g>
  </svg>`
}

function rhythmArt() {
  const x0 = 40, x1 = 860, days = 30
  const step = (x1 - x0) / (days - 1)
  const ticks = Array.from({ length: days }, (_, i) => {
    const x = x0 + i * step
    return `<g class="dr-day" transform="translate(${x.toFixed(1)} 96)"><circle r="4.2"/>${i % 7 === 0 ? `<text y="30" text-anchor="middle" class="dr-rl dr-rl--d">第 ${i + 1} 天</text>` : ''}</g>`
  }).join('')
  const evs = EVENTS.map((e) => {
    const x = x0 + (e.d - 1) * step
    return `<g transform="translate(${x.toFixed(1)} 96)"><g class="dr-ev">
      <path d="M0 -8v-26" stroke="rgba(255,179,92,.45)" stroke-width="1.4" stroke-dasharray="2 3"/>
      <rect x="-7" y="-49" width="14" height="14" rx="2" transform="rotate(45 0 -42)"/>
      <text y="-62" text-anchor="middle" class="dr-rl dr-rl--ev">${e.t}</text>
    </g></g>`
  }).join('')
  return `<svg class="dr-rhythm__svg" viewBox="0 0 1000 150" fill="none" role="img" aria-label="一个月的演练节奏：每天看一眼，变更后复测，月末完整演练">
    <path class="dr-rhythm__base" d="M${x0 - 20} 96H${x1 + 30}" stroke="rgba(244,239,230,.14)" stroke-width="2"/>
    <path class="dr-rhythm__fill" d="M${x0 - 20} 96H${x1 + 30}" stroke="url(#drRGrad)" stroke-width="2.4" pathLength="1"/>
    <defs><linearGradient id="drRGrad" x1="0" x2="1"><stop offset="0" stop-color="#6ff0b8"/><stop offset=".7" stop-color="#ffb35c"/><stop offset="1" stop-color="#ff7a52"/></linearGradient></defs>
    ${ticks}${evs}
    <g transform="translate(940 96)"><g class="dr-mon">
      <circle r="34" class="dr-mon__halo"/>
      <circle r="24" class="dr-mon__ring"/>
      <path d="M-9 0l6 6 12-13" class="dr-mon__chk"/>
      <text y="-46" text-anchor="middle" class="dr-rl dr-rl--mon">月度演练</text>
    </g></g>
  </svg>`
}

/* ---------------- 考题卡 ---------------- */
function initCards(el) {
  const cards = [...el.querySelectorAll('.dr-card')]
  const nEl = el.querySelector('.dr-counter__n')
  const segs = [...el.querySelectorAll('.dr-counter__bar i')]
  const done = el.querySelector('.dr-done')
  let finished = false

  function sync() {
    const open = cards.filter((c) => c.classList.contains('is-open')).length
    nEl.textContent = open
    segs.forEach((s, i) => s.classList.toggle('is-on', i < open))
    if (open === cards.length && !finished) {
      finished = true
      done.textContent = '10 道全部看完了。真正演练时，每一场都要留下验收记录，结论写清通过、失败还是未验证。'
      done.classList.add('is-on')
      audio.sfx('chord')
    } else if (open < cards.length && finished) {
      finished = false
      done.classList.remove('is-on')
      done.textContent = ''
    }
    if (!prefersReduced) gsap.fromTo(nEl, { scale: 1.5 }, { scale: 1, duration: 0.5, ease: 'expo.out' })
  }

  function setOpen(card, open, { quiet = false } = {}) {
    if (card.classList.contains('is-open') === open) return
    card.classList.toggle('is-open', open)
    const front = card.querySelector('.dr-face--front')
    const back = card.querySelector('.dr-face--back')
    front.toggleAttribute('inert', open)
    back.toggleAttribute('inert', !open)
    card.querySelector('.dr-face--front .dr-flip').setAttribute('aria-expanded', String(open))
    if (!quiet) audio.sfx(open ? 'reveal' : 'close')
  }

  cards.forEach((card) => {
    card.querySelector('.dr-face--front .dr-flip').addEventListener('click', () => {
      setOpen(card, true); sync()
      card.querySelector('.dr-flip--back').focus({ preventScroll: true })
    })
    card.querySelector('.dr-flip--back').addEventListener('click', () => {
      setOpen(card, false); sync()
      card.querySelector('.dr-face--front .dr-flip').focus({ preventScroll: true })
    })
  })

  el.querySelector('.dr-all').addEventListener('click', () => {
    const closed = cards.filter((c) => !c.classList.contains('is-open'))
    if (!closed.length) return
    audio.sfx('reveal')
    closed.forEach((c, i) => {
      const go = () => { setOpen(c, true, { quiet: true }); sync() }
      prefersReduced ? go() : setTimeout(go, i * 90)
    })
  })
  el.querySelector('.dr-reset').addEventListener('click', () => {
    cards.forEach((c) => setOpen(c, false, { quiet: true }))
    sync()
  })

  // 入场：卡片像发牌一样落下
  const grid = el.querySelector('.dr-grid')
  if (!prefersReduced) {
    gsap.set(cards, { opacity: 0, y: 60, rotate: (i) => (i % 2 ? 3 : -3) })
    onEnter(grid, () => gsap.to(cards, { opacity: 1, y: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06 }), { start: 'top 82%' })
  }
}

/* ---------------- 观察哨演示 ---------------- */
function initObs(el) {
  const fig = el.querySelector('.dr-obs')
  const svg = fig.querySelector('svg')
  const cap = fig.querySelector('.dr-obs__cap')
  const btns = [...fig.querySelectorAll('[data-s]')]
  const CAP = {
    ok: '平时：包裹从家里出发，经过代收点，到达自己的接收端。三个观察哨都看得到这条路。',
    down: '代收点关门：包裹停在半路，请求失败。物理接口上也没有直连包，这才算过关。',
  }
  function set(s, { sound = true } = {}) {
    fig.dataset.state = s
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === s)))
    cap.textContent = CAP[s]
    if (sound && s === 'down') { audio.sfx('deny') }
    if (sound && s === 'ok') { audio.sfx('success') }
  }
  btns.forEach((b) => b.addEventListener('click', () => set(b.dataset.s)))
  set('ok', { sound: false })
  // SMIL 动画离屏暂停
  if (prefersReduced) { svg.pauseAnimations?.(); svg.setCurrentTime?.(1.2); return }
  svg.pauseAnimations?.()
  whenVisible(fig, () => { svg.unpauseAnimations?.(); fig.classList.add('is-live') }, () => { svg.pauseAnimations?.(); fig.classList.remove('is-live') })
}

/* ---------------- 月历节奏条 ---------------- */
function initRhythm(el) {
  const box = el.querySelector('.dr-rhythm')
  const days = box.querySelectorAll('.dr-day')
  const evs = box.querySelectorAll('.dr-ev')
  const mon = box.querySelector('.dr-mon')
  const fill = box.querySelector('.dr-rhythm__fill')
  const beats = box.querySelectorAll('.dr-beat')
  if (prefersReduced) { box.classList.add('is-on'); return }
  gsap.set(fill, { strokeDasharray: 1, strokeDashoffset: 1 })
  gsap.set(days, { opacity: 0.18 })
  gsap.set(evs, { opacity: 0, y: 10 })
  gsap.set(mon, { opacity: 0, scale: 0.4, svgOrigin: '0 0' })
  gsap.set(beats, { opacity: 0, y: 30 })
  onEnter(box, () => {
    box.classList.add('is-on')
    const tl = gsap.timeline()
    tl.to(fill, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' }, 0)
      .to(days, { opacity: 1, duration: 0.3, stagger: 2 / days.length, ease: 'power1.out' }, 0.05)
      .to(evs, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.32 }, 0.35)
      .to(mon, { opacity: 1, scale: 1, duration: 1, ease: 'expo.out' }, 2)
      .to(beats, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }, 0.5)
  }, { start: 'top 78%' })
}

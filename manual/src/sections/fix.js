// 第 12 章 · 排障与恢复
// 招牌：症状选择器 + 「按正确顺序点击」的恢复链条练习（小请求沿着链条一格格跳到出口）
import './fix.css'
import { gsap, reveal, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { esc } from '../core/ui.js'
import { mascot } from '../core/mascot.js'

const svg = (d, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

/* ---------------- 症状表（原版「现象 / 先看什么 / 避免的动作」） ---------------- */
const SYMPTOMS = [
  {
    key: 'curl',
    name: '网页可用、curl 超时',
    plain: '浏览器能打开网页，命令行里的 curl 却一直超时。',
    look: ['这次 curl 有没有指定代理', '代理变量的大小写写对没有', 'NO_PROXY 里有没有例外'],
    avoid: ['把超时直接当作封号'],
    icon: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9l3 3-3 3M12.5 15H17"/>',
  },
  {
    key: 'tun',
    name: 'TUN 开后整机异常',
    plain: '修好围墙（TUN）以后，整台电脑的网络都不对劲。',
    look: ['同一网络里的其他设备是否正常', '路由、网络接口、内核状态', '在维护窗口里复现一次'],
    avoid: ['看到多个 utun 就杀掉全部 VPN'],
    icon: '<path d="M3 20V9h4v11M10 20V9h4v11M17 20V9h4v11M2 20h20M3 9l2-3 2 3M10 9l2-3 2 3M17 9l2-3 2 3"/>',
  },
  {
    key: 'guard',
    name: '守卫反复重启',
    plain: '巡逻的保安（守卫）一次次倒下，又一次次爬起来。',
    look: ['socket 路径', '当前模式', '权限', '日志时间与冷静期'],
    avoid: ['停掉守卫，继续跑业务'],
    icon: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12a3 3 0 1 0 1-2.2M9 8.5V10h1.5"/>',
  },
  {
    key: 'probe',
    name: '探测 429 或超时',
    plain: '检查出口的探测，回来一个 429，或者干脆超时。',
    look: ['探测源自己健不健康', '路由健不健康', '这两件事分开判断'],
    avoid: ['把「未知」当成 SAFE', '没有证据就断言「已经泄漏」'],
    icon: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6-6"/>',
  },
  {
    key: 'blank',
    name: '登录、下载或页面白屏',
    plain: '登录转圈、下载失败，或者页面一片空白。',
    look: ['登录重定向', 'CDN', 'bridge（浏览器桥）', '更新器的依赖'],
    avoid: ['临时打开全局 DIRECT（所有包裹从自家门口寄）'],
    icon: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 8h16"/><path d="M9 14h6" stroke-dasharray="1 3"/>',
  },
  {
    key: 'noeffect',
    name: '配置已加载却无效果',
    plain: '配置文件写好了，也显示加载成功，可就是不起作用。',
    look: ['anchor 有没有挂载', '规则顺序', '计数器有没有在涨', '已经建立的旧连接'],
    avoid: ['只看文件内容和退出码'],
    icon: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><circle cx="12" cy="14" r="2.4"/><path d="M12 10.2v1.4M12 16.4v1.4M8.2 14h1.4M14.4 14h1.4"/>',
  },
  {
    key: 'update',
    name: '更新后再次出问题',
    plain: '一切本来好好的，更新了一下，毛病又回来了。',
    look: ['权限', '新出现的网络接口', 'IPv6（侧门）', 'PATH', '重新生成的配置'],
    avoid: ['删除全部配置，把故障证据一起丢掉'],
    icon: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/><path d="M12 8v4l2.5 2"/>',
  },
]

/* ---------------- 恢复顺序（原版写死：暂停业务 → 恢复阻断 → 恢复代理 → 复核出口 → 放行业务） ---------------- */
const STEPS = [
  { name: '暂停业务', say: '先让正在跑的业务停下，排查期间没有请求要出门。', icon: '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>' },
  { name: '恢复阻断', say: '门卫先回岗。代收点还没好，包裹也出不了门。', icon: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2.5"/>' },
  { name: '恢复代理', say: '门卫在岗以后，再让代收点重新开门。', icon: '<path d="M3.5 10.5L12 4l8.5 6.5"/><path d="M5.5 9v11h13V9"/><rect x="9" y="13" width="6" height="7" rx="1"/>' },
  { name: '复核出口', say: '代收点开了，还要确认寄出去的地址对不对。', icon: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><path d="M8 10.5l1.8 1.8 3.2-3.4"/>' },
  { name: '放行业务', say: '前面四步都确认过，最后才放包裹出门。', icon: '<path d="M5 21V4.5L14 3v18"/><path d="M14 5h5v16"/><path d="M11 12h.01"/><path d="M3 21h18"/>' },
]

// 点得太早时的原因：说明为什么「现在还不到这一步」
const TOO_EARLY = [
  '',
  '业务还在跑。先暂停业务，再动防线。',
  '先恢复代理、再恢复阻断，中间那段时间可能直连。门卫要先回岗。',
  '代收点还没恢复，这时复核看不到真正的出口。',
  '路径还没确认。确认不了的时候，继续离线工作。',
]

// 打乱后的选项顺序（固定，保证每次看到的练习一致）
const SHUFFLED = [2, 4, 0, 3, 1]

const MIGRATE = [
  { t: 'socket 路径或服务 UID 变了，守卫还在访问旧地址。', m: '保安还在旧岗亭巡逻。' },
  { t: '原来 TUN 接管的探测，迁到纯代理后仍然裸请求。', m: '围墙拆了换成告示，有的探测不看告示。' },
  { t: '新的 Helper、更新器或版本号路径没有进入保护集合。', m: '新搬来的住户没有登记。' },
  { t: '订阅刷新重新生成配置，覆盖手工修改。', m: '门口的告示被悄悄换掉了。' },
  { t: '系统更新或新网卡恢复了未受控 IPv6。', m: '侧门又被打开了。' },
  { t: '只改新终端的变量，旧会话和常驻宿主仍保留旧环境。', m: '只通知了新来的人，老住户还按旧规矩。' },
]

const RULES = [
  { t: '路径确认不了，就继续离线工作。', icon: '<path d="M4 12h16"/><path d="M8 7l-4 5 4 5"/><path d="M4 4l16 16"/>' },
  { t: '别为了恢复可用，先取消阻断再慢慢排查。', icon: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>' },
  { t: '日志要有限额。', icon: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>' },
  { t: '重复失败时，停止自动重试，保留现场。', icon: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>' },
]

export default {
  id: 'fix',
  nav: '排障与恢复',
  desc: '先止损，再判断',
  mood: 'tension',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>排障与恢复</span></div>
        <h2 class="h2" data-reveal="lines">出了问题，<br><span class="text-warm">先止损，再判断</span></h2>
        <p class="lead" data-reveal>按现象查证据，不靠一个开关猜根因。先挑一个你遇到的症状，看看该先查哪里、千万别做什么。</p>
      </header>

      <!-- 症状选择器 -->
      <div class="fx-clinic" data-reveal="scale">
        <div class="fx-clinic__side">
          <p class="fx-eyebrow">你遇到的是</p>
          <div class="fx-chips" role="tablist" aria-label="选择症状">
            ${SYMPTOMS.map((s, i) => `
              <button class="fx-chip" type="button" role="tab" id="fx-tab-${s.key}" aria-controls="fx-panel" aria-selected="${i === 0}" data-i="${i}" data-sfx-hover="hover">
                <span class="fx-chip__n">${String(i + 1).padStart(2, '0')}</span>
                <span class="fx-chip__t">${esc(s.name)}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="fx-panel" id="fx-panel" role="tabpanel" aria-live="polite"></div>
      </div>

      <details class="fold fx-table pro-only">
        <summary>原版对照表 · 现象 / 先看什么 / 避免的动作</summary>
        <div class="fold__body">
          <div class="fx-table__scroll">
            <table>
              <thead><tr><th>现象</th><th>先看什么</th><th>避免的动作</th></tr></thead>
              <tbody>
                <tr><td>网页可用、curl 超时</td><td>curl 是否指定代理，变量大小写与 NO_PROXY</td><td>把超时直接当作封号</td></tr>
                <tr><td>TUN 开后整机异常</td><td>同网设备、路由、接口、内核；维护窗口复现</td><td>看到多个 utun 就杀掉全部 VPN</td></tr>
                <tr><td>守卫反复重启</td><td>socket、模式、权限、日志时间与冷静期</td><td>停掉守卫继续业务</td></tr>
                <tr><td>探测 429 / 超时</td><td>探测源健康与路由健康分别判断</td><td>未知当 SAFE，或无证据断言已经泄漏</td></tr>
                <tr><td>登录 / 下载 / 页面白屏</td><td>重定向、CDN、bridge 与更新器依赖</td><td>临时开全局 DIRECT</td></tr>
                <tr><td>配置已加载却无效果</td><td>anchor 挂载、顺序、计数器、既有连接</td><td>只看文件与退出码</td></tr>
                <tr><td>更新后再次出问题</td><td>权限、新接口、IPv6、PATH 与生成配置</td><td>删除全部配置，丢掉故障证据</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <!-- 恢复顺序练习 -->
      <div class="fx-drill" data-reveal>
        <div class="fx-drill__head">
          <div>
            <span class="tag tag--warm"><span class="dot"></span>小练习</span>
            <h3 class="h3">恢复顺序，固定下来</h3>
            <p class="muted">修好一次故障，有五个动作。顺序错了，中间就可能漏出一次直连。<br class="fx-br">请按你认为正确的顺序，依次点下面的五个动作。</p>
          </div>
          <div class="fx-drill__tools">
            <button class="btn btn--ghost btn--xs" type="button" data-act="answer" data-sfx="click">直接看答案</button>
            <button class="btn btn--ghost btn--xs" type="button" data-act="reset" data-sfx="click">重来</button>
          </div>
        </div>

        <div class="fx-chain" aria-label="恢复链条">
          <div class="fx-chain__track" aria-hidden="true"><i class="fx-chain__fill"></i></div>
          <div class="fx-chain__runner" aria-hidden="true">${mascot({ size: 84, face: 'worried' })}</div>
          <ol class="fx-chain__nodes">
            ${STEPS.map((s, i) => `
              <li class="fx-node" data-i="${i}">
                <span class="fx-node__dot">${svg(s.icon, 22)}<b class="fx-node__q" aria-hidden="true">?</b></span>
                <span class="fx-node__n">${String(i + 1).padStart(2, '0')}</span>
                <span class="fx-node__name">待填</span>
              </li>`).join('')}
          </ol>
        </div>

        <div class="fx-choices" role="group" aria-label="五个恢复动作（已打乱）">
          ${SHUFFLED.map((i) => `
            <button class="fx-choice" type="button" data-i="${i}">
              <span class="fx-choice__ico">${svg(STEPS[i].icon, 20)}</span>
              <span class="fx-choice__t">${STEPS[i].name}</span>
              <span class="fx-choice__ok" aria-hidden="true"></span>
            </button>`).join('')}
        </div>

        <p class="fx-feedback" aria-live="polite"><span class="fx-feedback__t">从第一步开始。出事的时候，你最先要做什么？</span></p>

        <div class="fx-result" hidden>
          <p class="fx-result__chain">${STEPS.map((s) => `<span>${s.name}</span>`).join('<i aria-hidden="true">→</i>')}</p>
          <p class="fx-result__say">门卫先回岗，代收点再开门，确认地址以后才放行。<span class="fx-result__score"></span></p>
        </div>
      </div>

      <!-- 排障守则 -->
      <ul class="fx-rules" data-reveal="stagger">
        ${RULES.map((r) => `<li class="fx-rule"><span class="fx-rule__ico">${svg(r.icon, 22)}</span><span>${r.t}</span></li>`).join('')}
      </ul>

      <!-- 升级迁移六件事 -->
      <section class="fx-migrate" aria-labelledby="fx-migrate-h">
        <div class="fx-migrate__head">
          <h3 class="h3" id="fx-migrate-h" data-reveal="lines">升级或迁移时，<br>最容易漏的六件事</h3>
          <p class="muted" data-reveal>搬家、换设备、升级客户端之后，防线常常在这些地方悄悄松动。</p>
        </div>
        <ol class="fx-migrate__list" data-reveal="stagger">
          ${MIGRATE.map((m, i) => `
            <li class="fx-mig card card--flat">
              <span class="fx-mig__n">${String(i + 1).padStart(2, '0')}</span>
              <p class="fx-mig__m">${m.m}</p>
              <p class="fx-mig__t">${m.t}</p>
            </li>`).join('')}
        </ol>
      </section>
    </div>`

    reveal(el)
    initClinic(el)
    initDrill(el)
  },
}

/* ============================================================
   症状选择器
   ============================================================ */
function panelHTML(s, i) {
  return `
    <div class="fx-panel__top">
      <span class="fx-panel__ico">${svg(s.icon, 30)}</span>
      <div>
        <p class="fx-panel__n">症状 ${String(i + 1).padStart(2, '0')} / ${String(SYMPTOMS.length).padStart(2, '0')}</p>
        <h4 class="fx-panel__name">${esc(s.name)}</h4>
        <p class="fx-panel__plain">${esc(s.plain)}</p>
      </div>
    </div>
    <div class="fx-panel__cols">
      <div class="fx-col fx-col--look">
        <p class="fx-col__h">${svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>', 18)}先看什么</p>
        <ul>${s.look.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <div class="fx-col fx-col--avoid">
        <p class="fx-col__h">${svg('<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>', 18)}千万别</p>
        <ul>${s.avoid.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </div>`
}

function initClinic(el) {
  const panel = el.querySelector('.fx-panel')
  const chips = [...el.querySelectorAll('.fx-chip')]
  let cur = 0
  let tl = null
  panel.innerHTML = panelHTML(SYMPTOMS[0], 0)
  panel.setAttribute('aria-labelledby', `fx-tab-${SYMPTOMS[0].key}`)

  const select = (i, { focus = false } = {}) => {
    if (i === cur) return
    const dir = i > cur ? 1 : -1
    cur = i
    chips.forEach((c, k) => { c.setAttribute('aria-selected', String(k === i)); c.tabIndex = k === i ? 0 : -1 })
    if (focus) chips[i].focus()
    panel.setAttribute('aria-labelledby', `fx-tab-${SYMPTOMS[i].key}`)
    audio.sfx('click')
    tl?.kill()
    if (prefersReduced) { panel.innerHTML = panelHTML(SYMPTOMS[i], i); return }
    tl = gsap.timeline()
    tl.to(panel.children, { opacity: 0, y: -14 * dir, duration: 0.18, ease: 'power2.in', stagger: 0.03 })
      .call(() => { panel.innerHTML = panelHTML(SYMPTOMS[i], i) })
      .call(() => {
        const items = panel.querySelectorAll('.fx-panel__ico, .fx-panel__n, .fx-panel__name, .fx-panel__plain, .fx-col, .fx-col li')
        gsap.from(items, { opacity: 0, y: 18 * dir, duration: 0.9, ease: 'expo.out', stagger: 0.035 })
        gsap.from(panel.querySelector('.fx-panel__ico'), { scale: 0.6, rotate: -12 * dir, duration: 0.9, ease: 'expo.out' })
      })
  }

  chips.forEach((c, k) => {
    c.tabIndex = k === 0 ? 0 : -1
    c.addEventListener('click', () => select(k))
    c.addEventListener('keydown', (e) => {
      const n = chips.length
      const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
      if (map[e.key]) { e.preventDefault(); select((cur + map[e.key] + n) % n, { focus: true }) }
      if (e.key === 'Home') { e.preventDefault(); select(0, { focus: true }) }
      if (e.key === 'End') { e.preventDefault(); select(n - 1, { focus: true }) }
    })
  })
}

/* ============================================================
   恢复顺序练习
   ============================================================ */
function initDrill(el) {
  const drill = el.querySelector('.fx-drill')
  const nodes = [...drill.querySelectorAll('.fx-node')]
  const choices = [...drill.querySelectorAll('.fx-choice')]
  const fill = drill.querySelector('.fx-chain__fill')
  const runner = drill.querySelector('.fx-chain__runner')
  const fb = drill.querySelector('.fx-feedback')
  const fbText = drill.querySelector('.fx-feedback__t')
  const result = drill.querySelector('.fx-result')
  const score = drill.querySelector('.fx-result__score')
  let next = 0
  let wrong = 0
  let busy = false
  let face = 'worried'

  const pos = (i) => `${10 + i * 20}%`
  const setFace = (f) => {
    if (f === face) return
    face = f
    runner.innerHTML = mascot({ size: 84, face: f, tint: f === 'happy' ? 'safe' : 'warm' })
  }
  const say = (text, kind = '') => {
    fb.dataset.kind = kind
    fbText.textContent = text
    if (!prefersReduced) gsap.fromTo(fbText, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' })
  }

  const light = (i, { fast = false } = {}) => {
    const node = nodes[i]
    node.classList.add('is-on')
    node.querySelector('.fx-node__name').textContent = STEPS[i].name
    const btn = choices.find((c) => Number(c.dataset.i) === i)
    btn.classList.add('is-done')
    btn.disabled = true
    btn.querySelector('.fx-choice__ok').textContent = String(i + 1).padStart(2, '0')
    const d = fast || prefersReduced ? 0 : 0.7
    gsap.to(fill, { scaleX: i / 4, duration: d, ease: 'expo.out' })
    if (!prefersReduced) {
      gsap.fromTo(node.querySelector('.fx-node__dot'), { scale: 0.7 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.5)' })
      gsap.fromTo(node.querySelector('.fx-node__name'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' })
      const hop = gsap.timeline()
      hop.to(runner, { left: pos(i), duration: fast ? 0.35 : 0.6, ease: 'power2.inOut' }, 0)
        .to(runner, { y: -26, duration: (fast ? 0.35 : 0.6) / 2, ease: 'power2.out', yoyo: true, repeat: 1 }, 0)
    } else {
      gsap.set(runner, { left: pos(i) })
    }
  }

  const finish = () => {
    drill.classList.add('is-complete')
    setFace('happy')
    result.hidden = false
    score.textContent = wrong === 0 ? '一次都没点错。' : `这一轮点错了 ${wrong} 次，每一次都值得记住原因。`
    if (!prefersReduced) {
      gsap.from(result.querySelectorAll('.fx-result__chain span, .fx-result__chain i, .fx-result__say'), { opacity: 0, y: 16, duration: 0.9, ease: 'expo.out', stagger: 0.06 })
      gsap.fromTo(runner, { scale: 1 }, { scale: 1.18, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' })
    }
    say('五步全部点亮。这就是固定下来的恢复顺序。', 'ok')
    setTimeout(() => audio.sfx('success'), 180)
  }

  const onPick = (btn) => {
    if (busy || btn.disabled) return
    const i = Number(btn.dataset.i)
    if (i === next) {
      audio.sfx('step')
      light(i)
      next++
      if (next === 1) setFace('idle')
      if (next < STEPS.length) say(`第 ${next} 步：${STEPS[i].name}。${STEPS[i].say}`, 'ok')
      else finish()
    } else {
      wrong++
      audio.sfx('deny')
      setFace('blocked')
      say(`还不到「${STEPS[i].name}」。${TOO_EARLY[i]}`, 'bad')
      btn.classList.add('is-wrong')
      if (!prefersReduced) {
        gsap.fromTo(btn, { x: 0 }, { keyframes: { x: [-9, 8, -6, 4, 0] }, duration: 0.42, ease: 'power1.out' })
        gsap.fromTo(runner, { rotate: 0 }, { keyframes: { rotate: [-10, 8, -4, 0] }, duration: 0.5 })
      }
      setTimeout(() => { btn.classList.remove('is-wrong'); if (face === 'blocked') setFace(next ? 'idle' : 'worried') }, 900)
    }
  }

  const reset = () => {
    next = 0; wrong = 0; busy = false
    drill.classList.remove('is-complete')
    result.hidden = true
    nodes.forEach((n) => { n.classList.remove('is-on'); n.querySelector('.fx-node__name').textContent = '待填' })
    choices.forEach((c) => { c.classList.remove('is-done', 'is-wrong'); c.disabled = false; c.querySelector('.fx-choice__ok').textContent = '' })
    gsap.to(fill, { scaleX: 0, duration: prefersReduced ? 0 : 0.5, ease: 'expo.out' })
    gsap.to(runner, { left: pos(0), y: 0, duration: prefersReduced ? 0 : 0.5, ease: 'expo.out' })
    setFace('worried')
    say('从第一步开始。出事的时候，你最先要做什么？')
  }

  const answer = () => {
    if (busy) return
    busy = true
    const start = next
    const gap = prefersReduced ? 0 : 420
    for (let i = start; i < STEPS.length; i++) {
      setTimeout(() => {
        audio.sfx('step')
        light(i, { fast: true })
        if (i === 0) setFace('idle')
        if (i === STEPS.length - 1) { next = STEPS.length; busy = false; finish() }
      }, (i - start) * gap)
    }
  }

  choices.forEach((c) => c.addEventListener('click', () => onPick(c)))
  drill.querySelector('[data-act="reset"]').addEventListener('click', reset)
  drill.querySelector('[data-act="answer"]').addEventListener('click', answer)
  gsap.set(runner, { left: pos(0), xPercent: -50 })
  gsap.set(fill, { scaleX: 0 })
}

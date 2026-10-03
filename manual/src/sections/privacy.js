// 第 13 章 · 隐私与遥测
// 招牌：仿系统设置的四个大开关（弹簧拨杆 + 展开说明）；旁边的小房子随开关亮窗，门牌号始终不变
import './privacy.css'
import { gsap, reveal, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { codeBlock, enhanceCodeBlocks } from '../core/ui.js'

const svg = (d, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

const ITEMS = [
  {
    key: 'train',
    name: '模型改进',
    sub: '是否允许模型改进',
    effect: '按你自己的数据偏好决定。',
    truth: '开启模型改进，没有经过证实的防封作用。关闭它，也不等于网络匿名。',
    color: '#ffb35c',
    icon: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/><path d="M10 12l1.5 1.5L14.5 10"/>',
  },
  {
    key: 'loc',
    name: '位置权限',
    sub: '是否授予定位',
    effect: '系统定位、浏览器权限、应用元数据，要分别核对。',
    truth: '关掉系统定位，服务端仍能从连接 IP（门牌号）推断你的大致地区。',
    color: '#8fb4ff',
    icon: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  },
  {
    key: 'tele',
    name: '运行遥测',
    sub: '是否发送运行遥测',
    effect: '设置以后，核对真实进程有没有读到，包括后台宿主。',
    truth: '已经在运行的会话，不会自动继承新 shell 的环境。关闭遥测，也替代不了出口防护。',
    color: '#6ff0b8',
    icon: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
  },
  {
    key: 'fb',
    name: '主动反馈',
    sub: '是否主动提交反馈',
    effect: '提交前，先审查附带的会话和日志。',
    truth: '源代码、路径或真实 IP，可能跟着报错材料一起上传。',
    color: '#ff7a52',
    icon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  },
]

const CODE = String.raw`# 按版本文档和功能需要选择，只影响读取到这些变量的进程。
export DISABLE_TELEMETRY=1
export DISABLE_ERROR_REPORTING=1
# 更广泛的可选开关，可能影响 Remote Control 等能力：
# export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`

// 小房子：四扇窗对应四个开关，门上的门牌号永远不变
function houseSVG() {
  const win = (x, y, i) => `
    <g class="pv-win" data-w="${i}" transform="translate(${x} ${y})">
      <rect class="pv-win__glow" x="-14" y="-14" width="68" height="62" rx="10"/>
      <rect class="pv-win__pane" width="40" height="34" rx="4"/>
      <path class="pv-win__bar" d="M20 0v34M0 17h40"/>
    </g>`
  return `<svg class="pv-house__svg" viewBox="0 0 300 300" aria-hidden="true">
    <defs>
      <linearGradient id="pv-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2030"/><stop offset="1" stop-color="#0e1119"/></linearGradient>
      <radialGradient id="pv-plate" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#fff1d6"/><stop offset=".6" stop-color="#ffc070"/><stop offset="1" stop-color="#ff7a52"/></radialGradient>
    </defs>
    <g class="pv-stars">
      <circle cx="30" cy="36" r="1.4"/><circle cx="262" cy="24" r="1.2"/><circle cx="240" cy="70" r="1"/><circle cx="58" cy="84" r="1"/><circle cx="150" cy="16" r="1.1"/>
    </g>
    <path d="M58 132 L150 58 L242 132" fill="none" stroke="rgba(244,239,230,.28)" stroke-width="2" stroke-linejoin="round"/>
    <path d="M70 124 L150 64 L230 124 V262 H70 Z" fill="url(#pv-wall)" stroke="rgba(244,239,230,.16)" stroke-width="1.5"/>
    <rect x="196" y="80" width="18" height="30" rx="2" fill="#141824" stroke="rgba(244,239,230,.16)"/>
    ${win(92, 138, 0)}${win(168, 138, 1)}${win(92, 196, 2)}${win(168, 196, 3)}
    <rect x="136" y="206" width="28" height="56" rx="4" fill="#07080c" stroke="rgba(255,179,92,.5)" stroke-width="1.5"/>
    <circle cx="157" cy="236" r="2" fill="#ffb35c"/>
    <g class="pv-plate">
      <rect x="78" y="236" width="52" height="20" rx="5" fill="url(#pv-plate)"/>
      <text x="104" y="250" text-anchor="middle" font-size="11" font-weight="800" fill="#2a1408" font-family="-apple-system,PingFang SC,sans-serif">门牌号</text>
    </g>
    <path d="M30 262 H270" stroke="rgba(244,239,230,.2)" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
}

export default {
  id: 'privacy',
  nav: '隐私与遥测',
  desc: '四个开关，各管各的',
  mood: 'calm',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>隐私与遥测</span></div>
        <h2 class="h2" data-reveal="lines">四个开关，<br><span class="text-warm">各管各的</span></h2>
        <p class="lead" data-reveal>隐私选择，不是防封承诺。别为了「看起来正常」，把所有隐私开关都打开。模型改进、位置权限、运行遥测、主动反馈，是四个不同的选择。按你自己的数据边界来设。</p>
      </header>

      <div class="metaphor pv-meta" data-reveal>
        <span>这四个开关，像家里四盏各自独立的灯。开哪盏、关哪盏，都换不掉你家的<strong>门牌号（IP）</strong>。</span>
      </div>

      <div class="pv-stage" data-reveal="scale">
        <div class="pv-window" role="group" aria-label="隐私设置（演示）">
          <div class="pv-window__bar">
            <span class="pv-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="pv-window__title">隐私设置</span>
            <span class="tag tag--warn pv-demo"><span class="dot"></span>演示开关 · 不改任何设置</span>
          </div>
          <p class="pv-window__hint">拨一下开关，看看它真正影响什么。这里只是演示，不会改动你电脑和账户里的任何设置。</p>
          <ul class="pv-rows">
            ${ITEMS.map((it, i) => `
              <li class="pv-row" data-i="${i}" style="--c:${it.color}">
                <div class="pv-row__head">
                  <span class="pv-row__ico">${svg(it.icon, 22)}</span>
                  <span class="pv-row__txt">
                    <span class="pv-row__name" id="pv-name-${it.key}">${it.name}</span>
                    <span class="pv-row__sub">${it.sub}</span>
                  </span>
                  <button class="pv-switch" type="button" role="switch" aria-checked="false" aria-labelledby="pv-name-${it.key}" aria-controls="pv-more-${it.key}">
                    <span class="pv-switch__track"><span class="pv-switch__knob"></span></span>
                  </button>
                </div>
                <div class="pv-row__more" id="pv-more-${it.key}" hidden>
                  <div class="pv-row__inner">
                    <p class="pv-state">演示状态：<b>关闭</b></p>
                    <div class="pv-kv">
                      <p class="pv-k">它真正影响什么</p>
                      <p class="pv-v">${it.effect}</p>
                    </div>
                    <div class="pv-kv pv-kv--truth">
                      <p class="pv-k">真相</p>
                      <p class="pv-v">${it.truth}</p>
                    </div>
                  </div>
                </div>
              </li>`).join('')}
          </ul>
          <div class="pv-window__foot">
            <span>已拨动 <b class="pv-count">0</b> 次</span>
            <span class="pv-sep" aria-hidden="true"></span>
            <span>门牌号：<b class="text-safe">一次也没变</b></span>
          </div>
        </div>

        <figure class="pv-house">
          ${houseSVG()}
          <figcaption>
            <span class="pv-house__cap">四扇窗跟着四个开关亮灭。门上的门牌号，一直是那一块。</span>
            <span class="tiny faint">设置项的名称和默认值可能变化，以你本人账户页面为准。</span>
          </figcaption>
        </figure>
      </div>

      <div class="pv-after" data-reveal="stagger">
        <div class="pv-sent card card--flat">
          <svg class="pv-sent__art" viewBox="0 0 240 120" aria-hidden="true">
            <path d="M18 92 L48 68 L78 92 V112 H18 Z" fill="#141824" stroke="rgba(244,239,230,.25)" stroke-width="1.5" stroke-linejoin="round"/>
            <rect x="40" y="96" width="14" height="16" rx="2" fill="#07080c" stroke="rgba(255,179,92,.45)"/>
            <path class="pv-sent__path" d="M60 70 C 110 20, 160 20, 214 40" fill="none" stroke="rgba(255,179,92,.55)" stroke-width="1.6" stroke-dasharray="3 6" stroke-linecap="round"/>
            <g class="pv-sent__box" transform="translate(206 30)">
              <rect x="-12" y="-9" width="24" height="18" rx="3" fill="#ffc070" stroke="#ff7a52"/>
              <path d="M-12 -3 H12 M0 -9 V9" stroke="#7a3a14" stroke-width="1.4"/>
            </g>
            <g transform="translate(96 96)">
              <rect x="-16" y="-10" width="32" height="20" rx="3" fill="none" stroke="rgba(244,239,230,.35)" stroke-dasharray="3 3"/>
              <path d="M-22 -14 L22 14" stroke="#ff4d61" stroke-width="2" stroke-linecap="round"/>
            </g>
          </svg>
          <div>
            <h3 class="h4">本地清理，撤不回远端数据</h3>
            <p class="muted">删掉家里的寄件底单，撤不回已经寄出去的包裹。删除本地日志，撤不回已经发送的事件，也不能保证以后不再生成。</p>
            <p class="muted">清理队列前先留备份，别去移动正在写入的文件。<strong>优先控制发送行为和出口路径。</strong></p>
          </div>
        </div>
      </div>

      <div class="pro-only pv-pro">
        <div class="pv-pro__head">
          <span class="pro-badge">进阶</span>
          <h3 class="h3">可选隐私配置</h3>
          <p class="muted">三个变量管的范围不同：遥测、错误报告、非必要流量。第三个更广，可能影响 Remote Control 等能力，所以原版把它注释掉了。</p>
        </div>
        <div class="pv-scope" aria-hidden="true">
          <span class="pv-scope__c"><code>DISABLE_TELEMETRY</code><em>遥测</em></span>
          <span class="pv-scope__c"><code>DISABLE_ERROR_REPORTING</code><em>错误报告</em></span>
          <span class="pv-scope__c pv-scope__c--wide"><code>CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC</code><em>非必要流量 · 更广</em></span>
        </div>
        ${codeBlock({ code: CODE, lang: 'bash', title: '可选隐私配置', note: '配置示例 · 不替代网络防火墙' })}
        <p class="small muted pv-pro__note">遥测、错误报告与非必要流量的范围不同；查阅 <a class="pv-link" href="https://code.claude.com/docs/en/data-usage" target="_blank" rel="noopener noreferrer">Claude Code 数据使用说明</a> 后，验证需要的功能是否仍可用。设置后核对真实进程是否读取，包括后台宿主；已运行会话不自动继承新 shell 的环境。</p>
      </div>
    </div>`

    reveal(el)
    enhanceCodeBlocks(el)
    initSwitches(el)
  },
}

function initSwitches(el) {
  const rows = [...el.querySelectorAll('.pv-row')]
  const wins = [...el.querySelectorAll('.pv-win')]
  const plate = el.querySelector('.pv-plate')
  const countEl = el.querySelector('.pv-count')
  let count = 0

  rows.forEach((row, i) => {
    const sw = row.querySelector('.pv-switch')
    const knob = sw.querySelector('.pv-switch__knob')
    const more = row.querySelector('.pv-row__more')
    const state = row.querySelector('.pv-state b')

    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true'
      sw.setAttribute('aria-checked', String(on))
      row.classList.toggle('is-on', on)
      wins[i].classList.toggle('is-on', on)
      state.textContent = on ? '开启' : '关闭'
      audio.sfx(on ? 'toggle-on' : 'toggle-off')
      count++
      countEl.textContent = String(count)

      const travel = sw.querySelector('.pv-switch__track').clientWidth - knob.offsetWidth - 6
      if (prefersReduced) {
        gsap.set(knob, { x: on ? travel : 0 })
      } else {
        // 弹簧：先压扁，再带回弹地滑过去
        gsap.timeline()
          .to(knob, { scaleX: 1.35, scaleY: 0.86, duration: 0.12, ease: 'power2.out' })
          .to(knob, { x: on ? travel : 0, duration: 0.7, ease: 'elastic.out(1, 0.5)' }, 0.04)
          .to(knob, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 0.12)
        gsap.fromTo(countEl, { scale: 1.5 }, { scale: 1, duration: 0.6, ease: 'expo.out' })
        gsap.fromTo(plate, { scale: 1 }, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '104px 246px' })
      }

      // 第一次拨动时展开说明，之后保持展开
      if (more.hidden) {
        more.hidden = false
        audio.sfx('open')
        if (!prefersReduced) {
          gsap.fromTo(more, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.8, ease: 'expo.out', clearProps: 'height' })
          gsap.from(more.querySelectorAll('.pv-state, .pv-kv'), { y: 14, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07, delay: 0.08 })
        }
      } else if (!prefersReduced) {
        gsap.fromTo(state, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out' })
      }
    })
  })

  // 窗口大小变化时，已开启的拨杆重新对位
  window.addEventListener('resize', () => {
    rows.forEach((row) => {
      const sw = row.querySelector('.pv-switch')
      if (sw.getAttribute('aria-checked') !== 'true') return
      const knob = sw.querySelector('.pv-switch__knob')
      gsap.set(knob, { x: sw.querySelector('.pv-switch__track').clientWidth - knob.offsetWidth - 6 })
    })
  }, { passive: true })
}

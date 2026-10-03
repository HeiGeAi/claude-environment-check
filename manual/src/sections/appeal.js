// 万一被限制：冷静的四步 + 一封只讲事实的申诉信
import './appeal.css'
import { gsap, reveal, onEnter, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { toast, copyText, esc } from '../core/ui.js'
import { mascot } from '../core/mascot.js'

const APPEAL_URL = 'https://support.claude.com/en/articles/8241253-safeguards-warnings-and-appeals'

// 原版英文模板，逐字照搬（复制时原样输出）
const TEMPLATE = [
  { en: 'Hello, my account was restricted on [date and timezone].', zh: '你好，我的账号在［日期和时区］被限制了。' },
  { en: 'The exact message was: [copy the complete notice].', zh: '提示的原话是：［粘贴完整的提示内容］。' },
  { en: 'I use Claude for [your actual work].', zh: '我用 Claude 来做［你实际在做的工作］。' },
  { en: 'Recent device or network changes: [facts, or none known].', zh: '最近设备或网络的变化：［写事实；确实不知道就写 none known］。' },
  { en: 'Could you review this restriction and explain what information is needed?', zh: '能否复核这次限制，并告诉我需要提供哪些信息？' },
  { en: 'I can provide relevant, redacted evidence through the official support channel.', zh: '我可以通过官方支持渠道，提供相关的、已脱敏的证据。' },
  { en: 'Thank you.', zh: '谢谢。' },
]
const TEMPLATE_TEXT = TEMPLATE.map((l) => l.en).join('\n')

// 原版「工作背景示例」3 句，逐字
const INTRO = [
  '我是用 Claude 做编程、写作和日常排障的开发者。',
  '请默认使用简体中文，代码、命令和必要术语保留英文。',
  '不确定的信息请明确说明，并提供可以验证的步骤。',
]

const ICONS = {
  note: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="4.5" width="18" height="23" rx="3"/><path d="M11.5 11h9M11.5 15.5h9M11.5 20h5"/><circle cx="23.5" cy="23.5" r="5" class="fill-bg"/><path d="M23.5 21v2.6l1.8 1.1"/></svg>',
  sort: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 8h22M5 16h14M5 24h8"/><circle cx="24" cy="21" r="4.5"/><path d="M27.2 24.2 30 27"/></svg>',
  letter: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="8" width="24" height="17" rx="3"/><path d="m5 10 11 8 11-8"/></svg>',
  ticket: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 10a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v3a3 3 0 0 0 0 6v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3a3 3 0 0 0 0-6z"/><path d="M13 8v16" stroke-dasharray="2 3"/><path d="M17 13h6M17 18h4"/></svg>',
}

const STEPS = [
  { icon: 'note', title: '先留证据', text: '保存完整错误提示、时间与时区、客户端版本和近期变更。', hint: '截图、原话、几点几分，都记下来。' },
  { icon: 'sort', title: '分清是哪种问题', text: '区分网络故障、服务故障、登录失效、额度限制与正式账户限制。', chips: ['网络故障', '服务故障', '登录失效', '额度限制', '正式账户限制'] },
  { icon: 'letter', title: '走官方入口', text: '从官方支持入口申请复核，陈述实际用途和事实，不编造信息。', hint: '只写真实发生的事。' },
  { icon: 'ticket', title: '留好工单号', text: '保留工单编号；不要把凭据交给所谓「解封服务」。', hint: '账号密码和登录凭据，只留在你自己手里。' },
]

// 把 [占位] 包成高亮小块
const markSlots = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<span class="ap-slot">[$1]</span>').replace(/［([^］]+)］/g, '<span class="ap-slot ap-slot--zh">［$1］</span>')

export default {
  id: 'appeal',
  nav: '万一被限制',
  desc: '申诉时只讲事实',
  mood: 'calm',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head ap-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>万一被限制</span></div>
        <h2 class="h2" data-reveal="lines">真被限制了，<br><span class="text-warm">先稳住，只讲事实。</span></h2>
        <p class="lead" data-reveal>账号会不会被限制，由 Anthropic 决定。出了事别慌，也别找偏门。按四步走，把事实讲清楚。</p>
        <div class="metaphor ap-metaphor" data-reveal><span>账号身份像你在对方那里的<strong>档案</strong>。被限制，就是档案先被冻结了。能做的是写一封<strong>说明信</strong>，从正门递进去，留好<strong>回执</strong>。</span></div>
      </header>

      <div class="ap-grid">
        <ol class="ap-steps" data-reveal="stagger" aria-label="出现账号限制时的四步">
          ${STEPS.map((s, i) => `
          <li class="ap-step">
            <div class="ap-step__rail" aria-hidden="true"><span class="ap-step__icon">${ICONS[s.icon]}</span></div>
            <div class="ap-step__body">
              <div class="ap-step__n">0${i + 1}</div>
              <h3 class="ap-step__title">${s.title}</h3>
              <p class="ap-step__text">${s.text}</p>
              ${s.chips ? `<div class="ap-chips" aria-label="五种不同的情况">${s.chips.map((c, j) => `<span class="ap-chip${j === 4 ? ' is-key' : ''}">${c}</span>`).join('')}</div><p class="ap-step__hint">先认准是哪一种，再决定下一步。</p>` : `<p class="ap-step__hint">${s.hint}</p>`}
            </div>
          </li>`).join('')}
        </ol>

        <div class="ap-desk">
          <div class="ap-desk__mascot" aria-hidden="true">
            <span class="ap-face ap-face--worried">${mascot({ size: 96, face: 'worried' })}</span>
            <span class="ap-face ap-face--calm">${mascot({ size: 96, face: 'idle' })}</span>
          </div>
          <div class="ap-letterbox">
            <div class="ap-envelope" aria-hidden="true">
              <svg viewBox="0 0 400 150" preserveAspectRatio="none"><path class="ap-envelope__back" d="M8 12h384v130H8z"/><path class="ap-envelope__fold" d="M8 142 200 58l192 84"/></svg>
            </div>
            <article class="ap-letter" aria-labelledby="ap-letter-title">
              <div class="ap-letter__top">
                <div>
                  <div class="ap-letter__label">英文申诉模板</div>
                  <h3 class="ap-letter__title" id="ap-letter-title">一封只讲事实的信</h3>
                </div>
                <div class="ap-letter__tools">
                  <div class="segmented ap-seg" role="group" aria-label="显示方式">
                    <button type="button" data-view="both" aria-pressed="true" data-sfx="click">中英对照</button>
                    <button type="button" data-view="en" aria-pressed="false" data-sfx="click">只看英文</button>
                  </div>
                </div>
              </div>
              <ol class="ap-lines">
                ${TEMPLATE.map((l, i) => `
                <li class="ap-line" style="--i:${i}">
                  <span class="ap-line__en" lang="en">${markSlots(l.en)}</span>
                  <span class="ap-line__zh">${markSlots(l.zh)}</span>
                </li>`).join('')}
              </ol>
              <div class="ap-letter__foot">
                <p class="ap-letter__note">中文仅供理解。提交时用英文原文，并按真实情况替换方括号里的内容。</p>
                <button class="btn btn--primary btn--sm ap-copy" type="button" data-copy="template">复制英文原文</button>
              </div>
              <div class="ap-postmark" aria-hidden="true">
                <svg viewBox="0 0 120 120">
                  <defs><path id="ap-ring" d="M60 60m-43 0a43 43 0 1 1 86 0a43 43 0 1 1-86 0"/></defs>
                  <circle cx="60" cy="60" r="54"/><circle cx="60" cy="60" r="33"/>
                  <text><textPath href="#ap-ring" startOffset="0" textLength="262" lengthAdjust="spacing">OFFICIAL SUPPORT · FACTS ONLY ·</textPath></text>
                  <text x="60" y="57" text-anchor="middle" class="ap-postmark__big">只讲</text>
                  <text x="60" y="76" text-anchor="middle" class="ap-postmark__big">事实</text>
                </svg>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div class="ap-bottom">
        <div class="ap-intro card card--flat" data-reveal>
          <div class="ap-intro__head">
            <span class="tag tag--warm">可选文字 · 无防封效力</span>
            <h3 class="h4">需要开场白，只说真实用途</h3>
            <p class="small muted">想让 Claude 先了解你的工作背景，写真实的用途就够了。下面是原版的工作背景示例。</p>
          </div>
          <blockquote class="ap-intro__paper">
            ${INTRO.map((s) => `<p>${s}</p>`).join('')}
          </blockquote>
          <button class="btn btn--ghost btn--sm ap-copy" type="button" data-copy="intro">复制示例</button>
        </div>

        <a class="ap-official card card--warm card--hover" href="${APPEAL_URL}" target="_blank" rel="noopener noreferrer" data-reveal data-sfx="click">
          <span class="ap-official__kicker">官方入口</span>
          <span class="ap-official__title">官方警告与申诉说明</span>
          <span class="ap-official__url">support.claude.com</span>
          <span class="ap-official__arrow" aria-hidden="true">↗</span>
          <span class="ap-official__foot">申诉走这里。账号结果由 Anthropic 决定，这份指南没有免封保证。</span>
        </a>
      </div>
    </div>`

    const letterbox = el.querySelector('.ap-letterbox')
    const letter = el.querySelector('.ap-letter')
    const lines = el.querySelectorAll('.ap-line')
    const postmark = el.querySelector('.ap-postmark')
    const desk = el.querySelector('.ap-desk')

    // 显示方式切换
    const seg = el.querySelector('.ap-seg')
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]')
      if (!b) return
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      letter.classList.toggle('is-en', b.dataset.view === 'en')
    })

    // 复制
    el.querySelectorAll('.ap-copy').forEach((btn) => {
      const label = btn.textContent
      btn.addEventListener('click', async () => {
        const text = btn.dataset.copy === 'template' ? TEMPLATE_TEXT : INTRO.join('\n')
        const ok = await copyText(text)
        audio.sfx(ok ? 'copy' : 'error')
        btn.textContent = ok ? '已复制' : '复制失败'
        toast(ok ? (btn.dataset.copy === 'template' ? '已复制英文原文。记得替换方括号里的内容' : '已复制示例文字') : '复制失败，请手动选中文本')
        setTimeout(() => { btn.textContent = label }, 1800)
      })
    })

    // 入场：信从信封里抽出，一行行写上，最后盖上邮戳；小请求从担心变平静
    const settle = () => desk.classList.add('is-calm')
    if (prefersReduced) {
      letterbox.classList.add('is-open')
      settle()
    } else {
      gsap.set(letter, { yPercent: 18, opacity: 0 })
      gsap.set(lines, { opacity: 0, y: 10 })
      gsap.set(postmark, { opacity: 0, scale: 1.8, rotate: -28 })
      onEnter(letterbox, () => {
        letterbox.classList.add('is-open')
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
        tl.call(() => audio.sfx('open'))
          .to(letter, { yPercent: 0, opacity: 1, duration: 1.2 }, 0.1)
          .to(lines, { opacity: 1, y: 0, duration: 0.9, stagger: 0.09 }, 0.45)
          .call(() => audio.sfx('pop'), null, 1.35)
          .to(postmark, { opacity: 1, scale: 1, rotate: -12, duration: 0.5, ease: 'back.out(2.2)' }, 1.35)
          .call(settle, null, 1.6)
      }, { start: 'top 72%' })
    }

    reveal(el)
  },
}

// 来源与边界：整理说明、官方资料、本页承诺，以及整站的收尾夜景
import './sources.css'
import { gsap, reveal, onEnter, whenVisible, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { mascot } from '../core/mascot.js'

const LINKS = [
  { t: 'Claude Code · Network configuration', d: '代理支持、域名依赖与后台启动范围。', u: 'https://code.claude.com/docs/en/network-config', tag: '官方' },
  { t: 'Claude Code · Data usage', d: '隐私、遥测与错误报告。', u: 'https://code.claude.com/docs/en/data-usage', tag: '官方' },
  { t: 'mihomo · 路由规则', d: '域名、进程、路径与匹配顺序。', u: 'https://wiki.metacubex.one/config/rules/', tag: '文档' },
  { t: 'mihomo · TUN', d: '路由接管、DNS、IPv6 和平台差异。', u: 'https://wiki.metacubex.one/config/inbound/tun/', tag: '文档' },
  { t: 'nftables · Configuring chains', d: 'output hook 与默认 drop。', u: 'https://wiki.nftables.org/wiki-nftables/index.php/Configuring_chains', tag: '文档' },
  { t: 'MDN · WebGL renderer information', d: '图形环境可见性与隐私限制。', u: 'https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info', tag: '参考' },
  { t: 'Claude Support · Warnings and appeals', d: '账户限制后的官方说明。', u: 'https://support.claude.com/en/articles/8241253-safeguards-warnings-and-appeals', tag: '官方' },
]
const host = (u) => u.replace(/^https?:\/\//, '').split('/')[0]

const PLEDGE_ICONS = {
  offline: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 13.5 16 6l10 7.5V26H6z"/><path d="M13 26v-7h6v7"/><path d="M3 29 29 3" class="cut"/></svg>',
  track: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z"/><circle cx="16" cy="16" r="3.5"/><path d="M5 27 27 5" class="cut"/></svg>',
  font: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="6" width="22" height="20" rx="3"/><path d="m8 22 6-7 4 4 3-3 3 4"/><circle cx="21" cy="11.5" r="2"/></svg>',
  probe: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="3"/><path d="M9.5 9.5a9 9 0 0 0 0 13M22.5 9.5a9 9 0 0 1 0 13"/><path d="M5 5a15 15 0 0 0 0 22M27 5a15 15 0 0 1 0 22" opacity=".5"/><path d="M4 28 28 4" class="cut"/></svg>',
}
const PLEDGES = [
  { i: 'offline', t: '静态手册', d: '本版包含独立的字体和脚本资源。下载完整静态包后通过本地服务阅读。' },
  { i: 'track', t: '无埋点', d: '不统计你看了什么，也不上报。' },
  { i: 'font', t: '无外部字体和远程图片', d: '字体、插图随静态包提供，阅读手册无需加载第三方资源。' },
  { i: 'probe', t: '不自动探测', d: '阅读手册不发网络探针。环境检测页会先说明测试范围，再由您点击运行；第三方服务会看到出口 IP。' },
]

// 收尾夜景：一排小房子，窗户亮着暖灯
function town() {
  const houses = [
    [20, 70, 58], [96, 54, 84], [158, 80, 50], [246, 60, 96], [314, 90, 64], [412, 64, 78], [484, 76, 56],
    [676, 70, 60], [754, 58, 90], [820, 84, 54], [912, 62, 80], [982, 88, 62], [1078, 60, 86], [1146, 70, 54],
  ]
  let win = 0
  const body = houses.map(([x, w, h]) => {
    const y = 220 - h
    const roof = `M${x - 4} ${y + 2} L${x + w / 2} ${y - 22} L${x + w + 4} ${y + 2}`
    const wins = []
    for (let wy = y + 16; wy < 208; wy += 22) {
      for (let wx = x + 12; wx < x + w - 14; wx += 20) {
        wins.push(`<rect class="so-win" x="${wx}" y="${wy}" width="9" height="11" rx="1.5" style="--d:${((win++ * 0.73) % 5).toFixed(2)}s"/>`)
      }
    }
    return `<path class="so-roof" d="${roof}"/><rect class="so-house" x="${x}" y="${y}" width="${w}" height="${h}"/>${wins.join('')}`
  }).join('')
  let stars = ''
  for (let i = 0; i < 46; i++) {
    const x = (i * 263.7) % 1200
    const y = 12 + ((i * 97.3) % 110)
    const r = i % 7 === 0 ? 1.6 : 0.9
    stars += `<circle class="so-star" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" style="--d:${((i * 0.37) % 4).toFixed(2)}s"/>`
  }
  return `<svg class="so-town" viewBox="0 0 1200 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="so-path" x1="0" x2="1"><stop offset="0" stop-color="#ffd08a" stop-opacity="0"/><stop offset=".5" stop-color="#ffb35c"/><stop offset="1" stop-color="#ff7a52" stop-opacity="0"/></linearGradient>
      <radialGradient id="so-door" cx="50%" cy="100%" r="80%"><stop offset="0" stop-color="#ffd08a" stop-opacity=".9"/><stop offset="1" stop-color="#ff7a52" stop-opacity="0"/></radialGradient>
    </defs>
    ${stars}
    <ellipse cx="600" cy="206" rx="170" ry="34" fill="url(#so-door)" opacity=".45"/>
    ${body}
    <path class="so-gate" d="M566 220v-54a34 34 0 0 1 68 0v54"/>
    <path class="so-ground" d="M0 220.5h1200"/>
    <path class="so-road" d="M40 232 H1160"/>
  </svg>`
}

export default {
  id: 'sources',
  nav: '来源与边界',
  desc: '方法可复核，隐私留本地',
  mood: 'triumph',
  mount(el, { num }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>来源与边界</span></div>
        <h2 class="h2" data-reveal="lines">方法要能复核，<br><span class="text-warm">示例要能辨认。</span></h2>
        <p class="lead" data-reveal>这一页交代三件事：内容从哪来，去哪里核对，这个页面自己守什么规矩。</p>
      </header>

      <div class="so-colophon" data-reveal>
        <div class="so-colophon__label">整理说明</div>
        <div class="so-colophon__body">
          <p class="so-colophon__main">改编自「智能体先锋队」《Claude 防护方法手册 · 本机实战版 v3.0》。</p>
          <dl class="so-meta">
            <div><dt>整理人</dt><dd>黑哥 · <a class="so-curator-link" href="https://www.heigeai.com" target="_blank" rel="noopener noreferrer">www.heigeai.com</a></dd></div>
            <div><dt>整理日期</dt><dd>2026.09.26</dd></div>
            <div><dt>基于</dt><dd>个人经验版 v2.5 与实际网络维护经验</dd></div>
            <div><dt>本版</dt><dd>小白图解版，用比喻和动画重新讲一遍</dd></div>
          </dl>
          <p class="so-colophon__warn">技术文档、客户端与网络环境持续变化，部署前再次核对版本。</p>
          <p class="so-colophon__stamp"><span>本页没有提供任何免封承诺。</span></p>
        </div>
      </div>

      <div class="so-links">
        <div class="so-links__head">
          <h3 class="h3" data-reveal>去源头核对</h3>
          <p class="small muted" data-reveal>官方与公开文档。点开会离开本页，在新标签打开。</p>
        </div>
        <ol class="so-list" data-reveal="stagger">
          ${LINKS.map((l, i) => `
          <li><a class="so-link" href="${l.u}" target="_blank" rel="noopener noreferrer" data-sfx="click" data-sfx-hover="hover">
            <span class="so-link__n">${String(i + 1).padStart(2, '0')}</span>
            <span class="so-link__main"><span class="so-link__t" lang="en">${l.t}</span><span class="so-link__d">${l.d}</span></span>
            <span class="so-link__host">${host(l.u)}</span>
            <span class="so-link__tag">${l.tag}</span>
            <span class="so-link__arrow" aria-hidden="true">↗</span>
          </a></li>`).join('')}
        </ol>
      </div>

      <div class="so-pledge">
        <div class="so-pledge__head">
          <h3 class="h3" data-reveal>这个页面的承诺</h3>
          <p class="small muted" data-reveal>页面里的演示只讲逻辑，不充当真实网络验收。</p>
        </div>
        <ul class="so-pledge__grid" data-reveal="stagger">
          ${PLEDGES.map((p) => `<li class="so-pledge__item"><span class="so-pledge__icon">${PLEDGE_ICONS[p.i]}</span><b>${p.t}</b><span>${p.d}</span></li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="so-finale">
      <div class="so-sky" aria-hidden="true"></div>
      <div class="wrap so-finale__inner">
        <p class="so-finale__kicker" data-reveal>如果只记住一句话</p>
        <p class="so-motto" aria-label="连不上，可以。真实 IP 直连，不行。">
          <span class="so-motto__line so-motto__line--a" aria-hidden="true"><span class="w">连不上，</span><span class="w so-ok">可以。</span></span>
          <span class="so-motto__line so-motto__line--b" aria-hidden="true"><span class="w">真实 IP 直连，</span><span class="w so-no">不行。<i class="so-no__stamp"></i></span></span>
        </p>
        <p class="so-finale__sub" data-reveal>账号结果由 Anthropic 决定。路径，由你把关。</p>
        <div class="so-hero">
          <span class="so-hero__m">${mascot({ size: 112, face: 'happy' })}</span>
          <span class="so-hero__wave" aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
        <a class="btn btn--primary so-top" href="#hero" data-jump="#hero" data-sfx="whoosh">回到开头 <span class="arrow" aria-hidden="true">↑</span></a>
      </div>
      ${town()}
      <footer class="so-foot">
        <p class="so-foot__line">方法留给你，隐私留在本地。</p>
        <p class="so-foot__curator">整理人：黑哥 · <a href="https://www.heigeai.com" target="_blank" rel="noopener noreferrer">www.heigeai.com</a></p>
        <p class="so-foot__small">原版署名：智能体先锋队 · 小白图解版改编</p>
      </footer>
    </div>`

    const finale = el.querySelector('.so-finale')
    const lineA = el.querySelector('.so-motto__line--a')
    const lineB = el.querySelector('.so-motto__line--b')
    const ok = el.querySelector('.so-ok')
    const no = el.querySelector('.so-no')
    const hero = el.querySelector('.so-hero')

    // 离屏时暂停夜景里的闪烁动画
    whenVisible(finale, () => finale.classList.add('is-live'), () => finale.classList.remove('is-live'), '0px')

    if (prefersReduced) {
      finale.classList.add('is-done')
    } else {
      gsap.set([lineA, lineB], { yPercent: 100, opacity: 0 })
      gsap.set(hero, { y: 40, opacity: 0, scale: 0.8 })
      onEnter(el.querySelector('.so-motto'), () => {
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
        tl.to(lineA, { yPercent: 0, opacity: 1, duration: 1.2 })
          .call(() => { ok.classList.add('is-lit'); audio.sfx('success') }, null, 0.55)
          .to(lineB, { yPercent: 0, opacity: 1, duration: 1.2 }, 0.8)
          .call(() => { no.classList.add('is-stamped'); audio.sfx('gate') }, null, 1.45)
          .fromTo(no, { scale: 1.12 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' }, 1.45)
          .to(hero, { y: 0, opacity: 1, scale: 1, duration: 1, ease: 'back.out(1.8)' }, 2)
          .call(() => { finale.classList.add('is-done'); audio.sfx('chord') }, null, 2.2)
      }, { start: 'top 78%' })
    }

    // 滚动时夜空轻微视差
    if (!prefersReduced) {
      gsap.to(el.querySelector('.so-town'), { yPercent: -6, ease: 'none', scrollTrigger: { trigger: finale, start: 'top bottom', end: 'bottom bottom', scrub: true } })
    }

    reveal(el)
  },
}

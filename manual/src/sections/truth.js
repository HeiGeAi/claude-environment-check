// 01 先说实话：这份指南能做什么、不能做什么，以及全站的核心原则
import './truth.css'
import { gsap, reveal, onEnter, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { mascot } from '../core/mascot.js'

const svg = (d, size = 20, w = 1.8) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

const ICON = {
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 2.2),
  cross: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 18, 2.2),
  house: svg('<path d="M4 11l8-6.5 8 6.5v9H4z"/><path d="M10 20v-5.5h4V20"/>'),
  sign: svg('<rect x="4" y="4" width="16" height="9" rx="1.5"/><path d="M12 13v7M8 8.5h6.5M12.5 6.5l2 2-2 2"/>'),
  eye: svg('<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M4.5 4.5l15 15"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M9 9.2a1.8 1.8 0 1 1 2.4 1.7c-.6.2-.9.6-.9 1.2"/><circle cx="10.5" cy="14" r=".4" fill="currentColor"/>'),
  doc: svg('<path d="M6 3h8.5L18 6.5V21H6z"/><path d="M14 3v4h4M9 11h6M9 14.5h6M9 18h3"/>'),
  tag: svg('<path d="M3.5 12.2V4h8.2l8.8 8.8-8.2 8.2z"/><circle cx="8" cy="8.5" r="1.5"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 18, 2),
}

// 章节号与短名从已装配的 DOM 里读，章节顺序调整后也不会写错
function chap(id) {
  const el = document.getElementById(id)
  return { num: el?.dataset.num || '', nav: el?.getAttribute('aria-label') || '' }
}

export default {
  id: 'truth',
  nav: '先说实话',
  desc: '这份指南能做什么、不能做什么',
  mood: 'calm',
  mount(el, { num }) {
    const modes = chap('modes')
    const fix = chap('fix')
    const checklist = chap('checklist')
    const inks = Array.from({ length: 12 }, () => '<i></i>').join('')

    el.innerHTML = `
<div class="wrap">
  <header class="chapter-head">
    <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>先说实话</span></div>
    <h2 class="h2" data-reveal="lines">出发之前，<br>先说几句<span class="text-warm">实话</span></h2>
    <p class="lead" data-reveal>这份指南能帮你做什么、做不到什么，先讲清楚。</p>
  </header>

  <!-- 1. 诚实提醒 -->
  <figure class="t-honest">
    <div class="t-honest__main">
      <span class="t-honest__mark" aria-hidden="true">「</span>
      <blockquote class="t-honest__quote" data-reveal="lines">以下经验也许有用，<br>也许毫无用处。</blockquote>
      <figcaption class="t-honest__cap" data-reveal>原版手册的开场白</figcaption>
    </div>
    <div class="t-honest__note" data-reveal data-delay="0.15">
      <div class="t-honest__who">${mascot({ size: 64, face: 'worried' })}<span>小请求想先提醒你</span></div>
      <p><b>账号会不会被限制，由 Anthropic 决定。</b></p>
      <p>这份指南<span class="t-hl">没有任何免封保证</span>。我们只把自己能控制的环节做好。</p>
    </div>
  </figure>

  <!-- 2 + 3. 能 / 不能 -->
  <div class="t-split">
    <div class="t-split__head">
      <h3 class="h3" data-reveal>把「防封」拆成两个问题</h3>
      <p class="muted" data-reveal>左边是这份指南能帮你做好的事。右边是谁也替你做不到的事。</p>
    </div>
    <div class="t-split__grid">
      <section class="t-col t-col--can" aria-label="能帮你做的">
        <div class="t-col__label"><span class="t-col__badge">${ICON.check}</span>能帮你做的</div>
        <ul class="t-col__list" data-reveal="stagger">
          <li><span class="t-col__ic">${ICON.house}</span><div><b>减少意外直连</b><span>包裹别从自家门口直接寄出，门牌号不外露。</span></div></li>
          <li><span class="t-col__ic">${ICON.sign}</span><div><b>防止配置漂移</b><span>门口那张「请走代收点」的告示，别被悄悄换掉。</span></div></li>
          <li><span class="t-col__ic">${ICON.eye}</span><div><b>少暴露不必要的信息</b><span>用不着带出门的东西，就别带出门。</span></div></li>
        </ul>
      </section>

      <div class="t-seam" aria-hidden="true"><span>边界</span></div>

      <section class="t-col t-col--cannot" aria-label="做不到的">
        <div class="t-col__label"><span class="t-col__badge">${ICON.cross}</span>做不到的</div>
        <ul class="t-col__list" data-reveal="stagger">
          <li><span class="t-col__ic">${ICON.search}</span><div><b>推断 Anthropic 的全部风控规则</b><span>对方怎样判断，我们看不到全貌。</span></div></li>
          <li><span class="t-col__ic">${ICON.doc}</span><div><b>承诺账号不被限制</b><span>结果由 Anthropic 决定，谁也没法替它签字。</span></div></li>
          <li><span class="t-col__ic">${ICON.tag}</span><div><b>拿某个标签当护身符</b><span>住宅标签、信任分、时区一致，都不是免封凭证。</span></div></li>
        </ul>
        <div class="t-void">
          <span class="t-void__word" aria-hidden="true">免封<svg class="t-void__strike" viewBox="0 0 300 100" preserveAspectRatio="none"><path pathLength="1" d="M4 54 C 60 34, 118 66, 176 44 S 262 36, 296 48"/></svg></span>
          <p class="t-void__note"><b>这份指南不提供免封保证。</b><br>看到谁这样承诺，都要多留个心眼。</p>
        </div>
      </section>
    </div>
  </div>
</div>

<!-- 4. 核心原则：滚动驱动的大字排版 -->
<div class="t-motto" role="group" aria-label="核心原则：连不上，可以。真实 IP 直连，不行。">
  <div class="t-motto__stage wrap">
    <p class="t-motto__kicker"><span class="latin">The rule</span><span class="bar"></span>核心原则，全站都按这一句办事</p>
    <p class="t-line t-line--ok" aria-hidden="true">
      <span class="t-fill t-w">连不上，</span><span class="t-fill t-ok">可以。<svg class="t-ok__tick" viewBox="0 0 40 40"><path pathLength="1" d="M8 21l8 8L33 11"/></svg></span>
      <span class="t-anno t-anno--ok">
        <span class="t-anno__pic"><span class="t-anno__a">${mascot({ size: 76, face: 'idle', tint: 'ghost' })}</span><span class="t-anno__b">${mascot({ size: 76, face: 'happy', tint: 'safe' })}</span></span>
        <span class="t-anno__cap">代收点关门了，<br>就在家等着</span>
      </span>
    </p>
    <p class="t-line t-line--no" aria-hidden="true">
      <span class="t-anno t-anno--no">
        <span class="t-anno__pic"><span class="t-anno__a">${mascot({ size: 76, face: 'idle', tint: 'ghost' })}</span><span class="t-anno__b">${mascot({ size: 76, face: 'leak', tint: 'danger' })}</span></span>
        <span class="t-anno__cap">从自家门口溜出去，<br>门牌号就露了</span>
      </span>
      <span class="t-fill t-w">真实 IP 直连，</span><span class="t-no"><span class="t-fill t-no__under">不行。</span><span class="t-stamp">不行</span><span class="t-ink">${inks}</span></span>
    </p>
    <ol class="t-explain">
      <li><span class="t-explain__n">1</span>被保护的程序，只能从受控的代理出口出门。</li>
      <li><span class="t-explain__n">2</span>一旦确认不了路径，就停止联网。</li>
      <li><span class="t-explain__n">3</span>账号会不会被封，是另一件事。</li>
    </ol>
  </div>
</div>

<div class="wrap">
  <div class="t-after">
    <div class="metaphor" data-reveal><span>代收点关门时，包裹<strong>宁可不寄</strong>，也不从自家门口寄。连不上只是暂时用不了；门牌号一旦露出去，就收不回来了。</span></div>
    <div class="pro-only t-pro pro-block" data-reveal>
      <span class="pro-badge">进阶</span>
      <p><b>落到工程上的设计目标：</b>被保护进程 → 受控代理；其他出口 → 拒绝。</p>
      <p>禁止自动退回 <code>DIRECT</code>；新域名也不能获得例外。代理自身拥有最小的上游连接权限，业务进程没有直接访问物理网络的权限。</p>
    </div>
  </div>

  <!-- 5. 三种读法 -->
  <div class="t-paths">
    <div class="t-paths__head">
      <h3 class="h3" data-reveal>三种读法，挑一张票</h3>
      <p class="muted" data-reveal>按你现在的情况选。点一下，直接去对应章节。</p>
    </div>
    <div class="t-tickets" data-reveal="stagger">
      <a class="t-ticket t-ticket--build" href="#modes" data-jump="#modes" data-sfx="click">
        <span class="t-ticket__in">
          <span class="t-ticket__stub"><span class="t-ticket__time">30<small>至</small>60</span><span class="t-ticket__unit">分钟</span></span>
          <span class="t-ticket__body">
            <span class="t-ticket__who">第一次搭建</span>
            <span class="t-ticket__hint">预留时间阅读与配置</span>
            <span class="t-ticket__route"><i>选接入方式</i><i>配规则</i><i>验证</i></span>
            <span class="t-ticket__go">去 ${modes.num} · ${modes.nav} ${ICON.arrow}</span>
          </span>
        </span>
      </a>
      <a class="t-ticket t-ticket--fix" href="#fix" data-jump="#fix" data-sfx="click">
        <span class="t-ticket__in">
          <span class="t-ticket__stub"><span class="t-ticket__time">5</span><span class="t-ticket__unit">分钟定位</span></span>
          <span class="t-ticket__body">
            <span class="t-ticket__who">已经出问题</span>
            <span class="t-ticket__hint">先止损，再判断</span>
            <span class="t-ticket__route"><i>先停业务</i><i>看故障表</i><i>留证</i></span>
            <span class="t-ticket__go">去 ${fix.num} · ${fix.nav} ${ICON.arrow}</span>
          </span>
        </span>
      </a>
      <a class="t-ticket t-ticket--daily" href="#checklist" data-jump="#checklist" data-sfx="click">
        <span class="t-ticket__in">
          <span class="t-ticket__stub"><span class="t-ticket__time">2</span><span class="t-ticket__unit">分钟</span></span>
          <span class="t-ticket__body">
            <span class="t-ticket__who">每天开工</span>
            <span class="t-ticket__hint">异常项另行处理</span>
            <span class="t-ticket__route"><i>看出口</i><i>看守卫</i><i>看变更</i></span>
            <span class="t-ticket__go">去 ${checklist.num} · ${checklist.nav} ${ICON.arrow}</span>
          </span>
        </span>
      </a>
    </div>
  </div>
</div>`

    reveal(el)
    bindStrike(el)
    bindMotto(el)
  },
}

/* 「免封」删除线：进入视口时划过去 */
function bindStrike(root) {
  const voidEl = root.querySelector('.t-void')
  if (prefersReduced) { voidEl.classList.add('is-on'); return }
  onEnter(voidEl, () => voidEl.classList.add('is-on'), { start: 'top 78%' })
}

/* 金句：桌面端 pin 住滚动驱动；手机端进入视口各播一次；减弱动效直接给终态 */
function bindMotto(root) {
  const motto = root.querySelector('.t-motto')
  const line1 = motto.querySelector('.t-line--ok')
  const line2 = motto.querySelector('.t-line--no')
  const w1 = line1.querySelector('.t-w')
  const w2 = line2.querySelector('.t-w')
  const ok = line1.querySelector('.t-ok')
  const annoOk = line1.querySelector('.t-anno')
  const annoNo = line2.querySelector('.t-anno')
  const no = line2.querySelector('.t-no')
  const stamp = no.querySelector('.t-stamp')
  const inks = no.querySelectorAll('.t-ink i')
  const explain = motto.querySelectorAll('.t-explain li')
  const kicker = motto.querySelector('.t-motto__kicker')

  gsap.set(stamp, { xPercent: -50, yPercent: -50, rotate: -8, opacity: 0 })

  let wantSound = false
  const hitNo = gsap.timeline({ paused: true })
    .fromTo(stamp, { scale: 2.8, rotate: -24, opacity: 0 }, { scale: 1, rotate: -8, opacity: 1, duration: 0.3, ease: 'power4.in', immediateRender: false })
    .call(() => {
      no.classList.add('is-stamped')
      if (wantSound) { audio.sfx('deny'); audio.duck(0.6, 800) }
    })
    .to(line2, { keyframes: { x: [-10, 8, -5, 2, 0] }, duration: 0.36, ease: 'none' })
    .fromTo(inks, { x: 0, y: 0, scale: 0, opacity: 1 }, {
      x: (i) => Math.cos((i / inks.length) * Math.PI * 2 + 0.3) * (70 + (i % 3) * 38),
      y: (i) => Math.sin((i / inks.length) * Math.PI * 2 + 0.3) * (44 + (i % 4) * 20),
      scale: 1, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.008, immediateRender: false,
    }, '<')

  function setOk(on, sound) {
    if (ok.classList.contains('is-on') === on) return
    ok.classList.toggle('is-on', on)
    annoOk.classList.toggle('is-on', on)
    if (on && sound) audio.sfx('gate')
  }
  function setNo(on, sound) {
    if (annoNo.classList.contains('is-on') === on) return
    annoNo.classList.toggle('is-on', on)
    if (on) { wantSound = !!sound; hitNo.play(0) }
    else { hitNo.pause(0); gsap.set(stamp, { opacity: 0 }); no.classList.remove('is-stamped') }
  }

  if (prefersReduced) {
    gsap.set([w1, w2], { backgroundPosition: '0% 0' })
    setOk(true, false)
    annoNo.classList.add('is-on')
    wantSound = false
    hitNo.progress(1)
    return
  }

  const mm = gsap.matchMedia()
  mm.add('(min-width: 900px)', () => {
    // 标签位置：「可以」在第一句填满后亮起，「不行」在第二句填满后盖章
    const OK_AT = 1.35
    const NO_AT = 3.6
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: motto, start: 'top top', end: '+=190%', pin: true, scrub: 0.5, anticipatePin: 1,
        onUpdate: (self) => {
          const t = self.progress * tl.duration()
          setOk(t >= OK_AT, self.direction > 0)
          setNo(t >= NO_AT, self.direction > 0)
        },
      },
    })
    tl.fromTo(kicker, { opacity: 0.35 }, { opacity: 1, duration: 0.4 }, 0)
      .to(w1, { backgroundPosition: '0% 0', duration: 1.2 }, 0.1)
      .to(w2, { backgroundPosition: '0% 0', duration: 1.4 }, 2.1)
      .fromTo(explain, { opacity: 0.22, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.3, ease: 'power2.out' }, 4.2)
      .to({}, { duration: 0.7 })
    return () => { setOk(false); setNo(false) }
  })

  mm.add('(max-width: 899px)', () => {
    onEnter(line1, () => {
      gsap.to(w1, { backgroundPosition: '0% 0', duration: 1.1, ease: 'power2.inOut', onComplete: () => setOk(true, true) })
    }, { start: 'top 72%' })
    onEnter(line2, () => {
      gsap.to(w2, { backgroundPosition: '0% 0', duration: 1.2, ease: 'power2.inOut', onComplete: () => setNo(true, true) })
    }, { start: 'top 72%' })
    explain.forEach((li) => {
      gsap.fromTo(li, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: li, start: 'top 88%', once: true } })
    })
    return () => { setOk(false); setNo(false) }
  })
}

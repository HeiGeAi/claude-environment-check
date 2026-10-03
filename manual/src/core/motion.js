// 动效工具：GSAP + ScrollTrigger + SplitText + Lenis 平滑滚动
// 章节模块统一从这里取 gsap，避免重复注册插件。
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger, SplitText, MotionPathPlugin)

export { gsap, ScrollTrigger, SplitText, MotionPathPlugin }

export const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const isTouch = window.matchMedia('(hover: none)').matches
export const EASE = 'expo.out'

if (prefersReduced) document.documentElement.classList.add('no-motion')

/** 全局 Lenis 实例（减弱动效时为 null，走原生滚动） */
export let lenis = null

export function initSmoothScroll() {
  if (prefersReduced) return null
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false })
  window.__lenis = lenis
  lenis.on("scroll", ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  return lenis
}

/** 平滑滚到某个元素或 #id */
export function scrollToTarget(target, opts = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) return
  if (lenis) lenis.scrollTo(el, { offset: opts.offset ?? -64, duration: opts.duration ?? 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) })
  else el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' })
}

export function lockScroll(on) {
  document.body.classList.toggle('is-locked', on)
  if (lenis) on ? lenis.stop() : lenis.start()
}

/**
 * 自动绑定 root 内所有 [data-reveal]：
 *   data-reveal            上浮淡入（默认）
 *   data-reveal="lines"    按行从遮罩里升起（标题、金句）
 *   data-reveal="chars"    逐字弹出
 *   data-reveal="scale"    轻微放大淡入
 *   data-reveal="stagger"  子元素依次出现
 *   data-reveal="blur"     从模糊到清晰
 * 可选：data-delay="0.2"
 */
export function reveal(root = document) {
  const els = root.querySelectorAll('[data-reveal]:not([data-revealed])')
  els.forEach((el) => {
    el.setAttribute('data-revealed', '')
    const type = el.dataset.reveal || 'up'
    const delay = parseFloat(el.dataset.delay || 0)
    if (prefersReduced) { gsap.set(el, { opacity: 1 }); return }
    const st = { trigger: el, start: 'top 86%', once: true }

    if (type === 'lines' || type === 'chars') {
      gsap.set(el, { opacity: 1 })
      const split = SplitText.create(el, {
        type: type === 'lines' ? 'lines' : 'lines,chars',
        mask: 'lines',
        linesClass: 'split-line',
        autoSplit: true,
        onSplit(self) {
          const targets = type === 'lines' ? self.lines : self.chars
          return gsap.from(targets, {
            yPercent: 110, opacity: 0, rotate: type === 'chars' ? 4 : 0,
            duration: type === 'lines' ? 1.2 : 0.9, ease: EASE,
            stagger: type === 'lines' ? 0.1 : 0.018, delay,
            scrollTrigger: st,
          })
        },
      })
      return split
    }
    if (type === 'stagger') {
      gsap.set(el, { opacity: 1 })
      gsap.from(el.children, { y: 40, opacity: 0, duration: 1, ease: EASE, stagger: 0.08, delay, scrollTrigger: st })
      return
    }
    const from = { opacity: 0, duration: 1.1, ease: EASE, delay, scrollTrigger: st }
    if (type === 'scale') Object.assign(from, { scale: 0.94, y: 20 })
    else if (type === 'blur') Object.assign(from, { filter: 'blur(14px)', y: 16 })
    else Object.assign(from, { y: 44 })
    gsap.fromTo(el, from, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: from.duration, ease: EASE, delay, scrollTrigger: st })
  })
}

/** 元素进入视口时回调一次（或每次） */
export function onEnter(el, cb, { start = 'top 75%', once = true, onLeaveBack } = {}) {
  return ScrollTrigger.create({ trigger: el, start, once, onEnter: () => cb(el), onLeaveBack })
}

/** 元素可见时运行、不可见时暂停（给 canvas / WebGL 循环用） */
export function whenVisible(el, onShow, onHide, rootMargin = '100px') {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? onShow?.() : onHide?.()))
  }, { rootMargin })
  io.observe(el)
  return () => io.disconnect()
}

/** 磁吸按钮：鼠标靠近时轻微跟随 */
export function magnetic(el, strength = 0.28) {
  if (isTouch || prefersReduced) return
  const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
  const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect()
    xTo((e.clientX - r.left - r.width / 2) * strength)
    yTo((e.clientY - r.top - r.height / 2) * strength)
  })
  el.addEventListener('pointerleave', () => { xTo(0); yTo(0) })
}

/** 数字滚动 */
export function countUp(el, to, { duration = 1.6, decimals = 0, suffix = '' } = {}) {
  const obj = { v: 0 }
  return gsap.to(obj, {
    v: to, duration: prefersReduced ? 0 : duration, ease: 'power3.out',
    onUpdate: () => { el.textContent = obj.v.toFixed(decimals) + suffix },
  })
}

/** 卡片跟随鼠标的高光（给元素设置 --mx / --my） */
export function spotlight(el) {
  if (isTouch) return
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  })
}

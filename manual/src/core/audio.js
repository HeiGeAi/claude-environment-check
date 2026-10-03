// ============================================================
// 音频引擎（接口契约不变，完整实现）
// 章节模块只通过下面这些方法发声，不自己 new AudioContext。
//
//   audio.unlock()            在用户手势里调用，创建/恢复 AudioContext
//   audio.enable() / disable() / toggle()   总开关（记忆在 localStorage）
//   audio.isOn()              当前是否开声
//   audio.onChange(fn)        开关变化回调 fn(isOn)
//   audio.sfx(name, opts)     播放音效，未开声时静默忽略
//   audio.setMood(mood)       切换配乐情绪：calm | journey | focus | tension | safe | triumph
//   audio.duck(amount, ms)    临时压低音乐（重要音效时用），amount 0-1
//
// 音效名（全部为合成音，不引用外部文件）：
//   hover      极轻的悬停提示
//   click      柔和的点击
//   toggle-on / toggle-off   开关
//   open / close             展开、收起
//   whoosh     转场气流
//   step       旅程中前进一步
//   success    通过、放行（明亮的双音）
//   deny       拦截、拒绝（低沉闷响）
//   gate       闸门落下（金属感）
//   alarm      泄漏警报（短促）
//   type       打字机单击（终端演示逐字调用，已内部节流）
//   ding       清单勾选；opts.pitch 为 0-1，越大越高
//   chord      完成一组
//   pop        轻快弹出
//   shatter    破碎（流言粉碎）
//   reveal     揭晓
//   copy       复制成功
//   error      操作失败
//   celebrate  全部完成的庆祝
//   heartbeat  紧张的心跳一下
//
// 实现：src/core/audio/（theory 乐理、voices 发声积木、music 配乐、sfx 音效、engine 混音）
// 全部程序化合成，D 大调五声为主，音效按当前和弦量化，与配乐同调。
// 配乐由 25ms 的 lookahead 调度器排程（提前 0.18 秒，按 ctx.currentTime 定时）。
// ============================================================
import { createEngine } from './audio/engine.js'
import { MOODS } from './audio/theory.js'

const KEY = 'guide:sound'
const LOOKAHEAD = 0.18
const TICK_MS = 25
const FADE_IN = 3
const FADE_OUT = 0.9
const FADE_HIDDEN = 0.6

const listeners = new Set()
const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined'
let ctx = null
let engine = null
let on = false
let mood = 'calm'
let playing = false
let timer = null
let suspendTimer = null

const store = {
  get() { try { return localStorage.getItem(KEY) } catch { return null } },
  set(v) { try { localStorage.setItem(KEY, v) } catch {} },
}
const hidden = () => hasDOM && document.visibilityState === 'hidden'

function ensure() {
  if (ctx) return ctx
  if (!hasDOM) return null
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    try { ctx = new AC({ latencyHint: 'interactive' }) } catch { ctx = new AC() }
  } catch {
    ctx = null
  }
  return ctx
}

function ensureEngine() {
  if (engine) return engine
  if (!ensure()) return null
  try {
    engine = createEngine(ctx)
    engine.setMood(mood)
  } catch (err) {
    console.warn('[audio] 引擎初始化失败，保持静音', err)
    engine = null
  }
  return engine
}

function resume() {
  try {
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') {
      const p = ctx.resume()
      if (p && p.catch) p.catch(() => {})
    }
  } catch {}
}

function tick() {
  try {
    if (engine && ctx) engine.schedule(ctx.currentTime + LOOKAHEAD)
  } catch (err) {
    console.warn('[audio] 调度出错，已停止配乐', err)
    stopTimer()
  }
}
function startTimer() { if (!timer) { timer = setInterval(tick, TICK_MS); tick() } }
function stopTimer() { if (timer) { clearInterval(timer); timer = null } }

function startMusic() {
  const e = ensureEngine()
  if (!e) return
  clearTimeout(suspendTimer)
  resume()
  try {
    e.startMusic(FADE_IN)
    playing = true
    startTimer()
  } catch (err) {
    console.warn('[audio] 配乐启动失败', err)
  }
}

function stopMusic(fade) {
  clearTimeout(suspendTimer)
  if (engine && playing) {
    try { engine.stopMusic(fade) } catch {}
  }
  playing = false
  stopTimer()
  // 淡出结束后挂起上下文，省电；期间重新开声会取消挂起
  suspendTimer = setTimeout(() => {
    if (playing || !ctx || ctx.state !== 'running') return
    if (on && !hidden()) return
    try { const p = ctx.suspend(); if (p && p.catch) p.catch(() => {}) } catch {}
  }, fade * 1000 + 450)
}

function emit() { listeners.forEach((f) => { try { f(on) } catch (err) { console.error(err) } }) }

if (hasDOM) {
  // 页面隐藏：淡出并暂停调度；回来再淡入
  document.addEventListener('visibilitychange', () => {
    if (!on) return
    if (hidden()) stopMusic(FADE_HIDDEN)
    else startMusic()
  })
  // 任意用户手势都尝试恢复上下文（iOS 需要在手势里 resume）
  const onGesture = () => {
    if (!on) return
    ensureEngine()
    resume()
    if (!playing && !hidden()) startMusic()
  }
  for (const ev of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(ev, onGesture, { capture: true, passive: true })
  }
}

export const audio = {
  unlock() { const c = ensure(); if (c) resume() },
  enable() {
    audio.unlock()
    on = true
    store.set('1')
    if (!hidden()) startMusic()
    emit()
  },
  disable() {
    const was = on
    on = false
    store.set('0')
    if (was || playing) stopMusic(FADE_OUT)
    emit()
  },
  toggle() { on ? audio.disable() : audio.enable(); return on },
  isOn() { return on },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  sfx(name, opts = {}) {
    if (!on || hidden()) return
    try {
      const e = ensureEngine()
      if (!e) return
      if (ctx.state !== 'running') resume()
      e.sfx(name, opts || {})
    } catch {}
  },
  setMood(m) {
    mood = MOODS[m] ? m : 'calm'
    try { if (engine) engine.setMood(mood) } catch {}
  },
  duck(amount = 0.5, ms = 600) {
    if (!on || !engine) return
    try { engine.duck(amount, ms) } catch {}
  },
  /** 上次选择（'1' 开 / '0' 关 / null 未选），给开场闸门参考 */
  remembered() { return store.get() },
}

/** 调试入口（试听台用），章节不要依赖 */
export const __audioInternals = {
  get ctx() { return ctx },
  get engine() { return engine },
  get playing() { return playing },
  get mood() { return mood },
}

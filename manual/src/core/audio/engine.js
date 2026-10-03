// ============================================================
// 引擎：总线与混音 + 配乐 + 音效管理（复音上限、节流、闪避）
// createEngine(ctx) 接收任意 BaseAudioContext：线上用 AudioContext，测试用 OfflineAudioContext。
//
// 信号流
//   配乐各层 ─┬─ musicIn ─ musicFade ─ musicDuck ─ musicOut ─┐
//             └─ 配乐混响（4.6 秒程序脉冲）─ musicIn           ├─ master ─ 压缩 ─ 限幅 ─ 输出
//   音效声部 ─┬─ sfxBus ─────────────────────────────────────┤
//             └─ 音效混响（1.8 秒小房间）─ sfxVerbOut ─────────┘
// ============================================================
import { mulberry32, MOODS } from './theory.js'
import { makeIR, whiteNoise } from './voices.js'
import { createMusic } from './music.js'
import { SFX } from './sfx.js'

export const MUSIC_LEVEL = 0.24 // 配乐总线：峰值约 -16 dBFS、RMS 约 -31 dBFS（见离线测试）
export const SFX_LEVEL = 0.9
const MAX_VOICES = 14

function softClipCurve() {
  const n = 2048
  const c = new Float32Array(n)
  const knee = 0.6, ceil = 0.95
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a <= knee ? a : knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee))
    c[i] = Math.sign(x) * y
  }
  return c
}

export function buildGraph(ctx, destination = ctx.destination) {
  const master = ctx.createGain()
  master.gain.value = 1
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 12
  comp.ratio.value = 3
  comp.attack.value = 0.005
  comp.release.value = 0.28
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.12
  // 最后一道保险：软削波，0.6 以下完全线性，之上平滑逼近 0.95，任何叠加都不会硬削波
  const clip = ctx.createWaveShaper()
  clip.curve = softClipCurve()
  master.connect(comp).connect(limiter).connect(clip).connect(destination)

  // 配乐
  const musicIn = ctx.createGain()
  const musicFade = ctx.createGain(); musicFade.gain.value = 0
  const musicDuck = ctx.createGain(); musicDuck.gain.value = 1
  const musicOut = ctx.createGain(); musicOut.gain.value = MUSIC_LEVEL
  musicIn.connect(musicFade).connect(musicDuck).connect(musicOut).connect(master)
  const musicVerb = ctx.createConvolver()
  musicVerb.normalize = true
  musicVerb.buffer = makeIR(ctx, { seconds: 4.6, rt60: 4.2, predelay: 0.024, damp: 0.75, seed: 11 })
  const musicVerbOut = ctx.createGain(); musicVerbOut.gain.value = 0.9
  musicVerb.connect(musicVerbOut).connect(musicIn)

  // 音效
  const sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_LEVEL
  sfxBus.connect(master)
  const sfxVerb = ctx.createConvolver()
  sfxVerb.normalize = true
  sfxVerb.buffer = makeIR(ctx, { seconds: 1.8, rt60: 1.5, predelay: 0.012, damp: 1.4, seed: 23 })
  const sfxVerbOut = ctx.createGain(); sfxVerbOut.gain.value = 0.55
  sfxVerb.connect(sfxVerbOut).connect(sfxBus)

  return { master, comp, limiter, clip, output: clip, musicIn, musicFade, musicDuck, musicOut, musicVerb, sfxBus, sfxVerb }
}

export function createEngine(ctx, { destination, seed } = {}) {
  const rnd = mulberry32(seed ?? Math.floor(Math.random() * 2 ** 31))
  const g = buildGraph(ctx, destination || ctx.destination)
  const music = createMusic(ctx, g, rnd)
  const nb = whiteNoise(ctx)
  const st = { stepIdx: 0, stepLast: -1e9 }
  const lastAt = Object.create(null)
  let voices = []
  let duckFloor = 1
  let duckUntil = 0

  function duck(amount = 0.5, ms = 600, when) {
    const p = g.musicDuck.gain
    const t = when ?? ctx.currentTime
    const target = Math.max(0, Math.min(1, 1 - (Number(amount) || 0)))
    const hold = Math.max(0, Number(ms) || 0) / 1000
    // 叠加闪避取更深的那一次，并延长到更晚的结束时间
    const floor = t < duckUntil ? Math.min(duckFloor, target) : target
    const until = Math.max(t < duckUntil ? duckUntil : 0, t + hold)
    duckFloor = floor
    duckUntil = until
    p.cancelScheduledValues(t)
    p.setTargetAtTime(floor, t, 0.035)
    p.setTargetAtTime(1, until, 0.32)
  }

  function prune(now) {
    if (!voices.length) return
    voices = voices.filter((v) => {
      if (v.end + 0.4 < now) {
        try { v.vg.disconnect() } catch {}
        try { v.wg.disconnect() } catch {}
        return false
      }
      return true
    })
  }

  function steal(v, t) {
    v.stolen = true
    v.vg.gain.cancelScheduledValues(t)
    v.vg.gain.setTargetAtTime(0, t, 0.012)
    v.wg.gain.cancelScheduledValues(t)
    v.wg.gain.setTargetAtTime(0, t, 0.012)
    v.end = Math.min(v.end, t + 0.1)
  }

  /** 播放音效。when 省略时立即播放；返回是否真的发声 */
  function sfx(name, opts = {}, when) {
    const spec = SFX[name] || SFX.click
    const key = SFX[name] ? name : 'click'
    const now = ctx.currentTime
    const t = when != null ? when : now + 0.004
    const clock = when != null ? when : (typeof performance !== 'undefined' ? performance.now() / 1000 : now)
    if (clock - (lastAt[key] ?? -1e9) < (spec.gap ?? 0.025)) return false
    prune(now)
    const live = voices.filter((v) => !v.stolen && v.end > t)
    const same = live.filter((v) => v.name === key)
    if (spec.max && same.length >= spec.max) {
      if (spec.prio === 0) return false
      steal(same[0], t)
    }
    const alive = live.filter((v) => !v.stolen)
    if (alive.length >= MAX_VOICES) {
      if (spec.prio === 0) return false
      const victim = alive.slice().sort((a, b) => a.prio - b.prio || a.start - b.start)[0]
      if (!victim || victim.prio > spec.prio) return false
      steal(victim, t)
    }
    lastAt[key] = clock
    const vg = ctx.createGain()
    vg.gain.value = spec.gain ?? 1
    vg.connect(g.sfxBus)
    const wg = ctx.createGain()
    wg.connect(g.sfxVerb)
    const x = {
      ctx, t, o: opts || {}, h: music.harmony(t), rnd, nb, st,
      d: { dry: vg, wet: wg, rnd },
      duck: (a, ms) => duck(a, ms, t),
    }
    const end = spec.fn(x)
    voices.push({ name: key, prio: spec.prio, start: t, end: Number.isFinite(end) ? end : t + 2, vg, wg })
    return true
  }

  function fadeMusic(to, sec, when) {
    const p = g.musicFade.gain
    const t = when ?? ctx.currentTime
    const cur = p.value
    p.cancelScheduledValues(t)
    p.setValueAtTime(cur, t)
    p.linearRampToValueAtTime(to, t + Math.max(0.02, sec))
    return t + sec
  }

  return {
    ctx, graph: g, music, rnd,
    sfx, duck,
    setMood: (m) => music.setMood(m),
    schedule: (until) => { music.schedule(until); prune(ctx.currentTime) },
    harmony: (t) => music.harmony(t ?? ctx.currentTime),
    voiceCount: () => voices.filter((v) => !v.stolen && v.end > ctx.currentTime).length,
    /** 调试：任一时刻同时发声（未被抢占）的最大音效数 */
    peakPolyphony() {
      let max = 0
      for (const a of voices) {
        const n = voices.filter((b) => b.start <= a.start && b.end > a.start && (!b.stolen || b === a)).length
        if (n > max) max = n
      }
      return max
    },
    fadeMusic,
    /** 开始配乐并在 fadeSec 秒内淡入 */
    startMusic(fadeSec = 3, when) {
      const t = when ?? ctx.currentTime
      if (!music.running) music.start(t + 0.03)
      fadeMusic(1, fadeSec, t)
    },
    /** 淡出配乐，淡出结束时释放全部持续声部；返回静音时刻 */
    stopMusic(fadeSec = 0.9, when) {
      const t = when ?? ctx.currentTime
      const end = fadeMusic(0, fadeSec, t)
      if (music.running) music.halt(end)
      return end
    },
    moods: Object.keys(MOODS),
  }
}

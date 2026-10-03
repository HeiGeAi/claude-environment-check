// ============================================================
// 发声积木：振荡音、噪声、铃音、毡钢琴，以及程序生成的缓冲（混响脉冲、噪声）
// 所有函数都只接收 BaseAudioContext，因此能在 OfflineAudioContext 里离线渲染。
//
// dest 约定：{ dry: AudioNode, wet?: AudioNode, rnd?: () => number }
//   dry 为直达声输出，wet 为混响发送（可无）
// ============================================================
import { mulberry32 } from './theory.js'

const EPS = 1e-5
const okF = (f) => (Number.isFinite(f) && f > 0 ? Math.min(f, 20000) : 440)

export function panNode(ctx, pan) {
  if (!pan || typeof ctx.createStereoPanner !== 'function') return null
  const p = ctx.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  return p
}

/** 起音 a、保持 hold、指数衰减 d。返回结束时间 */
export function envelope(param, t, a, d, peak, hold = 0) {
  const pk = Math.max(EPS * 2, peak)
  param.setValueAtTime(0, t)
  param.linearRampToValueAtTime(pk, t + a)
  if (hold > 0) param.setValueAtTime(pk, t + a + hold)
  const end = t + a + hold + d
  param.exponentialRampToValueAtTime(EPS, end)
  param.setValueAtTime(0, end + 0.005)
  return end
}

/** 把 node 接上可选的高通、低通、声像，再接到 dest.dry，并按 wet 发送到 dest.wet */
export function route(ctx, node, o, dest) {
  let n = node
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; f.Q.value = 0.6; n.connect(f); n = f }
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.lpQ ?? 0.5; n.connect(f); n = f }
  const p = panNode(ctx, o.pan)
  if (p) { n.connect(p); n = p }
  n.connect(dest.dry)
  if (o.wet && dest.wet) {
    const w = ctx.createGain()
    w.gain.value = o.wet
    n.connect(w)
    w.connect(dest.wet)
  }
  return n
}

/** 建一条子总线（带滤波 / 声像 / 混响发送），返回新的 dest，供多个分音共享 */
export function sub(ctx, dest, o = {}) {
  const g = ctx.createGain()
  g.gain.value = o.gain ?? 1
  route(ctx, g, o, dest)
  return { dry: g, wet: null, rnd: dest.rnd }
}

/** 单个振荡音。o: { t, f, type, wave, a, d, hold, peak, f2, glide, detune, vib:{rate,depth}, lp, hp, pan, wet } */
export function tone(ctx, dest, o) {
  const t = o.t
  const a = o.a ?? 0.004
  const d = o.d ?? 0.2
  const osc = ctx.createOscillator()
  if (o.wave) osc.setPeriodicWave(o.wave)
  else osc.type = o.type || 'sine'
  osc.frequency.setValueAtTime(okF(o.f), t)
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(okF(o.f2), t + (o.glide ?? 0.02))
  if (o.detune) osc.detune.setValueAtTime(o.detune, t)
  const g = ctx.createGain()
  const end = envelope(g.gain, t, a, d, o.peak ?? 0.1, o.hold ?? 0)
  osc.connect(g)
  route(ctx, g, o, dest)
  let lfo = null
  if (o.vib) {
    lfo = ctx.createOscillator()
    lfo.frequency.value = o.vib.rate
    const lg = ctx.createGain()
    lg.gain.value = o.vib.depth
    lfo.connect(lg)
    lg.connect(osc.detune)
    lfo.start(t)
    lfo.stop(end + 0.03)
  }
  osc.start(t)
  osc.stop(end + 0.03)
  return end
}

/** 滤波噪声。o: { t, dur, a, hold, peak, type, f, f2, sweep, q, lp, hp, pan, wet } */
export function noise(ctx, dest, buf, o) {
  const t = o.t
  const dur = o.dur ?? 0.05
  const src = ctx.createBufferSource()
  src.buffer = buf
  const flt = ctx.createBiquadFilter()
  flt.type = o.type || 'bandpass'
  flt.frequency.setValueAtTime(okF(o.f ?? 2000), t)
  if (o.f2) flt.frequency.exponentialRampToValueAtTime(okF(o.f2), t + (o.sweep ?? dur))
  flt.Q.value = o.q ?? 1
  const g = ctx.createGain()
  const end = envelope(g.gain, t, o.a ?? 0.001, dur, o.peak ?? 0.05, o.hold ?? 0)
  src.connect(flt)
  flt.connect(g)
  route(ctx, g, o, dest)
  const rnd = dest.rnd || Math.random
  const span = Math.max(0, buf.duration - (end - t) - 0.05)
  src.start(t, rnd() * span)
  src.stop(end + 0.03)
  return end
}

// 分音表：[频率比, 相对电平, 衰减比例]
export const BELL = [[1, 1, 1], [2, 0.26, 0.5], [3.01, 0.09, 0.28], [4.18, 0.035, 0.15]]
export const BELL_BRIGHT = [[1, 1, 1], [2, 0.3, 0.55], [3.0, 0.12, 0.3], [5.04, 0.05, 0.14], [6.8, 0.02, 0.08]]
export const PIANO = [[1, 1, 1], [2, 0.38, 0.55], [3, 0.14, 0.32], [4, 0.05, 0.2]]
export const GATE_METAL = [[1, 0.085, 1.5], [2.76, 0.06, 1.1], [5.4, 0.042, 0.75], [8.93, 0.028, 0.5], [13.34, 0.016, 0.32]]

/** 多分音铃音 / 毡钢琴。o: { t, f, peak, d, a, partials, lp, pan, wet } */
export function bell(ctx, dest, o) {
  const bus = sub(ctx, dest, { lp: o.lp, pan: o.pan, wet: o.wet })
  bus.wet = null
  let end = o.t
  for (const [r, g, dr] of o.partials || BELL) {
    const f = o.f * r
    if (f > 15000) continue
    end = Math.max(end, tone(ctx, bus, { t: o.t, f, a: o.a ?? 0.003, d: (o.d ?? 1) * dr, peak: (o.peak ?? 0.1) * g, detune: o.detune }))
  }
  return end
}

// ------------------------------------------------------------
// 缓冲：按上下文缓存，避免重复生成
// ------------------------------------------------------------
const cache = new WeakMap()
function cached(ctx, key, make) {
  let m = cache.get(ctx)
  if (!m) { m = {}; cache.set(ctx, m) }
  if (!m[key]) m[key] = make()
  return m[key]
}

/** 白噪声（单声道 2 秒），音效用 */
export function whiteNoise(ctx) {
  return cached(ctx, 'white', () => {
    const sr = ctx.sampleRate
    const b = ctx.createBuffer(1, Math.floor(sr * 2), sr)
    const d = b.getChannelData(0)
    const r = mulberry32(99)
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1
    return b
  })
}

/** 粉红噪声（立体声 6 秒，可循环），环境底噪用 */
export function pinkNoise(ctx) {
  return cached(ctx, 'pink', () => {
    const sr = ctx.sampleRate
    const len = Math.floor(sr * 6)
    const b = ctx.createBuffer(2, len, sr)
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch)
      const r = mulberry32(17 + ch * 31)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < len; i++) {
        const w = r() * 2 - 1
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.969 * b2 + w * 0.153852
        b3 = 0.8665 * b3 + w * 0.3104856
        b4 = 0.55 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.016898
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
        b6 = w * 0.115926
      }
      // 首尾交叉淡化，循环无接缝
      const x = Math.floor(sr * 0.25)
      for (let i = 0; i < x; i++) {
        const k = i / x
        d[i] = d[i] * k + d[len - x + i] * (1 - k)
      }
    }
    return b
  })
}

/**
 * 程序生成的立体声混响脉冲：预延迟 + 稀疏早期反射 + 随时间变暗的指数衰减尾巴。
 * seconds 总长，rt60 衰减到 -60 dB 的时间，damp 越大高频消失越快。
 */
export function makeIR(ctx, { seconds = 4, rt60 = 3.5, predelay = 0.018, damp = 0.9, seed = 7 } = {}) {
  const sr = ctx.sampleRate
  const len = Math.floor(sr * seconds)
  const b = ctx.createBuffer(2, len, sr)
  const pre = Math.floor(predelay * sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    const r = mulberry32(seed + ch * 101)
    let lp = 0
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr
      const env = Math.pow(10, (-3 * t) / rt60)
      const coef = 0.08 + 0.82 * Math.exp(-t * damp * 1.6)
      lp += coef * ((r() * 2 - 1) - lp)
      // 起音 8 ms 渐入，避免尖峰
      const fadeIn = Math.min(1, t / 0.008)
      d[i] = lp * env * fadeIn * (1.4 - coef * 0.5)
    }
    for (let k = 0; k < 10; k++) {
      const at = pre + Math.floor((0.004 + r() * 0.075) * sr)
      if (at < len) d[at] += (r() * 2 - 1) * 0.35 * (1 - k / 12)
    }
    const tail = Math.floor(sr * 0.08)
    for (let i = 0; i < tail; i++) d[len - 1 - i] *= i / tail
  }
  return b
}

/** 柔和的铺底波形：谐波按 1/n^k 衰减，bright 越大越亮 */
export function padWave(ctx, bright) {
  const key = `pad:${bright.toFixed(2)}`
  return cached(ctx, key, () => {
    const N = 28
    const real = new Float32Array(N)
    const imag = new Float32Array(N)
    const k = 1.15 + (1 - bright) * 1.4
    for (let n = 1; n < N; n++) imag[n] = (n % 2 ? 1 : 0.62) / Math.pow(n, k)
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false })
  })
}

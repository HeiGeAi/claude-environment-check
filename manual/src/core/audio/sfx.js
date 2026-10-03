// ============================================================
// 音效库：全部程序化合成，音高按当前和弦 / 音阶量化，和配乐同调
// 每个音效：{ gain, prio, gap, max, fn(x) => 结束时间 }
//   prio 0 可丢弃（悬停、打字）/ 1 普通 UI / 2 剧情音效（复音满时可抢占低优先级）
//   gap  同名音效的最小间隔（秒）   max 同名同时发声上限
// x = { ctx, d: 输出 dest, t: 开始时间, o: 调用参数, h: 当前和声, rnd, nb: 白噪声, st: 状态, duck(amount, ms) }
// ============================================================
import { mtof, near, up, stepIn, scaleNotes, clamp, pc } from './theory.js'
import { tone, noise, bell, sub, BELL, BELL_BRIGHT, PIANO, GATE_METAL } from './voices.js'

const tick = (x, t, f, peak, o = {}) => {
  noise(x.ctx, x.d, x.nb, { t, dur: 0.006, a: 0.0008, peak: peak * 0.45, type: 'bandpass', f: o.nf ?? 4200, q: 1.1 })
  return tone(x.ctx, x.d, { t, f: f * 0.985, f2: f, glide: 0.01, a: 0.002, d: o.d ?? 0.09, peak, wet: o.wet ?? 0.12, lp: o.lp })
}

export const SFX = {
  hover: {
    prio: 0, gap: 0.045, max: 2,
    fn({ ctx, d, t, h, rnd, nb }) {
      const m = near(h.tones, 93 + (rnd() < 0.5 ? 0 : 3))
      noise(ctx, d, nb, { t, dur: 0.011, a: 0.0015, peak: 0.02, type: 'bandpass', f: 5200, q: 1.6, pan: (rnd() - 0.5) * 0.3 })
      return tone(ctx, d, { t, f: mtof(m), a: 0.003, d: 0.045, peak: 0.0085, wet: 0.1 })
    },
  },

  click: {
    prio: 1, gap: 0.03, max: 4,
    fn({ ctx, d, t, h, nb }) {
      const f = mtof(near(h.tones, 81))
      noise(ctx, d, nb, { t, dur: 0.007, a: 0.0008, peak: 0.045, type: 'bandpass', f: 3400, q: 1.2 })
      tone(ctx, d, { t, f: 190, f2: 120, glide: 0.03, a: 0.002, d: 0.04, peak: 0.05 })
      return tone(ctx, d, { t, f: f * 1.5, f2: f, glide: 0.012, a: 0.002, d: 0.085, peak: 0.1, wet: 0.08 })
    },
  },

  'toggle-on': {
    prio: 1, gap: 0.05, max: 2,
    fn(x) {
      const m1 = near(x.h.tones, 79)
      const m2 = stepIn(x.h.scale, m1, 2)
      tick(x, x.t, mtof(m1), 0.08)
      return tick(x, x.t + 0.06, mtof(m2), 0.095, { d: 0.12 })
    },
  },

  'toggle-off': {
    prio: 1, gap: 0.05, max: 2,
    fn(x) {
      const m2 = near(x.h.tones, 79)
      const m1 = stepIn(x.h.scale, m2, 2)
      tick(x, x.t, mtof(m1), 0.08, { lp: 2800 })
      return tick(x, x.t + 0.06, mtof(m2), 0.07, { lp: 2400, d: 0.1 })
    },
  },

  open: {
    prio: 1, gap: 0.08, max: 2,
    fn({ ctx, d, t, h, nb }) {
      noise(ctx, d, nb, { t, dur: 0.14, a: 0.08, peak: 0.035, type: 'bandpass', f: 500, f2: 2600, sweep: 0.22, q: 0.9, wet: 0.2 })
      const m1 = near(h.tones, 74)
      const m2 = stepIn(h.scale, m1, 3)
      bell(ctx, d, { t: t + 0.03, f: mtof(m1), peak: 0.055, d: 0.45, wet: 0.25, lp: 5000, partials: BELL })
      return bell(ctx, d, { t: t + 0.09, f: mtof(m2), peak: 0.06, d: 0.6, wet: 0.3, lp: 5000, partials: BELL })
    },
  },

  close: {
    prio: 1, gap: 0.08, max: 2,
    fn({ ctx, d, t, h, nb }) {
      noise(ctx, d, nb, { t, dur: 0.14, a: 0.06, peak: 0.03, type: 'bandpass', f: 2600, f2: 500, sweep: 0.22, q: 0.9, wet: 0.2 })
      const m2 = near(h.tones, 74)
      const m1 = stepIn(h.scale, m2, 3)
      bell(ctx, d, { t: t + 0.02, f: mtof(m1), peak: 0.05, d: 0.35, wet: 0.2, lp: 4000, partials: BELL })
      return bell(ctx, d, { t: t + 0.08, f: mtof(m2), peak: 0.055, d: 0.5, wet: 0.25, lp: 3200, partials: BELL })
    },
  },

  whoosh: {
    prio: 2, gap: 0.12, max: 2,
    fn({ ctx, d, t, rnd, nb }) {
      const len = 0.85
      const bus = sub(ctx, d, { wet: 0.3 })
      bus.wet = null
      const src = ctx.createBufferSource()
      src.buffer = nb
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'; bp.Q.value = 0.85
      bp.frequency.setValueAtTime(260, t)
      bp.frequency.exponentialRampToValueAtTime(2200, t + 0.38)
      bp.frequency.exponentialRampToValueAtTime(480, t + len)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.2, t + 0.34)
      g.gain.linearRampToValueAtTime(0, t + len)
      const body = ctx.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 380
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0, t)
      bg.gain.linearRampToValueAtTime(0.1, t + 0.3)
      bg.gain.linearRampToValueAtTime(0, t + len)
      let out = g
      if (typeof ctx.createStereoPanner === 'function') {
        const p = ctx.createStereoPanner()
        p.pan.setValueAtTime(-0.6, t)
        p.pan.linearRampToValueAtTime(0.6, t + len)
        g.connect(p); out = p
      }
      src.connect(bp).connect(g)
      src.connect(body).connect(bg).connect(bus.dry)
      out.connect(bus.dry)
      src.start(t, rnd() * 0.9)
      src.stop(t + len + 0.05)
      return t + len
    },
  },

  step: {
    prio: 1, gap: 0.04, max: 4,
    fn({ ctx, d, t, h, nb, st }) {
      if (t - st.stepLast > 1.8 || st.stepIdx >= 8) st.stepIdx = 0
      const notes = scaleNotes(h.scale, 69, 96)
      const m = notes[st.stepIdx % notes.length]
      st.stepIdx++
      st.stepLast = t
      const f = mtof(m)
      noise(ctx, d, nb, { t, dur: 0.005, peak: 0.03, type: 'lowpass', f: 1800, q: 0.7 })
      tone(ctx, d, { t, f: f * 4, a: 0.001, d: 0.045, peak: 0.022 })
      return tone(ctx, d, { t, f, a: 0.003, d: 0.34, peak: 0.11, wet: 0.2 })
    },
  },

  success: {
    prio: 2, gap: 0.12, max: 2,
    fn({ ctx, d, t, h, duck }) {
      const m1 = near(h.tones, 81)
      const m2 = up(h.tones, m1 + 3)
      const root = up([pc(h.chord.bass)], 62)
      duck(0.2, 400)
      tone(ctx, d, { t, f: mtof(root), a: 0.01, d: 0.55, peak: 0.028, wet: 0.2 })
      bell(ctx, d, { t, f: mtof(m1), peak: 0.1, d: 0.7, wet: 0.35, partials: BELL_BRIGHT, lp: 7000 })
      return bell(ctx, d, { t: t + 0.095, f: mtof(m2), peak: 0.11, d: 1.1, wet: 0.4, partials: BELL_BRIGHT, lp: 7000 })
    },
  },

  deny: {
    gain: 0.55, prio: 2, gap: 0.12, max: 2,
    fn({ ctx, d, t, nb, duck }) {
      duck(0.35, 450)
      const bus = sub(ctx, d, { lp: 900, wet: 0.12 })
      bus.wet = null
      noise(ctx, bus, nb, { t, dur: 0.05, a: 0.002, peak: 0.2, type: 'lowpass', f: 320, q: 0.8 })
      tone(ctx, bus, { t, f: 110, type: 'triangle', a: 0.004, d: 0.2, peak: 0.06 })
      tone(ctx, bus, { t, f: 146.8 * 1.013, f2: 73.4 * 1.013, glide: 0.14, a: 0.004, d: 0.3, peak: 0.16 })
      return tone(ctx, bus, { t, f: 146.8, f2: 73.4, glide: 0.14, a: 0.004, d: 0.34, peak: 0.3 })
    },
  },

  gate: {
    gain: 0.6, prio: 2, gap: 0.2, max: 2,
    fn({ ctx, d, t, rnd, nb, duck }) {
      duck(0.45, 700)
      tone(ctx, d, { t, f: 95, f2: 40, glide: 0.22, a: 0.003, d: 0.5, peak: 0.34 })
      noise(ctx, d, nb, { t, dur: 0.05, a: 0.001, peak: 0.14, type: 'bandpass', f: 1600, q: 1.4, wet: 0.3 })
      noise(ctx, d, nb, { t: t + 0.11, dur: 0.012, a: 0.001, peak: 0.05, type: 'highpass', f: 3500, q: 0.7, wet: 0.2 })
      const metal = sub(ctx, d, { wet: 0.35, hp: 150 })
      metal.wet = null
      const f0 = mtof(57)
      let end = t
      for (const [r, g, dr] of GATE_METAL) {
        const pan = (rnd() - 0.5) * 0.5
        end = Math.max(end, tone(ctx, metal, { t, f: f0 * r, a: 0.002, d: 1.2 * dr, peak: g, pan }))
        tone(ctx, metal, { t, f: f0 * r * 1.004, a: 0.002, d: 1.0 * dr, peak: g * 0.55, pan: -pan })
      }
      return Math.max(end, t + 0.6)
    },
  },

  alarm: {
    prio: 2, gap: 0.3, max: 1,
    fn({ ctx, d, t, duck }) {
      duck(0.4, 700)
      const bus = sub(ctx, d, { lp: 2300, wet: 0.2 })
      bus.wet = null
      const hi = mtof(81), lo = mtof(77)
      let end = t
      for (const [dt, f, k] of [[0, hi, 1], [0.15, lo, 0.95], [0.32, hi, 0.7], [0.47, lo, 0.6]]) {
        tone(ctx, bus, { t: t + dt, f, type: 'square', a: 0.008, hold: 0.08, d: 0.05, peak: 0.016 * k })
        end = tone(ctx, bus, { t: t + dt, f, type: 'triangle', a: 0.008, hold: 0.08, d: 0.05, peak: 0.11 * k, vib: { rate: 7, depth: 12 } })
      }
      return end
    },
  },

  type: {
    prio: 0, gap: 0.028, max: 3,
    fn({ ctx, d, t, rnd, nb }) {
      const pk = 0.045 + rnd() * 0.035
      noise(ctx, d, nb, { t, dur: 0.006 + rnd() * 0.008, a: 0.0008, peak: pk, type: 'bandpass', f: 1800 + rnd() * 2600, q: 0.8 + rnd() * 0.9, hp: 700, pan: (rnd() - 0.5) * 0.3 })
      const bf = 140 + rnd() * 90
      tone(ctx, d, { t, f: bf, f2: bf * 0.7, glide: 0.02, a: 0.001, d: 0.022, peak: 0.022 + rnd() * 0.014 })
      if (rnd() < 0.18) noise(ctx, d, nb, { t: t + 0.022 + rnd() * 0.01, dur: 0.004, peak: pk * 0.35, type: 'bandpass', f: 5000, q: 1 })
      return t + 0.06
    },
  },

  ding: {
    prio: 1, gap: 0.03, max: 4,
    fn({ ctx, d, t, o, h }) {
      const p = clamp(Number(o.pitch ?? 0.5) || 0, 0, 1)
      const notes = scaleNotes(h.scale, 74, 110).slice(0, 11)
      const m = notes[Math.round(p * (notes.length - 1))]
      return bell(ctx, d, { t, f: mtof(m), peak: 0.1 - 0.035 * p, d: 1.0, wet: 0.35, partials: BELL_BRIGHT, lp: 8000 })
    },
  },

  chord: {
    prio: 2, gap: 0.15, max: 2,
    fn({ ctx, d, t, h }) {
      const root = up([pc(h.chord.bass)], 60)
      const notes = [root]
      while (notes.length < 5) notes.push(up(h.tones, notes[notes.length - 1] + 1))
      tone(ctx, d, { t, f: mtof(root - 12), a: 0.01, d: 1.2, peak: 0.05 })
      let end = t
      notes.forEach((m, i) => {
        end = Math.max(end, bell(ctx, d, { t: t + i * 0.035, f: mtof(m), peak: 0.065, d: 1.6, a: 0.005, wet: 0.4, partials: PIANO, lp: 3600, pan: (i / 4 - 0.5) * 0.5 }))
      })
      return end
    },
  },

  pop: {
    prio: 1, gap: 0.035, max: 4,
    fn({ ctx, d, t, h, rnd, nb }) {
      const f = mtof(near(h.scale, 83 + Math.floor(rnd() * 5)))
      noise(ctx, d, nb, { t, dur: 0.003, peak: 0.03, type: 'bandpass', f: 2500, q: 1 })
      return tone(ctx, d, { t, f: f * 0.55, f2: f, glide: 0.035, a: 0.002, d: 0.09, peak: 0.12, wet: 0.15 })
    },
  },

  shatter: {
    gain: 0.8, prio: 2, gap: 0.25, max: 1,
    fn({ ctx, d, t, h, rnd, nb, duck }) {
      duck(0.35, 600)
      noise(ctx, d, nb, { t, dur: 0.3, a: 0.001, peak: 0.15, type: 'highpass', f: 1800, q: 0.7, wet: 0.35 })
      noise(ctx, d, nb, { t, dur: 0.12, a: 0.001, peak: 0.09, type: 'bandpass', f: 5200, q: 0.9 })
      noise(ctx, d, nb, { t, dur: 0.1, a: 0.002, peak: 0.08, type: 'bandpass', f: 900, q: 1 })
      tone(ctx, d, { t, f: 130, f2: 55, glide: 0.1, a: 0.002, d: 0.14, peak: 0.12 })
      const notes = scaleNotes(h.scale, 96, 116)
      const N = 34
      let end = t + 0.3
      for (let i = 0; i < N; i++) {
        const tt = t + 0.005 + Math.pow(i / N, 1.8) * 0.75 + rnd() * 0.02
        const m = notes[Math.floor(rnd() * notes.length)]
        const pk = (0.05 - 0.035 * (i / N)) * (0.6 + 0.4 * rnd())
        end = Math.max(end, tone(ctx, d, { t: tt, f: mtof(m), a: 0.0008, d: 0.02 + rnd() * 0.07, peak: pk, pan: (rnd() - 0.5) * 1.4, wet: 0.4 }))
      }
      return end
    },
  },

  reveal: {
    prio: 2, gap: 0.3, max: 1,
    fn({ ctx, d, t, h, nb, duck }) {
      duck(0.25, 900)
      noise(ctx, d, nb, { t, dur: 0.6, a: 0.45, peak: 0.045, type: 'bandpass', f: 700, f2: 4200, sweep: 0.8, q: 0.8, wet: 0.5 })
      const notes = [up(h.tones, 74)]
      while (notes.length < 5) notes.push(up(h.tones, notes[notes.length - 1] + 1))
      let end = t
      notes.forEach((m, i) => {
        end = Math.max(end, bell(ctx, d, { t: t + 0.08 + i * 0.06, f: mtof(m), peak: 0.05 + 0.006 * i, d: 1.3, wet: 0.5, partials: BELL, pan: (i - 2) * 0.15 }))
      })
      const top = notes[notes.length - 1]
      tone(ctx, d, { t: t + 0.35, f: mtof(top + 12), a: 0.2, d: 1.4, peak: 0.018, vib: { rate: 5, depth: 8 }, wet: 0.6 })
      return Math.max(end, t + 2)
    },
  },

  copy: {
    prio: 1, gap: 0.06, max: 2,
    fn({ ctx, d, t, h, nb }) {
      const m1 = near(h.tones, 86)
      const m2 = up(h.tones, m1 + 3)
      noise(ctx, d, nb, { t, dur: 0.004, peak: 0.025, type: 'bandpass', f: 4500, q: 1 })
      tone(ctx, d, { t, f: mtof(m1) * 0.98, f2: mtof(m1), glide: 0.01, a: 0.002, d: 0.05, peak: 0.07 })
      return tone(ctx, d, { t: t + 0.05, f: mtof(m2) * 0.98, f2: mtof(m2), glide: 0.01, a: 0.002, d: 0.1, peak: 0.065, wet: 0.15 })
    },
  },

  error: {
    prio: 2, gap: 0.15, max: 1,
    fn({ ctx, d, t, h }) {
      const bus = sub(ctx, d, { lp: 1400, wet: 0.2 })
      bus.wet = null
      const m1 = near(h.scale, 65)
      const m2 = stepIn(h.scale, m1, -1)
      tone(ctx, bus, { t, f: mtof(m1), type: 'triangle', a: 0.01, d: 0.2, peak: 0.1 })
      tone(ctx, bus, { t, f: mtof(m1) * 1.005, a: 0.01, d: 0.18, peak: 0.04 })
      tone(ctx, bus, { t: t + 0.14, f: mtof(m2) * 1.005, a: 0.01, d: 0.28, peak: 0.04 })
      return tone(ctx, bus, { t: t + 0.14, f: mtof(m2), type: 'triangle', a: 0.01, d: 0.3, peak: 0.1 })
    },
  },

  celebrate: {
    prio: 2, gap: 0.5, max: 1,
    fn({ ctx, d, t, h, rnd, duck }) {
      duck(0.5, 1600)
      const notes = [up(h.tones, 74)]
      while (notes.length < 7) notes.push(up(h.tones, notes[notes.length - 1] + 1))
      let end = t
      notes.forEach((m, i) => {
        end = Math.max(end, bell(ctx, d, { t: t + i * 0.065, f: mtof(m), peak: 0.075 - i * 0.004, d: 1.2, wet: 0.45, partials: BELL_BRIGHT, lp: 8000, pan: (i / 6 - 0.5) * 0.8 }))
      })
      const sparkle = scaleNotes(h.scale, 93, 110)
      for (let i = 0; i < 14; i++) {
        const tt = t + 0.3 + rnd() * 1.3
        end = Math.max(end, tone(ctx, d, { t: tt, f: mtof(sparkle[Math.floor(rnd() * sparkle.length)]), a: 0.001, d: 0.25, peak: 0.02 + rnd() * 0.015, pan: (rnd() - 0.5) * 1.5, wet: 0.5 }))
      }
      const root = up([pc(h.chord.bass)], 62)
      ;[root, up(h.tones, root + 3), up(h.tones, root + 6)].forEach((m) => {
        tone(ctx, d, { t, f: mtof(m), a: 0.3, d: 1.8, peak: 0.03, wet: 0.5 })
      })
      return Math.max(end, t + 2.1)
    },
  },

  heartbeat: {
    gain: 0.6, prio: 2, gap: 0.35, max: 2,
    fn({ ctx, d, t, nb }) {
      const bus = sub(ctx, d, { lp: 320 })
      bus.wet = null
      tone(ctx, bus, { t, f: 62, f2: 48, glide: 0.08, a: 0.006, d: 0.16, peak: 0.4 })
      tone(ctx, bus, { t, f: 124, f2: 96, glide: 0.08, a: 0.006, d: 0.08, peak: 0.08 })
      noise(ctx, bus, nb, { t, dur: 0.05, a: 0.002, peak: 0.08, type: 'lowpass', f: 180, q: 0.7 })
      const t2 = t + 0.24
      tone(ctx, bus, { t: t2, f: 72, f2: 55, glide: 0.07, a: 0.006, d: 0.13, peak: 0.28 })
      tone(ctx, bus, { t: t2, f: 144, f2: 110, glide: 0.07, a: 0.006, d: 0.07, peak: 0.055 })
      return noise(ctx, bus, nb, { t: t2, dur: 0.04, a: 0.002, peak: 0.05, type: 'lowpass', f: 200, q: 0.7 })
    },
  },
}

export const SFX_NAMES = Object.keys(SFX)

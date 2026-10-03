// ============================================================
// 程序化氛围配乐：铺底 pad、深沉 sub、稀疏铃音琶音、环境底噪、（tension）低频心跳脉动
// 纯时间驱动：schedule(until) 把 until 之前的音符全部排程好。
// 线上由 25ms 的 lookahead 调度器调用，离线测试按块调用，两边走同一套代码。
// ============================================================
import { MOODS, EIGHTH, STEPS_PER_BAR, mtof, scaleNotes, near, pc } from './theory.js'
import { tone, bell, PIANO, pinkNoise, padWave, panNode } from './voices.js'

const LAG_RESYNC = 0.25 // 调度落后超过这个值就重新对齐，避免一口气补一堆音

export function createMusic(ctx, g, rnd) {
  // ---------------- 分层节点 ----------------
  const musicIn = g.musicIn
  const verb = g.musicVerb

  // pad：总线 → 低通（慢 LFO 扫动）→ 呼吸颤音 → 电平
  const padBus = ctx.createGain()
  padBus.gain.value = 0.095
  const padFilter = ctx.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = MOODS.calm.padCut
  padFilter.Q.value = 0.45
  const padTrem = ctx.createGain()
  padTrem.gain.value = 1
  const padLevel = ctx.createGain()
  padLevel.gain.value = 0
  padBus.connect(padFilter).connect(padTrem).connect(padLevel)
  padLevel.connect(musicIn)
  const padWet = ctx.createGain(); padWet.gain.value = 0.62
  padLevel.connect(padWet).connect(verb)

  const lfoCut = ctx.createOscillator(); lfoCut.frequency.value = 0.043
  const lfoCutDepth = ctx.createGain(); lfoCutDepth.gain.value = MOODS.calm.padCut * 0.28
  lfoCut.connect(lfoCutDepth).connect(padFilter.frequency)
  const lfoTrem = ctx.createOscillator(); lfoTrem.frequency.value = 0.071
  const lfoTremDepth = ctx.createGain(); lfoTremDepth.gain.value = 0.12
  lfoTrem.connect(lfoTremDepth).connect(padTrem.gain)

  // shimmer：和弦最高两个音再高八度 / 十二度的纯正弦，几乎全进混响，给画面加一层空气感
  const shimBus = ctx.createGain(); shimBus.gain.value = 0.05
  const shimLevel = ctx.createGain(); shimLevel.gain.value = 0
  shimBus.connect(shimLevel)
  const shimDry = ctx.createGain(); shimDry.gain.value = 0.35
  shimLevel.connect(shimDry).connect(musicIn)
  const shimWet = ctx.createGain(); shimWet.gain.value = 1
  shimLevel.connect(shimWet).connect(verb)

  // sub：低通 → 电平（干声）
  const subBus = ctx.createGain(); subBus.gain.value = 0.042
  const subLP = ctx.createBiquadFilter(); subLP.type = 'lowpass'; subLP.frequency.value = 190; subLP.Q.value = 0.5
  const subLevel = ctx.createGain(); subLevel.gain.value = 0
  subBus.connect(subLP).connect(subLevel).connect(musicIn)

  // 铃音：电平 → 干声 + 附点八分延迟（反馈回路里低通，越回越暗）+ 混响
  const bellBus = ctx.createGain(); bellBus.gain.value = 0.6
  const bellLevel = ctx.createGain(); bellLevel.gain.value = 0
  const bellTone = ctx.createBiquadFilter(); bellTone.type = 'lowpass'; bellTone.frequency.value = 5200; bellTone.Q.value = 0.4
  bellBus.connect(bellTone).connect(bellLevel)
  const bellDry = ctx.createGain(); bellDry.gain.value = 0.62
  bellLevel.connect(bellDry).connect(musicIn)
  const bellWet = ctx.createGain(); bellWet.gain.value = 0.75
  bellLevel.connect(bellWet).connect(verb)
  const delay = ctx.createDelay(2)
  delay.delayTime.value = EIGHTH * 1.5
  const fbLP = ctx.createBiquadFilter(); fbLP.type = 'lowpass'; fbLP.frequency.value = 2300
  const fbHP = ctx.createBiquadFilter(); fbHP.type = 'highpass'; fbHP.frequency.value = 280
  const fb = ctx.createGain(); fb.gain.value = 0.34
  const echo = ctx.createGain(); echo.gain.value = 0.36
  bellLevel.connect(echo).connect(delay)
  delay.connect(fbLP).connect(fbHP).connect(fb).connect(delay)
  const echoOut = ctx.createGain(); echoOut.gain.value = 0.8
  const echoPan = panNode(ctx, 0.35)
  if (echoPan) { fbHP.connect(echoPan).connect(echoOut) } else fbHP.connect(echoOut)
  echoOut.connect(musicIn)
  const echoWet = ctx.createGain(); echoWet.gain.value = 0.5
  echoOut.connect(echoWet).connect(verb)

  // 环境底噪：粉红噪声 → 带通成风声 → 慢速阵风 LFO → 电平
  const noiseLP = ctx.createBiquadFilter(); noiseLP.type = 'lowpass'; noiseLP.frequency.value = 620; noiseLP.Q.value = 0.3
  const noiseHP = ctx.createBiquadFilter(); noiseHP.type = 'highpass'; noiseHP.frequency.value = 110
  const gust = ctx.createGain(); gust.gain.value = 0.65
  const lfoGust = ctx.createOscillator(); lfoGust.frequency.value = 0.029
  const lfoGustDepth = ctx.createGain(); lfoGustDepth.gain.value = 0.35
  lfoGust.connect(lfoGustDepth).connect(gust.gain)
  const noiseLevel = ctx.createGain(); noiseLevel.gain.value = 0
  noiseLP.connect(noiseHP).connect(gust).connect(noiseLevel)
  const noiseTrim = ctx.createGain(); noiseTrim.gain.value = 0.075
  noiseLevel.connect(noiseTrim).connect(musicIn)
  const noiseWet = ctx.createGain(); noiseWet.gain.value = 0.02
  noiseLevel.connect(noiseWet).connect(verb)

  // 脉动（tension 的轻心跳）
  const pulseLevel = ctx.createGain(); pulseLevel.gain.value = 0
  const pulseTrim = 0.4
  const pulseLP = ctx.createBiquadFilter(); pulseLP.type = 'lowpass'; pulseLP.frequency.value = 240
  pulseLP.connect(pulseLevel).connect(musicIn)

  const t0 = ctx.currentTime
  ;[lfoCut, lfoTrem, lfoGust].forEach((o) => o.start(t0))

  // ---------------- 状态 ----------------
  let running = false
  let moodName = 'calm'
  let mood = MOODS.calm
  let pending = null
  let nextStep = 0
  let step = 0
  let barCount = 0
  let chordIdx = 0
  let barsInChord = 0
  let chord = mood.chords[0]
  let padVoices = []
  let noiseSrc = null
  let melody = null
  const history = []

  function ramp(param, v, t, tau) { param.cancelScheduledValues(t); param.setTargetAtTime(v, t, tau) }

  function applyLevels(m, t, tau) {
    ramp(padFilter.frequency, m.padCut, t, tau)
    ramp(lfoCutDepth.gain, m.padCut * 0.28, t, tau)
    ramp(padLevel.gain, m.padLevel, t, tau)
    ramp(subLevel.gain, m.subLevel, t, tau)
    ramp(bellLevel.gain, m.bellLevel, t, tau)
    ramp(noiseLevel.gain, m.noiseLevel, t, tau)
    ramp(pulseLevel.gain, m.pulseLevel, t, tau)
    ramp(echo.gain, m.echo, t, tau)
    ramp(shimLevel.gain, m.shimmer ?? 0.5, t, tau)
  }

  // ---------------- 声部 ----------------
  function padVoice(midi, t, attack, level, wave, pan) {
    const f = mtof(midi)
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0, t)
    g1.gain.linearRampToValueAtTime(level, t + attack)
    const oscs = []
    for (const dt of [-6.5, 6.5]) {
      const o = ctx.createOscillator()
      o.setPeriodicWave(wave)
      o.frequency.value = f
      o.detune.value = dt + (rnd() - 0.5) * 3
      o.connect(g1)
      o.start(t)
      oscs.push(o)
    }
    const p = panNode(ctx, pan)
    if (p) g1.connect(p).connect(padBus); else g1.connect(padBus)
    return voice(g1, oscs)
  }

  function subVoice(midi, t, attack, level) {
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0, t)
    g1.gain.linearRampToValueAtTime(level, t + attack)
    const oscs = []
    const a = ctx.createOscillator(); a.frequency.value = mtof(midi); a.connect(g1); oscs.push(a)
    const h = ctx.createOscillator(); h.frequency.value = mtof(midi) * 2
    const hg = ctx.createGain(); hg.gain.value = 0.22
    h.connect(hg).connect(g1); oscs.push(h)
    g1.connect(subBus)
    oscs.forEach((o) => o.start(t))
    return voice(g1, oscs)
  }

  function shimVoice(midi, t, attack, pan) {
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0, t)
    g1.gain.linearRampToValueAtTime(1, t + attack)
    const o = ctx.createOscillator()
    o.frequency.value = mtof(midi)
    o.detune.value = (rnd() - 0.5) * 6
    const vib = ctx.createOscillator(); vib.frequency.value = 0.18 + rnd() * 0.2
    const vg = ctx.createGain(); vg.gain.value = 4
    vib.connect(vg).connect(o.detune)
    o.connect(g1)
    const p = panNode(ctx, pan)
    if (p) g1.connect(p).connect(shimBus); else g1.connect(shimBus)
    o.start(t); vib.start(t)
    return voice(g1, [o, vib])
  }

  function voice(gainNode, oscs) {
    let done = false
    return {
      release(t, tau) {
        if (done) return
        done = true
        gainNode.gain.cancelScheduledValues(t)
        gainNode.gain.setTargetAtTime(0, t, tau)
        const stopAt = t + tau * 7
        oscs.forEach((o) => { try { o.stop(stopAt) } catch {} })
      },
    }
  }

  function triggerChord(t) {
    chord = mood.chords[chordIdx % mood.chords.length]
    padVoices.forEach((v) => v.release(t, mood.release))
    padVoices = []
    const wave = padWave(ctx, mood.bright)
    const n = chord.pad.length
    const lvl = 1 / Math.sqrt(n) / 1.6
    chord.pad.forEach((m, i) => {
      const pan = n > 1 ? ((i / (n - 1)) * 2 - 1) * 0.42 * (i % 2 ? -1 : 1) : 0
      padVoices.push(padVoice(m, t + i * 0.06, mood.attack, lvl, wave, pan))
    })
    padVoices.push(subVoice(chord.bass, t, Math.min(1.8, mood.attack), 0.9))
    const top = chord.pad.slice(-2)
    top.forEach((m, i) => padVoices.push(shimVoice(m + (i ? 12 : 19), t + 0.3 + i * 0.4, mood.attack * 1.3, i ? -0.5 : 0.5)))
    history.push({ t, moodName, mood, chord })
    if (history.length > 24) history.splice(0, history.length - 24)
  }

  function playBell(t, s) {
    const [lo, hi] = mood.range
    const notes = scaleNotes(mood.scale, lo, hi)
    if (!notes.length) return
    if (melody == null || melody >= notes.length) melody = Math.floor(notes.length * 0.4)
    const r = rnd()
    const move = r < 0.06 ? 0 : r < 0.36 ? -1 : r < 0.66 ? 1 : r < 0.8 ? -2 : r < 0.94 ? 2 : (rnd() < 0.5 ? -3 : 3)
    melody += move
    if (melody < 0) melody = -melody
    if (melody >= notes.length) melody = 2 * (notes.length - 1) - melody
    melody = Math.max(0, Math.min(notes.length - 1, melody))
    let m = notes[melody]
    // 强拍落到和弦音上
    if (s % 4 === 0 && !chord.tones.includes(pc(m))) {
      const cand = near(chord.tones, m)
      if (cand >= lo - 2 && cand <= hi + 2) m = cand
    }
    const hiK = (m - lo) / Math.max(1, hi - lo)
    const vel = (0.62 + 0.38 * rnd()) * (1 - hiK * 0.35) * (s === 0 ? 1.1 : 1)
    const dest = { dry: bellBus, wet: null, rnd }
    bell(ctx, dest, {
      t, f: mtof(m), peak: vel * 0.5, d: 3.2 - hiK * 1.2, a: 0.006,
      partials: PIANO, pan: (rnd() - 0.5) * 0.9, lp: 4400,
    })
    // 偶尔加一个下方五度 / 八度的和音
    if (mood.density > 0.25 && rnd() < 0.16) {
      const low = near(chord.tones, m - 7)
      bell(ctx, dest, { t: t + 0.012, f: mtof(low), peak: vel * 0.22, d: 2.6, a: 0.008, partials: PIANO, pan: (rnd() - 0.5) * 0.6, lp: 2400 })
    }
  }

  function pulse(t) {
    const dest = { dry: pulseLP, wet: null, rnd }
    tone(ctx, dest, { t, f: 68, f2: 49, glide: 0.09, a: 0.01, d: 0.2, peak: 0.34 * pulseTrim })
    tone(ctx, dest, { t, f: 136, f2: 98, glide: 0.09, a: 0.01, d: 0.1, peak: 0.07 * pulseTrim })
    tone(ctx, dest, { t: t + 0.23, f: 74, f2: 55, glide: 0.08, a: 0.01, d: 0.16, peak: 0.2 * pulseTrim })
  }

  function onBar(t) {
    if (pending) {
      moodName = pending
      mood = MOODS[pending]
      pending = null
      chordIdx = 0
      barsInChord = 0
      melody = null
      triggerChord(t)
    } else if (barCount === 0) {
      triggerChord(t)
    } else {
      barsInChord++
      if (barsInChord >= mood.barsPerChord) {
        barsInChord = 0
        chordIdx = (chordIdx + 1) % mood.chords.length
        triggerChord(t)
      }
    }
    barCount++
  }

  function onStep(t, s) {
    let p = mood.density * (s % 2 === 0 ? 1 : 0.5) * (s === 0 ? 1.35 : 1)
    if (barCount % 4 === 0) p *= 0.55 // 每四小节留一口气
    if (rnd() < p) playBell(t + rnd() * 0.014, s)
    if (mood.pulse !== false && mood.pulseLevel > 0 && s % 2 === 0) pulse(t)
  }

  // ---------------- 对外 ----------------
  return {
    get running() { return running },
    get mood() { return pending || moodName },

    setMood(name) {
      const m = MOODS[name] ? name : 'calm'
      const now = ctx.currentTime
      if (!running) {
        moodName = m; mood = MOODS[m]; pending = null
        applyLevels(mood, now, 0.05)
        return
      }
      if (m === moodName) {
        if (pending) { pending = null; applyLevels(mood, now, 0.9) }
        return
      }
      if (m === pending) return
      pending = m
      // 滤波与层级立刻开始平滑过渡（约 2.5 秒），和声在下一小节切换
      applyLevels(MOODS[m], now, 0.85)
    },

    start(t) {
      running = true
      if (pending) { moodName = pending; mood = MOODS[pending]; pending = null }
      nextStep = t
      step = 0
      barCount = 0
      chordIdx = 0
      barsInChord = 0
      melody = null
      applyLevels(mood, t, 0.05)
      noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = pinkNoise(ctx)
      noiseSrc.loop = true
      noiseSrc.connect(noiseLP)
      noiseSrc.start(t, rnd() * 5)
    },

    /** 在 t 时刻释放所有持续声部，之后不再排程 */
    halt(t) {
      running = false
      if (pending) { moodName = pending; mood = MOODS[pending]; pending = null }
      padVoices.forEach((v) => v.release(t, 0.25))
      padVoices = []
      if (noiseSrc) { try { noiseSrc.stop(t + 0.3) } catch {} noiseSrc = null }
    },

    schedule(until) {
      if (!running) return
      const now = ctx.currentTime
      if (nextStep < now - LAG_RESYNC) {
        // 主线程卡住太久：跳过错过的格子，但保持小节计数，和声照常推进
        while (nextStep < now) {
          if (step === 0) onBar(Math.max(nextStep, now + 0.01))
          step = (step + 1) % STEPS_PER_BAR
          nextStep += EIGHTH
        }
      }
      let guard = 0
      while (nextStep < until && guard++ < 256) {
        const t = nextStep
        if (step === 0) onBar(t)
        onStep(t, step)
        step = (step + 1) % STEPS_PER_BAR
        nextStep += EIGHTH
      }
    },

    /** t 时刻正在响的和弦与音阶，给音效量化音高用 */
    harmony(t) {
      let h = null
      for (let i = history.length - 1; i >= 0; i--) if (history[i].t <= t + 0.001) { h = history[i]; break }
      if (!h) {
        const m = MOODS[pending || moodName]
        return { mood: pending || moodName, scale: m.scale, chord: m.chords[0], tones: m.chords[0].tones }
      }
      return { mood: h.moodName, scale: h.mood.scale, chord: h.chord, tones: h.chord.tones }
    },
  }
}

// ============================================================
// 乐理：速度、音阶、和弦进行、情绪配置
// 全站在 D 调上：配乐与音效共用同一套音阶，音效会按当前和弦量化音高。
// ============================================================

export const TEMPO = 66
export const BEAT = 60 / TEMPO
export const EIGHTH = BEAT / 2
export const STEPS_PER_BAR = 8
export const BAR = EIGHTH * STEPS_PER_BAR

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
export const pc = (m) => ((Math.round(m) % 12) + 12) % 12
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/** D 大调五声：D E F# A B */
export const D_MAJOR_PENTA = [2, 4, 6, 9, 11]
/** D 小调五声：D F G A C（tension 用） */
export const D_MINOR_PENTA = [2, 5, 7, 9, 0]

/** lo 到 hi 之间所有属于 pcs 的 MIDI 音 */
export function scaleNotes(pcs, lo, hi) {
  const out = []
  for (let m = Math.ceil(lo); m <= hi; m++) if (pcs.includes(pc(m))) out.push(m)
  return out
}

/** 离 midi 最近、属于 pcs 的音（优先向上） */
export function near(pcs, midi) {
  const m0 = Math.round(midi)
  for (let d = 0; d < 12; d++) {
    if (pcs.includes(pc(m0 + d))) return m0 + d
    if (pcs.includes(pc(m0 - d))) return m0 - d
  }
  return m0
}

/** ≥ midi 的第一个属于 pcs 的音 */
export function up(pcs, midi) {
  const m0 = Math.ceil(midi)
  for (let d = 0; d < 12; d++) if (pcs.includes(pc(m0 + d))) return m0 + d
  return m0
}

/** 在音阶里移动 k 级（可为负） */
export function stepIn(pcs, midi, k) {
  let m = near(pcs, midi)
  const dir = k >= 0 ? 1 : -1
  for (let i = 0; i < Math.abs(k); i++) {
    m += dir
    while (!pcs.includes(pc(m))) m += dir
  }
  return m
}

/** 可复现的伪随机（离线测试用固定种子，线上用随机种子） */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------------
// 和弦：bass 为低音（sub 层），pad 为铺底声部（MIDI）
// ------------------------------------------------------------
const C = (bass, pad) => ({ bass, pad, tones: [...new Set(pad.map(pc))] })

// 情绪配置
//   barsPerChord 每个和弦持续几小节     density 铃音每个八分音符出现的概率
//   range 铃音音域                        padCut 铺底低通（Hz）
//   *Level 各层电平（线性）               bright 铺底音色亮度 0-1
//   echo 铃音延迟回声量                  shimmer 高处空气层电平
//   attack / release 铺底起音与释放（秒）
export const MOODS = {
  calm: {
    scale: D_MAJOR_PENTA,
    barsPerChord: 2,
    chords: [
      C(38, [50, 57, 61, 64, 66]), // Dmaj9
      C(35, [47, 54, 57, 62, 64]), // Bm11
      C(31, [43, 50, 54, 57, 59]), // Gmaj9
      C(33, [45, 52, 57, 59, 64]), // Asus2
    ],
    density: 0.22, range: [66, 88],
    padCut: 1250, padLevel: 1.0, subLevel: 0.9, bellLevel: 0.9, noiseLevel: 0.9, pulseLevel: 0,
    shimmer: 0.55, bright: 0.45, echo: 0.36, attack: 2.6, release: 1.4,
  },
  journey: {
    scale: D_MAJOR_PENTA,
    barsPerChord: 1,
    chords: [
      C(38, [50, 57, 59, 64, 66]), // D6/9
      C(37, [49, 52, 57, 59, 64]), // Aadd9/C#
      C(35, [47, 54, 57, 62, 66]), // Bm7
      C(31, [43, 50, 54, 57, 59]), // Gmaj9
    ],
    density: 0.4, range: [66, 90],
    padCut: 1700, padLevel: 0.95, subLevel: 0.95, bellLevel: 1.0, noiseLevel: 0.8, pulseLevel: 0,
    shimmer: 0.6, bright: 0.55, echo: 0.4, attack: 1.8, release: 1.1,
  },
  focus: {
    scale: D_MAJOR_PENTA,
    barsPerChord: 2,
    chords: [
      C(38, [50, 57, 64, 69]), // Dsus2（开放五度）
      C(35, [47, 54, 57, 64]), // Bm(add11)
      C(31, [43, 50, 57, 59]), // Gadd9
      C(33, [45, 52, 57, 62]), // Asus4
    ],
    density: 0.12, range: [69, 86],
    padCut: 900, padLevel: 0.8, subLevel: 0.7, bellLevel: 0.85, noiseLevel: 0.6, pulseLevel: 0,
    shimmer: 0.35, bright: 0.3, echo: 0.3, attack: 2.8, release: 1.6,
  },
  tension: {
    scale: D_MINOR_PENTA,
    barsPerChord: 2,
    chords: [
      C(38, [50, 53, 57, 64]), // Dm(add9)
      C(34, [46, 53, 57, 62]), // Bbmaj7
      C(31, [43, 50, 53, 58]), // Gm7
      C(33, [45, 52, 55, 62]), // A7sus4
    ],
    density: 0.1, range: [62, 81],
    padCut: 650, padLevel: 0.95, subLevel: 1.1, bellLevel: 0.75, noiseLevel: 1.2, pulseLevel: 1.0,
    shimmer: 0.2, bright: 0.35, echo: 0.28, attack: 2.2, release: 1.2,
  },
  safe: {
    scale: D_MAJOR_PENTA,
    barsPerChord: 2,
    chords: [
      C(38, [50, 57, 64, 66, 69]), // Dadd9
      C(31, [55, 59, 62, 66, 69]), // Gmaj9（高位）
      C(35, [47, 54, 57, 62, 64]), // Bm11
      C(33, [57, 59, 64, 69, 71]), // Asus2（高位）
    ],
    density: 0.3, range: [69, 93],
    padCut: 2300, padLevel: 0.9, subLevel: 0.85, bellLevel: 1.0, noiseLevel: 0.6, pulseLevel: 0,
    shimmer: 0.9, bright: 0.6, echo: 0.42, attack: 2.2, release: 1.3,
  },
  triumph: {
    scale: D_MAJOR_PENTA,
    barsPerChord: 1,
    chords: [
      C(38, [50, 57, 62, 66, 69, 76]), // Dadd9
      C(33, [45, 52, 57, 61, 64, 71]), // A6/9
      C(35, [47, 54, 59, 62, 66, 69]), // Bm7
      C(31, [43, 50, 55, 59, 66, 69]), // Gmaj9
    ],
    density: 0.5, range: [71, 95],
    padCut: 2900, padLevel: 0.9, subLevel: 1.0, bellLevel: 1.0, noiseLevel: 0.5, pulseLevel: 0,
    shimmer: 1.0, bright: 0.7, echo: 0.45, attack: 1.6, release: 1.0,
  },
}
export const MOOD_NAMES = Object.keys(MOODS)

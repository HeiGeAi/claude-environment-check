// 氛围切换：同时改背景光色（html[data-mood]）和配乐情绪
// 章节默认 mood 由 main.js 在滚动进入时设置；章节内的剧情（比如演示泄漏）
// 可以临时调用 pushMood('tension')，结束后 popMood() 恢复。
import { audio } from './audio.js'

let base = 'calm'
let override = null

function apply() {
  const m = override || base
  if (document.documentElement.dataset.mood !== m) {
    document.documentElement.dataset.mood = m
    audio.setMood(m)
  }
}

export function setBaseMood(m) { base = m; apply() }
export function pushMood(m) { override = m; apply() }
export function popMood() { override = null; apply() }
export function currentMood() { return override || base }

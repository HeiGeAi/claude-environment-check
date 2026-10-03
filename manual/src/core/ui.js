// 共享 UI 工具：代码块（高亮 + 复制）、提示条、声音绑定、HTML 转义
import { audio } from './audio.js'

/** 转义，拼模板字符串时用来放代码 */
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

let toastTimer
export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.classList.add('is-on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms)
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;left:-9999px;top:0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch {}
    ta.remove()
    return ok
  }
}

/* ---------------- 极简语法高亮 ---------------- */
const RULES = {
  bash: [
    [/(#[^\n]*)/, 'c'],
    [/("(?:\\.|[^"\\])*"|'[^']*')/, 's'],
    [/(\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)/, 'v'],
    [/\b(if|then|else|fi|for|do|done|exit|export|exec|set|printf|curl|sudo|type|launchctl|netstat|ifconfig|scutil|rg|nft|pfctl|plutil)\b/, 'k'],
    [/(\s-{1,2}[A-Za-z][\w-]*)/, 'o'],
    [/\b(\d+)\b/, 'n'],
  ],
  yaml: [
    [/(#[^\n]*)/, 'c'],
    [/("(?:\\.|[^"\\])*"|'[^']*')/, 's'],
    [/^(\s*-?\s*[A-Za-z_][\w-]*)(?=:)/m, 'k'],
    [/\b(true|false|null|socks5|select)\b/, 'n'],
    [/\b(\d+)\b/, 'n'],
    [/((?:PROCESS-NAME-REGEX|PROCESS-PATH-REGEX|DOMAIN-SUFFIX|DOMAIN|MATCH))/, 'p'],
  ],
  xml: [
    [/(<!--[\s\S]*?-->)/, 'c'],
    [/("(?:[^"])*")/, 's'],
    [/(<\/?[A-Za-z!?][\w:-]*|\/?>)/, 'p'],
  ],
  conf: [
    [/(#[^\n]*)/, 'c'],
    [/("(?:\\.|[^"\\])*")/, 's'],
    [/^([A-Z_][A-Z0-9_]*)(?==)/m, 'k'],
    [/\b(\d+)\b/, 'n'],
  ],
  nft: [
    [/(#[^\n]*)/, 'c'],
    [/("(?:\\.|[^"\\])*")/, 's'],
    [/(\$[a-z_]+)/, 'v'],
    [/\b(define|table|chain|type|filter|hook|output|priority|policy|drop|accept|counter|oifname|ip|daddr|tcp|dport|inet)\b/, 'k'],
    [/\b(\d+(?:\.\d+){0,3})\b/, 'n'],
  ],
  pf: [
    [/(#[^\n]*)/, 'c'],
    [/(<[a-z_0-9]+>)/, 'v'],
    [/\b(block|drop|out|quick|inet6?|proto|from|any|to|tcp|udp)\b/, 'k'],
  ],
  text: [],
}

export function highlight(code, lang = 'text') {
  const rules = RULES[lang] || []
  if (!rules.length) return esc(code)
  // 逐行处理，按规则顺序切片，避免嵌套替换
  return code.split('\n').map((line) => {
    let out = ''
    let rest = line
    let guard = 0
    while (rest.length && guard++ < 400) {
      let best = null
      for (const [re, cls] of rules) {
        const m = new RegExp(re.source, re.flags.replace('g', '')).exec(rest)
        if (m && (best === null || m.index < best.m.index)) best = { m, cls }
      }
      if (!best) { out += esc(rest); break }
      const { m, cls } = best
      const hit = m[1] ?? m[0]
      const at = m.index + (m[0].indexOf(hit))
      out += esc(rest.slice(0, at)) + `<span class="tok-${cls}">${esc(hit)}</span>`
      rest = rest.slice(at + hit.length)
      if (!hit.length) { out += esc(rest); break }
    }
    return out
  }).join('\n')
}

/**
 * 生成代码块 HTML。code 传原文（不要预先转义）。
 * codeBlock({ code, lang: 'bash', title: 'guarded-claude-example.sh', note: '教学脚本 · 未自动安装' })
 */
export function codeBlock({ code, lang = 'text', title = '', note = '' }) {
  const raw = code.replace(/^\n+|\s+$/g, '')
  return `<div class="codeblock" data-lang="${lang}">
    <div class="codeblock__bar">
      <span class="codeblock__dots" aria-hidden="true"><i></i><i></i><i></i></span>
      ${title ? `<span class="codeblock__title">${esc(title)}</span>` : ''}
      ${note ? `<span class="codeblock__note">${esc(note)}</span>` : '<span style="margin-left:auto"></span>'}
      <button class="codeblock__copy" type="button" data-sfx="click">复制</button>
    </div>
    <pre data-lenis-prevent><code>${highlight(raw, lang)}</code></pre>
    <textarea hidden>${esc(raw)}</textarea>
  </div>`
}

/** 在 root 内启用所有代码块复制按钮（main.js 会对全页调用一次，章节也可再调） */
export function enhanceCodeBlocks(root = document) {
  root.querySelectorAll('.codeblock:not([data-ready])').forEach((cb) => {
    cb.setAttribute('data-ready', '')
    const btn = cb.querySelector('.codeblock__copy')
    const src = cb.querySelector('textarea')
    if (!btn || !src) return
    btn.addEventListener('click', async () => {
      const ok = await copyText(src.value)
      audio.sfx(ok ? 'copy' : 'error')
      btn.textContent = ok ? '已复制' : '复制失败'
      btn.classList.toggle('is-done', ok)
      toast(ok ? '已复制到剪贴板。复制不会执行任何命令' : '复制失败，请手动选中文本')
      setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('is-done') }, 1800)
    })
  })
}

/**
 * 声音绑定：给元素加 data-sfx="click" 就会在点击时播放；
 * data-sfx-hover="hover" 在鼠标悬停时播放（已节流）。
 * main.js 用事件委托全局处理，章节不需要自己绑定。
 */
export function bindSfxDelegation() {
  let lastHover = 0
  let lastHoverEl = null
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-sfx]')
    if (el) audio.sfx(el.dataset.sfx)
  })
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-sfx-hover], .btn, .segmented button, .tool-btn')
    if (!el || el === lastHoverEl) return
    lastHoverEl = el
    const now = performance.now()
    if (now - lastHover < 70) return
    lastHover = now
    audio.sfx(el.dataset.sfxHover || 'hover')
  })
  document.addEventListener('pointerout', (e) => {
    if (lastHoverEl && !lastHoverEl.contains(e.relatedTarget)) lastHoverEl = null
  })
}

/** 简单的一次性事件总线 */
export const bus = {
  on: (name, fn) => document.addEventListener(`guide:${name}`, (e) => fn(e.detail)),
  emit: (name, detail) => document.dispatchEvent(new CustomEvent(`guide:${name}`, { detail })),
}

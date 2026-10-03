// ============================================================
// 封面：原生 WebGL 光流 + 逐字升起的标题
// 画面含义：暖金光流 = 受控路线，全部汇入同一扇发光的门（固定出口）；
// 少数红色光流想从旁边溜走，半路撞上一道看不见的墙，熄灭。
// 入场节奏与 opening.js 配合：start 事件后先点亮光门，约 0.9 秒后标题升起。
// ============================================================
import './hero.css'
import { gsap, ScrollTrigger, whenVisible, magnetic, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { bus } from '../core/ui.js'

const LINES = [
  { text: '让每一个请求，', warm: [] },
  { text: '都只走那扇对的门。', warm: [3, 8] }, // 「那扇对的门」
]

/* ---------------- 着色器 ---------------- */
const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2 uRes;      // 画布像素
uniform vec2 uDoor;     // 光门中心（像素，y 向上）
uniform float uL;       // 长度单位（像素）
uniform float uTime;
uniform vec2 uMouse;    // 指针（像素，y 向上）
uniform float uMouseOn;
uniform float uIntro;   // 光流从外向内汇聚 0-1
uniform float uGlow;    // 光门点亮 0-1
uniform float uScroll;  // 滚出封面的进度 0-1

#define TAU 6.28318530718

float hash(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i), b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0)), d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uDoor) / uL;

  // 滚动：镜头推向门，光流加速
  float zoom = 1.0 - uScroll * 0.38;
  vec2 pz = p * zoom;
  float spd = 1.0 + uScroll * 2.6;
  float t = uTime;

  // 指针：把附近的空间轻轻吸过去，光流随之弯向指针（门本身不变形）
  vec2 m = (uMouse - uDoor) / uL * zoom;
  vec2 dm = pz - m;
  float fm = exp(-dot(dm, dm) * 12.0) * uMouseOn;
  vec2 q = pz - dm * fm * 0.2;

  float r = length(q) + 1e-4;
  float a = atan(q.y, q.x);
  float lr = log(r);
  vec2 dir = q / r;

  // 光门（拱形）：上半圆 + 下方长方形
  vec2 dq = pz - vec2(0.0, 0.03);
  float dBox = sdBox(dq - vec2(0.0, -0.065), vec2(0.058, 0.065));
  float dArc = length(dq) - 0.058;
  float dDoor = min(dBox, dArc);

  // 汇聚的波前：从屏幕外向门推进
  float front = mix(2.6, -0.2, uIntro);
  float introMask = smoothstep(front - 0.02, front + 0.42, r) * step(0.001, uIntro);
  introMask = mix(introMask, 1.0, smoothstep(0.85, 1.0, uIntro));

  float warp = (noise(dir * 1.7 + vec2(lr * 1.1 - t * 0.04, 0.0)) - 0.5) * 1.1;
  float absorb = smoothstep(0.0, 0.05, dDoor);        // 进门后消失
  float nearBoost = 1.0 + 1.6 * exp(-r * 5.0);       // 靠近门更亮

  vec3 col = vec3(0.0);
  vec3 goldA = vec3(1.0, 0.56, 0.26);
  vec3 goldB = vec3(1.0, 0.86, 0.62);

  // 第一层：密的主光流
  {
    float N = 30.0;
    float s = a / TAU * N + lr * 2.3 + warp;
    float id = mod(floor(s), N);
    float lf = fract(s) - 0.5;
    float h = hash(id + 3.7);
    float w = clamp(0.018 / r, 0.045, 0.3);
    float line = exp(-lf * lf / (w * w));
    float act = step(0.3, h);
    float v = fract(lr * 1.55 + t * (0.22 + h * 0.3) * spd + h * 9.0);
    float comet = pow(1.0 - v, 6.0) * smoothstep(0.0, 0.025, v);
    float base = 0.06 + 0.05 * h;
    float farFade = 1.0 - smoothstep(0.9, 1.9, r);
    float k = line * act * absorb * nearBoost * farFade * introMask;
    col += mix(goldA, goldB, comet) * (base + comet * 1.15) * k;
  }
  // 第二层：稀疏、较粗、较慢，拉出景深
  {
    float N = 11.0;
    float s = a / TAU * N + lr * 1.4 - warp * 0.6 + 0.37;
    float id = mod(floor(s), N);
    float lf = fract(s) - 0.5;
    float h = hash(id + 41.0);
    float w = clamp(0.02 / r, 0.03, 0.22);
    float line = exp(-lf * lf / (w * w));
    float act = step(0.45, h);
    float v = fract(lr * 0.9 + t * (0.12 + h * 0.12) * spd + h * 5.0);
    float comet = pow(1.0 - v, 9.0) * smoothstep(0.0, 0.03, v);
    float farFade = 1.0 - smoothstep(0.7, 1.6, r);
    float k = line * act * absorb * farFade * introMask;
    col += vec3(1.0, 0.72, 0.42) * (0.025 + comet * 0.7) * k;
  }

  // 红色光流：从门附近向外溜，撞上看不见的墙（半径 rW）后熄灭
  {
    float rW = 0.56;
    float N = 9.0;
    float s = a / TAU * N + lr * 0.35 + warp * 0.25 + 0.5;
    float id = mod(floor(s), N);
    float lf = fract(s) - 0.5;
    float h = hash(id + 11.0);
    float act = step(0.66, h) * introMask;
    float k = 0.8;
    float sp = 0.16 + h * 0.06;
    float v = fract(-lr * k + t * sp + h * 4.0);
    float comet = pow(1.0 - v, 7.0) * smoothstep(0.0, 0.02, v);
    float wr = clamp(0.011 / r, 0.015, 0.08);
    float line = exp(-lf * lf / (wr * wr));
    float vis = smoothstep(0.17, 0.3, r) * (1.0 - smoothstep(rW - 0.012, rW, r));
    col += vec3(1.0, 0.2, 0.28) * comet * line * vis * act * 2.0;
    // 撞墙的一瞬：一小段弧形闪光
    float vW = fract(-log(rW) * k + t * sp + h * 4.0);
    float hit = pow(1.0 - vW, 16.0);
    float arc = exp(-pow((r - rW) * 90.0, 2.0)) * exp(-lf * lf / (0.2 * 0.2));
    col += vec3(1.0, 0.3, 0.36) * arc * hit * act * 2.2;
    float ripple = exp(-pow((r - rW - (1.0 - hit) * 0.05) * 140.0, 2.0)) * exp(-lf * lf / (0.34 * 0.34));
    col += vec3(1.0, 0.45, 0.45) * ripple * hit * act * 0.35;
  }

  // 光门本体
  float inside = 1.0 - smoothstep(-0.0015, 0.0015, dDoor);
  float ig = uGlow;
  vec3 doorCol = mix(vec3(1.0, 0.78, 0.52), vec3(1.0, 0.97, 0.9), smoothstep(-0.1, 0.06, dq.y) * 0.6 + 0.4);
  float rays = (0.9 + 0.1 * sin(dq.x * 160.0 + t * 0.6)) * (0.82 + 0.18 * exp(-abs(dq.x) * 28.0));
  col = mix(col, doorCol * rays * 1.25, inside * ig);
  float od = max(dDoor, 0.0);
  col += vec3(1.0, 0.62, 0.32) * (exp(-od * 34.0) * 0.55 + exp(-od * 9.0) * 0.28) * ig;
  col += vec3(1.0, 0.9, 0.75) * exp(-abs(dDoor) * 420.0) * 0.9 * ig;
  // 地面的光
  float fy = pz.y + 0.105;
  float fyk = fy < 0.0 ? 1500.0 : 9000.0;
  col += vec3(1.0, 0.6, 0.3) * exp(-(pz.x * pz.x * 22.0 + fy * fy * fyk)) * 0.5 * ig;
  col += vec3(1.0, 0.55, 0.3) * exp(-(pz.x * pz.x * 4.0 + fy * fy * 90.0)) * 0.08 * ig;

  // 背景：夜色、门后的暖晕、星点
  vec2 uv = frag / uRes;
  vec3 bg = mix(vec3(0.028, 0.031, 0.047), vec3(0.04, 0.045, 0.08), uv.y);
  bg += vec3(1.0, 0.5, 0.24) * exp(-length(pz) * 2.4) * 0.16 * (0.3 + 0.7 * ig);
  bg += vec3(0.3, 0.34, 0.8) * exp(-length(uv - vec2(0.1, 0.95)) * 2.4) * 0.05;
  vec2 cell = floor(frag / 3.0);
  float st = hash2(cell);
  float star = step(0.9975, st) * (0.35 + 0.65 * sin(t * (0.6 + st * 2.0) + st * 40.0) * 0.5 + 0.3) * smoothstep(0.1, 0.6, uv.y);
  bg += vec3(0.9, 0.9, 1.0) * star * 0.5;

  // 指针处一点暖光
  col += vec3(1.0, 0.7, 0.4) * exp(-dot(dm, dm) * 60.0) * 0.07 * uMouseOn;

  col += bg;
  // 暗角
  vec2 vc = uv - 0.5;
  col *= 1.0 - dot(vc, vc) * 0.7;
  // 色调映射 + 抖动，防止色带
  col = 1.0 - exp(-col * 1.25);
  col += (hash2(frag + fract(t) * 17.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`

/* ---------------- WebGL 渲染器 ---------------- */
function createRenderer(canvas) {
  let gl = null
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'default' })
  } catch { gl = null }
  if (!gl) return null

  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[hero] shader', gl.getShaderInfoLog(s))
      return null
    }
    return s
  }
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const fs = compile(gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null
  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[hero] link', gl.getProgramInfoLog(prog))
    return null
  }
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const U = {}
  ;['uRes', 'uDoor', 'uL', 'uTime', 'uMouse', 'uMouseOn', 'uIntro', 'uGlow', 'uScroll'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n) })

  return {
    gl,
    draw(s) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(U.uRes, canvas.width, canvas.height)
      gl.uniform2f(U.uDoor, s.doorX, s.doorY)
      gl.uniform1f(U.uL, s.L)
      gl.uniform1f(U.uTime, s.time)
      gl.uniform2f(U.uMouse, s.mx, s.my)
      gl.uniform1f(U.uMouseOn, s.mouseOn)
      gl.uniform1f(U.uIntro, s.intro)
      gl.uniform1f(U.uGlow, s.glow)
      gl.uniform1f(U.uScroll, s.scroll)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
  }
}

/* ---------------- 夜色小城的剪影（细线 + 几扇亮着的窗） ---------------- */
function skyline() {
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  const W = 1600
  const H = 180
  let x = -10
  let body = ''
  let wins = ''
  while (x < W) {
    const bw = 46 + rnd() * 90
    const bh = 36 + rnd() * 110
    const top = H - bh
    const roof = rnd()
    if (roof < 0.34) {
      body += `M${x} ${H}V${top + 16}L${x + bw / 2} ${top - 10}L${x + bw} ${top + 16}V${H}`
    } else if (roof < 0.5) {
      body += `M${x} ${H}V${top}H${x + bw * 0.62}V${top - 22}H${x + bw * 0.8}V${top}H${x + bw}V${H}`
    } else {
      body += `M${x} ${H}V${top}H${x + bw}V${H}`
    }
    const cols = Math.max(1, Math.floor(bw / 22))
    const rows = Math.max(1, Math.floor((bh - 26) / 24))
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rnd() > 0.16) continue
        const wx = x + 10 + c * ((bw - 20) / cols)
        const wy = top + 20 + r * 24
        wins += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="7" height="9" rx="1.5" style="--d:${(rnd() * 6).toFixed(2)}s"/>`
      }
    }
    x += bw + 4 + rnd() * 16
  }
  return `<svg class="s-hero__city" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <path class="s-hero__city-line" d="${body}"/>
    <g class="s-hero__city-win">${wins}</g>
  </svg>`
}

function titleHTML() {
  return LINES.map(({ text, warm }) => {
    const chars = [...text]
    const [ws, we] = warm.length ? warm : [-1, -2]
    const n = we - ws
    const spans = chars.map((ch, i) => {
      const isWarm = i >= ws && i < we
      const style = isWarm && n > 1 ? ` style="background-position:${((i - ws) / (n - 1)) * 100}% 0;background-size:${n * 100}% 100%"` : ''
      return `<span class="s-hero__ch${isWarm ? ' is-warm' : ''}"${style}>${ch}</span>`
    }).join('')
    return `<span class="s-hero__line" aria-hidden="true"><span class="s-hero__line-in">${spans}</span></span>`
  }).join('')
}

const ICON = {
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.3 6.4a8 8 0 0 1 0 11.2"/></svg>',
  level: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="16" cy="12" r="2.6"/></svg>',
}

export default {
  id: 'hero',
  nav: '封面',
  desc: '',
  mood: 'calm',
  mount(el) {
    el.innerHTML = `
      <div class="s-hero__bg" aria-hidden="true">
        <div class="s-hero__fallback"><i class="s-hero__fb-door"></i></div>
        <canvas class="s-hero__gl"></canvas>
        ${skyline()}
        <div class="s-hero__shade"></div>
      </div>
      <div class="s-hero__door" aria-hidden="true">
        <span class="s-hero__door-tag"><i></i>受控出口<em>固定的快递代收点</em></span>
      </div>
      <div class="s-hero__content">
        <div class="wrap s-hero__wrap">
          <p class="s-hero__kicker"><span class="latin">Field Guide</span><span class="s-hero__bar"></span><span>Claude 防封指南 · 小白图解版</span></p>
          <h1 class="s-hero__title" tabindex="-1" aria-label="让每一个请求，都只走那扇对的门。">${titleHTML()}</h1>
          <p class="s-hero__sub">从零开始，用比喻和动画看懂：电脑为什么会「露馅」，哪些环节你能自己把好关。</p>
          <ul class="s-hero__meta">
            <li>${ICON.clock}约 15 分钟</li>
            <li>${ICON.sound}有声音</li>
            <li>${ICON.level}可切换进阶模式</li>
          </ul>
          <div class="s-hero__actions">
            <a class="btn btn--primary s-hero__go" href="#truth" data-jump="#truth" data-sfx="click">开始旅程 <span class="arrow" aria-hidden="true">↓</span></a>
            <a class="btn btn--ghost" href="#build" data-jump="#build" data-level="pro" data-sfx="click">我懂技术，直接看配置</a>
          </div>
          <div class="s-hero__foot">
            <p class="s-hero__credit">改编自「智能体先锋队」《Claude 防护方法手册 · 本机实战版 v3.0》（2026.09.26）</p>
            <ul class="s-hero__legend" aria-label="背景动画说明">
              <li><i class="is-gold"></i>暖金光流：受控路线，都汇入同一扇门</li>
              <li><i class="is-red"></i>红色光流：想绕路直连，半路被拦下</li>
              <li class="s-hero__demo">背景为示意动画</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="s-hero__cue" aria-hidden="true"><span>向下滚动</span><i></i></div>`

    const canvas = el.querySelector('.s-hero__gl')
    const inner = el.querySelector('.s-hero__wrap')
    const chars = el.querySelectorAll('.s-hero__line-in')
    const lateEls = el.querySelectorAll('.s-hero__kicker, .s-hero__sub, .s-hero__meta, .s-hero__actions, .s-hero__foot')
    const decoEls = el.querySelectorAll('.s-hero__door-tag, .s-hero__cue')
    magnetic(el.querySelector('.s-hero__go'), 0.22)

    /* ---------- 状态 ---------- */
    const S = {
      doorX: 0, doorY: 0, L: 1, time: 3.2,
      mx: -9999, my: -9999, mouseOn: 0, mouseTarget: 0,
      intro: 0, glow: 0, scroll: 0, scrollTarget: 0,
      scale: 1, dx: 0.74, dy: 0.4,
    }
    let started = false
    let running = false
    let visible = true
    let raf = 0

    const renderer = createRenderer(canvas)
    if (!renderer) el.classList.add('is-nogl')
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); el.classList.add('is-nogl') })

    /* ---------- 尺寸：DPR 上限 1.75，按像素预算降采样 ---------- */
    let budget = 1.6e6
    function layout() {
      const w = el.clientWidth
      const h = el.clientHeight
      const vh = Math.min(h, window.innerHeight || h)
      const wide = w >= 900
      const Lcss = Math.min(w * 1.25, vh)
      S.dx = wide ? 0.745 : 0.5
      // 门的纵向位置按视口算（窄屏的封面可以比一屏高，门仍留在首屏上部）
      const doorTop = wide ? vh * 0.4 : Math.max(150, vh * (vh / w > 1.5 ? 0.23 : 0.27))
      S.dy = doorTop / h
      el.style.setProperty('--door-x', `${S.dx * 100}%`)
      el.style.setProperty('--door-y', `${doorTop.toFixed(1)}px`)
      el.style.setProperty('--door-bottom', `${(doorTop + 0.15 * Lcss + 30).toFixed(1)}px`) // 门下沿 + 标签
      el.style.setProperty('--door-w', `${(0.26 * Lcss).toFixed(1)}px`)
      el.style.setProperty('--door-h', `${(0.3 * Lcss).toFixed(1)}px`)
      el.style.setProperty('--door-L', `${Lcss.toFixed(1)}px`)
      if (!renderer) return
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      S.scale = Math.min(dpr, Math.sqrt(budget / Math.max(1, w * h)))
      const cw = Math.max(2, Math.round(w * S.scale))
      const ch = Math.max(2, Math.round(h * S.scale))
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch }
      S.L = Lcss * S.scale
      S.doorX = S.dx * cw
      S.doorY = (1 - S.dy) * ch
      if (!running) renderer.draw(S)
    }
    const ro = new ResizeObserver(layout)
    ro.observe(el)
    layout()

    /* ---------- 循环：仅在开场后、可见时运行 ---------- */
    let last = 0
    let slowFrames = 0
    let frames = 0
    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
      last = now
      S.time += dt
      S.scroll += (S.scrollTarget - S.scroll) * Math.min(1, dt * 6)
      S.mouseOn += (S.mouseTarget - S.mouseOn) * Math.min(1, dt * 4)
      renderer.draw(S)
      // 集显保护：连续慢帧就降低渲染分辨率
      frames++
      if (frames > 20) slowFrames = dt > 0.026 ? slowFrames + 1 : Math.max(0, slowFrames - 1)
      if (slowFrames > 45 && budget > 4e5) { budget *= 0.6; slowFrames = 0; layout() }
    }
    function start() {
      if (running || !renderer || prefersReduced || !started || !visible) return
      running = true
      last = 0
      raf = requestAnimationFrame(frame)
    }
    function stop() {
      running = false
      cancelAnimationFrame(raf)
    }
    whenVisible(el, () => { visible = true; start() }, () => { visible = false; stop() }, '0px')
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start() })

    /* ---------- 指针 ---------- */
    el.addEventListener('pointermove', (e) => {
      if (!renderer || prefersReduced) return
      const r = canvas.getBoundingClientRect()
      S.mx = (e.clientX - r.left) * S.scale
      S.my = (r.bottom - e.clientY) * S.scale
      S.mouseTarget = e.pointerType === 'touch' ? 0.7 : 1
    })
    el.addEventListener('pointerleave', () => { S.mouseTarget = 0 })

    /* ---------- 初始态：开场前全部隐藏 ---------- */
    if (!prefersReduced) {
      gsap.set(chars, { yPercent: 115 })
      gsap.set(lateEls, { y: 26, opacity: 0 })
      gsap.set(decoEls, { opacity: 0 })
    }

    /* ---------- 入场 ---------- */
    bus.on('start', () => {
      if (started) return
      started = true
      if (prefersReduced) {
        S.intro = 1; S.glow = 1
        renderer?.draw(S)
        return
      }
      start()
      const tl = gsap.timeline()
      // 光门先点亮；约 0.72 秒时开场的小请求正好飞进门里，门闪一下
      tl.to(S, { glow: 1, duration: 0.7, ease: 'power2.out' }, 0.02)
        .to(S, { glow: 1.9, duration: 0.1, ease: 'power2.out' }, 0.72)
        .to(S, { glow: 1, duration: 0.9, ease: 'power2.out' }, 0.82)
        .to(S, { intro: 1, duration: 2.6, ease: 'power2.out' }, 0.25)
        .call(() => audio.sfx('whoosh'), null, 0.9)
        .to(chars, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.12 }, 0.9)
        .to(lateEls, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 1.15)
        .to(decoEls, { opacity: 1, duration: 1.2, ease: 'power2.out', stagger: 0.2 }, 1.8)
    })
    if (prefersReduced) { S.intro = 1; S.glow = 1; S.time = 6; renderer?.draw(S) }

    /* ---------- 滚动：标题视差 + 光流加速汇入 ---------- */
    ScrollTrigger.create({
      trigger: el, start: 'top top', end: 'bottom top',
      onUpdate: (self) => {
        S.scrollTarget = self.progress
        if (prefersReduced && renderer) { S.scroll = self.progress; renderer.draw(S) }
      },
    })
    if (!prefersReduced) {
      gsap.to(inner, { yPercent: -14, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true } })
    }
  },
}

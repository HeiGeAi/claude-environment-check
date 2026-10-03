// Original 夜色小城 gate shaders. Extracted unchanged from sections/hero.js.
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
uniform float uBlocked; // 手册示意可包含阻断红线；检测页明确关闭

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
    float act = step(0.66, h) * introMask * uBlocked;
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


/** Pure renderer shared by the manual and its environment-check companion. */
export function createGateRenderer(canvas) {
  let gl;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false,
      stencil: false, premultipliedAlpha: false, powerPreference: 'default' });
  } catch { return null; }
  if (!gl) return null;
  const objects = [];
  let disposed = false;
  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Shader unavailable');
    objects.push(['Shader', shader]);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed');
    return shader;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const [kind, object] of objects.reverse()) gl[`delete${kind}`](object);
  }
  try {
    const vertex = compile(gl.VERTEX_SHADER, VERT), fragment = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!program) throw new Error('Program unavailable');
    objects.push(['Program', program]);
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader linking failed');
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Buffer unavailable');
    objects.push(['Buffer', buffer]); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, 'aPos');
    if (location < 0) throw new Error('Vertex attribute unavailable');
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    const uniforms = {};
    for (const name of ['uRes','uDoor','uL','uTime','uMouse','uMouseOn','uIntro','uGlow','uScroll','uBlocked']) uniforms[name] = gl.getUniformLocation(program, name);
    return {
      gl,
      draw(state) {
        if (disposed || gl.isContextLost()) return;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
        gl.uniform2f(uniforms.uDoor, state.doorX, state.doorY);
        gl.uniform1f(uniforms.uL, state.L); gl.uniform1f(uniforms.uTime, state.time);
        gl.uniform2f(uniforms.uMouse, state.mx, state.my);
        gl.uniform1f(uniforms.uMouseOn, state.mouseOn);
        gl.uniform1f(uniforms.uIntro, state.intro); gl.uniform1f(uniforms.uGlow, state.glow);
        gl.uniform1f(uniforms.uScroll, state.scroll);
        gl.uniform1f(uniforms.uBlocked, state.blocked ?? 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose
    };
  } catch { dispose(); return null; }
}

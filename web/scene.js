// Shared courier from the original guide. This picture follows actual app
// phases; it never assigns network findings or certifies a protected path.
import { mascot } from '../manual/src/core/mascot.js';

export function createScene() {
  const scene = document.getElementById('check-scene');
  const label = document.getElementById('scene-label');
  const art = document.getElementById('scene-art');
  const brand = document.getElementById('brand-courier');
  if (!scene || !label || !art) return { update() {} };
  // Only trusted static SVG goes into this markup. Report text cannot enter it.
  if (brand) brand.innerHTML = mascot({ size: 30 });
  art.innerHTML = `<svg class="network-scene" viewBox="0 0 560 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <radialGradient id="check-gate-halo"><stop stop-color="#ffb35c" stop-opacity=".24"/><stop offset="1" stop-color="#ff7a52" stop-opacity="0"/></radialGradient>
      <linearGradient id="check-gate" x1="0" y1="0" x2=".15" y2="1"><stop stop-color="#fff7e8"/><stop offset=".55" stop-color="#ffd08a"/><stop offset="1" stop-color="#ff7a52"/></linearGradient>
      <linearGradient id="check-route"><stop stop-color="#ffb35c" stop-opacity=".1"/><stop offset="1" stop-color="#ffd08a" stop-opacity=".7"/></linearGradient>
      <linearGradient id="check-ground"><stop stop-color="#ffb35c" stop-opacity="0"/><stop offset=".5" stop-color="#ffb35c" stop-opacity=".3"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></linearGradient>
    </defs>
    <ellipse class="scene-halo" cx="424" cy="186" rx="158" ry="180" fill="url(#check-gate-halo)"/>
    <g fill="none" stroke="#f4efe6" stroke-opacity=".055" stroke-width="1">
      <ellipse cx="290" cy="270" rx="210" ry="55"/><ellipse cx="290" cy="270" rx="150" ry="40"/>
      <path d="M32 318H535M70 332H497M130 350H454M125 269L61 353M224 268L200 355M365 268L405 355M462 268L534 354"/>
    </g>
    <g fill="rgba(7,8,12,.6)" stroke="#f4efe6" stroke-opacity=".15" stroke-width="1">
      <path d="M32 270v-54l40-27 39 27v54M47 260v-37h20v37M89 235h11v13H89z"/>
      <path d="M168 271v-22h35v22M200 270v-47h26v47M241 270v-30h20v30M504 269v-56h30v56"/>
    </g>
    <g fill="#ffb35c" opacity=".4"><rect x="177" y="254" width="5" height="7" rx="1"/><rect x="212" y="234" width="5" height="7" rx="1"/><rect x="514" y="226" width="5" height="7" rx="1"/></g>
    <path d="M108 256C180 252 200 191 267 193S350 221 397 213" fill="none" stroke="url(#check-route)" stroke-width="1.5"/>
    <path class="route-light" d="M187 228C214 211 235 191 267 193S317 209 338 213" fill="none" stroke="#ffd08a" stroke-width="2" opacity=".45"/>
    <g fill="#ffd08a" opacity=".4"><circle cx="222" cy="205" r="2"/><circle cx="281" cy="195" r="2"/><circle cx="352" cy="216" r="2"/></g>
    <path d="M398 262V138a26 26 0 0 1 52 0v124z" fill="url(#check-gate)" opacity=".88"/>
    <path d="M389 262V138a35 35 0 0 1 70 0v124" fill="none" stroke="#ffd08a" stroke-opacity=".35" stroke-width="1"/>
    <path d="M349 266H499" stroke="url(#check-ground)" stroke-width="3"/>
    <ellipse cx="424" cy="273" rx="83" ry="9" fill="url(#check-gate-halo)"/>
    <g font-family="-apple-system,PingFang SC,sans-serif" font-size="11" fill="#f4efe6" fill-opacity=".5">
      <text x="52" y="295">当前浏览器</text><text x="399" y="305">请求出口</text>
    </g>
    <path d="M459 135h21" stroke="#ffb35c" stroke-opacity=".45"/><rect x="478" y="122" width="62" height="25" rx="12.5" fill="#0e1119" stroke="#ffb35c" stroke-opacity=".35"/>
    <text x="509" y="138" text-anchor="middle" font-size="10" font-family="-apple-system,PingFang SC,sans-serif" fill="#ffd08a">光门示意</text>
  </svg><div class="scene-courier">${mascot({ size: 82 })}</div>`;
  const messages = { ready: '小请求已就位', running: '小请求正在收集证据', complete: '本轮证据已整理', stopped: '小请求停下了，未完成项会保留', error: '本轮未完成，可以重新核对', import: '正在阅读本机生成的证据' };
  return {
    update(status = 'ready', step = null) {
      scene.dataset.state = status;
      if (step === null) delete scene.dataset.step;
      else scene.dataset.step = String(step);
      label.textContent = messages[status] || messages.ready;
    }
  };
}

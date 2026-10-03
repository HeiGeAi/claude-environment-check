// 02 10 个词：全站比喻体系的地基。顶部小城地图 + 10 张可翻面的词卡
import './words.css'
import { gsap, reveal, whenVisible, prefersReduced, isTouch, spotlight } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { mascot } from '../core/mascot.js'

/* ------------------------------------------------------------
   插画：统一 160 × 120 画布，细线 + 发光 + 夜色小城
   .ln 线稿；.acc 主色线（随卡片 --tone）；.lit 暖灯；.a-* 微动画部件
   ------------------------------------------------------------ */
const STARS = '<g class="w-stars"><circle cx="16" cy="14" r="1.1"/><circle cx="142" cy="18" r="1.3"/><circle cx="128" cy="8" r=".8"/><circle cx="34" cy="26" r=".7"/></g>'
const GROUND = '<path class="ln ln--faint" d="M8 104 H152"/>'
const wrapIll = (inner) => `<svg class="w-ill__svg" viewBox="0 0 160 120" aria-hidden="true">${STARS}${GROUND}${inner}</svg>`

const ILL = {
  // 门牌号：房子 + 门口立着的门牌，门牌在发光、向外「广播」
  ip: wrapIll(`
    <path class="ln" d="M24 104 V60 L54 36 L84 60 V104"/>
    <path class="ln" d="M18 64 L54 33 L90 64"/>
    <rect class="ln" x="34" y="78" width="14" height="26" rx="2"/>
    <rect class="lit" x="58" y="68" width="14" height="12" rx="1.5"/>
    <path class="ln" d="M118 104 V78"/>
    <g class="a-plate">
      <rect class="acc acc--fill" x="98" y="56" width="42" height="22" rx="4"/>
      <text class="w-ill__txt" x="119" y="71" text-anchor="middle">No.12</text>
    </g>
    <g class="a-rays acc">
      <path d="M144 52 q6 -6 12 -6" /><path d="M146 67 h10" /><path d="M144 82 q6 6 12 6" />
    </g>`),

  // 快递代收点：小亭子 + 遮阳棚，包裹从左边送进窗口，再从右边寄出
  proxy: wrapIll(`
    <circle class="a-lamp" cx="84" cy="18" r="10"/>
    <rect class="acc" x="64" y="22" width="40" height="13" rx="2.5"/>
    <path class="ln" d="M72 28.5 H96"/>
    <path class="ln" d="M52 40 H116 L120 52 H48 Z"/>
    <path class="acc" d="M48 52 q5.67 7 11.33 0 q5.67 7 11.33 0 q5.67 7 11.33 0 q5.67 7 11.33 0 q5.67 7 11.33 0 q5.67 7 11.33 0"/>
    <rect class="ln" x="54" y="54" width="60" height="50" rx="2"/>
    <rect class="lit" x="62" y="64" width="44" height="18" rx="2"/>
    <path class="ln" d="M58 86 H110"/>
    <g class="a-in"><rect class="ln box" x="18" y="88" width="16" height="14" rx="2"/><path class="ln" d="M26 88 V102"/></g>
    <g class="a-out"><rect class="acc box" x="124" y="70" width="12" height="11" rx="2"/><path class="acc" d="M130 70 V81"/></g>
    <path class="ln ln--faint dash" d="M122 76 H152"/>`),

  // 直连：门开着，包裹从自家门口直接飞出去，门牌号亮红灯
  direct: wrapIll(`
    <path class="ln" d="M22 104 V60 L52 36 L82 60 V104"/>
    <path class="ln" d="M16 64 L52 33 L88 64"/>
    <rect class="hole" x="32" y="76" width="16" height="28" rx="1"/>
    <path class="ln" d="M32 76 L22 80 V106 L32 104"/>
    <g class="a-alarm"><rect class="acc acc--fill" x="56" y="66" width="20" height="12" rx="2.5"/><text class="w-ill__txt w-ill__txt--s" x="66" y="74.6" text-anchor="middle">12</text></g>
    <path class="acc dash a-trail" d="M46 92 Q92 84 138 40"/>
    <g class="a-fly"><rect class="acc box" x="40" y="86" width="13" height="11" rx="2"/><path class="acc" d="M46.5 86 V97"/></g>
    <g class="acc a-eye"><path d="M126 34 q10 -9 20 0 q-10 9 -20 0 z"/><circle cx="136" cy="34" r="2.6"/></g>`),

  // 告示：路牌写着「请走代收点」，听话的暖色小球照做，灰色的程序径直走开
  sys: wrapIll(`
    <path class="ln" d="M52 104 V56"/>
    <g class="a-sign">
      <rect class="acc" x="18" y="24" width="68" height="32" rx="4"/>
      <path class="acc" d="M28 40 H72 M64 33 L72 40 L64 47"/>
    </g>
    <g class="a-good"><circle class="dot-warm" cx="98" cy="62" r="6.5"/></g>
    <path class="ln ln--faint dash" d="M98 62 H150"/>
    <g class="a-ghost">
      <circle class="dot-ghost" cx="100" cy="92" r="8"/>
      <circle class="eye" cx="97.5" cy="91" r="1.3"/><circle class="eye" cx="102.5" cy="91" r="1.3"/>
    </g>
    <path class="ln ln--faint dash" d="M108 94 Q130 100 150 112"/>`),

  // 围墙：整栋房子被一圈墙围住，只在右边留一个门
  tun: wrapIll(`
    <path class="acc wall" d="M138 52 V42 Q138 20 116 20 H44 Q22 20 22 42 V84 Q22 104 44 104 H116 Q138 104 138 84 V74"/>
    <path class="ln ln--faint dash" d="M131 52 V44 Q131 27 114 27 H46 Q29 27 29 44 V82 Q29 97 46 97 H114 Q131 97 131 82 V74"/>
    <rect class="acc acc--fill" x="134" y="46" width="8" height="7" rx="1.5"/>
    <rect class="acc acc--fill" x="134" y="73" width="8" height="7" rx="1.5"/>
    <path class="ln" d="M60 84 V62 L78 48 L96 62 V84 Z"/>
    <rect class="lit" x="72" y="68" width="12" height="16" rx="1.5"/>
    <path class="ln ln--faint dash" d="M84 80 Q112 80 118 63 H158"/>
    <g class="a-walk"><circle class="dot-warm" cx="84" cy="80" r="5"/></g>`),

  // 电话簿：翻开的本子，荧光笔划过其中一行，对应一栋小房子
  dns: wrapIll(`
    <path class="ln" d="M80 36 C66 30 46 30 28 34 V96 C46 92 66 92 80 98 Z"/>
    <path class="ln" d="M80 36 C94 30 114 30 132 34 V96 C114 92 94 92 80 98 Z"/>
    <path class="ln ln--faint" d="M36 46 H72 M36 56 H68 M36 66 H72 M36 76 H64 M36 86 H70"/>
    <rect class="a-hl" x="86" y="52" width="40" height="8" rx="2"/>
    <path class="ln ln--faint" d="M88 46 H124 M88 66 H122 M88 76 H116 M88 86 H122"/>
    <path class="acc" d="M89 56 H120"/>
    <g class="a-point acc"><path d="M134 56 H144"/><path d="M144 60 V52 L150 47 L156 52 V60 Z"/></g>`),

  // 侧门：正门（v4）上了锁，侧门（v6）虚掩着，漏出一道光
  v6: wrapIll(`
    <path class="ln" d="M16 104 V58 L68 30 L120 58 V104"/>
    <path class="ln" d="M10 62 L68 26 L126 62"/>
    <rect class="ln" x="32" y="74" width="20" height="30" rx="2"/>
    <g class="lock"><path d="M39 86 V83 a3 3 0 0 1 6 0 V86"/><rect x="37.5" y="86" width="9" height="7" rx="1.5"/></g>
    <text class="w-ill__txt w-ill__txt--s w-ill__txt--dim" x="42" y="69" text-anchor="middle">v4</text>
    <path class="a-light" d="M104 76 L152 94 V110 L104 104 Z"/>
    <rect class="ln" x="88" y="76" width="16" height="28" rx="1"/>
    <path class="acc a-door" d="M88 76 L99 79 V106 L88 104 Z"/>
    <text class="w-ill__txt w-ill__txt--s" x="96" y="70" text-anchor="middle">v6</text>
    <rect class="lit" x="62" y="62" width="12" height="10" rx="1.5"/>`),

  // 对讲机：天线发出一圈圈信号，另一头亮起了门牌号
  rtc: wrapIll(`
    <path class="ln" d="M76 44 V24"/><circle class="acc acc--fill" cx="76" cy="21" r="3"/>
    <rect class="ln" x="50" y="44" width="36" height="58" rx="7"/>
    <rect class="lit" x="57" y="52" width="22" height="12" rx="2"/>
    <path class="ln ln--faint" d="M58 74 H78 M58 80 H78 M58 86 H78 M58 92 H78"/>
    <rect class="ln" x="45" y="58" width="5" height="14" rx="2"/>
    <g class="acc a-waves"><path class="w1" d="M84 13 A 11 11 0 0 1 84 29"/><path class="w2" d="M90 7 A 19 19 0 0 1 90 35"/><path class="w3" d="M96 1 A 27 27 0 0 1 96 41"/></g>
    <g class="a-leak"><rect class="acc acc--fill" x="114" y="14" width="32" height="16" rx="3.5"/><text class="w-ill__txt w-ill__txt--s" x="130" y="25" text-anchor="middle">No.12</text></g>`),

  // 长相和笔迹：指纹纹路 + 扫描线，旁边一笔签名
  fp: wrapIll(`
    <g class="ln fp">
      <path d="M40 42 C46 35 66 35 72 42"/>
      <path d="M56 44 C44 44 38 54 38 64 C38 76 42 86 48 94"/>
      <path d="M56 44 C68 44 74 54 74 64 C74 72 72 80 68 88"/>
      <path d="M56 52 C48 52 45 58 45 65 C45 75 49 84 54 90"/>
      <path d="M56 52 C63 52 67 58 67 65 C67 72 65 78 62 84"/>
      <path d="M56 60 C53 60 52 63 52 66 C52 74 55 80 58 86"/>
      <path d="M56 60 C59 60 60 62 60 66 V74"/>
    </g>
    <rect class="a-scan" x="32" y="40" width="48" height="2.4" rx="1.2"/>
    <path class="acc a-sig" pathLength="1" d="M92 86 c4 -12 9 -18 12 -8 c2 7 -6 14 -2 12 c6 -3 8 -14 12 -9 c3 4 -2 10 2 9 c4 -1 6 -8 10 -6"/>
    <path class="ln ln--faint" d="M90 94 H146"/>`),

  // 门卫：岗亭里有人值班，栏杆放下，包裹被挡在门外
  fw: wrapIll(`
    <path class="ln" d="M14 50 H58 L52 40 H20 Z"/>
    <rect class="ln" x="18" y="50" width="36" height="54" rx="3"/>
    <rect class="lit" x="24" y="58" width="24" height="18" rx="2"/>
    <circle class="guard" cx="36" cy="70" r="4.6"/><path class="acc acc--fill" d="M30.5 67 H41.5 L39.8 63 H32.2 Z"/>
    <rect class="ln" x="62" y="80" width="6" height="24" rx="1.5"/>
    <g class="a-arm"><rect class="acc arm" x="64" y="75" width="80" height="7" rx="3.5"/><path class="stripe" d="M72 78.5 H140"/></g>
    <circle class="acc acc--fill" cx="65" cy="78.5" r="3.4"/>
    <g class="a-box"><rect class="ln box" x="120" y="90" width="15" height="13" rx="2"/><path class="ln" d="M127.5 90 V103"/></g>`),
}

const WORDS = [
  { key: 'ip', term: 'IP 地址', meta: '门牌号', tone: 'warm',
    say: '网站看到的「你从哪来」，就是这个号码。',
    deep: 'IP 来自网络连接。代理能改变服务端看到的来源；它撤不回过去已经记录的地址，也挡不住 IP 被写进日志、提示词或上传的截图。',
    pro: 'IPv4 / IPv6', go: 'fingerprint' },
  { key: 'proxy', term: '代理 / 固定出口', meta: '快递代收点', tone: 'warm',
    say: '包裹都从这里寄出，对方只看得到代收点的地址。',
    deep: '专用策略组只放一个固定出口，最终组不设置 DIRECT 回落。选出口前，先核对地区、稳定性、上游协议、可用性与日志政策。',
    pro: 'proxy-groups · 不含 DIRECT', go: 'modes' },
  { key: 'direct', term: '直连', meta: '自家门口直接寄', tone: 'danger',
    say: '包裹没走代收点，门牌号露了。这就叫「露馅」。',
    deep: '配置里的 DIRECT 就是直连。故障底线：代理不可达时拒绝业务，不能悄悄走 DIRECT；新域名也不能获得例外。',
    pro: 'DIRECT', go: 'journey' },
  { key: 'sys', term: '系统代理', meta: '门口的告示', tone: 'warn',
    say: '告示写着「寄件请走代收点」。听话的程序照做，不看告示的照样自己出门。',
    deep: '系统代理没有强制隔离的效果：不读系统配置或环境变量的程序，仍可能直接发包。新开的终端会读代理变量，已经打开的终端不会自动更新。',
    pro: 'HTTP / HTTPS / SOCKS', go: 'modes' },
  { key: 'tun', term: 'TUN', meta: '一圈围墙', tone: 'safe',
    say: '给整栋房子修一圈围墙，只留一个门通向代收点。',
    deep: 'TUN 在路由层接管流量，但仍要检查排除项、IPv6 和掉线行为。开启 TUN，不自动等于所有协议、接口和进程都被覆盖；关掉 TUN 时也必须保持系统阻断。',
    pro: 'REQUIRE_TUN=1 · NET_MODE=tun', go: 'modes' },
  { key: 'dns', term: 'DNS', meta: '电话簿', tone: 'info',
    say: '查地址用的电话簿。寄件之前，先在这里查到对方住哪。',
    deep: '纯代理模式下，系统 DNS 返回真实地址可能是正常行为，不能直接当作业务流量泄漏。TUN 模式要核对 dns-hijack、DoH 与 IPv6 解析路径。',
    pro: 'dns-hijack · DoH', go: 'modes' },
  { key: 'v6', term: 'IPv6', meta: '侧门', tone: 'warn',
    say: '家里另一扇平时没注意的门。只锁正门（IPv4）不够。',
    deep: 'IPv4 安全不能代替 IPv6 验收，IPv4、IPv6、UDP 要分别演练。系统更新或新网卡，可能恢复未受控的 IPv6。',
    pro: 'AAAA · inet6', go: 'journey' },
  { key: 'rtc', term: 'WebRTC', meta: '对讲机', tone: 'danger',
    say: '浏览器里视频通话用的。它可能绕开代收点，直接报出地址。',
    deep: '它会涉及候选地址与潜在直连路径，UDP 可能绕过普通 HTTP 代理。要在受控网络内验证；限制非代理 UDP 或关闭所需 API，视频通话和实时功能可能受影响。',
    pro: 'ICE / STUN · UDP', go: 'fingerprint' },
  { key: 'fp', term: '浏览器指纹', meta: '长相和笔迹', tone: 'info',
    say: '能认出「是同一台设备」，和门牌号是两回事。',
    deep: '指纹来自浏览器和设备特征的组合，比如 WebGL、Canvas、字体、UA、时区。改 WebGL 字符串修不了 IPv6 直连；保持真实稳定的环境，不堆叠来路不明的随机指纹插件。',
    pro: 'WebGL · Canvas · UA', go: 'fingerprint' },
  { key: 'fw', term: '出站限制 / 防火墙', meta: '门卫', tone: 'safe',
    say: '没通过检查的包裹，一件也不许出门。',
    deep: '严格防护必须在发包前拒绝，守卫只是补充。业务进程只可连接指定的本地代理或网关；代理只可连接已审核的上游。',
    pro: 'PF · nftables · policy drop', go: 'layers' },
]

const PLUS = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
const BACK = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6.5 4L2.5 8l4 4M3 8h7.5a3 3 0 0 1 0 6H9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

function chap(id) {
  const el = document.getElementById(id)
  return { num: el?.dataset.num || '', nav: el?.getAttribute('aria-label') || '' }
}

function card(w, i) {
  const n = String(i + 1).padStart(2, '0')
  const c = chap(w.go)
  return `<article class="w-card" data-tone="${w.tone}" data-key="${w.key}">
    <div class="w-card__lift">
      <div class="w-card__in">
        <div class="w-face w-face--front">
          <div class="w-card__top"><span class="w-no">${n}</span><span class="w-term">${w.term}</span></div>
          <div class="w-ill w-ill--${w.key}">${ILL[w.key]}</div>
          <div class="w-card__text">
            <p class="w-meta">${w.meta}</p>
            <p class="w-say">${w.say}</p>
            <div class="pro-only w-pro"><code>${w.pro}</code></div>
            <button class="w-flip" type="button" aria-expanded="false" aria-controls="w-back-${w.key}">再深一点 ${PLUS}</button>
          </div>
        </div>
        <div class="w-face w-face--back" id="w-back-${w.key}" inert>
          <div class="w-card__top"><span class="w-no">${n}</span><span class="w-term">${w.term}</span></div>
          <p class="w-back__k">再深一点</p>
          <p class="w-deep">${w.deep}</p>
          <div class="w-back__foot">
            ${c.num ? `<a class="w-go" href="#${w.go}" data-jump="#${w.go}" data-sfx="click">去 ${c.num} · ${c.nav} →</a>` : ''}
            <button class="w-flip w-flip--back" type="button" aria-label="翻回正面">${BACK} 翻回去</button>
          </div>
        </div>
      </div>
    </div>
  </article>`
}

/* ------------------------------------------------------------
   小城地图：房子（你的电脑）在左，代收点在中，Claude 岛在右
   ------------------------------------------------------------ */
function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

function townMap() {
  const r = rand(42)
  const stars = Array.from({ length: 46 }, () => {
    const x = (r() * 1200).toFixed(0), y = (r() * 190 + 6).toFixed(0), s = (r() * 1.3 + 0.5).toFixed(2)
    return `<circle cx="${x}" cy="${y}" r="${s}" style="--d:${(r() * 4).toFixed(2)}s"/>`
  }).join('')
  // 远处天际线：低矮的楼群，窗户零星亮着
  const r2 = rand(7)
  let x = 30
  let blds = ''
  let wins = ''
  while (x < 790) {
    const w = 26 + Math.round(r2() * 40)
    const h = 36 + Math.round(r2() * 70)
    if (!(x > 110 && x < 290) && !(x > 520 && x < 700)) {
      blds += `<rect x="${x}" y="${292 - h}" width="${w}" height="${h}" rx="2"/>`
      for (let k = 0; k < 3; k++) if (r2() > 0.45) wins += `<rect x="${x + 6 + Math.round(r2() * (w - 16))}" y="${292 - h + 8 + Math.round(r2() * (h - 22))}" width="4" height="5"/>`
    }
    x += w + 6 + Math.round(r2() * 14)
  }
  const waves = [306, 322, 340, 360, 382].map((y, i) => `<path d="M${820 + i * 12} ${y} q 14 -5 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0" style="--d:${i * 0.6}s"/>`).join('')

  return `<svg class="w-map__svg" viewBox="0 0 1200 440" role="img" aria-labelledby="w-map-title">
    <title id="w-map-title">小城地图：左边是你的电脑（房子），中间是代收点（固定出口），右边隔着水是 Claude 岛（目标服务）。暖色路线经过代收点，红色虚线是直连。</title>
    <defs>
      <radialGradient id="w-moon-g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd08a" stop-opacity=".4"/><stop offset="1" stop-color="#ffd08a" stop-opacity="0"/></radialGradient>
      <radialGradient id="w-isle-g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffc070" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a52" stop-opacity="0"/></radialGradient>
      <linearGradient id="w-sea-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb4ff" stop-opacity=".1"/><stop offset="1" stop-color="#8fb4ff" stop-opacity="0"/></linearGradient>
    </defs>
    <g class="w-map__stars">${stars}</g>
    <circle cx="1096" cy="72" r="70" fill="url(#w-moon-g)"/>
    <circle class="w-map__moon" cx="1096" cy="72" r="22"/><circle class="w-map__moonbite" cx="1107" cy="64" r="19"/>
    <g class="w-map__sky">${blds}</g>
    <g class="w-map__skywin">${wins}</g>

    <!-- 地面与水面 -->
    <path class="w-map__land" d="M0 292 H790 Q812 292 826 300 L842 440 H0 Z"/>
    <path class="w-map__shore" d="M0 292 H790 Q812 292 826 300"/>
    <path d="M790 292 H1200 V440 H842 L826 300 Q812 292 790 292 Z" fill="url(#w-sea-g)"/>
    <g class="w-map__waves">${waves}</g>

    <!-- 直连：跳过代收点，门牌号露了 -->
    <path class="w-map__direct" d="M214 304 C 380 424, 800 428, 1000 300"/>
    <g class="w-map__x" transform="translate(600 393)"><circle r="15"/><path d="M-6 -6 L6 6 M6 -6 L-6 6"/></g>
    <text class="w-map__dlabel" x="600" y="428" text-anchor="middle">红色虚线：直连，跳过代收点，门牌号露了</text>

    <!-- 受控路线 -->
    <path class="w-map__route-glow" d="M214 300 C 320 330, 470 330, 596 300 C 700 276, 790 300, 880 280 C 930 270, 972 268, 1006 268"/>
    <path class="w-map__route" d="M214 300 C 320 330, 470 330, 596 300 C 700 276, 790 300, 880 280 C 930 270, 972 268, 1006 268"/>
    <g class="w-map__lamps">
      <g transform="translate(340 318)"><path d="M0 0 V-40"/><circle cy="-44" r="4"/></g>
      <g transform="translate(470 318)"><path d="M0 0 V-40"/><circle cy="-44" r="4"/></g>
    </g>

    <!-- 房子：你的电脑 -->
    <g class="w-map__place w-map__house">
      <rect class="w-map__chim" x="228" y="164" width="16" height="30" rx="2"/>
      <path class="w-map__fill" d="M140 292 V206 L202 158 L264 206 V292 Z"/>
      <path class="w-map__roof" d="M126 212 L202 150 L278 212"/>
      <rect class="w-map__win" x="156" y="222" width="24" height="22" rx="2"/>
      <rect class="w-map__win" x="226" y="222" width="24" height="22" rx="2"/>
      <path class="w-map__mull" d="M168 222 V244 M156 233 H180 M238 222 V244 M226 233 H250"/>
      <rect class="w-map__door" x="190" y="250" width="24" height="42" rx="3"/>
      <g class="w-map__plate"><rect x="218" y="256" width="40" height="17" rx="4"/><text x="238" y="268.5" text-anchor="middle">门牌号</text></g>
      <text class="w-map__name" x="202" y="340" text-anchor="middle">你的电脑</text>
      <text class="w-map__sub" x="202" y="362" text-anchor="middle">一栋房子 · 门牌号就是 IP</text>
    </g>

    <!-- 代收点：固定出口 -->
    <g class="w-map__place w-map__kiosk">
      <circle class="w-map__halo" cx="600" cy="196" r="44"/>
      <rect class="w-map__signbd" x="562" y="178" width="76" height="26" rx="4"/>
      <text class="w-map__signtx" x="600" y="196" text-anchor="middle">代收点</text>
      <path class="w-map__roof" d="M546 214 H654 L662 232 H538 Z"/>
      <path class="w-map__awn" d="M538 232 q 7.75 10 15.5 0 q 7.75 10 15.5 0 q 7.75 10 15.5 0 q 7.75 10 15.5 0 q 7.75 10 15.5 0 q 7.75 10 15.5 0 q 7.75 10 15.5 0 q 7.75 10 15.5 0"/>
      <path class="w-map__fill" d="M548 236 H652 V292 H548 Z"/>
      <rect class="w-map__win w-map__win--k" x="562" y="246" width="76" height="26" rx="3"/>
      <path class="w-map__mull" d="M556 278 H644"/>
      <g class="w-map__lamp2"><path d="M676 292 V214"/><circle cx="676" cy="208" r="6"/></g>
      <text class="w-map__name" x="600" y="340" text-anchor="middle">代收点</text>
      <text class="w-map__sub" x="600" y="362" text-anchor="middle">固定出口 · 代理</text>
    </g>

    <!-- Claude 岛：目标服务 -->
    <g class="w-map__place w-map__isle">
      <circle class="w-map__beacon" cx="1010" cy="196" r="58" fill="url(#w-isle-g)"/>
      <path class="w-map__mound" d="M900 296 Q 950 262 1010 260 Q 1074 262 1122 296 Z"/>
      <path class="w-map__tower" d="M992 262 L998 206 H1022 L1028 262 Z"/>
      <rect class="w-map__win" x="1003" y="218" width="14" height="14" rx="2"/>
      <path class="w-map__roof" d="M992 206 L1010 186 L1028 206"/>
      <circle class="w-map__star" cx="1010" cy="178" r="5"/>
      <g class="w-map__rays"><path d="M1010 160 V150 M1028 168 l7 -7 M992 168 l-7 -7 M1036 182 h10 M984 182 h-10"/></g>
      <text class="w-map__name" x="1010" y="340" text-anchor="middle">Claude 岛</text>
      <text class="w-map__sub" x="1010" y="362" text-anchor="middle">你要去的目标服务</text>
    </g>

    <!-- 小请求：沿受控路线走 -->
    <g class="w-map__trav" transform="translate(214 274)">${mascot({ size: 46, face: 'happy' }).replace('<svg ', '<svg x="-23" y="-26" ')}</g>
  </svg>`
}

export default {
  id: 'words',
  nav: '10 个词',
  desc: '用生活比喻认识关键术语',
  mood: 'calm',
  mount(el, { num }) {
    el.innerHTML = `
<div class="wrap">
  <header class="chapter-head">
    <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>10 个词</span></div>
    <h2 class="h2" data-reveal="lines">先认识这座小城，<br>和<span class="text-warm">10 个词</span></h2>
    <p class="lead" data-reveal>后面每一章都用这套比喻。你的电脑是一栋房子，每个网络请求是一个会发光的小球，我们叫它「小请求」。</p>
  </header>

  <figure class="w-map" data-reveal="scale">
    <div class="w-map__scroll" tabindex="0" aria-label="小城地图，可以左右滑动">${townMap()}</div>
    <figcaption class="w-map__cap">
      <span class="w-map__leg"><i class="is-warm"></i>暖色路线：先到代收点，再过桥上岛</span>
      <span class="w-map__leg"><i class="is-red"></i>红色虚线：直连</span>
      <span class="w-map__hint">左右滑动看完整地图</span>
    </figcaption>
  </figure>

  <div class="w-grid-head">
    <h3 class="h3" data-reveal>10 个词，一张卡一个</h3>
    <p class="muted" data-reveal>正面是说人话的比喻。点一下卡片，翻到背面看「再深一点」。</p>
  </div>
  <div class="w-grid" data-reveal="stagger">
    ${WORDS.map(card).join('')}
  </div>

  <div class="w-outro">
    <div class="w-outro__pal" aria-hidden="true">${mascot({ size: 88, face: 'happy' })}</div>
    <p class="w-outro__line" data-reveal="lines">记住这些，我们跟着一个<span class="text-warm">小请求</span>出门看看。</p>
    <a class="btn btn--ghost w-outro__btn" href="#journey" data-jump="#journey" data-sfx="whoosh">跟它出门 <span class="arrow" aria-hidden="true">→</span></a>
  </div>
</div>`

    reveal(el)
    bindMap(el)
    bindCards(el)
  },
}

/* ---------- 地图：小请求沿路线循环，离屏暂停 ---------- */
function bindMap(root) {
  const fig = root.querySelector('.w-map')
  const svgEl = fig.querySelector('svg')
  const route = svgEl.querySelector('.w-map__route')
  const trav = svgEl.querySelector('.w-map__trav')
  const kiosk = svgEl.querySelector('.w-map__kiosk')
  const isle = svgEl.querySelector('.w-map__isle')
  const len = route.getTotalLength()

  // 找到路线上离代收点（x = 600）最近的位置
  let kT = 0.45
  for (let i = 0, best = 1e9; i <= 200; i++) {
    const p = route.getPointAtLength((i / 200) * len)
    const d = Math.abs(p.x - 600)
    if (d < best) { best = d; kT = i / 200 }
  }
  const s = { t: 0 }
  const place = () => {
    const p = route.getPointAtLength(s.t * len)
    trav.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(p.y - 22).toFixed(1)})`)
  }
  const ping = (g) => { g.classList.remove('is-ping'); void g.getBoundingClientRect(); g.classList.add('is-ping') }

  if (prefersReduced) { s.t = kT; place(); fig.classList.add('is-static'); return }

  const tl = gsap.timeline({ repeat: -1, paused: true, repeatDelay: 0.4 })
  tl.set(s, { t: 0 }).call(place)
    .fromTo(trav, { opacity: 0 }, { opacity: 1, duration: 0.4 })
    .to(s, { t: kT, duration: 3.2, ease: 'sine.inOut', onUpdate: place }, '<')
    .call(() => ping(kiosk))
    .to(s, { t: 1, duration: 3.4, ease: 'sine.inOut', onUpdate: place }, '+=0.7')
    .call(() => ping(isle))
    .to(trav, { opacity: 0, duration: 0.5 }, '+=0.9')
  place()

  let seen = false
  whenVisible(fig, () => {
    tl.play(); fig.classList.remove('is-off')
    if (!seen) { seen = true; audio.sfx('reveal') }
  }, () => { tl.pause(); fig.classList.add('is-off') }, '0px')
}

/* ---------- 词卡：翻面 + 插画微动画 ---------- */
function bindCards(root) {
  const cards = root.querySelectorAll('.w-card')
  const ANIM_MS = 2600

  const play = (c) => {
    c.classList.remove('is-play'); void c.offsetWidth; c.classList.add('is-play')
    clearTimeout(c._t)
    c._t = setTimeout(() => { if (!c.matches(':hover')) c.classList.remove('is-play') }, ANIM_MS)
  }

  cards.forEach((c) => {
    const front = c.querySelector('.w-face--front')
    const back = c.querySelector('.w-face--back')
    const openBtn = front.querySelector('.w-flip')
    const closeBtn = back.querySelector('.w-flip')
    spotlight(c.querySelector('.w-card__lift'))

    const toggle = (on) => {
      const hide = on ? front : back
      const show = on ? back : front
      const hadFocus = hide.contains(document.activeElement)
      c.classList.toggle('is-flipped', on)
      show.inert = false
      hide.inert = true
      openBtn.setAttribute('aria-expanded', String(on))
      if (hadFocus) (on ? closeBtn : openBtn).focus({ preventScroll: true })
      audio.sfx(on ? 'open' : 'close')
      if (!on) play(c)
    }
    c.addEventListener('click', (e) => {
      if (e.target.closest('a')) return
      toggle(!c.classList.contains('is-flipped'))
    })
    if (!isTouch && !prefersReduced) {
      c.addEventListener('pointerenter', () => { clearTimeout(c._t); c.classList.add('is-play') })
      c.addEventListener('pointerleave', () => c.classList.remove('is-play'))
    }
  })

  if (prefersReduced) return
  // 进入视口时每张卡自己动一次，错开一点
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return
      io.unobserve(e.target)
      const idx = [...cards].indexOf(e.target) % 5
      setTimeout(() => play(e.target), 500 + idx * 140)
    })
  }, { threshold: 0.55 })
  cards.forEach((c) => io.observe(c))
}

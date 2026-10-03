// 09 · 动手搭建
// 小白：8 站施工图（小请求沿路走，走到哪一站亮哪一站）+ 终端演示「SAFE 才准入」
// 进阶：6 段原版模板 + 可选 VM 方案，标签页组织；模块职责卡片
import './build.css'
import { gsap, ScrollTrigger, reveal, prefersReduced } from '../core/motion.js'
import { audio } from '../core/audio.js'
import { pushMood, popMood } from '../core/mood.js'
import { codeBlock, enhanceCodeBlocks, bus } from '../core/ui.js'
import { mascot } from '../core/mascot.js'

const D = '${' // 代码里出现的 ${ 用它拼接，避免被模板字符串解析

/* ================= 八站施工图 ================= */
const STATIONS = [
  { t: '备份', d: '先把现在能用的配置存一份。改坏了，能原样退回来。', icon: '<rect x="4" y="4.5" width="16" height="4.5" rx="1.2"/><path d="M5.5 9v10h13V9"/><path d="M10 13h4"/>' },
  { t: '受控出口', d: '准备一个固定的代收点。策略组里只放它一个，关门了也不许自己寄。', icon: '<path d="M4 20V10l8-5.5L20 10v10"/><path d="M9.5 20v-5h5v5"/><path d="M3 20h18"/>' },
  { t: '接入模式', d: '围墙（TUN）还是告示（纯代理），明确二选一，守卫也按同一种配。', icon: '<path d="M3 19.5h18"/><path d="M4 19.5v-11h16v11"/><path d="M4 14h16M9 8.5V14M15 8.5V14M12 14v5.5"/>' },
  { t: '出站限制', d: '请好门卫：没通过检查的包裹，一件也不许出门。', icon: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.5-7 9-4-1.5-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15 10.4"/>' },
  { t: '启动预检', d: '出门前安检：代收点在线、地址对，才放行。不确定，就不启动。', icon: '<path d="M6 20V9a6 6 0 0 1 12 0v11"/><path d="M3 20h18"/><path d="M9.5 12.5h5M9.5 16h5"/>' },
  { t: '常驻守卫', d: '保安定时巡逻：状态看得见，发现异常就报警、拦人，重试有次数限制。', icon: '<circle cx="12" cy="12" r="8"/><path d="m12 12 5-5"/><circle cx="12" cy="12" r="1.4"/><path d="M12 4v1.8M20 12h-1.8M12 20v-1.8M4 12h1.8"/>' },
  { t: '门禁', d: '钥匙不乱给，包括 AI 助手。谁要改防线，先审查具体改动。', icon: '<circle cx="8" cy="12" r="3.8"/><path d="M11.8 12h8.7M17.5 12v3M20.5 12v2.4"/>' },
  { t: '失败演练', d: '用不带账号的测试，故意让代收点掉线，确认没有包裹从自家门口溜走。', icon: '<path d="M13 3 5.5 13.5H11L10 21l8-10.5h-5.5z"/>' },
]

/* ================= 终端演示 ================= */
const SCENARIOS = {
  ok: { label: '代收点正常', hint: '代收点：在线，出口地址和预期一致' },
  down: { label: '代收点掉线', hint: '代收点：掉线了，灯是黑的' },
  mismatch: { label: '出口地址不对', hint: '代收点：在线，但出口地址和预期不一致' },
}
const HEAD = [
  { t: '$ ./guarded-claude-example.sh', c: 'cmd', pause: 420 },
  { t: '[1/4] 检查真实客户端路径 .......... 通过', c: 'info' },
  { t: '[2/4] 注入代理变量 → http://127.0.0.1:7897', c: 'info', ev: 'toGate' },
  { t: '[3/4] 经代理探测出口 https://api.ipify.org', c: 'info', ev: 'probe', pause: 900 },
]
const TAIL = {
  ok: [
    { t: '      已返回出口地址（演示里不显示）', c: 'dim' },
    { t: '[4/4] 比对 EXPECTED_EXIT_IPV4 ..... 一致', c: 'ok', pause: 500 },
    { t: '启动探测通过；持续阻断由独立防火墙负责。', c: 'pass', ev: 'pass' },
    { t: '→ exec 真实客户端（演示到此为止）', c: 'dim' },
  ],
  down: [
    { t: '      连接超时：代理没有响应', c: 'warn', ev: 'dark', pause: 500 },
    { t: 'BLOCKED: 出口探测失败，拒绝启动。', c: 'bad', ev: 'block' },
    { t: 'exit 78', c: 'dim' },
  ],
  mismatch: [
    { t: '      已返回出口地址（演示里不显示）', c: 'dim' },
    { t: '[4/4] 比对 EXPECTED_EXIT_IPV4 ..... 不一致', c: 'warn', ev: 'wrong', pause: 500 },
    { t: 'BLOCKED: 出口不匹配，拒绝启动。', c: 'bad', ev: 'block' },
    { t: 'exit 78', c: 'dim' },
  ],
}

/* ================= 原版模板（逐字照搬） ================= */
const CODE_MIHOMO = String.raw`# 合并片段，不是完整配置；保留已验证的其他配置。
# SOCKS5 是 mihomo 上游；CLI 连接本地 HTTP 代理。
proxies:
  - name: Claude Whitelisted SOCKS5
    type: socks5
    server: residential.example.com  # 本地替换，不公开节点
    port: 443
    username: REPLACE_LOCALLY
    password: REPLACE_LOCALLY
    udp: true                       # 上游也必须真正支持
    dialer-proxy: YOUR_VERIFIED_UPSTREAM
proxy-groups:
  - name: Claude Residential
    type: select
    proxies: [Claude Whitelisted SOCKS5]  # 不含 DIRECT
rules:
  # 放到宽泛直连之前；只处理已进入 mihomo 的流量。
  - PROCESS-NAME-REGEX,(?i)^claude.*$,Claude Residential
  - PROCESS-PATH-REGEX,^/Applications/Claude\.app/Contents/.*$,Claude Residential
  - DOMAIN-SUFFIX,claude.ai,Claude Residential
  - DOMAIN-SUFFIX,claude.com,Claude Residential
  - DOMAIN-SUFFIX,anthropic.com,Claude Residential
  - DOMAIN-SUFFIX,claudeusercontent.com,Claude Residential
  - DOMAIN,http-intake.logs.us5.datadoghq.com,Claude Residential
  - DOMAIN,browser-intake-us5-datadoghq.com,Claude Residential
  # 让下方示例的出口探测使用同一策略组
  - DOMAIN,api.ipify.org,Claude Residential
  # 按实际进程补专用浏览器、更新器及已核实的依赖。
  # 本片段不替代系统级出站限制。`

const CODE_GUARD = String.raw`#!/bin/bash
# 教学版：启动探测 + 显式代理，不修改系统。
# 前提：已部署独立出站限制；探测域名与业务同组。
set -euo pipefail
: "${D}EXPECTED_EXIT_IPV4:?先设定自己的预期出口 IPv4}"
: "${D}CLAUDE_REAL_BIN:?先设定已核验的二进制绝对路径}"
[[ "$CLAUDE_REAL_BIN" = /* && -x "$CLAUDE_REAL_BIN" ]] || exit 78
[[ ! "$CLAUDE_REAL_BIN" -ef "$0" ]] || exit 78
PROXY_URL="http://127.0.0.1:7897"
export HTTPS_PROXY="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
export https_proxy="$PROXY_URL" http_proxy="$PROXY_URL"
export ALL_PROXY="$PROXY_URL" all_proxy="$PROXY_URL"
export NO_PROXY="localhost,127.0.0.1,::1" no_proxy="localhost,127.0.0.1,::1"
export DISABLE_TELEMETRY=1
# -q 禁止 curlrc；--noproxy '' 防止环境变量绕过本次代理。
# TLS 保持证书校验，不使用 -k；不打印出口身份。
if ! OBSERVED=$(curl -q --fail --silent --show-error \
  --proxy "$PROXY_URL" --noproxy '' --connect-timeout 3 --max-time 8 \
  https://api.ipify.org); then
  printf '%s\n' 'BLOCKED: 出口探测失败，拒绝启动。' >&2
  exit 78
fi
if [[ "$OBSERVED" != "$EXPECTED_EXIT_IPV4" ]]; then
  printf '%s\n' 'BLOCKED: 出口不匹配，拒绝启动。' >&2
  exit 78
fi
printf '%s\n' '启动探测通过；持续阻断由独立防火墙负责。' >&2
exec "$CLAUDE_REAL_BIN" "$@"`

const CODE_MODE = String.raw`# 守卫接口设计示例：本项目未提供 route-guard 或 net-guard 实现。
# 先自行实现并验收守卫，再参考这些参数。
# A：TUN 模式
# route-guard.conf
REQUIRE_TUN=1
# net-guard.conf
NET_MODE=tun
# B：纯代理模式（与上面二选一）
# route-guard.conf
REQUIRE_TUN=0
IPINFO_PROXY="http://127.0.0.1:7897"
# net-guard.conf
NET_MODE=proxy
# CLASH_SOCK 填本机实际 service socket。
# 探测源只用 HTTPS，显式代理，强制不绕过。
# 预期出口由受保护本地配置提供，不写入公开日志。`

const CODE_LAUNCHD = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.YOU.claude-route-guard</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string>
    <string>/Users/YOU/bin/claude-route-guard.sh</string>
    <string>--daemon</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>/Users/YOU/guard.out.log</string>
  <key>StandardErrorPath</key><string>/Users/YOU/guard.err.log</string>
</dict></plist>`

const CODE_PF = String.raw`# 这是局部示意，不是可直接加载的完整配置。
# reviewed_v4/v6 必须预先定义成已审核的地址集合。
block drop out quick inet proto { tcp udp } from any to <reviewed_v4>
block drop out quick inet6 proto { tcp udp } from any to <reviewed_v6>
# 维护窗口中先验证语法，再按现有加载流程应用：
# sudo pfctl -a YOUR_ANCHOR -nf reviewed-anchor.conf
# 随后读回 anchor 规则、计数器与相关连接状态。
# 语法失败：保留旧规则；禁止先清空再重建。
# TUN 接口名按运行时确定，不照抄 utun 编号。`

const CODE_STATUS = String.raw`# 系统代理概况；只在本地查看，分享前脱敏
scutil --proxy
# 入口解析：确认不是绕过包装器的另一份安装
type -a claude
# 分别核查 IPv4 / IPv6 路由与接口
netstat -rn -f inet
netstat -rn -f inet6
ifconfig
# 服务存在与退出码 0 不是持续健康证明
launchctl list | rg 'claude-route-guard|net-guard'
# 下列为守卫接口设计示例；本仓库没有提供这些脚本。
# 只有独立实现并验收后，才可按实际安装路径查询
"$HOME/bin/claude-route-guard.sh" --status
"$HOME/bin/net-guard.sh" check`

const CODE_NFT = String.raw`# 文件：pioneer-egress.nft
# 仅供专用、静态网络 Linux VM；不要在 macOS 终端执行。
# 192.0.2.1 是文档示例地址，必须换成隔离网段上的代理网关。
# 规则不依赖目标网站域名；只允许 VM -> 网关代理端口。
# 前提：无容器转发、无其他网络 namespace、无旁路网卡。
# Agent 没有 root / CAP_NET_ADMIN，也不能修改防火墙。
define proxy_gateway = 192.0.2.1
define proxy_port = 7897
table inet pioneer_egress {
  chain output {
    type filter hook output priority 0; policy drop;
    oifname "lo" accept
    ip daddr $proxy_gateway tcp dport $proxy_port accept
    counter drop
  }
}
# 在 VM 控制台先校验（不加载）:
# sudo nft -c -f pioneer-egress.nft
# 首次安装，确认 table 不存在后加载:
# sudo nft -f pioneer-egress.nft
# sudo nft list table inet pioneer_egress
# 已存在时不要直接重复附加；制定原子替换事务。
# 在 VM 中给 CLI 配置该代理；浏览器也要显式配置。
# export HTTPS_PROXY=http://192.0.2.1:7897
# export HTTP_PROXY=$HTTPS_PROXY
# 代理负责目标 DNS；VM 的直接 DNS / UDP / IPv6 均被拒绝。`

const EXT = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer" class="bd-link">${text}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5h7v7M12.5 3.5l-9 9"/></svg></a>`

const PANELS = [
  {
    tab: '锁定出口', title: '锁定出口：策略组只有一个成员',
    before: '前置线路连接到固定出口，最终组不设置 DIRECT 回落。SOCKS5 本身不提供传输加密；跨不可信网络时，应核对前置传输与目标 TLS 的保护。dialer-proxy 指向已定义的上游，不能构成循环。',
    use: '把 Claude 相关的进程和域名，全部指向一个只有一个成员的策略组。',
    pre: '前置线路连到固定出口；dialer-proxy 指向已定义的上游；开 udp 时上游也必须真正支持。',
    check: '最终组里没有 DIRECT；规则放在宽泛直连之前；检查实际运行规则，别只看配置文本。',
    code: { code: CODE_MIHOMO, lang: 'yaml', title: 'mihomo · 合并配置', note: '配置片段 · 含占位符，不可原样部署' },
    after: `语法与顺序：${EXT('https://wiki.metacubex.one/config/rules/', 'mihomo 路由规则')}。生成配置可能被订阅刷新覆盖：修改持久来源，并检查实际运行规则。`,
  },
  {
    tab: '启动预检', title: '启动预检：不确定就不启动',
    before: '严格策略只接受经过当前检查的 SAFE；探测超时、429、出口不匹配都不启动新任务。下面只检查一次 IPv4 出口，检查之后网络仍可能变化，必须配合独立阻断层。给原二进制指定固定、可信的路径，升级时重新验收。',
    use: '启动前经代理探测一次出口，探测失败或出口不匹配，就拒绝启动。',
    pre: '已部署独立出站限制；探测域名与业务同组；先设好 EXPECTED_EXIT_IPV4 与 CLAUDE_REAL_BIN。',
    check: '断开代理或改错预期出口时，脚本以 exit 78 退出且不启动客户端；升级后重新验收二进制路径。',
    code: { code: CODE_GUARD, lang: 'bash', title: 'guarded-claude-example.sh', note: '教学脚本 · 未自动安装' },
    after: 'CLI 使用本地 HTTP 代理入口，再由 mihomo 连接上游 SOCKS5。IDE、Desktop、后台 supervisor 和直接运行原二进制可能不经过 PATH 包装器；逐个检查启动链路，使用对应版本支持的托管配置或进程包装机制。',
  },
  {
    tab: '模式参数', title: '模式参数：明确选择 A 或 B',
    before: 'A 是围墙（TUN），B 是告示（纯代理）。两段参数二选一，分别写进 route-guard 和 net-guard 各自的配置。',
    use: '让守卫明确知道这台机器用的是哪种接入方式。',
    pre: '先定下 A 或 B；CLASH_SOCK 填本机实际 service socket。',
    check: '守卫配置与实际模式一致；改完按实现方式重启或按受控流程重载守卫。',
    code: { code: CODE_MODE, lang: 'conf', title: '守卫参数 · 分别写入各自配置', note: '示例 · 需按本机适配' },
    after: 'socket 路径不要照抄别人的 UID。脚本如果只在启动时读取配置，修改后需重启相关守卫；每轮重新读取的实现则不同。plist 环境变量在装载时读取，修改后按受控流程重载。',
  },
  {
    tab: '常驻服务', title: '常驻服务：状态可读，失败有界',
    before: '让守卫作为常驻服务运行。下面是结构模板，路径里的 YOU 换成自己机器上的实际值。',
    use: '让 claude-route-guard 常驻运行，状态可读，失败有界。',
    pre: '守卫脚本已放在固定路径；在维护窗口里操作，加载会改变常驻服务。',
    check: '先用 plutil -lint 验语法，再加载并观察心跳；日志有上限和轮转。',
    code: { code: CODE_LAUNCHD, lang: 'xml', title: 'launchd · 守卫常驻结构', note: '结构模板 · 加载会改变常驻服务' },
    after: '先用 plutil -lint 验语法，再在维护窗口加载并观察心跳。定时守卫可以用 StartInterval，但它不是实时防火墙。日志设置上限和轮转，自愈设置重试次数与冷静期，避免重启风暴。',
  },
  {
    tab: 'PF 阻断', title: 'PF：文件、内核、连接状态，三处一致',
    before: '对已审核的地址集合，在发包前阻断。这是局部示意，只说明结构。',
    use: '对已审核的 IPv4 / IPv6 地址集合做发包前的阻断。',
    pre: 'reviewed_v4 / reviewed_v6 预先定义成已审核的地址集合；TUN 接口名按运行时确定。',
    check: '维护窗口里先验语法；随后读回 anchor 规则、计数器与相关连接状态；语法失败时保留旧规则。',
    code: { code: CODE_PF, lang: 'pf', title: 'PF · 仅示意已审核地址集的阻断', note: '局部规则示意 · 不替代全目的地进程约束' },
    afterTitle: 'IP 网段封锁只是一层补充',
    after: 'CDN、共享基础设施与新地址不会因为属于同一产品就自动落在旧 CIDR 中。对「任何新域名也不直连」的要求，要由业务进程的全目的地出站限制实现；不能靠无限补名单实现同等保证。',
    tone: 'warn',
  },
  {
    tab: '只读排查', title: '只读排查入口',
    before: '只看不改：查代理概况、入口解析、IPv4 / IPv6 路由与接口，以及守卫状态。',
    use: '出问题时先看现场，不改任何设置。',
    pre: '只在本地查看；守卫的状态入口按实际安装路径调整。',
    check: '服务存在、退出码为 0，都证明不了持续健康；输出分享前先脱敏。',
    code: { code: CODE_STATUS, lang: 'bash', title: '查看状态 · 输出仅留本地', note: '只读诊断 · 输出可能包含网络隐私' },
    after: '这些命令只读取状态。输出里可能有网络隐私，只留在本地看。',
  },
  {
    tab: '可选 · VM', title: '可选：Mac 上的专用 VM 方案',
    before: '需要更明确的隔离边界时，让 Claude 与专用浏览器只在一台受控 Linux VM 内运行。VM 只允许连接独立代理网关的固定 TCP 端口，所有其他目的地默认拒绝；新域名、IP 字面量、IPv6、UDP 都不靠名单识别。',
    use: '把工具关进一个只能连代理网关的隔离环境。',
    pre: '专用、静态网络的 Linux VM；无容器转发、无其他网络 namespace、无旁路网卡；Agent 没有 root / CAP_NET_ADMIN。',
    check: '规则先于业务加载；重启后读回规则再允许启动；用 VM 控制台做掉线、未知域名、原始 IP、UDP 和重启测试。',
    prep: [
      ['准备', '专用 VM、静态私有网段、控制台恢复入口；先安装工具与依赖。不要通过唯一的 SSH 连接部署默认拒绝规则。'],
      ['网关', '仅在隔离接口提供 HTTP CONNECT 代理，限制来源 VM；上游固定，禁止 DIRECT 回落。不要把未认证代理暴露到局域网或公网。'],
      ['VM', '下方 inet output 链只放行代理网关端口，其余 IPv4 / IPv6 流量拒绝。无额外桥接网卡、容器或 namespace 绕过。'],
      ['权限', '业务 Agent 是普通用户，不给 sudo、Docker socket、宿主执行入口或修改规则的能力。宿主上的原生 Claude 不在这套 VM 保护内，不能混着使用。'],
      ['启动', '规则必须先于业务加载；重启后读回规则再允许启动。用 VM 控制台做掉线、未知域名、原始 IP、UDP 和重启测试。'],
    ],
    code: { code: CODE_NFT, lang: 'nft', title: '可选严格模式 · 专用 Linux VM 出站规则', note: 'Linux VM 模板 · 此处未部署' },
    after: `此模板不放行 DHCP、NTP 或系统更新的直接网络请求，静态网络与系统维护要提前安排；需要例外时逐项审核，不加入全局 established 放行来图方便。更新工具通过受控代理获取。</p>
      <p><b>回滚</b>必须先停业务并断开 VM 外网，在控制台只删除专用 table：<code>sudo nft delete table inet pioneer_egress</code>。不要使用 flush ruleset 清空其他规则。重新启用业务前，恢复并验证保护。</p>
      <p class="faint">机制依据：${EXT('https://wiki.nftables.org/wiki-nftables/index.php/Configuring_chains', 'nftables 官方文档 · output hook 与默认 drop')}。这是可实施的隔离方案，仍需在所选 VM、内核与网关上验收。`,
  },
]

const MODULES = [
  { name: 'claude-route-guard', as: '巡逻保安', duty: '预检、路由判定与异常响应', check: 'SAFE 才准入；UNKNOWN 不当作 SAFE；失败不放宽', icon: '<circle cx="12" cy="12" r="8"/><path d="m12 12 5-5"/><circle cx="12" cy="12" r="1.4"/>' },
  { name: 'net-guard', as: '巡逻保安', duty: '出口身份、IPv6、路由与自愈', check: '模式明确；探测走受控路径；冷静期有效', icon: '<path d="M4 12a8 8 0 0 1 16 0"/><path d="M7.5 12a4.5 4.5 0 0 1 9 0"/><circle cx="12" cy="12" r="1.4"/><path d="M12 13.4V20"/>' },
  { name: 'CLI wrapper', as: '出门安检', duty: '代理注入、预检、启动真实客户端', check: '退出码传递；拒绝时不启动；无递归；参数原样传递', icon: '<path d="M6 20V9a6 6 0 0 1 12 0v11"/><path d="M3 20h18"/><path d="M9.5 12.5h5M9.5 16h5"/>' },
  { name: 'PF / 系统过滤', as: '门卫', duty: '发包前的阻断', check: '语法正确不够，要读回规则并做断线反例', icon: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.5-7 9-4-1.5-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15 10.4"/>' },
  { name: '权限辅助工具', as: '钥匙', duty: '少量固定的高权限动作', check: 'root 所有、普通用户不可写；参数约束，不授宽泛 sudo', icon: '<circle cx="8" cy="12" r="3.8"/><path d="M11.8 12h8.7M17.5 12v3M20.5 12v2.4"/>' },
]

const pad = (n) => String(n).padStart(2, '0')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ico = (p, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`

export default {
  id: 'build',
  nav: '动手搭建',
  desc: '八步施工图与配置模板',
  mood: 'focus',
  mount(el, { num, setLevel }) {
    el.innerHTML = `
    <div class="wrap">
      <header class="chapter-head">
        <div class="kicker"><span class="num">${num}</span><span class="bar"></span><span>动手搭建</span></div>
        <h2 class="h2" data-reveal="lines">按顺序，一层一层<br><span class="text-warm">搭起来</span></h2>
        <p class="lead" data-reveal>这是一张施工图，一共八站。<strong>每完成一层，先确认它真正生效，再继续下一层。</strong></p>
      </header>

      <div class="bd-plan" data-reveal="blur">
        <div class="bd-plan__bar">
          <span class="bd-plan__title">施工图 · 八站</span>
          <span class="bd-plan__legend"><i class="is-on"></i>已验收 <i></i>待施工</span>
        </div>
        <div class="bd-track">
          <i class="bd-rail" aria-hidden="true"><i class="bd-rail__fill"></i></i>
          <div class="bd-walker" aria-hidden="true">${mascot({ size: 46, face: 'idle' })}</div>
          <ol class="bd-stations">
            ${STATIONS.map((s, i) => `<li class="bd-st ${i % 2 ? 'is-below' : 'is-above'}" style="--i:${i}">
              <span class="bd-st__node">${ico(s.icon)}<span class="bd-st__ok" aria-hidden="true">${ico('<path d="m6.5 12.5 3.6 3.6 7.4-8"/>')}</span></span>
              <div class="bd-st__card">
                <span class="bd-st__n">${pad(i + 1)}</span>
                <h3 class="bd-st__t">${s.t}</h3>
                <p class="bd-st__d">${s.d}</p>
              </div>
            </li>`).join('')}
          </ol>
        </div>
      </div>

      <ul class="bd-rules" data-reveal="stagger">
        <li><span class="bd-rules__i">${ico('<path d="m6.5 12.5 3.6 3.6 7.4-8"/>')}</span><p><b>先验收，再继续。</b>每完成一层，确认它真正生效了，再搭下一层。</p></li>
        <li><span class="bd-rules__i">${ico('<path d="M4 7h16M4 12h10M4 17h7"/><circle cx="18" cy="16" r="3"/>')}</span><p><b>这是脱敏模板。</b>端口、路径和节点，按自己的机器改。</p></li>
        <li><span class="bd-rules__i">${ico('<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15"/>')}</span><p><b>它不是万能安装命令。</b>页面上的复制按钮，也不会执行任何命令。</p></li>
      </ul>

      <section class="bd-demo" aria-label="终端演示：SAFE 才准入">
        <div class="bd-demo__side">
          <div class="bd-demo__tags"><span class="tag tag--warm"><span class="dot"></span>演示</span><span class="tag">不执行任何命令</span></div>
          <h3 class="h2 bd-demo__h" data-reveal="lines">SAFE 才准入</h3>
          <p class="muted" data-reveal>启动预检就是出门前的安检，<strong>它只认一个结果：SAFE。</strong>探测超时、429、出口不匹配，一律不启动新任务。</p>
          <p class="bd-demo__label small faint">选一种情况，再点运行：</p>
          <div class="segmented bd-seg" role="group" aria-label="选择演示情况">
            ${Object.entries(SCENARIOS).map(([k, v], i) => `<button type="button" data-sc="${k}" aria-pressed="${i === 0}">${v.label}</button>`).join('')}
          </div>
          <div class="bd-demo__actions">
            <button type="button" class="btn btn--primary bd-run"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg><span>运行预检</span></button>
          </div>
          <div class="callout callout--info bd-demo__note">
            <div class="callout__title">${ico('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>')}只查一次，不够</div>
            <p class="small">它只在启动那一刻查一次。查完之后网络还可能变，所以要配合独立的阻断层（门卫）一起用。</p>
          </div>
        </div>

        <div class="bd-demo__main">
          <div class="bd-scene" data-state="ok">
            <svg class="bd-scene__svg" viewBox="0 0 640 170" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <defs>
                <radialGradient id="bd-lamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd08a" stop-opacity=".95"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
                <radialGradient id="bd-win" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd08a" stop-opacity=".7"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
              </defs>
              <g class="bd-stars"><circle cx="210" cy="26" r="1.2"/><circle cx="430" cy="18" r="1"/><circle cx="560" cy="36" r="1.3"/><circle cx="80" cy="20" r="1"/><circle cx="330" cy="44" r="0.9"/></g>
              <path class="bd-ground" d="M0 142h640"/>
              <path class="bd-road" d="M84 142h480"/>
              <g class="bd-house">
                <circle cx="84" cy="100" r="30" fill="url(#bd-win)"/>
                <path d="M44 142V96l40-30 40 30v46"/>
                <path d="M74 142v-24h20v24"/>
                <rect x="54" y="102" width="12" height="11" rx="2" class="bd-lit"/>
                <rect x="102" y="102" width="12" height="11" rx="2" class="bd-lit"/>
                <text x="84" y="162" text-anchor="middle">你的电脑</text>
              </g>
              <g class="bd-gate">
                <path class="bd-gate__post" d="M262 142V94"/>
                <circle class="bd-gate__light" cx="262" cy="88" r="5"/>
                <g class="bd-gate__arm"><rect x="262" y="104" width="86" height="7" rx="3.5"/><path d="M282 104v7M302 104v7M322 104v7" class="bd-gate__stripe"/></g>
                <text x="262" y="162" text-anchor="middle">启动预检</text>
                <g class="bd-stamp"><rect x="222" y="40" width="112" height="30" rx="6"/><text x="278" y="61" text-anchor="middle">拒绝启动</text></g>
              </g>
              <path class="bd-sig" d="M300 96C360 58 470 54 528 76"/>
              <g class="bd-depot">
                <circle class="bd-depot__glow" cx="552" cy="74" r="44" fill="url(#bd-lamp)"/>
                <path d="M510 142V92l42-28 42 28v50"/>
                <path d="M538 142v-26h28v26"/>
                <circle class="bd-depot__lamp" cx="552" cy="92" r="6"/>
                <text x="552" y="162" text-anchor="middle">代收点</text>
                <g class="bd-depot__wrong"><rect x="506" y="30" width="92" height="22" rx="11"/><text x="552" y="45" text-anchor="middle">地址不对</text></g>
              </g>
            </svg>
            <div class="bd-hero" aria-hidden="true">${mascot({ size: 64, face: 'idle' })}</div>
            <p class="bd-scene__hint tiny"><span class="bd-scene__dot"></span><span class="bd-scene__txt">${SCENARIOS.ok.hint}</span></p>
          </div>

          <div class="bd-term" role="region" aria-label="终端演示输出">
            <div class="bd-term__bar">
              <span class="codeblock__dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="bd-term__title">guarded-claude-example.sh</span>
              <span class="bd-term__note">演示，不执行任何命令</span>
            </div>
            <div class="bd-term__out" aria-hidden="true"><div class="bd-term__line is-dim">$ 选好情况，点「运行预检」</div></div>
            <p class="visually-hidden bd-term__live" aria-live="polite"></p>
          </div>
          <p class="bd-demo__foot tiny faint">逻辑演示，不读取你电脑的网络。输出文字取自原版教学脚本 guarded-claude-example.sh。</p>
        </div>
      </section>

      <div class="bd-teaser newbie-only card card--info" data-reveal>
        <div class="bd-teaser__txt">
          <span class="pro-badge">进阶</span>
          <h3 class="h3">想看真实的配置和脚本？</h3>
          <p class="muted">进阶模式里有 6 段模板和 1 个可选的 VM 方案。每段都写了用途、前提和验收点，代码与原版逐字一致。</p>
        </div>
        <button type="button" class="btn btn--ghost bd-teaser__btn">切到进阶，看配置 <span class="arrow">→</span></button>
      </div>

      <section class="bd-pro pro-only" aria-label="进阶：配置与脚本">
        <header class="bd-pro__head">
          <span class="pro-badge">进阶 · 配置与脚本</span>
          <h3 class="h3">每段都有用途、前提与验收点</h3>
          <p class="muted">复制按钮不会执行命令。下面全部是脱敏教学模板，含占位符的地方要换成实际值。route-guard、net-guard 及其状态接口是设计示例，需要另行实现与验收。本项目只提供手册和只读检测，不安装防火墙或常驻守卫，不能原样部署。</p>
        </header>
        <div class="bd-tabs">
          <div class="bd-tablist" role="tablist" aria-label="配置与脚本" aria-orientation="vertical">
            ${PANELS.map((p, i) => `<button type="button" role="tab" id="bd-t-${i}" aria-controls="bd-p-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-sfx="click"><span class="n">${pad(i + 1)}</span><span class="t">${p.tab}</span></button>`).join('')}
          </div>
          <div class="bd-panels">
            ${PANELS.map((p, i) => `<div class="bd-panel" role="tabpanel" id="bd-p-${i}" aria-labelledby="bd-t-${i}" tabindex="0" ${i ? 'hidden' : ''}>
              <header class="bd-panel__head">
                <span class="bd-panel__n">${pad(i + 1)}</span>
                <div><h4 class="h3">${p.title}</h4><p class="muted">${p.before}</p></div>
              </header>
              <dl class="bd-meta">
                <div><dt>用途</dt><dd>${p.use}</dd></div>
                <div><dt>前提</dt><dd>${p.pre}</dd></div>
                <div><dt>验收点</dt><dd>${p.check}</dd></div>
              </dl>
              ${p.prep ? `<ol class="bd-prep">${p.prep.map(([k, v]) => `<li><b>${k}</b><span>${v}</span></li>`).join('')}</ol>` : ''}
              ${codeBlock(p.code)}
              <div class="callout callout--${p.tone || 'info'} bd-after">
                ${p.afterTitle ? `<div class="callout__title">${p.afterTitle}</div>` : ''}
                <p class="small">${p.after}</p>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <div class="bd-mods">
          <h3 class="h3">模块职责：每个零件管什么，怎么验收</h3>
          <div class="bd-mods__grid" data-reveal="stagger">
            ${MODULES.map((m) => `<article class="bd-mod">
              <div class="bd-mod__top"><span class="bd-mod__i">${ico(m.icon)}</span><span class="tag tag--warm">${m.as}</span></div>
              <h4 class="bd-mod__name">${m.name}</h4>
              <dl><div><dt>职责</dt><dd>${m.duty}</dd></div><div><dt>验收点</dt><dd>${m.check}</dd></div></dl>
            </article>`).join('')}
          </div>
        </div>
      </section>
    </div>`

    enhanceCodeBlocks(el)
    // 代码块内部滚动：让滚轮在代码里原生滚动
    el.querySelectorAll('.codeblock pre').forEach((p) => p.setAttribute('data-lenis-prevent', ''))

    /* ---------------- 施工图：小请求沿路走 ---------------- */
    const track = el.querySelector('.bd-track')
    const rail = el.querySelector('.bd-rail')
    const railFill = el.querySelector('.bd-rail__fill')
    const walker = el.querySelector('.bd-walker')
    const sts = [...el.querySelectorAll('.bd-st')]
    let centers = []
    let vertical = false
    let lastOn = -1
    let progress = prefersReduced ? 1 : 0

    function measure() {
      const tr = track.getBoundingClientRect()
      centers = sts.map((s) => {
        const r = s.querySelector('.bd-st__node').getBoundingClientRect()
        return { x: r.left - tr.left + r.width / 2, y: r.top - tr.top + r.height / 2 }
      })
      vertical = Math.abs(centers[7].y - centers[0].y) > Math.abs(centers[7].x - centers[0].x)
      const a = centers[0]
      const b = centers[centers.length - 1]
      if (vertical) Object.assign(rail.style, { left: `${a.x - 1}px`, top: `${a.y}px`, width: '2px', height: `${b.y - a.y}px` })
      else Object.assign(rail.style, { left: `${a.x}px`, top: `${a.y - 1}px`, width: `${b.x - a.x}px`, height: '2px' })
      paint(progress, false)
    }

    function paint(p, sound = true) {
      progress = p
      const a = centers[0]
      const b = centers[centers.length - 1]
      if (!a) return
      const x = a.x + (b.x - a.x) * p
      const y = a.y + (b.y - a.y) * p
      walker.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      railFill.style.transform = vertical ? `scaleY(${p})` : `scaleX(${p})`
      let on = -1
      centers.forEach((c, i) => {
        const reached = vertical ? y >= c.y - 2 : x >= c.x - 2
        sts[i].classList.toggle('is-on', reached)
        if (reached) on = i
      })
      if (on !== lastOn) {
        if (sound && on > lastOn && on >= 0) audio.sfx(on === sts.length - 1 ? 'success' : 'step')
        const done = on === sts.length - 1
        if (done !== walker.classList.contains('is-done')) {
          walker.classList.toggle('is-done', done)
          walker.innerHTML = mascot({ size: 46, face: done ? 'happy' : 'idle', tint: done ? 'safe' : 'warm' })
        }
        lastOn = on
      }
    }

    requestAnimationFrame(measure)
    const roTrack = new ResizeObserver(() => measure())
    roTrack.observe(track)
    if (prefersReduced) paint(1, false)
    else {
      ScrollTrigger.create({
        trigger: track, start: 'top 72%', end: 'bottom 52%', scrub: 0.8,
        onUpdate: (self) => paint(self.progress, self.direction > 0),
        onRefresh: () => measure(),
      })
    }

    /* ---------------- 终端演示 ---------------- */
    const scene = el.querySelector('.bd-scene')
    const hero = el.querySelector('.bd-hero')
    const arm = el.querySelector('.bd-gate__arm')
    const stamp = el.querySelector('.bd-stamp')
    const sig = el.querySelector('.bd-sig')
    const out = el.querySelector('.bd-term__out')
    const live = el.querySelector('.bd-term__live')
    const runBtn = el.querySelector('.bd-run')
    const hintTxt = el.querySelector('.bd-scene__txt')
    const segBtns = [...el.querySelectorAll('.bd-seg button')]
    let sc = 'ok'
    let runId = 0
    let moodTimer = 0
    const POS = { home: 22, gate: 35, depot: 80 }
    const face = (f, tint = 'warm') => { hero.innerHTML = mascot({ size: 64, face: f, tint }) }
    const moveHero = (to, dur = 1) => gsap.to(hero, { left: `${POS[to]}%`, duration: prefersReduced ? 0 : dur, ease: 'expo.out' })

    function resetScene() {
      gsap.killTweensOf([hero, arm, stamp, sig])
      gsap.set(hero, { left: `${POS.home}%`, x: 0, y: 0 })
      gsap.set(arm, { rotation: 0, svgOrigin: '262 107.5' })
      gsap.set(stamp, { opacity: 0, scale: 0.6, svgOrigin: '278 55' })
      gsap.set(sig, { opacity: 0, strokeDashoffset: 0 })
      scene.classList.remove('is-blocked', 'is-pass', 'is-wrong', 'is-probing')
      scene.dataset.state = sc
      face('idle')
      clearTimeout(moodTimer)
    }

    function idle() {
      runId++
      out.innerHTML = '<div class="bd-term__line is-dim">$ 选好情况，点「运行预检」</div>'
      runBtn.removeAttribute('aria-disabled')
      runBtn.querySelector('span').textContent = '运行预检'
      resetScene()
    }

    function onEvent(ev) {
      if (ev === 'toGate') { moveHero('gate', 1.2); audio.sfx('whoosh') }
      if (ev === 'probe') {
        scene.classList.add('is-probing')
        gsap.set(sig, { opacity: 1 })
        if (!prefersReduced) gsap.fromTo(sig, { strokeDashoffset: 60 }, { strokeDashoffset: 0, duration: 0.9, ease: 'none', repeat: 1 })
      }
      if (ev === 'dark') { face('worried'); audio.sfx('heartbeat') }
      if (ev === 'wrong') { scene.classList.add('is-wrong'); face('worried'); audio.sfx('error') }
      if (ev === 'block') {
        scene.classList.remove('is-probing')
        scene.classList.add('is-blocked')
        face('blocked')
        audio.sfx('gate')
        setTimeout(() => audio.sfx('deny'), 140)
        pushMood('tension')
        clearTimeout(moodTimer)
        moodTimer = setTimeout(() => popMood(), 2600)
        if (!prefersReduced) {
          gsap.fromTo(stamp, { opacity: 0, scale: 1.8, rotation: -14 }, { opacity: 1, scale: 1, rotation: -6, duration: 0.5, ease: 'back.out(2.2)', svgOrigin: '278 55' })
          gsap.fromTo(hero, { x: 0 }, { x: -7, duration: 0.07, repeat: 5, yoyo: true, ease: 'sine.inOut', onComplete: () => gsap.set(hero, { x: 0 }) })
          gsap.to(hero, { left: `${POS.home}%`, duration: 1.4, ease: 'expo.out', delay: 1.1 })
        } else gsap.set(stamp, { opacity: 1, scale: 1, rotation: -6, svgOrigin: '278 55' })
        live.textContent = sc === 'down' ? '结果：BLOCKED，出口探测失败，拒绝启动。' : '结果：BLOCKED，出口不匹配，拒绝启动。'
      }
      if (ev === 'pass') {
        scene.classList.remove('is-probing')
        scene.classList.add('is-pass')
        audio.sfx('success')
        gsap.to(arm, { rotation: -78, svgOrigin: '262 107.5', duration: prefersReduced ? 0 : 0.8, ease: 'expo.out' })
        face('happy', 'safe')
        moveHero('depot', 1.6)
        live.textContent = '结果：启动探测通过；持续阻断由独立防火墙负责。'
      }
    }

    async function run() {
      const id = ++runId
      resetScene()
      out.innerHTML = ''
      live.textContent = '正在运行演示预检'
      runBtn.setAttribute('aria-disabled', 'true')
      runBtn.querySelector('span').textContent = '运行中…'
      const lines = [...HEAD, ...TAIL[sc]]
      for (const line of lines) {
        if (id !== runId) return
        const row = document.createElement('div')
        row.className = `bd-term__line is-${line.c} is-typing`
        out.appendChild(row)
        if (prefersReduced) row.textContent = line.t
        else {
          const chars = [...line.t]
          for (let i = 0; i < chars.length; i++) {
            if (id !== runId) return
            row.textContent = chars.slice(0, i + 1).join('')
            if (chars[i] !== ' ' && chars[i] !== '.') audio.sfx('type')
            await sleep(line.c === 'cmd' ? 34 : chars[i] === '.' ? 8 : 17)
          }
        }
        row.classList.remove('is-typing')
        if (line.ev) onEvent(line.ev)
        if (!prefersReduced) await sleep(line.pause || 240)
      }
      if (id !== runId) return
      const cur = document.createElement('div')
      cur.className = 'bd-term__line is-dim is-cursor'
      cur.textContent = '$ '
      out.appendChild(cur)
      runBtn.removeAttribute('aria-disabled')
      runBtn.querySelector('span').textContent = '再运行一次'
    }

    runBtn.addEventListener('click', () => { if (runBtn.getAttribute('aria-disabled') !== 'true') { audio.sfx('click'); run() } })
    segBtns.forEach((b) => b.addEventListener('click', () => {
      sc = b.dataset.sc
      segBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      hintTxt.textContent = SCENARIOS[sc].hint
      audio.sfx(sc === 'ok' ? 'toggle-on' : 'toggle-off')
      idle()
    }))
    resetScene()

    /* ---------------- 进阶：标签页 ---------------- */
    const tabs = [...el.querySelectorAll('.bd-tablist [role="tab"]')]
    const panels = [...el.querySelectorAll('.bd-panel')]
    let refreshT = 0
    function select(i, focus = false) {
      tabs.forEach((t, n) => { t.setAttribute('aria-selected', String(n === i)); t.tabIndex = n === i ? 0 : -1 })
      panels.forEach((p, n) => { p.hidden = n !== i })
      if (focus) tabs[i].focus()
      if (!prefersReduced) gsap.fromTo(panels[i], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' })
      clearTimeout(refreshT)
      refreshT = setTimeout(() => ScrollTrigger.refresh(), 120)
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i))
      t.addEventListener('keydown', (e) => {
        const k = e.key
        let n = -1
        if (k === 'ArrowDown' || k === 'ArrowRight') n = (i + 1) % tabs.length
        if (k === 'ArrowUp' || k === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length
        if (k === 'Home') n = 0
        if (k === 'End') n = tabs.length - 1
        if (n >= 0) { e.preventDefault(); audio.sfx('click'); select(n, true) }
      })
    })

    el.querySelector('.bd-teaser__btn').addEventListener('click', () => setLevel('pro'))
    bus.on('level', () => requestAnimationFrame(measure))

    reveal(el)
  },
}

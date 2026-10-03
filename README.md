# Claude 防护手册与环境体检

一份完整的 Claude 使用环境与防护手册，配套浏览器基础检测、macOS 本地检测器与 Agent skill。手册解释安装、认证入口、代理路径、隐私与故障排查；检测工具帮助核对可观察到的环境与证据缺口。

**打开网站即阅读完整手册。** 顶部「环境检测」按钮进入辅助检测页，完成后可返回手册继续排查。首页完整保留 18 个章节、图解与小白／进阶模式。

项目与 Anthropic 无隶属关系。探测结果描述对应时间和范围；账号资格与账户处置以官方规则为准。

## 使用方式

在线手册：[Claude 防护手册](https://www.heigeai.com/claude/)。项目仓库：[claude-environment-check](https://github.com/HeiGeAi/claude-environment-check)。手册源码位于 [`manual/src/`](manual/src/)，辅助检测页面位于 [`web/`](web/)，两者一同构建为静态网站。公开项目站点使用下面的 GitHub Pages 链接。

项目站点：[完整手册与辅助检测](https://heigeai.github.io/claude-environment-check/)。手册源码、图解、字体与检测工具均随仓库和静态发布包提供。

![完整手册首页](docs/images/manual-desktop.png)

[查看完整章节目录](docs/手册目录.md) · [浏览器环境检测](https://heigeai.github.io/claude-environment-check/check/)

本地：Python 3.10 及以上。核心仅使用标准库；网络探针需要系统 curl。默认只读，不执行本工具网络探针。克隆后运行：

```sh
git clone https://github.com/HeiGeAi/claude-environment-check.git
cd claude-environment-check
python3 skills/claude-environment-check/scripts/check.py --run-location local_mac --out-dir "$HOME/claude-check-reports"
```

主动网络探针需选择路径。系统模式沿用当前系统路由，不能据此证明每个 Claude 进程走同一出口：

```sh
python3 skills/claude-environment-check/scripts/check.py --run-location local_mac --network --path system --out-dir "$HOME/claude-check-reports"
```

显式本地 HTTP 代理（以下端口是合成示例，必须替换为自己的 HTTP 代理端口）：

```sh
python3 skills/claude-environment-check/scripts/check.py --run-location local_mac --network --proxy http://127.0.0.1:45678 --out-dir "$HOME/claude-check-reports"
```

代理失败不自动直连、不关闭 TLS 校验、不切换节点。默认仍调用已安装 CLI 读取版本与认证状态，本工具不隔离该 CLI 的网络行为。认证状态读取仅针对被检查的 CLI。Desktop 和网页账号状态分别列出。

Agent：将 `skills/claude-environment-check` 文件夹复制到所用 Agent 的 skill 目录。`SKILL.md` 与 `scripts/check.py` 必须一起保留。执行位置在用户电脑上的 Agent 才能检查该电脑；远程或云端 Agent 检查的是自己的执行环境。

可在 [Release 下载页](https://github.com/HeiGeAi/claude-environment-check/releases) 获取完整 `.skill`／`.zip` 包和静态网站包。`.skill` 与 `.zip` 均为 ZIP 格式。

## 覆盖范围

| 能力 | 网页 | 本地 macOS |
| :--- | :--- | :--- |
| 浏览器语言、时区、基础能力 | 可观察 | 未覆盖浏览器配置 |
| IPv4／IPv6 出口探针 | 点击后执行 | 显式联网模式 |
| 同族出口比较 | 可观察的探针结果 | 可观察的探针结果 |
| WebRTC 候选地址 | 单独选择后执行 | 未覆盖 |
| CLI 安装与认证入口 | 导入报告阅读 | 定向读取 |
| 系统代理、默认路由、DNS 摘要 | 导入报告阅读 | 定向读取 |
| PF 规则 | 无法读取 | 权限不足为 UNKNOWN |
| DNS 泄漏、整机断线阻断 | 未验证 | 未做故障演练为 UNKNOWN |
| 封号概率或账号安全认证 | 不提供 | 不提供 |

IPv4 与 IPv6 地址不同属正常地址族差异。没有 WebRTC 候选、探针超时或跨域限制不能解释成没有泄漏。`doctor` 返回成功也不代表所有配置正常。

## 报告与隐私

PASS、FAIL、WARN、UNKNOWN、SKIPPED 分别表示已验证、确认问题、配置线索、证据不足和未执行。整体结果只聚合当前范围。报告导出不包含凭据、原始出口 IP、用户名、机器名或完整配置；单份报告内以随机别名保留地址相等关系。

公开仓库不收录开发者或用户的真实个人体检报告、机器快照与短期环境状态。运行报告由用户保存在自己的目录并自行决定是否分享，测试夹具为明确标注的合成数据。

网页导入在浏览器本地完成。本站没有报告上传接口、分析埋点或云端报告库。点击网络检测时，探针服务会收到你的出口 IP 及请求元数据；可选 STUN 会向其服务发起 WebRTC 请求。详细边界见 [隐私说明](docs/隐私说明.md)。

## 开发与验证

Node.js 22 及以上用于构建手册。依赖版本由 lockfile 固定。Python 与 Node 测试执行：

```sh
npm ci
npm test
npm run build
npm run dev
```

预览地址为 `http://127.0.0.1:5190`。`dist/` 可以部署在任意静态站点的子目录，无需新增后端或数据库。

[报告格式](docs/报告格式.md) · [测试与兼容范围](docs/验收记录.md) · [第三方许可](THIRD_PARTY_NOTICES.md)

## 开源许可

原创代码及手册采用 MIT。字体与第三方库使用其各自许可，见第三方声明。欢迎提交最小问题描述与合成复现步骤；请勿附带真实个人体检报告、机器快照、凭据、代理订阅、Cookie 或原始配置。

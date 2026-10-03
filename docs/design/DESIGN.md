---
version: alpha
name: NightTown-design-system
description: >-
  A shared field-guide and diagnostic companion interface. Deep night canvas,
  warm paper text, amber light routes, coral accents and a glowing courier mascot.
colors:
  primary: "#ffb35c"
  on-primary: "#2a1408"
  canvas: "#07080c"
  surface: "#0e1119"
  ink: "#f4efe6"
  muted: "#b8b5b1"
  hairline: "#383940"
  safe: "#6ff0b8"
  warning: "#ffd166"
  danger: "#ff4d61"
  info: "#8fb4ff"
typography:
  display:
    fontFamily: '"GuideSerif", "Songti SC", "Noto Serif SC", "PingFang SC", serif'
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.12
  body:
    fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.85
  latin:
    fontFamily: '"Instrument", "GuideSerif", "Songti SC", serif'
    fontSize: 22px
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: '"JB Mono", "SF Mono", Menlo, Consolas, monospace'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.7
rounded:
  sm: 12px
  md: 18px
  lg: 28px
  pill: 999px
spacing:
  xs: 8px
  sm: 12px
  md: 24px
  lg: 40px
  section: 80px
components:
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "{spacing.section} {spacing.md}"
  caption:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.mono}"
    padding: "{spacing.xs}"
  divider:
    backgroundColor: "{colors.hairline}"
    height: 1px
  status-warning:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warning}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
  status-unknown:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.info}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "{spacing.sm} {spacing.md}"
  reading-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  status-pass:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.safe}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
  status-fail:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
---

# 夜色小城

手册与环境检测共享同一视觉来源。颜色、字体、间距、圆角、缓动及本地字体声明从 `manual/src/styles/tokens.css` 复用；小请求形象从 `manual/src/core/mascot.js` 复用。检测页不另建独立视觉主题。

## Signature Moment

一颗暖色小请求沿灯带靠近受控光门。等待检测时，只展示正在采集的状态；完成后按真实报告显示结论。光门与线路是解释图解，不代表真实流量捕获或系统防护已经生效。

## Do's and Don'ts

1. 暗底、暖纸文字、暖金到珊瑚的主要操作色保持一致。
2. 标题使用原 serif，本地字体与系统中文兜底同时保留。
3. 圆角面板、细线、留白建立层级，技术详情可以折叠，访问目的必须可查看。
4. 动效跟随真实运行状态；只动 transform 与 opacity，减少动态效果时停止装饰动画。
5. PASS、FAIL、WARN、UNKNOWN、SKIPPED 保留文字标签与不同语义色，不用装饰图形制造检测结论。
6. 首次进入不自动联系测试服务；导入报告仅在浏览器处理，公开截图不包含个人环境。

## Validation

设计规范通过 HeiGe·Design 所用的 design.md lint 引擎验证。页面另行使用实际浏览器核对桌面与移动视口、字体、视觉一致性、真实请求、取消、报告导入与脱敏导出。规范检查不能代替视觉验收。

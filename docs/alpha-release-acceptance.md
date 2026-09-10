# LifeFlow 公开 Alpha 发布验收记录

日期：2026-09-10

发布提交：`1b1dada27e7616ea29a310d07a77e1f369339c3e`

公开地址：<https://life-flow-seven.vercel.app/>

## 结论

LifeFlow 第一阶段已经达到“公开 Alpha 已发布”的验收标准：展示页、安全 Demo、账号边界、反馈入口、隐私安全事件边界、生产构建、前后端测试、本机验收及部署后的桌面、移动端和 PWA 主路径均已验证。

发布范围仍严格限定为公开展示页和安全 Demo。公开注册继续关闭，真实 Supabase 账号、跨设备同步、真实信源与通用生产安全能力不属于本次发布验收。

## 自动化与构建证据

- `npm test`：74/74 通过。
- `npm run backend:test`：41/41 通过。
- `npm run build`：通过，Vite 转换 193 个模块并生成 PWA Service Worker。
- `git diff --check`：通过。
- 展示页拥有独立的 `LandingView` JS/CSS chunk；`TodayView`、`ContentView`、`AppShell`、`weekly` 等工作台模块均为单独按需 chunk，没有静态合并进展示页 chunk。
- `dist/manifest.webmanifest`、`dist/sw.js`、`pwa-192.png`、`pwa-512.png` 均生成并进入预缓存；应用保留安装、更新提示和离线就绪处理。

测试期间在受限沙箱中出现过 Vite HMR WebSocket 监听 `EPERM` 日志，但测试结果全部通过；生产预览和 Playwright 浏览器验收没有该错误。

## 本机真实浏览器主路径

使用最新生产构建和全新本地 origin，在桌面视口完成以下路径：

1. 匿名访问 `/`，确认价值主张、Alpha 状态、本地合成数据边界、Demo、登录、GitHub 和反馈入口。
2. 从展示页进入 `/demo`，确认“安全 Demo / 退出 Demo / 重置 Demo”身份控制及 LifeFlow 公开仓库内容。
3. 完成“规划今日重点”并提交合成执行备注；引导的执行步骤只在两项事实都成立后完成。
4. 打开周期复盘，展开对应任务后看到刚提交的执行备注。
5. 打开 News，确认没有真实信源管理或刷新入口；收藏一条合成资讯。
6. 刷新页面，确认 Demo 身份、执行事实、引导进度和收藏状态持续存在；请求清单中没有生产业务 API。
7. 返回 Today，确认执行、周期复盘、资讯收藏三项引导均完成。
8. 执行“重置 Demo”，确认访客备注和收藏消失，任务、历史记录、周期复盘、合成资讯及三项引导恢复固定初始快照。
9. 执行“退出 Demo”，确认 Demo 身份关闭并返回 `/`。
10. 直接访问 `/auth`，确认公开注册入口隐藏，已有账号登录、密码恢复和安全 Demo 入口仍可到达。

主路径复验结束时浏览器控制台为 0 errors / 0 warnings。

## 移动端与 PWA

- 在 390×844 视口检查展示页：标题、说明、两个主 CTA 和工作流示意可读、可点击。
- 在相同视口直接访问 `/demo`：Today、完成统计和三步体验引导先于天气、资讯摘要等辅助组件呈现。
- 在 390×844 视口再次完整完成任务、提交备注、在周期复盘观察备注、收藏合成资讯、刷新确认持续性、确认三步引导完成并重置；重置后访客备注消失，控制台 0 errors / 0 warnings。
- PWA 单独验收：先在线访问并让 Service Worker 接管，再将浏览器设为离线并刷新 `/demo`。页面、工作台资源和头部标志均由缓存正常加载，控制台 0 errors / 0 warnings。

## 线上部署与真实浏览器证据

- GitHub `main` 的发布提交为 `1b1dada27e7616ea29a310d07a77e1f369339c3e`；GitHub Deployment `6353114344` 在 2026-09-09 15:17:34 UTC 报告 `success`。
- 公开展示页 <https://life-flow-seven.vercel.app/>、安全 Demo `/demo` 和认证页 `/auth` 均返回 HTTP 200；根路由、Demo、Today、News 和认证页的直接访问或刷新均成功。
- 部署页标题、描述、canonical URL、Open Graph 图片和应用图标均指向正式 LifeFlow 信息；分享图、PWA manifest、GitHub 仓库和反馈模板入口均可访问。未登录 GitHub 的访客会先进入 GitHub 登录页。
- 全新浏览器会话只访问展示页时加载入口 JS/CSS、Workbox、`LandingView` JS/CSS、默认关闭的 Alpha 事件边界和应用图标；没有加载 `TodayView`、`ContentView`、`AppShell`、`weekly` 或 Markdown 编辑器等工作台 chunk。
- 桌面端从展示页进入安全 Demo 后，真实完成任务并提交合成执行备注；周期复盘中可见该备注，合成资讯收藏在刷新后保持，三步引导全部完成。重置后验收备注和收藏消失，引导恢复初始状态；退出 Demo 后返回展示页。
- 匿名状态直接访问和刷新 `/auth` 正常，页面明确显示“公开注册暂未开放”，已有账号登录、恢复密码和安全 Demo 入口均可到达。
- 桌面验收请求清单中除静态资源外没有动态请求，展示页和安全 Demo 未调用生产业务 API；完整主路径控制台为 0 errors / 0 warnings。
- 在 390×844 视口重新完成任务、备注、周期复盘、资讯收藏、刷新持续性和重置；Today 与体验引导先于辅助组件，控制台为 0 errors / 0 warnings，动态请求清单为空。
- PWA 由 Service Worker 实际接管，线上 manifest 使用 `display: standalone`、`scope: /`、`start_url: /pulse` 并提供 192/512 与 maskable 图标。浏览器切换离线后刷新 `/today` 仍完整呈现安全 Demo 和引导，控制台为 0 errors / 0 warnings。
- GitHub 仓库 Homepage 已更新为 <https://life-flow-seven.vercel.app/>；README 同时保留展示页、安全 Demo、反馈、贡献与安全报告入口。

## 浏览器验收中发现并修复的问题

### Demo 备注草稿无法持久化

真实输入备注时曾触发 `DataCloneError`：Vue reactive proxy 被直接交给 `structuredClone`。修复是在状态连续性的 `today.saveDrafts` adapter 边界用 `toRaw` 转换并复制为 plain data；新增回归测试覆盖 reactive 草稿写入。修复后备注输入、提交、刷新和复盘均通过浏览器复验。

### 离线头部标志未进入预缓存

原 `/logo.png` 为 3.4 MB，未进入当前 Workbox 预缓存，离线刷新时产生资源错误。工作台标志和 favicon 已改用预缓存内的 `/pwa-192.png`；全新 origin 的离线刷新复验为零错误。

## 尚未验证的边界

- 未连接真实 Supabase 项目验证注册、登录、恢复码、跨设备同步或真实账号端到端流程；后端 `/health` 与自动化测试不能替代这些证据。
- 未向普通访客开放云端注册，也未验证通用公网账号服务所需的滥用防护、限流、数据库 RLS 或完整 SSRF 防护。
- 安全 Demo 不创建、刷新或管理真实信源；线上验收没有扩大这一边界。
- Alpha 事件接收器继续默认关闭，因此当前没有聚合访问或完成漏斗数据。
- 尚未获得外部测试者的独立体验、回访、留存或付费意愿反馈；本次发布证据只证明公开可访问性与既定主路径质量。

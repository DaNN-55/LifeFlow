<div align="center">

<img src="assets/banner.jpg" alt="LifeFlow — daily execution becomes a continuous work loop" width="100%">

# LifeFlow

**把每天的执行，沉淀成可回看、可判断、可继续行动的周期复盘。**

</div>

LifeFlow 是一个面向个人知识工作者的工作流产品：任务不只是待办，执行备注不只是日志，资讯也不只是信息流。它把三者连接为同一份可持续使用的事实，让每天的行动自然成为下一次复盘和决策的依据。

它以真实的个人长期使用场景为起点，交付为可运行、可测试的 Vue + Express 应用；同时提供不连接后端或外部服务的安全 Demo，便于完整体验核心闭环。

## 一个连续的工作闭环

<img src="assets/features.svg" alt="LifeFlow 将每日执行、周期复盘和信息输入连接为连续闭环" width="100%">

| 环节 | 用户得到什么 |
| --- | --- |
| 每日执行 | 创建、排序和完成任务；把过程记录关联到具体任务与日期。 |
| 周期复盘 | 从任务变化、完成记录和执行备注聚合出可回看的历史，再保存周总结。 |
| 信息输入 | 管理信源、阅读与收藏；在需要行动时保留可追溯的信息输入。 |

## 先体验，不必配置环境

```bash
npm ci
npm run dev
```

打开 `http://localhost:5173/auth`，点击 **体验安全 Demo**。Demo 使用固定合成数据，所有改动只写入独立的浏览器 `localStorage`：不会连接生产 API、Supabase、资讯、天气或行情服务，也不会触及真实账号数据。

建议按这条路径体验：

1. 在 Today 完成任务并写一条执行备注。
2. 进入任务页的复盘面板，保存一篇周总结，并在确认弹窗中二次确认。
3. 打开 News，将一条合成资讯标记为已读或收藏。
4. 回到 Pulse，查看由任务、记录和周总结派生的状态摘要。
5. 用顶部的“重置 Demo”恢复初始合成数据。

## 它为什么可信

不是用静态页面演示概念，而是把关键边界做成可操作、可检查的产品行为：

- **安全 Demo 与真实模式隔离**：Demo 不发出远端同步或真实信源管理请求；其状态单独持久化并可重置。
- **一份事实，多处派生**：Today 的任务和备注会进入周期复盘；Pulse 只做摘要与跳转，不另存一份复盘事实。
- **真实模式有账号边界**：Express 负责用户名/密码、Session Cookie 与输入校验；存储查询按当前用户范围限定。
- **存储可替换**：本地开发可用易失的 Memory Store 验证完整流程；配置 Supabase 后可持久化并跨进程保存。

<details>
<summary>查看安全 Demo 的真实界面证据</summary>

<br>

| Today：完成任务与执行备注 | 周总结：保存并确认 |
| --- | --- |
| ![Today 安全 Demo：提交执行记录并完成任务](docs/portfolio/01-today-execution.png) | ![Review 安全 Demo：保存周总结](docs/portfolio/02-weekly-review.png) |

| News：合成资讯状态 | Pulse：聚合后的状态摘要 |
| --- | --- |
| ![News 安全 Demo：标记合成资讯为已读并收藏](docs/portfolio/03-news-input.png) | ![Pulse 安全 Demo：查看任务、记录和周总结聚合](docs/portfolio/04-pulse-overview.png) |

</details>

## 本地运行真实模式

项目声明使用 Node.js 20.x。全新 clone 后分别安装前后端依赖：

```bash
npm ci
npm --prefix backend ci
cp backend/.env.example backend/.env
```

启动两个进程：

```bash
# 终端 1：Express API，默认 http://localhost:8787
npm run backend:dev

# 终端 2：Vite 前端，默认 http://localhost:5173
npm run dev
```

未配置 Supabase 凭据时，后端默认使用 Memory Store。它支持账号和核心业务流程，但服务重启后数据会丢失，适合本地开发与流程验证。

## 工程验证

```bash
# 前端状态与 Demo 测试
npm test

# 后端账号、隔离、存储与资讯输入测试
npm run backend:test

# 前端生产构建
npm run build
```

前端以 Vue 3、Pinia、Vue Router 与 Vite 构建；后端使用 Express、Zod 和可选的 Supabase Postgres。后端配置、接口和数据库基线见 [backend/README.md](backend/README.md)。

## 职责与 AI Coding 协作

我负责从真实使用场景识别问题，定义信息架构、业务规则、数据边界和部署取舍，并通过代码审查、测试、生产构建与页面操作完成验收。AI Coding 用于协助实现、测试草案、排错和方案整理；需求判断、业务规则和最终验收由我负责。

## 当前边界

- 这是个人作品与产品原型，不宣称公开用户规模、企业采用、商业收益或生产运行结果。
- Supabase Store 已实现并有配置错误分类测试，但尚未连接真实 Supabase 项目完成端到端验收。
- 数据隔离由后端 Session 和带 `user_id` 的查询保证；数据库侧尚未配置独立 RLS，因此 `SUPABASE_SERVICE_ROLE_KEY` 必须只保存在后端。
- 自定义 RSS / 网页信源尚未完成生产级内网地址拦截与完整 SSRF 防护；公开部署前应补齐该边界。

## 部署方向

前端可部署到 Vercel；后端需要持续运行的 Node.js 服务，并设置 `CORS_ORIGIN`。要启用持久化，再在后端配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`；完整步骤见 [后端部署说明](backend/README.md#部署注意)。

## 开源许可证

本项目采用 [MIT License](LICENSE)。

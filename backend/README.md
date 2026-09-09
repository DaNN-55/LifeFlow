# LifeFlow 后端服务

这是给 LifeFlow Dashboard 配套使用的轻量后端。

当前支持两种存储模式：
- `memory`：本地开发使用，不依赖外部服务；进程重启后数据会丢失
- `supabase`：使用 Supabase Postgres 作为数据库

当前认证方式：
- 不使用 Supabase Auth
- 使用后端自建 `用户名 + 密码 + Session Cookie`

## 功能

- 健康检查接口
- 用户注册 / 登录 / 退出 / 当前用户
- 图形验证码
- 恢复码找回密码
- 账号资料 / 修改密码 / 修改用户名 / 重新生成恢复码 / 退出全部登录 / 清空账号数据 / 删除账号
- 任务增删改查
- 任务存档与恢复
- 每日记录读写
- 周复盘聚合
- 每周总结读写
- News 资讯聚合、信源管理与手动刷新
- 天气组件代理接口

## 快速开始

1. 安装依赖

```bash
cd backend
npm ci
```

2. 复制环境变量模板

```bash
cp .env.example .env
```

3. 启动本地服务

```bash
npm run dev
```

运行测试：

```bash
npm test
```

默认运行地址：

```text
http://localhost:8787
```

## 接口

认证接口：
- `GET /api/auth/challenge`
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/recover-password`
- `POST /api/auth/signout`
- `GET /api/auth/me`
- `GET /api/auth/captcha`

业务接口：
- `GET /api/pulse/quote`
- `GET /api/sync/bootstrap`
- `GET /api/sync/changes`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/daily-records/:date`
- `PUT /api/daily-records/:date`
- `GET /api/weekly-review/:week`
- `GET /api/task-timeline`
- `GET /api/weekly-summaries/:week`
- `PUT /api/weekly-summaries/:week`
- `GET /api/account/profile`
- `PUT /api/account/preferences`
- `POST /api/account/username`
- `POST /api/account/password`
- `POST /api/account/recovery-code`
- `POST /api/account/signout-all`
- `POST /api/account/clear-data`
- `POST /api/account/delete`
- `GET /api/content`
- `GET /api/content/featured`
- `POST /api/content/refresh`
- `POST /api/content/favorites`
- `DELETE /api/content/favorites`
- `GET /api/content-sources`
- `POST /api/content-sources`
- `PATCH /api/content-sources/:sourceId`
- `DELETE /api/content-sources/:sourceId`
- `GET /api/widgets/weather`

## Supabase 作为数据库

如果你要把后端切到 Supabase：

1. 在 Supabase 创建一个新项目。
2. 全新项目打开 SQL Editor，只需执行当前完整基线：
   `supabase/schema.sql`
3. 已使用旧版 schema 的现有项目不要重复执行完整基线，只按时间顺序补执行尚未应用的迁移：
   `supabase/migrations/2026-03-09-add-user-scope.sql`
   `supabase/migrations/2026-03-11-add-task-archive-columns.sql`
   `supabase/migrations/2026-03-11-add-users-and-sessions.sql`
   `supabase/migrations/2026-03-11-add-weekly-summaries.sql`
   `supabase/migrations/2026-03-11-drop-public-defaults.sql`
   `supabase/migrations/2026-03-12-add-account-preferences-and-content-bodies.sql`
   `supabase/migrations/2026-03-12-add-content-tables.sql`
   `supabase/migrations/2026-03-12-add-content-favorites.sql`
   `supabase/migrations/2026-03-14-add-user-recovery-code.sql`
   `supabase/migrations/2026-03-27-add-sync-tracking.sql`
   `supabase/migrations/2026-03-27-dedupe-content-sources-and-add-identity-constraint.sql`
   `supabase/migrations/2026-03-27-drop-content-source-is-default.sql`
   `supabase/migrations/2026-03-28-ensure-content-items-and-source-sync-state.sql`
   `supabase/migrations/2026-09-09-add-opaque-sync-cursors.sql`
4. 在项目设置里拿到：
   - `Project URL`
   - `service_role` key

需要配置的环境变量：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGIN`

示例：

```env
PORT=8787
CORS_ORIGIN=http://localhost:8000,https://your-frontend.vercel.app,https://life-flow-*.vercel.app
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

配置完成后重启后端：

```bash
cd backend
npm run dev
```

访问：

```text
http://localhost:8787/health
```

如果返回里看到：

```json
{"ok":true,"storage":"supabase"}
```

说明后端已经切到 Supabase 数据库。

## 用户与数据隔离 / 账号偏好

当前数据隔离方式：

- `users`：保存账号
- `user_sessions`：保存后端 session
- `tasks / daily_records / weekly_summaries / content_sources / content_items`：通过 `user_id` 关联到具体用户
- `content_favorites`：保存资讯收藏

也就是说：
- 每个账号登录后只能看到自己的内容
- 不再依赖 Supabase Auth
- Supabase 这里只负责数据库存储
- 账号偏好当前通过 `users.preferences` 保存，包含侧边栏、组件配置、资讯已读/稍后读/隐藏来源，以及轻量同步状态

这里的用户隔离由后端会话校验和带 `user_id` 的存储查询负责。当前 schema 没有配置独立的 Row Level Security 策略，因此 `service_role` key 只能保存在后端，不能放进前端或暴露给用户。

## 部署注意

如果前端在 `Vercel`，后端在 `Render`：

- `CORS_ORIGIN` 必须包含前端正式域名
- 如果会频繁使用 `Vercel Preview` 域名，可以直接配置通配，例如 `https://life-flow-*.vercel.app`
- 前后端都必须使用 HTTPS
- 登录态依赖 Cookie，跨域场景下后端会自动写 `SameSite=None; Secure`

## 外部服务与安全边界

- 资讯刷新会请求用户配置的 RSS / 网页信源；天气、每日语录和安全验证也依赖第三方服务。
- 外部服务超时、限流、返回结构变化或暂时不可用时，对应内容可能刷新失败，但不应影响任务与复盘数据。
- 当前自定义信源仅校验为 `http(s)` URL，尚未完成面向生产环境的内网地址拦截和完整 SSRF 防护。公开部署前应补齐该边界。
- Supabase Store 已有自动化错误分类测试；当前作品集收口未使用真实 Supabase 项目完成端到端验证。

## 启用 Supabase 模式

如果你要把现在这版完整连起来，最低只需要完成：

1. 在 Supabase 执行最新 schema / migration（包括 `2026-09-09-add-opaque-sync-cursors.sql`）
2. 验证 `users.data_sync_version`、各事实表的 `sync_version` 以及 `*_assign_lifeflow_sync_version` trigger 已存在
3. 验证 `clear_lifeflow_user_data` RPC 仅授予 `service_role`，并在真实 PostgreSQL 中确认其事务性清空、trigger 与 upsert 行为
4. 再部署使用不透明 cursor 的后端代码
5. 在后端配置：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGIN`
6. 重启或重新部署后端
7. 前端继续直接调用当前后端，无需额外生成前端 key

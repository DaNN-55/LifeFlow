# LifeFlow 后端服务

这是给 LifeFlow Dashboard 配套使用的轻量后端。

当前支持两种存储模式：
- `memory`：本地开发使用，不依赖外部服务
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
- Finance / Science 资讯聚合、信源管理与手动刷新
- 天气组件代理接口

## 快速开始

1. 安装依赖

```bash
cd private-dashboard/backend
npm install
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
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/recover-password`
- `POST /api/auth/signout`
- `GET /api/auth/me`
- `GET /api/auth/captcha`

业务接口：
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/daily-records/:date`
- `PUT /api/daily-records/:date`
- `GET /api/weekly-review/:week`
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
- `PATCH /api/content-sources/:id`
- `DELETE /api/content-sources/:id`
- `GET /api/widgets/weather`

## Supabase 作为数据库

如果你要把后端切到 Supabase，按下面顺序做：

1. 在 Supabase 创建一个新项目
2. 打开 SQL Editor，执行：
   [schema.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/schema.sql)
3. 再按顺序执行以下迁移：
   [2026-03-09-add-user-scope.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-09-add-user-scope.sql)
   [2026-03-11-add-task-archive-columns.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-11-add-task-archive-columns.sql)
   [2026-03-11-add-users-and-sessions.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-11-add-users-and-sessions.sql)
   [2026-03-11-add-weekly-summaries.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-11-add-weekly-summaries.sql)
   [2026-03-11-drop-public-defaults.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-11-drop-public-defaults.sql)
   [2026-03-12-add-account-preferences-and-content-bodies.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-12-add-account-preferences-and-content-bodies.sql)
   [2026-03-12-add-content-tables.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-12-add-content-tables.sql)
   [2026-03-12-add-content-favorites.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-12-add-content-favorites.sql)
   [2026-03-14-add-user-recovery-code.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-14-add-user-recovery-code.sql)
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
CORS_ORIGIN=http://localhost:8000,https://your-frontend.vercel.app
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

配置完成后重启后端：

```bash
cd /Users/dan/Programs/LifeFlow/private-dashboard/backend
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

## 部署注意

如果前端在 `Vercel`，后端在 `Render`：

- `CORS_ORIGIN` 必须包含前端正式域名
- 前后端都必须使用 HTTPS
- 登录态依赖 Cookie，跨域场景下后端会自动写 `SameSite=None; Secure`

## 当前你需要做的事

如果你要把现在这版完整连起来，最低只需要完成：

1. 在 Supabase 执行最新 schema / migration
2. 在后端配置：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGIN`
3. 重启或重新部署后端
4. 前端继续直接调用当前后端，无需额外生成前端 key

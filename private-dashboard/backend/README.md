# LifeFlow 后端服务

这是给 LifeFlow Dashboard 配套使用的轻量后端，当前支持两种运行模式：

- `memory`：本地开发使用，不依赖外部服务
- `supabase`：配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 后启用

## 功能

- 健康检查接口
- 任务增删改查
- 任务存档与永久删除
- 每日记录读写
- 周复盘聚合
- 每周总结读写
- 可选的 `x-app-key` 写入保护

## 快速开始

1. 安装依赖：

```bash
cd private-dashboard/backend
npm install
```

2. 复制环境变量模板：

```bash
cp .env.example .env
```

3. 启动本地服务：

```bash
npm run dev
```

默认运行地址为 `http://localhost:8787`。

## 接口

- `GET /health`
- `GET /api/tasks`
- `POST /api/tasks`
- `DELETE /api/tasks/:taskId`
- `GET /api/daily-records/:date`
- `PUT /api/daily-records/:date`
- `GET /api/weekly-review/:week`

## Supabase

如果你要把当前后端切到 Supabase，按下面顺序做：

1. 在 Supabase 创建一个新项目
2. 打开 SQL Editor，执行 [schema.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/schema.sql)
3. 在项目设置中找到以下两个值：
   - `Project URL`
   - `service_role` key
4. 把它们写入 [`.env.example`](/Users/dan/Programs/LifeFlow/private-dashboard/backend/.env.example) 对应的环境变量，实际使用时请复制为 `.env`

需要配置的环境变量如下：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

例如：

```env
PORT=8787
CORS_ORIGIN=http://localhost:8000
APP_WRITE_KEY=
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

配置完成后重启后端：

```bash
cd /Users/dan/Programs/LifeFlow/private-dashboard/backend
npm run dev
```

启动成功后访问：

```text
http://localhost:8787/health
```

如果返回里看到：

```json
{"ok":true,"storage":"supabase"}
```

就说明后端已经从 `memory` 模式切换到了 `supabase` 模式。

补充说明：

- 后端在连接到一个空的 Supabase 数据库时，会自动补齐默认任务
- 你现有前端的本地数据会在首次连上后端时自动同步过去
- `SUPABASE_SERVICE_ROLE_KEY` 不要放到前端，只能放在后端 `.env` 中

## 用户隔离迁移

当前后端已经支持两种数据作用域：

- `public`：未登录时使用的公共数据
- `user_id`：登录 Supabase Auth 后使用的用户私有数据

如果你之前已经按旧版 schema 建过表，需要在 Supabase SQL Editor 中额外执行一次迁移脚本：

[2026-03-09-add-user-scope.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-09-add-user-scope.sql)

执行完成后：

- `tasks` 会变成 `(user_id, id)` 复合主键
- `daily_records` 会变成 `(user_id, record_date)` 复合主键
- 旧数据会自动归到 `public` 用户下面

迁移后重新部署 Render 后端，访问 `/health` 时会看到：

- `schemaMode: "user-scoped"`：说明已经按用户隔离
- `schemaMode: "legacy"`：说明还在旧结构，登录态暂时不会分用户存储

如果你要启用 2026-03-11 新增的任务存档能力，还需要再执行一次：

[2026-03-11-add-task-archive-columns.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-11-add-task-archive-columns.sql)

如果你要启用 Weekly 总结云端同步，还需要执行：

[2026-03-11-add-weekly-summaries.sql](/Users/dan/Programs/LifeFlow/private-dashboard/backend/supabase/migrations/2026-03-11-add-weekly-summaries.sql)

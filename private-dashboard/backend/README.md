# LifeFlow 后端服务

这是给 LifeFlow Dashboard 配套使用的轻量后端，当前支持两种运行模式：

- `memory`：本地开发使用，不依赖外部服务
- `supabase`：配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 后启用

## 功能

- 健康检查接口
- 任务增删改查
- 每日记录读写
- 周复盘聚合
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

例如：

```env
PORT=8787
CORS_ORIGIN=http://localhost:8000
APP_WRITE_KEY=
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
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

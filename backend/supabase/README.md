# LifeFlow Supabase 数据库交付

## 唯一初始化文件

LifeFlow 只需要一个 Supabase 项目。新建空白项目后，在 Supabase SQL Editor **只执行一次** [`schema.sql`](schema.sql)。它包含当前代码所需的全部表、索引、函数、trigger 与权限；仓库不再交付或维护历史迁移链。

然后回到 [后端配置说明](../README.md#supabase-作为数据库)，填写 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 并启动后端。

执行后，确认以下对象存在：

- `users.data_sync_version` 和 `users.data_reset_version`；
- `tasks`、`daily_records`、`weekly_summaries`、`content_sources`、`content_items`、`content_favorites` 的 `sync_version` 与对应 `*_assign_lifeflow_sync_version` trigger；
- `clear_lifeflow_user_data(text)` 和 `read_lifeflow_sync_projection(text,bigint)` 仅授予 `service_role`。

再运行 `npm run backend:test`。它检查代码与基线 SQL 的关键同步、函数权限约束；不代替真实 Supabase 项目上的 SQL 执行和账号端到端验证。

## 已有旧数据库

本仓库不再提供从旧 schema 升级的数据迁移脚本。保留已有数据库时，不要把完整基线重复执行到其中；如需切换到当前结构，先导出备份，再新建空白 Supabase 项目并执行本基线，然后把后端配置切换到新项目。

## 后续变更规则

`schema.sql` 是唯一版本化的数据库交付物。每次数据库变更都必须直接更新该文件，并同步更新必要的自动化验证和本说明。`backend/supabase/migrations/` 是本地实验目录，已被 Git 忽略，不能作为公开部署步骤。

# LifeFlow Supabase 数据库交付

这个目录包含同一份最终数据库结构的两种交付物，适用于不同的起点：

| 你的项目状态 | 应执行的内容 |
| --- | --- |
| 新建、空白的 Supabase 项目 | 只执行一次 [`schema.sql`](schema.sql)。它是当前完整基线。 |
| 曾按旧版本部署过 LifeFlow schema 的项目 | 只执行尚未应用的历史迁移，顺序如下。不要再执行完整基线。 |

## 已有项目升级

先导出备份，并在 SQL Editor 中确认表、列、函数和 trigger 的当前状态。下面的文件是兼容已有数据的历史记录，不能为“文件更少”而删除、改名或拼接后重新执行：其中包含数据回填、去重和约束变更，和空项目基线不是同一类操作。

按以下顺序执行缺失项：

1. `migrations/2026-03-09-add-user-scope.sql`
2. `migrations/2026-03-11-add-task-archive-columns.sql`
3. `migrations/2026-03-11-add-users-and-sessions.sql`
4. `migrations/2026-03-11-add-weekly-summaries.sql`
5. `migrations/2026-03-11-drop-public-defaults.sql`
6. `migrations/2026-03-12-add-content-tables.sql`
7. `migrations/2026-03-12-add-account-preferences-and-content-bodies.sql`
8. `migrations/2026-03-12-add-content-favorites.sql`
9. `migrations/2026-03-14-add-user-recovery-code.sql`
10. `migrations/2026-03-27-add-sync-tracking.sql`
11. `migrations/2026-03-27-dedupe-content-sources-and-add-identity-constraint.sql`
12. `migrations/2026-03-27-drop-content-source-is-default.sql`
13. `migrations/2026-03-28-ensure-content-items-and-source-sync-state.sql`
14. `migrations/2026-08-11-add-task-lifecycle-events.sql`
15. `migrations/2026-09-09-add-opaque-sync-cursors.sql`
16. `migrations/2026-09-09-fix-sync-trigger-search-path.sql`

完成后，检查以下对象：

- `users.data_sync_version` 和 `users.data_reset_version`；
- `tasks`、`daily_records`、`weekly_summaries`、`content_sources`、`content_items`、`content_favorites` 的 `sync_version` 与对应 `*_assign_lifeflow_sync_version` trigger；
- `clear_lifeflow_user_data(text)` 和 `read_lifeflow_sync_projection(text,bigint)` 仅授予 `service_role`。

再运行 `npm run backend:test`。这会检查代码与基线 SQL 的关键同步、函数权限约束；它不代替真实 Supabase 项目上的备份、SQL 执行和账号端到端验证。

## 后续变更规则

`schema.sql` 是新项目唯一入口。每个未来的数据库改动都应同时做到：

1. 通过 Supabase CLI 创建新的、带时间戳的迁移文件；不要改写已发布历史。
2. 将验证后的最终结构同步进 `schema.sql`。
3. 更新本文件的升级清单和必要的自动化验证。

如果以后把本仓库接入 Supabase CLI 的 linked project，再先对远端迁移历史执行 `supabase migration list`。确认本地与远端一致后，才评估 CLI 的 `migration squash`；该命令会省略 `UPDATE`、`DELETE` 等数据操作，不能替代这里的旧项目升级链。

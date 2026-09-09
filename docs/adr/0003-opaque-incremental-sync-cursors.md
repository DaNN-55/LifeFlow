---
status: accepted
---

# 采用不透明的增量同步游标

LifeFlow 将增量同步游标定义为账号已确认事实的位置，而不是可比较的墙上时间。任务、周期复盘与信息输入的持久化 adapter 以单调版本确认事实；Supabase 通过数据库 trigger 将事实写入与版本推进置于同一 seam，删除继续以 reset 快照传播。保留既有同步响应形状，旧日期游标安全 fallback 到完整快照。

## Considered Options

- 保持毫秒级时间戳并加入 lookback：无法保证同毫秒确认事实可观察。
- 由各 caller 在写入后推进游标：事实与位置不能原子对应，且易遗漏新写入路径。
- 以每账号不透明版本作为位置：能固定快照上界、支持两个 adapter 的一致 contract，因此采用。

## Consequences

- 新增事实 `sync_version` 与账户版本字段；历史事实以初始版本通过首次 bootstrap 取得。
- 增量读取只返回 `(since, upper]` 的确认事实；删除返回 `reset: true + snapshot`。
- cursor 格式是 interface 的不透明值，客户端不得按日期解释。

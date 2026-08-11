---
status: accepted
---

# 采用独立的深周期复盘 module

LifeFlow 将周、月、时间线与状态概览统一放入一个深周期复盘 module，通过不透明 selector 的只读 `view` 与唯一的周总结写入形成小 interface。状态连续性继续独占确认快照、optimistic 更新、远端确认与失败回滚；周期复盘只派生结果，不提供加载、刷新或快照写入，执行备注与任务生命周期仍归 Today。

## Considered Options

- 极小的 `project(query)`：入口少，但 caller 仍需正确构造范围与组合。
- 自带身份和刷新 lifecycle：常用 caller 简单，但会与状态连续性形成第二个 owner。
- 不透明 selector + 周总结写入：保持两个高 leverage 入口，同时把日期合法性、归档可见性、排行、月内完成进度、时间线与周总结状态留在 implementation，因此采用。

## Consequences

- 周期复盘从状态连续性的同一份事实 projection 派生，所有表面同步观察 optimistic、确认与 rollback，不再手工刷新 aggregation。
- Pulse 只保留 UI-only implementation；任务恢复等生命周期操作通过 Today 发起。
- 迁移采用垂直切片替换，同一个派生表面在任何时刻只有一个 owner；迁移完成后删除旧 aggregation 与直接快照读取路径。
- 测试穿过周期复盘和 Today 的 public interface，不断言内部日期 helper、缓存 schema 或 aggregation 结构。

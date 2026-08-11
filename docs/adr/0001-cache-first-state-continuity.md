---
status: accepted
---

# 采用缓存优先的状态连续性 module

LifeFlow 将真实账号的远端确认数据视为权威状态，本地仅保留最近一次确认快照；安全 Demo 则由浏览器本地 adapter 持有权威状态。状态连续性 module 采用“身份 scope + 只读 projection + opaque domain operation + 低频 control”的 interface，集中隐藏缓存迁移、cursor、同步去重、optimistic overlay、失败回滚和身份竞态，同时让 Today、Review、News 等领域 module 继续拥有各自规则。这一选择提供缓存优先的状态连续性，但明确不承诺 local-first、离线写入队列或冲突合并。

## Considered Options

- 极小的 `enter / select / execute` interface：入口少，但集中式 intent catalog 容易让状态连续性 module 吞掉领域规则。
- 通用能力令牌与 registry：扩展性强，但对当前 JavaScript/Vue 项目过于抽象，interface 学习成本高。
- 身份 scope 与领域 operation：在 depth、locality 和 seam 清晰度之间最符合当前需求，因此采用；只读响应式 projection 吸收自极小 interface 方案。

## Consequences

- 真实账号写入可以 optimistic 展示，但只有远端确认结果能进入持久快照；失败必须回滚。
- 同一账号的业务写入按提交顺序确认，迟到的旧身份结果必须丢弃。
- 主动退出清除该用户的确认快照和 Today 草稿；普通断网继续保留。
- 匿名 News 本地模式以及天气、股票、GitHub 等未被 LifeFlow 后端确认的数据不进入确认快照。
- 第一阶段只迁移前端 Session + Today，保持现有后端同步协议不变；迁移期间任何时刻只能有一个确认快照 owner。
- 测试通过状态连续性 module 的 interface 覆盖缓存启动、同步、失败回滚、并发去重、身份隔离、Demo 无网络和退出清理。

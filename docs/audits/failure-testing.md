# Failure-Oriented Testing

> **当前状态（2026-10-01，用户批准修复后）：原审计确认的缺陷已完成本地修复。20 条原先失败的测试均已通过，另补 16 条回归测试。最新完整测试为前端 105/105、后端 57/57，构建通过。** 下文保留首次审计证据；其中“未修复”和非零退出码描述的是首次审计阶段，当前结果见文末“授权修复与最终验收”。

审计日期：2026-10-01。代码基线：`d92547a4`。环境：macOS、Node `v24.20.0`、npm `11.19.0`，主测试进程使用本机 `Asia/Shanghai` 时区。

## 结论与边界

现有 **119 条测试全部通过**，仍能在隔离环境中复现数据丢失、备份不完整、错误成功状态与竞态问题。本轮选择 **15 类架构相关场景**，补充 **27 条测试**：7 条通过，20 条失败，覆盖其中 13 类场景中的实际缺陷。失败用例数不等于独立 bug 数，例如 F08 的三条失败是同一格式校验缺口的不同输入。

所有新增测试断言预期的正确行为。发现的业务 bug **未修复**，失败测试没有改成 `skip`、`todo` 或“断言错误行为也算通过”。完整测试因此应返回非零退出码。

没有修改业务代码、数据库 schema、依赖或原有测试；没有访问正式账号、浏览器真实 localStorage 或真实 Supabase；没有 push、创建 PR 或 GitHub Issue。`.gitignore` 仅增加本报告的精确例外，避免审计文档被现有 `docs/*` 规则忽略。

### 本轮可检查的成功条件

| 条件 | 对应交付 |
| --- | --- |
| 建立修改前 baseline，区分环境错误与产品失败 | 下文 baseline 表 |
| 先理解真实路径，再限制为最多 15 类场景 | 架构说明、F01–F15 矩阵 |
| 每个 bug 有执行过的隔离复现 | 四个新增测试文件、最小复现步骤 |
| 原有测试与业务行为不被修改 | 工作区变更限定为测试、测试 helper、报告和忽略规则 |
| 完成后运行前后端全部测试 | 文末最终验证 |

## 用户路径、数据流与状态边界

### 主要使用路径

1. 公开展示页 `/` → `/demo` 安全 Demo，或 `/auth` 登录后进入 `/pulse`。
2. `/today` 创建、编辑、排序、归档/恢复任务，切换日期、记录完成状态、提交执行备注。周期复盘在 Today 的 review panel 中使用；`/weekly` 重定向到 `/today?panel=review`。
3. 周期复盘和状态概览从同一份任务、日记录、周总结事实派生；它们不是单独的数据源。
4. `/content` 消费资讯、标记已读、收藏、隐藏/停用/删除信源、刷新。Home 与侧栏从同一信息输入派生。
5. 账号同步中心导出 JSON、保存本地安全备份、合并导入或完整覆盖。这个路径会批量改变任务和历史数据，是本轮重点。

### 数据流与状态管理

```text
Vue 页面
  → Pinia stores（当前日期、表单、草稿、反馈）
  → stateContinuity 的身份 scope
      → confirmedSnapshot + pendingChanges → Today / 周期复盘 / 信息输入投影
      → 每 scope 的操作队列、generation 失效检查
      → Account adapter → API client → Express → MemoryStore / SupabaseStore
      → Demo adapter → 独立 localStorage fixture
```

账号同步通过 bootstrap 或 opaque cursor 增量读取；删除通过 reset 快照传播，见 [ADR 0003](../adr/0003-opaque-incremental-sync-cursors.md)。客户端缓存按 user ID 保存，账号切换、清空和退出有 scope 失效机制。**同一客户端 scope 的串行化不能证明后端跨请求的并发安全**。

账号备份导入是一个关键例外：任务、日记录、周总结通过 API 逐项写入，最后才用 continuity 保存偏好、刷新投影。它没有整体事务。备注提交则先移除并持久化草稿，再等待日记录写入确认。

### 文件与数据库读写

- 前端主要持久化是浏览器 localStorage：账号快照、session 镜像、执行备注草稿、Demo 状态、安全备份。文件入口是 `File.text()` + JSON，导出使用 Blob 下载；没有业务侧“打开任意服务器路径”的流程。因此“文件不存在”按未选择 File 验证，未虚构服务器文件路径测试。
- Memory Store 使用进程内 Map 和每用户确认队列，重启丢失属于 README 明确限制，不作为新 bug。F06 测的是前端待确认备注的恢复问题。
- Supabase Store 使用带 `user_id` 条件的查询；数据库 trigger 分配 sync version，RPC 读取同步投影和事务性清空。仓库中的数据库测试主要是 query double、RPC mock 和 SQL 文本断言，不等于真实 PostgreSQL 验证。
- 信息刷新先并发采集信源，再逐信源写入资讯、更新同步元数据、清理过期内容；采集失败保留该信源旧内容。进程内 `refreshInFlight` 合并同用户同频道的刷新，但信源删除是另一条写入路径。

### 外部依赖与隔离办法

外部依赖包括 Supabase、RSS/网页/RSSHub、天气服务、每日语录、GitHub/行情组件和 Turnstile。PWA 还涉及 Service Worker 生命周期。测试没有调用这些真实服务。

- 新增端到端调用链测试使用真实 Pinia store、API client、Express 路由、临时 Memory Store，以及随机 `127.0.0.1` 端口。
- helper 在网络发送前强制校验目标 origin；禁止 fallback 到配置中的远端 API。Vite SSR harness 不加载项目 `.env` 或 PWA 配置，HMR 复用临时 HTTP server。
- 缓存和 File 全部由内存 fixture 构造；异常使用 deferred promise、QuotaExceededError、503、损坏 XML 和受控时钟注入。
- 后端测试命令显式清空 Supabase 环境变量；fixture 直接构造 Memory Store，不启动 `backend/src/server.js`。
- F12 的时区验证在短生命周期子进程中执行；没有修改用户系统时区。

## 当前测试 baseline

修改前执行：

```bash
npm test
SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' npm run backend:test
```

| 范围 | 测试数 | 通过 | 失败 | skipped / todo | 退出码 |
| --- | ---: | ---: | ---: | --- | ---: |
| 前端 | 76 | 76 | 0 | 0 / 0 | 0 |
| 后端 | 43 | 43 | 0 | 0 / 0 | 0 |
| 合计 | 119 | 119 | 0 | 0 / 0 | — |

第一次在受限沙箱运行时，前端仍 76/76 通过，但 Vite HMR 报 `listen EPERM`；后端 38/43 通过，5 个需要 HTTP listener 的测试均因同一 `EPERM` 失败。允许本地临时监听后重跑得到上表结果。环境限制不计为产品 bug。

### 现有测试已经证明什么

| 现有测试 | 已覆盖 | 未证明的相邻边界 |
| --- | --- | --- |
| `test/state-continuity.test.js` | 缓存读取、离线保留、单次回滚、同 scope 同步合并、身份切换、reset、迟到结果丢弃、cursor fallback | 缓存写失败后读回、结构不完整的成功响应、UI 草稿恢复、中途退出 |
| `test/period-review.test.js` | 空活动、待补周总结、跨投影回滚、排序、生命周期历史 | 备份往返、后台日历日期归一化 |
| `test/information-input.test.js` | 跨表面派生、收藏、已读、隐藏、删除后保留收藏、前端刷新复用 | 真实后端采集中的删除竞态 |
| `test/demo-state.test.js` | 正常 fixture 初始化、写入、reload、reset、Demo 隔离 | 同版本结构损坏 |
| `test/session-store.test.js`、`home-store.test.js`、`weekly-store.test.js` | 身份失效、清除旧 widget、按身份隔离草稿 | 同一身份下日期变化与在途备注、中途退出 |
| `backend/test/account-http.test.js` | 注册/session、用户任务隔离、越权更新拒绝、普通中文 tags | 极端长度、emoji、无效日历日、并发修改同一任务 |
| `backend/test/content.test.js` | 空信源、部分刷新失败保留旧内容、上限 50、增量采集、七天清理、完整刷新返回 | 删除与刷新交错、持久化异常后重试、实际损坏 RSS |
| `backend/test/information-input-persistence.test.js`、`sync.test.js` | 版本上界、队列确认可见性、删除 reset、并发创建不同任务 | 对同一个任务先读后排队的更新竞态 |
| `backend/test/supabase-store.test.js` 等 | 缺表/旧 schema/网络错误分类、RPC 调用、排序、schema 文本 | 数据库真实约束、trigger、事务与并发 |
| `backend/test/weather.test.js` | 天气主供应商失败后备用供应商返回 | 响应头后正文卡住 |
| auth / feedback / PWA 边界测试 | 配置条件与源代码结构、静态入口约束 | 浏览器实际路由、DOM 操作、Service Worker 安装更新 |

## 15 类失败场景与实际结果

“盲区但通过”意味着此前没有直接测试该边界，本次验证没有发现 bug；并不把它算作产品缺陷。

| ID | 场景、注入方式 | 现有覆盖与真正盲区 | 实际结果 |
| --- | --- | --- | --- |
| F01 | 缺失/损坏 JSON、账号缓存 v1/v2/v3、Demo 同版本缺少集合 | 已覆盖正常 Demo reload；结构损坏与缓存版本边界是盲区 | 账号缓存恢复与有效草稿保留通过；Demo `{version:1}` 创建任务时 TypeError |
| F02 | localStorage 写快照抛 QuotaExceededError，API 返回有效新快照 | 原有测试只模拟网络失败 | sync resolve，但运行时仍显示旧任务并标为 confirmed |
| F03 | 200 返回非 JSON、503 返回 HTML、reset 缺少 snapshot | 没有成功响应结构验证测试 | 前两项正确报错；缺 snapshot 的 reset 静默清空运行时和本地缓存 |
| F04 | 响应头成功，正文 promise 不完成，到达 timeout | 原有离线测试未覆盖响应体阶段 | timeout 已清除，signal 不 abort，正文可无限等待 |
| F05 | 备注请求挂起时切日期或输入新草稿，然后返回 503 | 只覆盖 continuity 写入回滚，没有调用 Today 的草稿恢复逻辑 | 草稿回到错误日期；旧草稿覆盖新输入 |
| F06 | 提交备注，远端确认前用同一 storage 创建新 scope | 只覆盖已确认快照与正常 reload | 待确认备注既不在持久草稿，也不在可恢复记录 |
| F07 | 导出后原样导回；归档任务备份恢复到空 Memory Store | 原测试没有备份往返 | 未归档任务被 HTTP 400 拒绝；tags/icon 丢失 |
| F08 | 无 File、损坏 JSON、缺集合、旧字段形状、未知版本，选择 replace | 没有导入校验与破坏性写入顺序测试 | 无 File/损坏 JSON 安全拒绝；后三种删除原任务且报告成功 |
| F09 | 有旧日记录和周总结，导入合法空 v6 备份并 replace | 无完整覆盖语义测试 | 原日记录与周总结仍存在 |
| F10 | 第二项导入返回 503；相同合法备份连续导入两次 | 无部分成功与重复执行测试 | 第一项已入库却不出现在当前 scope；重复导入抛 DataCloneError |
| F11 | 同时改 name/color；删除后紧接一个更新，调用真实 MemoryStore | 已覆盖并发创建不同任务，没覆盖同实体读改写 | 一项更新丢失；已删除任务被迟到更新复活 |
| F12 | `2026-02-30` HTTP 写入；UTC/上海/洛杉矶子进程写同一日期 | 没有非法日历值或负时区测试 | 不存在日期被接受；洛杉矶将 `2026-10-01` 写成 `2026-09-30` |
| F13 | 空集合、中英文/emoji/组合字符/特殊字符、40/41 与 500/501 UTF-16 长度边界 | 普通中文已覆盖，长度与非法类型是盲区 | 通过；超长/错误类型返回 400，旧有效数据未被覆盖 |
| F14 | 同时刷新、重复资讯、持久化失败后重试、损坏 RSS 与成功信源混合 | 部分失败/空信源已有覆盖；并发刷新、持久化重试和真实 XML 错误新增 | 通过；复用一次采集、去重、释放刷新锁、失败信源保留旧内容 |
| F15 | 采集挂起 → 删除信源 → 迟到采集返回 | 原先只测顺序删除，没有刷新交错 | 信源已不存在，但普通资讯 `late` 重新入库；收藏仍保留 |

## 已确认 bug 与最小复现

所有命令在仓库根目录运行，使用 Node 22–24 与已经安装的前后端依赖。下面的失败就是诊断信号，预期退出码为 1。执行中不需要手动登录、真实文件或数据库凭据。

```bash
# 缓存 / API / Demo，按 F01–F04 选择
SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' node --test --test-name-pattern='F02' test/failure-cache-api.test.js

# Today / 备份，按 F05–F10 选择
SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' node --test --test-name-pattern='F08' test/failure-workflows.test.js

# 后端任务 / 日期，按 F11–F13 选择
SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' node --test --test-name-pattern='F11' backend/test/failure-boundaries.test.js

# 资讯刷新，按 F14–F15 选择
SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' node --test --test-name-pattern='F15' backend/test/failure-refresh.test.js
```

P1 表示丢失、破坏或错误恢复用户数据；P2 表示功能不可用、错误确认或条件性一致性问题。优先级是此次审计的影响判断，不是发布阻断流程。

### F08 · P1：格式不受支持的备份可删除账号任务

- 最小步骤：创建一个任务；构造 `new File(['{"data":{}}'], 'fixture.json')`；调用 `account.importSnapshot(file, 'replace')`。
- 正确行为：在任何写操作之前拒绝不完整格式，保留原任务。
- 实测：`rejected:false`、任务列表变空、发生 2 次写请求（删任务和保存偏好）。旧字段 fixture `{version:1,tasks:[...]}`、`version:999` 同样未被拒绝。旧字段 fixture 只是用于验证安全拒绝，不宣称它是历史正式版本的真实备份。
- 代码路径：`src/stores/account.js:203` 的 normalizer 把缺失集合变为空；`:785` 的导入随后按空 ID 集合删除现有任务，未校验版本。
- 测试：F08 的三个格式变体。无 File 和损坏 JSON 对照通过，不能由此推断结构合法。

### F05 / F06 · P1：备注的失败恢复与中断恢复会丢内容

- F05 最小步骤：日期 A 提交草稿并挂起请求；切到日期 B；返回 503。实测 A 草稿为空，B 出现 A 草稿。另一变体在挂起时继续输入新文字，503 后新文字被旧文字覆盖。
- F06 最小步骤：草稿提交但不确认；用相同 storage 创建新的 account continuity。实测草稿和已确认记录均不含这条备注。随后释放旧请求只是测试清理，不改变已捕获的恢复结果。
- 正确行为：失败恢复仍归属提交时的日期，并保留后续输入；尚未确认的用户文字必须留有可恢复副本。
- 代码路径：`src/stores/today.js:413` 在请求前删除并保存草稿，失败后按当时的 `this.selectedDate` 和同 task ID 回填。
- 测试：F05 两条、F06 一条；中断由新 runtime/scope 模拟，没有真实杀浏览器。

### F07 · P1：备份无法完整往返

- 未归档任务：真实导出产生 `archivedAt:""`，导入又把这个值发到 task API；Zod 仅接受有效 datetime、null 或缺省值，返回 400。
- 元数据：为隔离上述错误，使用合法 archivedAt 的归档任务导出，然后清空临时账号再导入。实测 `tags:[]`、`icon:""`，原值为 `["中文","é"]` 和 `target`。
- 正确行为：当前版本的导出能被当前版本原样导回，并保留已有任务字段。
- 代码路径：`src/stores/account.js:125` 的导出投影和 `:810` 附近的导入 task payload；`backend/src/app.js:27` 的 task schema。
- 测试：F07 两条。清空只作用于测试新建的 Memory Store。

### F09 · P1：完整覆盖留下备份之外的历史

- 最小步骤：临时账号已有日记录和周总结；导入 `{version:6,taskTypes:[],dailyRecords:{},weeklySummaries:{},preferences:{}}`，策略 replace。
- 实测：导入成功，但旧记录和旧总结都存在。
- 正确行为：完整覆盖后任务、日记录、周总结与合法备份一致。
- 代码路径：`src/stores/account.js:804` 只删除备份之外的任务；后续日记录和周总结只有 upsert，没有清除备份外记录。

### F11 · P1：Memory Store 的版本队列没有保护完整读改写

- 更新丢失：创建 `{name:'before',color:'blue'}`；`Promise.all([updateTask(...,{name:'after'}), updateTask(...,{color:'red'})])`。
- 实测：两次都确认、sync version 增加 2，但最终 `{name:'before',color:'red'}`。
- 任务复活：创建任务；同时调用先开始的 delete 和紧接的 update。最终列表仍有该任务，名称为 `late update`。
- 正确行为：不同字段的成功 patch 都应保留；删除后的 patch 应拒绝或找不到实体，不能重新插入任务。
- 代码路径：`backend/src/store/memoryStore.js:153` 在进入确认队列前读取并复制旧任务，排队后直接 `tasks.set`。
- 影响已确认到 Memory Store；未据此宣称 Supabase 存在相同实现缺陷。

### F12 · P1：日期被静默写到另一日

- 非法日历日：HTTP PUT `/api/daily-records/2026-02-30`，body `{tasks:{}}`。应返回 400 且不写入，实测 200、增加一条记录。JS Date 把它归一到三月。
- 时区：在 `TZ=America/Los_Angeles` 子进程调用 `upsertDailyRecord(scope,'2026-10-01',...)`，返回日期 `2026-09-30`；UTC 与上海对照均为 `2026-10-01`。
- 代码路径：`backend/src/app.js:1471` 与 `backend/src/store/memoryStore.js:192` 使用 `new Date(dateOnly)` 后按本地时区格式化，而非保持日历键。
- 非法日期验证到真实 HTTP；负时区最小复现验证到 Memory Store，未对部署环境作结论。

### F15 · P1：删除信源后迟到刷新重新写入普通资讯

- 最小步骤：刷新开始并等待 collector → 删除信源 → collector 返回该信源新资讯 → 刷新结束。
- 实测：`sources:0`、`ordinaryItems:['late']`；收藏对照仍保留。
- 正确行为：删除信源应移除该信源普通历史，迟到采集不能复活它们，符合 `CONTEXT.md` 的“删除信源”定义。
- 代码路径：`backend/src/information-input/index.js:108` 捕获信源列表；`persistence.js:24` 确认时没有重新判断信源是否仍存在；Memory Store 接受迟到 upsert。
- 已确认 Memory Store 路径；真实 Supabase 的并发事务行为未验证。

### F02 / F03 · P2 / P1：同步确认可能是假成功，异常 reset 可清缓存

- F02：缓存先含任务 `old`，mock 快照返回 `remote`；仅缓存键 `setItem` 抛 QuotaExceededError。实测 sync resolve 后仍显示 `old`，没有报错，并进入 confirmed 状态。问题不是要求缓存必须永远落盘，而是远端有效结果不能因缓存失败被丢弃。
- F03：缓存含 `old`；返回 `{reset:true,cursor:'v1.3'}`，没有 snapshot。实测不拒绝请求，运行时与持久缓存都被替换为空。
- 代码路径：`src/services/state-continuity/account-sync.js:23` 在保存后重新读 localStorage；缺 snapshot 用 `{}` 替代。缓存写错误被 best-effort 分支吞掉。
- 这证明客户端抵御存储/响应故障的缺口，不表示当前后端已观察到返回缺 snapshot。

### F04 · P2：timeout 不覆盖响应正文

- 最小步骤：mock fetch 返回成功响应头，`text()` 保持 pending；推进受控时钟至 timeout。
- 实测：timer 已被清除，`signal.aborted:false`。测试主动释放 body 后才结束，避免留下悬挂任务。
- 正确行为：超时应覆盖整个 API 响应的读取。
- 代码路径：`src/services/api-client.js:10` 的 `finally` 位于 `response.text()` 之前。测试直接驱动真实 API client，没有依赖真实网络时延。

### F10 · P2：部分导入后的投影不同步，重复导入会异常

- 部分成功：空账号 sync 完成；导入 one、two 两个合法任务；对 two 返回 503。实测服务器已有 one，scope 仍为空。没有要求所有导入必须事务回滚，但当前投影应反映已确认部分，或明确进入需要重新同步的状态。
- 重复执行最小复现：包含一个合法 archivedAt 的备份，连续调用两次 merge 导入。第一次成功；第二次在 preferences.replace 中抛 `DataCloneError: #<Object> could not be cloned.`。
- 代码路径：`src/stores/account.js:785` 仅在全部写完后 refresh；偏好 merge 会保留嵌套 reactive 数组元素，再进入 `state-continuity.js:6` 的 `structuredClone(toRaw(...))`，仅移除根 proxy 不足以克隆嵌套对象。
- 前一项确认的是成功写入与当前视图不一致；后一项确认的是重复执行失败，没有把“没有重复 task ID”当作整个导入成功。

### F01 · P2：同版本但不完整的 Demo 状态无法恢复

- 最小步骤：Demo storage 值为 `{"version":1}`；`createDemoStateRepository({storage}).createTask({name:'任务'})`。
- 实测：`TypeError: Cannot read properties of undefined (reading 'push')`。
- 正确行为：不完整持久化数据应可恢复或明确拒绝加载，不能进入可用状态后再崩溃。
- 代码路径：`src/services/demo-state.js:227` 只判断版本，对必需 tasks/dailyRecords 等集合不做形状检查。

## 新增测试与维护方式

| 文件 | 测试数 | 通过 / 失败 | 负责的场景 |
| --- | ---: | --- | --- |
| `test/failure-cache-api.test.js` | 6 | 2 / 4 | F01–F04 |
| `test/failure-workflows.test.js` | 12 | 1 / 11 | F05–F10 |
| `backend/test/failure-boundaries.test.js` | 5 | 1 / 4 | F11–F13 |
| `backend/test/failure-refresh.test.js` | 4 | 3 / 1 | F14–F15 |
| 合计 | 27 | 7 / 20 | 15 类场景 |

`test/helpers/failure-testing.js` 提供可销毁 localStorage、deferred、受限 fetch、本地服务和 SSR/Pinia harness。它不是业务模块，不替代被测逻辑。前端工作流测试需要安装 backend 依赖，因为它刻意跨越真实 API 边界。

原有测试文件全部保留。新测试命名带 F 编号，可以单独最小复现，也由现有 `npm test` / `npm run backend:test` 自动纳入。未来修复后，正确断言应自然变绿。

## 仍未验证的风险

- 没有真实 PostgreSQL/Supabase：无法证明 schema 安装、trigger 原子性、RPC 锁、事务 rollback、数据库约束、真实账号 E2E 或生产并发。F11 的 Memory 结论不外推到 SQL adapter。
- 本轮没有浏览器 DOM/E2E：PWA 更新、离线 Service Worker 缓存、真实文件选择器、浏览器配额策略和杀进程恢复未实际操作。F02/F06 分别是存储异常注入和 runtime 重建，不等于真实崩溃耐久性验收。
- 没有真实外部供应商请求：限流、重定向、实际网络流中断、第三方格式漂移，以及多个后端实例之间的刷新竞争未验证。
- 没有全量旧版备份样本：F01 验证当前 loader 声称支持的账号缓存版本；F08 只证明未知或不完整格式没有安全拒绝，不能宣称完成历史迁移兼容验收。
- “完整账号导出”的其他数据类别是否完整、多个标签页同时改整份日记录/偏好、长时间累计数据性能，未在 15 类场景之外追加验证。
- 自定义信源 SSRF 防护不足是 README 已声明边界；本轮没有发起内网探测，也不把它包装成新发现。
- 没有对业务源码作修复，因此本报告列出的失败风险仍存在。

## 最终验证

报告与测试完成后，实际执行了两套完整测试：

```bash
SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' npm test
SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' npm run backend:test
```

| 最终完整运行 | 总数 | 通过 | 失败 | cancelled / skipped / todo | 退出码 |
| --- | ---: | ---: | ---: | --- | ---: |
| 前端 | 94 | 79 | 15 | 0 / 0 / 0 | 1 |
| 后端 | 52 | 47 | 5 | 0 / 0 / 0 | 1 |
| 合计 | 146 | 126 | 20 | 0 / 0 / 0 | — |

逐条对照 baseline 名称，原有前端 76 条、后端 43 条全部仍通过。失败全部属于新增 F 场景，最终运行无 `EPERM`、端口冲突或被意外远端请求触发的隔离断言错误。前端约 0.93 秒、后端约 0.38 秒，时长仅代表本机此次运行。

`git diff --check` 通过。测试监听、deferred、mock 和时区子进程均已结束，本次临时日志清理后不作为交付依赖；完整复现保留在测试文件中。业务 bug 保持未修复，工作停止于报告与测试。


## 授权修复与最终验收（2026-10-01）

用户随后明确授权“按照你的建议，依次完成上述修复”。本阶段因此允许修改业务代码；此前“仅审计、不修复”适用于首次审计阶段。未部署、未 push、未创建 PR，未访问正式数据。

### 修复前复核

在已有审计测试和工作区其他改动的基础上，重新执行完整测试：前端 **79/94 通过、15 失败**，后端 **47/52 通过、5 失败**。与首次审计的 20 个失败一致。修复前保存工作区 diff，后续只修改本轮故障对应路径，保留已有的依赖、样式、旧组件清理等其他修改。

### 成功条件、改动与结果

| 顺序 | 可检查的结果 | 对应改动 | 验证结果 |
| --- | --- | --- | --- |
| 1 · 备份 F07–F10 | 无效文件零写入；当前备份可往返；完整覆盖清理多余历史；部分失败可见、重复导入可用 | `backup-validation.js` 在写入前校验版本、必需集合、任务/备注/周总结/偏好和重复 ID；保留 tags/icon，转换空 archivedAt；改从 bootstrap 导出真实存储历史；支持下载的安全备份包装；先保存安全备份、写替换值，再删多余项；失败后刷新；递归解包嵌套 Vue proxy；成功通知延后至清理完成 | 原失败全部通过；补测注册前/未来历史、特殊字符 ID、非法后续条目、备份无法落盘、覆盖中途失败、删除失败、保留资讯收藏 |
| 2 · 备注 F05/F06 | 远端确认前草稿可恢复；切日期和继续输入不丢字；重复提交不重复写 | 草稿保留到确认成功；捕获提交时的身份 scope 和日期；只删除仍等于已提交文字的原草稿；同 scope/日期/任务的在途提交去重 | 原 3 个复现通过；补测成功时继续输入、切日期及快速重复提交 |
| 3 · 并发 F11/F15 | 不同字段更新都保留；删除不会复活；信源已变更时丢弃迟到采集结果 | Memory Store 将完整读改写放入同一用户队列；信息持久层串行化信源写入和刷新确认，确认时重查存在、启用状态及采集配置 | 同任务并发、删除后更新、采集中删除均通过；补测禁用/改 URL、确认写入阶段发生删除 |
| 4 · 日期 F12 | 不存在日期返回 400；日历键不随服务器时区偏移 | HTTP 与两种 store 统一验证严格 `YYYY-MM-DD`，日历键保持原值，不先转换本地时区 | UTC/上海/洛杉矶对照通过；补测读/写/删拒绝非法日期、有效闰日及日期范围 |
| 5 · 异常恢复 F01–F04 | 损坏 Demo 可恢复；缓存失败不丢有效响应；缺字段响应不清缓存；timeout 覆盖正文 | 校验 Demo 必需集合，损坏时重建独立 fixture；sync 直接使用内存计算结果；校验同步响应集合后才改缓存；API timeout 覆盖 `response.text()`，保留 caller abort 并清理监听/计时器 | 原失败全部通过；补测损坏集合类型、正常 Demo 修改保留、非法增量/全量保留游标、caller 取消/timeout/成功清理 |

F13、F14 的对照测试继续通过，没有为这些已经正确的行为添加业务修复。

完整覆盖新增两个经过认证的 HTTP 接口：`DELETE /api/daily-records/:date` 和 `DELETE /api/weekly-summaries/:week`。Memory 与 Supabase adapter 均按用户删除；后者保留 `user_id` 条件并传播 SQL 错误。删除继续沿用已有的 reset 同步语义及数据库 trigger，**未修改 schema 或 migration**。部署时需要同时更新前后端，旧后端没有这两个接口。

### 回归测试的变化

| 文件 | 首次审计测试数 | 本阶段新增 | 当前数 |
| --- | ---: | ---: | ---: |
| `test/failure-cache-api.test.js` | 6 | 3 | 9 |
| `test/failure-workflows.test.js` | 12 | 8 | 20 |
| `backend/test/failure-boundaries.test.js` | 5 | 3 | 8 |
| `backend/test/failure-refresh.test.js` | 4 | 2 | 6 |
| 合计 | 27 | 16 | 43 |

原有断言没有被降低，没有删除、跳过或标记 todo。`test/state-continuity.test.js` 的一个正常 bootstrap fixture 补齐 `weeklySummaries: []`，让它符合现在校验的完整快照协议；其原有 cursor fallback 断言保持不变。F11 的断言进一步要求删除后的更新返回 null，且不额外增加确认版本。

### 最终完整验证

在报告及测试完成后执行：

```bash
SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' npm test
SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' npm run backend:test
npm run build -- --outDir /tmp/lifeflow-failure-fixes/build --emptyOutDir
git diff --check
```

| 检查 | 结果 |
| --- | --- |
| 前端完整测试 | **105/105 通过**，0 failed / cancelled / skipped / todo |
| 后端完整测试 | **57/57 通过**，0 failed / cancelled / skipped / todo |
| 总计 | **162/162 通过**，包括原审计 20 条失败用例 |
| Vite + PWA 构建 | 通过；产物写入本轮临时目录，未覆盖现有 dist |
| diff 格式检查 | 通过 |

前端既有 SSR 测试在关闭 Vite 时仍可能打印依赖扫描中止日志（`The server is being restarted or closed. Request is outdated`）；修复前复核也存在，不是新增断言失败。本轮新增 harness 已关闭自动依赖发现。未为清理这些既有日志扩大业务修复范围。

测试使用隔离 Memory Store、mock 存储和随机 loopback 端口。临时构建产物与诊断日志在验收后清理，不是运行测试的依赖。

### 仍然存在的明确边界

- **导入仍是多请求操作，没有整体数据库事务。** 中途失败可能已写入或删除一部分；现在会保留导入前安全备份、尝试刷新已确认事实并返回错误，不宣称自动回滚。其他标签页/设备同时导入或编辑不在此次验收范围。
- **F15 的串行化作用于同一后端进程中的信息持久层。** 跨后端实例、绕过该持久层直接写数据库的竞态没有经过真实数据库验证。
- **Supabase 只验证了 adapter 查询/错误传播和现有 schema 文本契约。** 没有连接正式或临时 PostgreSQL，不能把 mock 通过解释为线上 trigger、事务和并发已验收。
- **缓存配额失败时，已成功同步的云端结果可以在当前页面正确显示，但不能保证重启后本地缓存或草稿仍可恢复。** 备注中断恢复以 localStorage 能正常写入为前提。
- 未执行真实浏览器强退、DOM/PWA 更新验收或第三方供应商调用。损坏 Demo 会重建演示 fixture；不支持的备份版本被安全拒绝，并未实现未知历史格式迁移。
- v6 备份管理任务、日记录、周总结与偏好；本次完整覆盖刻意保留信源、普通资讯和收藏，没有扩展为这些数据类别的全量备份功能。

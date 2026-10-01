# Cleanup Audit

## Executive Summary

审计确认的 H1–H8、R1–R5 已按授权完成处理。FretFlow 已确认永久退役并删除专属实现，旧链接仍跳转 Pulse；Featured API 和闲置 Store 方法已移除，数据库列保留。H2 已纠正为删除孤立 Milkdown 组件及依赖。最终当前工作区前端 105/105、后端 57/57 测试通过，构建与浏览器检查通过；其中故障修复由并行工作完成。实现验收时未提交、push 或创建 PR；后续交付授权见文末。

审计及实施日期：2026-10-01。审计基准提交：`d92547a4bfcb042e34e32dacbc47d117bc0b7133`，只读审计开始时工作区干净。只读阶段收尾时业务源码及 HEAD 未变，但出现五份不由本次审计写入的未跟踪测试/辅助文件，以及其他工作对 `.gitignore` 的三行追加；本报告没有覆盖或删除它们。下方原始测试记录对应只读阶段（北京时间约 18:09）；用户批准后的实施结果见文末。

范围与方法：检查 156 个 Git 跟踪文件，包含 86 个前端 JS/Vue/CSS 文件、14 个后端非测试 JS 文件和 24 个测试文件；核对 npm 入口、路由、静态及动态 import、Vue 模板、store/API 调用、数据库交付契约和本地文档链接。使用已安装的 Babel parser、Vue SFC parser、PostCSS 在内存中做静态筛选，再搜索和阅读调用方排除误报；未安装或升级工具与依赖。未检查私人笔记、凭据内容、实际数据库或线上调用流量；未把忽略目录或生成产物当作历史业务文件。

“高”表示当前仓库证据足以确认该问题；“中”表示需要产品、外部消费者或兼容期限判断。无可靠证据的低置信度猜测不进入清理清单。下列候选项的路径行号对应审计基准提交；部分文件现已按批准范围删除。

## High Confidence

### H1. 全局 CSS 保留了已没有界面消费者的三组旧样式

- **位置**：`src/styles/base.css:3335–3448` 的 `task-timeline-*`，`:4999–5041` 的 `pulse-links-*` / `pulse-link-card`，`:5502`、`:7035–7108`、`:7118–7150` 的 `content-overview-*` / `content-lead-*` / `content-stat-*` / `content-quick-tag(s)`；另有 `:8008`、`:8774`、`:9092`、`:9137`、`:9145`、`:9150` 的主题或响应式残留。
- **证据**：PostCSS 提取选择器后，对所有跟踪的生产 JS/Vue/HTML 搜索这些类名和前缀，未找到生成者。当前时间线模板使用 `review-note-*` / `timeline-review-*`（`src/components/weekly/TimelineTaskCard.vue:99–119`）；当前 News 使用 `ContentCard` 列表和 toolbar（`src/views/ContentView.vue:199–273`）。`src/main.js:10` 仍全局加载该 CSS。
- **建议与影响**：清理这些选择器可降低样式维护噪声和全局 CSS 体积。只能处理确认无消费者的选择器，不能删除整个相邻区块：例如 `content-quick-strip` 在 `ContentView.vue:195` 仍使用，`:9137` 还与有效的 `task-note-row`、`content-card-meta-row` 共用声明。后续实际清理仍须检查 Today、周期复盘、News 的桌面/移动和主题显示。
- **置信度：高**。不是仅凭“类名未出现”批量清除全部 CSS；动态类名与第三方编辑器样式已单独排除。

### H2. Markdown 富文本编辑器已脱离入口，专属依赖和样式可删除（复核更正）

- **位置**：`src/components/common/MarkdownWysiwygEditor.vue:1–153`；`package.json:20` 的 `@milkdown/crepe`；`src/styles/base.css:2630–2706` 的 11 条 `.weekly-summary-input .milkdown` 规则。
- **证据**：分别对基准 HEAD 和实施中的工作区做 Vue SFC / Babel AST import 扫描。HEAD 的 97 个 JS/Vue 模块里，只有该组件内部导入 Milkdown，无其他模块导入该组件；未发现非字面量动态 import、glob 自动注册或其他挂载入口。当前 `TodayView.vue:595` 使用原生 `textarea.review-summary-textarea`，实际 Demo 验证可编辑、保存并在刷新后读取周总结。
- **更正原因**：最初审计只看到了组件内部的 `@milkdown/kit/utils` 导入，建议补声明，并误把 Milkdown DOM 对应样式列为应保留。组件自身不可达，这个建议不成立；本次撤回补声明方案，删除整个孤立组件及专属依赖、样式。
- **建议与影响**：不影响当前周总结输入；以后若重新引入富文本编辑器，需要重新实现或从历史恢复。保留 textarea、摘要预览的样式，以及实际使用的 DOMPurify / MarkdownIt。移除依赖后 lockfile 减少 183 个包条目，保留包的 version / resolved / integrity 全部未变。
- **置信度：高**。

### H3. Supabase 旧 schema 错误提示及测试仍指向已撤下的迁移文件

- **位置**：`backend/src/store/supabaseStore.js:220`；`backend/test/supabase-store.test.js:40–61`；对照 `backend/supabase/README.md:5,17–23`。
- **证据**：缺少同步版本字段时，运行时代码提示执行 `2026-09-09-add-opaque-sync-cursors.sql`，测试第 60 行也要求该文件名。当前仓库没有该文件；当前交付说明明确唯一交付物为 `schema.sql`，不再维护历史迁移链。故测试即使通过，也在保护已经失效的操作指引。
- **建议与影响**：同时更新错误说明和测试，指向当前数据库交付指南，保留旧 schema 的启动拒绝检查。对已有数据库不能简单把提示替换成“直接重跑 schema.sql”；当前指南要求按已有库边界处理。该修改改善故障恢复指引，不应改变查询或数据库数据。
- **置信度：高**。

### H4. 三个完整界面文件已脱离当前入口

| 文件位置 | 当前引用证据 | 删除或修改影响 |
| --- | --- | --- |
| `src/views/HomeView.vue:1` | 无静态/动态 import、路由或父组件引用。`src/router/index.js:5–87` 的实际工作台页面是 Today、Pulse、Content；旧文件内部仍实现任务与复盘组合界面。 | 不影响当前路由；可消除旧页面的重复维护。不能顺带删除其导入的共享 store/widget。 |
| `src/views/WeeklyView.vue:1` | 无入口引用；`src/router/index.js:55–63` 已把 `/weekly` 重定向至 `today?panel=review`。 | 可清理未加载的独立页面，但必须保留重定向和 Today 使用的周复盘组件/store。 |
| `src/components/content/ContentPreviewModal.vue:1`，`src/utils/markdown.js:23–25` | 弹窗无父组件引用，`renderContentPreviewMarkdown` 仅被该弹窗使用。当前 `ContentCard` 由 `ContentView.vue:264` 渲染。 | 可一并清理未接入弹窗及专用转发函数；`renderTaskNoteMarkdown`、DOMPurify 和 MarkdownIt 仍服务执行备注，必须保留。 |

- **验证**：跟踪源码/测试全域搜索 `HomeView|WeeklyView|ContentPreviewModal|renderContentPreviewMarkdown`，并复核路由动态 import 与组件模板，未发现隐藏挂载入口。模块内部有实现不代表模块本身可达。
- **置信度：高**，适用于当前仓库入口；将来若要重新启用这些旧界面，需要从历史恢复或重新实现。

### H5. 内容和周期复盘仍保留旧的前端读取 API 封装

- **位置**：`src/services/content-api.js:3–16,46–48,58–62` 的 `buildContentSearch`、`fetchContentList`、`fetchContentSources`、`fetchFeaturedContent`；`src/services/weekly-api.js:2,4–6,12–14,24` 的 `fetchWeeklyReview`、`fetchTaskTimeline` 和 `fetchDailyRecord/listTasks` 转出。
- **证据**：五个读取封装在源码与测试中均只有定义；`buildContentSearch` 只被未使用的 `fetchContentList` 调用。当前内容 store 使用 `attachInformationInput`（`src/stores/content.js:3,53`），周期复盘使用 `createPeriodReview`（`src/stores/weekly.js:3`）；对 `fetchDailyRecord/listTasks` 的有效引用来自 `today-api.js`，没有从 `weekly-api.js` 消费这两个转出。
- **建议与影响**：仅移除无消费者的前端封装及转出，保留刷新/收藏/信源写入和仍使用的 `fetchWeeklySummary/saveWeeklySummary`。不要顺带删掉 `today-api.js` 的原函数或后端 HTTP endpoint：公开 API 是另一层契约，见 R4。
- **置信度：高**。

### H6. 账号缓存中十个逐项读写包装函数无消费者

- **位置**：`src/services/state-continuity/account-cache.js:281–290` 的 `loadCachedTasks/saveCachedTasks`；`:336–381` 的 `loadCachedDailyRecord/loadCachedDailyRecords/saveCachedDailyRecord/saveCachedDailyRecords`；`:383–403` 的 `loadCachedWeeklySummary/saveCachedWeeklySummary`；`:405–420` 的 `loadCachedHomeData/saveCachedHomeData`。
- **证据**：逐一搜索以上十个导出，源码、测试中均只有定义。实际 adapter 通过 `loadDashboardUserCache/updateDashboardUserCache` 和专门的 `loadCachedTodayNoteDrafts/saveCachedTodayNoteDrafts` 操作缓存（`src/services/state-continuity/account-adapter.js:7–10,37–65`）。
- **建议与影响**：可缩减未使用的缓存 API 表面，避免后续误接旧包装；不应删除缓存模块、存储 key、真实缓存数据或笔记草稿函数。当前仓内调用链不受影响，本次不声称验证过任何仓外脚本。
- **置信度：高**（当前仓库范围）。

### H7. 生产采集器残留五个局部死函数，以及一个无效条件表达式

- **位置**：`backend/src/information-input/productionCollector.js:213–233` 的 `dedupeContentItems`，`:357–363` 的 `resolveContentImageUrl`，`:376–385` 的 `localizeBody`，`:422–446` 的 `pickLatestPublishedAt/mapWithConcurrency`。
- **证据**：Babel scope binding 检查显示五个函数的 `referencePaths.length` 全为 0；全文搜索也只命中定义，`:472–476` 的 `module.exports` 未暴露它们。其中去重、最新发布时间和并发遍历已有正在使用的对应实现，位于 `backend/src/information-input/index.js:290–327`，不应把两处都删掉。
- **另外**：同文件 `:346–351` 的四个正则条件无论真/假都返回 `normalized`，不影响最终返回值；这是可确定的冗余判断，不是可直接启用的图片类型验证。
- **建议与影响**：删除五个局部死函数；把上述条件表达式简化为原来的返回值，不改变 URL 接受范围。不要连带删除仍被采集路径调用的 `normalizeDateString`、`normalizeUrl`、`localizeSummary` 或 service 层同名函数。
- **置信度：高**；局部未导出函数不涉及公开 API 下线。

### H8. 后端 README 仍描述已经不存在的“稍后读”偏好

- **位置**：`backend/README.md:163`；对照 `backend/src/app.js:103–149` 和 `CONTEXT.md` 的“收藏资讯”定义。
- **证据**：README 说 `users.preferences` 包含“资讯已读/稍后读/隐藏来源”；当前 `content` 偏好 schema 只有 `readItems` 与 `hiddenSources`，收藏由独立的 `content_favorites` 保存，未找到“稍后读”的字段或消费者。
- **建议与影响**：修正文档中的字段/概念说明，不修改存储结构。可避免维护者把收藏误归到账号偏好、重新引入已经不存在的状态。
- **置信度：高**，优先级低于会给出错误操作指令的 H3。

## Needs Review

### R1. `entities` 没有直接消费者，但可能承担显式版本约束

- **位置**：`package.json:22`、`package-lock.json`。
- **证据**：AST 扫描未发现业务、测试或构建配置直接导入 `entities`；Milkdown 的孤立消费已单独更正为 H2。`npm explain entities` 显示根 `entities@7.0.1` 同时满足 `@vue/compiler-core` 的 `^7.0.1`，而 `markdown-it@15.0.2` 使用嵌套的 `entities@8.1.0`。两个主版本不能直接视为重复安装错误。
- **待判断与影响**：确认根的精确版本声明是否为有意锁定；若只是历史安装残留，可移除直接声明并重新核对依赖树、lockfile与构建。Vue 仍需要它，因此不应承诺减少一个实际安装包，更不能直接删除 `node_modules/entities`。此为审计时的待判断项；批准后的处理见实施记录。
- **置信度：中**（无直接引用为高置信，是否应移除声明为中置信）。

### R2. 数据库交付测试与“本地实验目录”的说明不一致

- **位置**：`backend/test/supabase-schema-delivery.test.js:12`、`backend/supabase/README.md:23`、`.gitignore:8`。
- **证据**：说明把 `backend/supabase/migrations/` 定义为被 Git 忽略的本地实验目录；测试却断言该目录在文件系统上不存在，而非检查它未进入公开交付。只要按说明保留本地实验目录，这条断言就会失败，与是否被 Git 跟踪无关。当前目录不存在；本次未为复现创建目录。
- **待判断与影响**：确认契约是“禁止本地目录”还是“禁止公开交付历史迁移”。再对应修改说明或测试边界。改变测试不影响业务，但不能放松 `schema.sql` 完整性及权限检查，也不应因此恢复或删除迁移文件。
- **置信度：中**（矛盾明确，选择哪一方作为规范需判断）。

### R3. FretFlow 停用功能子树（已确认永久退役）

- **位置**：`src/app/constants.js:20,26–29`；`src/router/index.js:75–87`；`src/views/FretFlowView.vue`、`src/stores/fretflow.js`、`src/components/fretflow/`、`src/utils/fretflow/`、`src/composables/useMetronome.js`、`src/composables/useTrainingAudio.js`。
- **证据**：`FRETFLOW_ENABLED = false` 同时关闭导航和页面路由，`/fretflow/*` 当前转向 `/pulse`。该子树内部仍有完整引用链，不能把每个内部组件逐个宣称为孤立死文件。额外发现 `FretFlowHeaderActions.vue:1` 即使开启该子树也没有父组件引用；`music-theory.js:73–76` 的 `trainingViewOptions` 与 `FretTrainingControls.vue:38–41` 重复定义两项训练模式。
- **待判断与影响**：若确认功能退役，可按子树和专属样式一起规划清理；若准备恢复，则只处理未挂载 header 和重复选项。整组删除会失去重新启用训练、节拍器和音频功能的实现，不能只因常量为 false 就直接执行。暂不为停用模块进行单独重构。
- **置信度：中（原审计）→ 高（用户已明确确认永久删除）**。用户确认后删除范围和实际验证见文末。

### R4. Featured HTTP 链及 `is_featured` 字段未被当前前端消费

- **位置**：`backend/src/app.js:872–880` → `information-input/index.js:104–105` → `information-input/persistence.js:16–21` → `memoryStore.js:604–612` / `supabaseStore.js:1028–1042`；`backend/supabase/schema.sql:99`；`backend/README.md:95`。
- **证据**：前端唯一对应封装 `fetchFeaturedContent` 已无调用（H5），未发现此接口的后端测试；仓内未找到将 `is_featured` 设为 true 的业务写入路径。Memory 返回最新 N 条，Supabase 先按 `is_featured` 再按发布时间排序。它仍是实际注册且文档公开的 API，不能称为不可执行的死路径。
- **待判断与影响**：先确认外部客户端和现有数据库是否仍使用它，再决定退役或保留。未查看线上流量或数据库，不能断言已有 `is_featured` 全为 false；删除接口会破坏外部消费者，删除字段涉及数据库契约，须另行处理。
- **置信度：中**。

### R5. Store 导出类仍包含无仓内调用的旧方法

- **位置**：`backend/src/store/memoryStore.js:51,355,614,696` 的 `touchUserSyncState/listUsers/getContentItem/getFavoriteContentItem`；`backend/src/store/supabaseStore.js:666,1044,1170` 的后三个对应方法。
- **证据**：对方法名及调用点搜索，当前 app、持久化适配层和测试中均没有消费者；其中 `touchUserSyncState` 只转调仍有效的 `confirmUserFact`。
- **待判断与影响**：仓内可缩减这七个方法，但 Store 类为导出边界，清理前确认有无维护脚本/仓外调用。不能从这一结论扩展为删除完整 Store 或同步确认机制；若两套 Store 仍维持共同接口，应同步决定双方的相关方法去留。
- **置信度：中**（仓内零调用明确，外部使用未验证）。

## False Positives / Keep

| 内容与位置 | 验证证据与保留理由 | 误删影响 / 置信度 |
| --- | --- | --- |
| 前后端各自的 manifest、lockfile 和 README | 根 `package.json:15–17` 通过 `npm --prefix backend` 启动/测试独立后端；两份 lockfile 的根 dependencies 均与 manifest 一致。 | 合并会改变安装与运行边界；保留，高。 |
| `public/logo.png` 与 README 图片 | `index.html:18,23` 仍将 logo 用作 Open Graph / Twitter 图片；`README.md:7,32` 引用两张 `assets/` 图片。 | 删除会破坏分享或 README；保留，高。 |
| PWA 插件、配置和注册入口 | `vite.config.js:3–34` 配置插件、manifest 与开发服务；`src/main.js:3,97–111` 使用 `virtual:pwa-register`，已有 PWA 更新边界测试。 | 影响安装、离线和更新；保留，高。 |
| 动态 CSS | `CalendarHeatmap.vue:89` 生成 `level-${day.level}`；`StockWidget.vue:57` 生成 `market-trend-*`；`ContentCard.vue:95` 生成 `is-*`。 | 纯全文“无同名字符串”会误报；这些有效样式保留，高。Milkdown 最初列入此项有误，已更正为 H2。 |
| `picomatch` override 和多个间接依赖版本 | `npm explain picomatch` 确认 override 实际约束 Vite、Rollup / Workbox 链；`git show 90432f5b -- package.json` 记录它随依赖加固引入。 | 无证据表明约束过期；不建议去掉，不评估升级，高。 |
| `docs/alpha-release-acceptance.md` | 文首明确标注 2026-09-10 日期与发布 commit；其中测试数和界面证据属于该次验收，不是当前测试数量声明。 | 删除会丢失历史验收证据；保留，高。 |
| 当前 `backend/supabase/schema.sql` 交付路径 | 当前 README、schema delivery 测试和 `.gitignore` 一致确认 schema-only 公开交付；历史迁移已经不在当前跟踪文件中。 | 不按旧历史记忆恢复迁移；保留当前交付边界，高。 |
| 安全 Demo、Memory / Supabase 两套 Store、测试采集器 | `state-continuity/demo-adapter.js` 与账号 adapter 分别服务不同身份；`backend/src/store/index.js` 根据配置选择 Store；`backend/test/information-input-http.test.js:8,26,75` 使用 `memoryCollector.js` fixture。 | 这是运行边界和可重复测试能力，不是应合并的重复业务代码；保留，高。 |
| 图形验证码的 legacy 命名 | `backend/src/config.js:86–91` 在未配置 Turnstile 时选择 captcha；`src/services/auth-api.js:53` 仍调用 `/api/auth/captcha`。 | 删除会破坏实际回退路径及 `svg-captcha` 使用；保留，高。 |
| 旧账号数据与旧同步游标的兼容 | `src/services/period-review.js:36,341` 仍消费 `archived_at`；`test/state-continuity.test.js:667` 验证首次生命周期写入迁移旧存档事实；`docs/adr/0003-opaque-incremental-sync-cursors.md` 明确要求旧日期游标回退完整快照。 | 未证实旧持久化数据消失，不能因 legacy 字样删兼容；保留，高。 |
| 只在模块内部被调用的导出 | `period-review.js` 的 `PeriodReviewInputError`、`config.js` 的 `resetResolvedApiBase`、`utils/content.js` 的 `normalizePrimaryContentTag` 都有同文件调用。 | 无外部 import 不等于无使用；保留，高。 |

补充排除结果：跟踪文件中没有确认可删除的备份/临时/生成文件或独立废弃脚本；所有 npm 脚本仍有对应执行入口。跟踪文档的本地 Markdown 文件链接检查未发现缺失目标（未验证外链或页内锚点）。`backend/.env.example` 中每个变量均由当前配置读取，未确认无效环境变量。未发现需要形成清理项的 `TODO` / `FIXME` / `HACK` / `workaround` 注释；历史或兼容关键词本身不作为废弃证据。

## Recommended Cleanup Order

以下为只读审计时的建议顺序；用户随后批准执行，实际处理及验证记录附在文末：

1. **先修复误导性的维护契约**：处理 H3 的错误提示与测试，顺带修正 H8 的偏好说明；确定 R2 的本地目录边界。
2. **修正依赖声明**：处理 H2，再判断 R1 是否确有必要保留精确版本声明；不升级依赖。
3. **再清理确定无消费者的局部代码和样式**：H7 局部函数 → H5/H6 内部封装 → H4 孤立界面 → H1 旧样式。逐项独立处理，避免把相邻有效实现、共享选择器一并删除；现有测试之外，涉及显示的删除应增加相称的页面验收。
4. **最后决定停用功能与公开 API 的去留**：R3、R4、R5 先取得产品或消费者证据，再确定删除范围；不因为测试通过就当作删除授权。

### 只读审计阶段的验证记录

- 静态导入扫描：完成，前后端分别核对声明与实际 import / require；Vue SFC 脚本通过 parser 解析，动态 import 计入。
- 样式核查：完成，PostCSS 提取候选后复核模板、动态类名和第三方 DOM；未把静态候选列表直接作为删除清单。
- `npm ls --depth=0`、`npm --prefix backend ls --depth=0`：均成功，无 missing / invalid / extraneous 的直接依赖报告。
- 运行环境：Node.js `v24.20.0`、npm `11.19.0`；Node 版本在项目声明 `>=22 <25` 范围内。
- 报告主体完成后执行现有测试命令，并针对运行期间出现的额外测试作一次范围明确的基准复核：

| 命令 / 范围 | 实际结果 | 说明 |
| --- | --- | --- |
| `npm test`，运行时 `test/*.test.js` | **退出 1；94 项，79 通过、15 失败，0 跳过/取消** | 通配符包含了审计期间新增的两份未跟踪故障测试；不能报告为全绿。 |
| `npm run backend:test` | **退出 0；43/43 通过，0 跳过/取消** | 包括 HTTP、本地 Memory、Supabase query double/schema 文本等现有测试，不连接真实 Supabase。 |
| `node --test`，参数明确取自 `git ls-files 'test/*.test.js'` 返回的 12 个跟踪文件 | **退出 0；76/76 通过，0 跳过/取消** | 为区分基准与新增文件而追加一次复核；没有改写 npm 脚本或临时挪走失败测试。 |
| 再次直接运行 `npm run backend:test`，包含随后新增的两份后端故障测试 | **退出 1；52 项，47 通过、5 失败，0 跳过/取消** | 下表记录新增测试的失败；原有 43 项仍全部通过。 |

15 项失败均来自下面两份未跟踪文件；其辅助文件为 `test/helpers/failure-testing.js`。这些文件在审计开始时不在文件清单，亦非本次审计或其只读子任务创建。记录实际失败，不把它们误判为可清理的历史文件，也不在本任务修复：

| 失败位置 | 数量 | 实际输出要点 |
| --- | ---: | --- |
| `test/failure-cache-api.test.js:32,39,61,89` | 4 | Demo 缺少集合时读取 `push` 失败；缓存配额错误后保留旧任务而非远端任务；reset 缺 snapshot 未拒绝且清空状态；正文读取阶段超时未触发预期 abort。 |
| `test/failure-workflows.test.js:41,53,61` | 3 | 备注失败回滚到了其他日期；旧请求覆盖新草稿；远端确认前重开 scope 无法恢复待确认备注。 |
| `test/failure-workflows.test.js:74,85` | 2 | 导出后再导入被格式校验拒绝；tags/icon 未原样保留。 |
| `test/failure-workflows.test.js:110`（三个输入案例） | 3 | 缺集合、旧字段形状、未知未来版本的备份均未按预期拒绝，并出现写请求。 |
| `test/failure-workflows.test.js:122,135,155` | 3 | 完整覆盖仍保留旧日记录/周总结；部分导入成功后当前 scope 未反映确认事实；重试触发 `DataCloneError`。 |

随后发现另外两份未跟踪文件 `backend/test/failure-boundaries.test.js` 和 `backend/test/failure-refresh.test.js`，故追加后端复测；这两份文件同样不由本次审计创建：

| 后端新增失败位置 | 数量 | 实际输出要点 |
| --- | ---: | --- |
| `backend/test/failure-boundaries.test.js:45,58` | 2 | 并发 patch 丢失先确认字段；删除后并发 patch 重新出现任务。 |
| `backend/test/failure-boundaries.test.js:68,75` | 2 | 无效日历日期返回 200 并写入记录；`America/Los_Angeles` 下 date-only 键偏移到前一天。 |
| `backend/test/failure-refresh.test.js:79` | 1 | 刷新期间删除信源，随后返回的采集结果使普通资讯重新出现。 |

后端追加运行的一次 Node 包装执行受 `listen EPERM 127.0.0.1` 限制，报 41/52 通过、11 失败，其中 7 项是监听失败；随后改为直接执行原 npm 命令，监听错误消失，最终结果为上表的 47/52。未以环境错误代替行为断言结论，也未修改任何测试。

前端运行另外输出 Vite `dep-scan` 的 `The server is being restarted or closed. Request is outdated`，扫描清单包含被忽略的本地 HTML 文档；跟踪测试复核也检测到 `EPERM` 诊断日志。它们没有使上述 76 个基准断言失败，但本次前端测试不是“零错误日志”的干净运行。未进一步改配置或扩展诊断。只读阶段未运行生产构建、浏览器/线上验收或真实数据库测试；实施阶段的构建与本地 Demo 验证见下文。

只读阶段收尾检查：`git diff --check` 通过，报告结构与候选编号核对通过。最终 `git diff --stat` 显示其他工作为 `docs/audits/failure-testing.md` 追加了三行 `.gitignore` 规则；本次没有写入该改动，业务源码没有 diff。除本报告外，本次未主动生成需要保留的临时分析文件；测试工具按现有行为可能更新忽略的 Vite 缓存。

可复核的只读命令示例（零匹配的 `rg` 返回码 1 表示未找到，并非工具失败）：

```bash
git rev-parse HEAD
git ls-files
rg -n 'HomeView|WeeklyView|ContentPreviewModal|renderContentPreviewMarkdown' src test
rg -n 'fetchContentList|fetchContentSources|fetchFeaturedContent|fetchWeeklyReview|fetchTaskTimeline' src test
rg -n 'loadCachedTasks|saveCachedTasks|loadCachedDailyRecord|saveCachedDailyRecord|loadCachedWeeklySummary|saveCachedWeeklySummary|loadCachedHomeData|saveCachedHomeData' src test
rg -n 'dedupeContentItems|resolveContentImageUrl|localizeBody|pickLatestPublishedAt|mapWithConcurrency' backend/src/information-input
rg -n '2026-09-09-add-opaque|schema.sql' backend/src backend/test backend/supabase/README.md
rg -n 'task-timeline-|pulse-links|pulse-link-card|content-lead-|content-overview-|content-stat-|content-quick-tag' src test --glob '!*.css'
npm explain entities
npm explain @milkdown/kit
npm explain picomatch
```

只读阶段交付边界：当时仅写入 `docs/audits/cleanup-audit.md`；不修改业务代码、配置、依赖或测试，不删除文件，不提交、push 或创建 PR。现有忽略规则仍排除本报告（最终 `git check-ignore -v` 命中 `.gitignore:21` 的 `docs/audits/*`）；报告已作为本地文件交付，本次不改忽略规则、不暂存。


### 批准后的实施记录

分支：`codex/cleanup-audit-implementation`，从审计基准 HEAD 新建；未提交、push 或创建 PR。用户批准从只读审计转为实施后开始修改。清理前已有的故障测试、`failure-testing.md`、research 文稿以及 `.gitignore` 的对应追加均未覆盖。本次只额外放行 `docs/audits/cleanup-audit.md`，便于后续审查报告。收尾时又出现并行业务修复：state-continuity / today-api / weekly-api / account 与新增 backup-validation，以及后端日期校验、app、两套 Store；这些变化不属于本次 Cleanup，也没有回退或覆盖。

**可检查的完成条件**：确认移除项没有当前消费者；保留实际功能、数据结构、数据库列与兼容入口；保留依赖版本不升级；完整测试不新增行为失败；生产构建成功；受样式影响的 Today / Review / Timeline / News 页面及周总结、收藏操作通过本地 Demo 检查。

| 审计项 | 实施结果与边界 | 验证 |
| --- | --- | --- |
| H1 | 删除 40 条无消费者 CSS 规则，另从 3 条共用规则中仅移除失效选择器；保留 `content-quick-strip` 等有效选择器。 | 源码类名复核、PostCSS 解析、桌面及移动端页面检查。 |
| H2 | 更正原结论，删除孤立 MarkdownWysiwygEditor、11 条 Milkdown 专属规则和 `@milkdown/crepe`；未引入 `@milkdown/kit`。 | HEAD / 工作区 AST 导入关系扫描，Demo 周总结保存并刷新，构建通过。 |
| H3/H8 | 修正过期 SQL 操作提示及对应断言、README 偏好说明；已有数据库明确不应重复执行完整基线。 | Supabase Store / schema delivery 测试通过；未操作真实数据库。 |
| H4 | 删除 HomeView、WeeklyView、ContentPreviewModal 及其独占 Markdown 转发函数。 | 仓内无残留引用；`/weekly` 仍跳转 `/today?panel=review`。 |
| H5/H6 | 删除 5 个读取 API 封装、专用查询 helper、旧转出及 10 个账号缓存包装函数。 | 源码与全部测试（含未跟踪故障测试）无残留消费者；保留实际写入、草稿和缓存核心。 |
| H7 | 删除 5 个局部死函数；简化无效 URL 条件，返回值与原来相同。 | 采集器与信息输入相关测试通过。 |
| R1 | 删除根 `entities` 直接声明。历史引入提交没有解释额外约束用途，当前无直接调用，Vue / markdown-it 间接消费仍在。 | 保留间接 7.0.1 / 8.1.0；两份 manifest 依赖树完整。 |
| R2 | 选择现有文档契约：允许 Git 忽略的本地实验目录；测试不再要求本地文件系统完全没有 migrations 目录。 | 临时创建空目录后 2/2 schema delivery 测试通过，随后删掉该空目录；基线结构与权限检查仍在。 |
| R3 | 用户明确选择永久退役；删除 14 个专属文件、功能开关、导航分支、AppShell 专用跳转函数及两个监听器、283 条专属样式。 | AST 确认外部只有路由导入，旧地址保留到 Pulse 的重定向；共用控件、会话与同步服务保留，详情见最后一节。 |
| R4/R5 | 按用户明确确认，删除 Featured route → service → persistence → 两套 Store 链，以及 7 个旧 Store 方法；同步删除 API 文档。 | HTTP 回归验证退役入口返回 404，普通 content / sync 流程通过；`schema.sql` 及 `is_featured` 列和查询投影保留。 |

依赖处理使用离线 `npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund` 与 `npm prune --ignore-scripts --offline --no-audit --no-fund`，未升级任何包。对比 HEAD 的 lockfile：删除 183 个安装条目，新增 0；保留包的 version、resolved、integrity 全部相同，仅 `debug` / `ms` 增加 `dev` 标记。`entities` 的两个主版本服务不同消费者，不合并。

#### 实施后验证（Cleanup 完成时的首次快照）

| 检查 | 最终结果 |
| --- | --- |
| `npm test` | 94 项，79 通过、15 失败；0 跳过/取消，退出 1。15 项仍对应前文故障测试，失败名称及断言行为与清理前一致；原有 76 项通过。 |
| `npm run backend:test` | 52 项，47 通过、5 失败；0 跳过/取消，退出 1。5 项仍对应前文故障测试；原有 43 项通过。 |
| `npm run build` | 成功，Vite 与 PWA 产物生成完成。 |
| `npm ls --depth=0`、`npm --prefix backend ls --depth=0` | 通过，无缺失或无效直接依赖。 |
| `git diff --check` | 通过。 |
| 本地独立 Demo 浏览器 | 1440×1000 桌面、390×844 移动端检查 Today / Review / Timeline / News 的浅色、深色相关页面；时间轴可展开，周总结保存并刷新后保留，收藏资讯刷新后显示“取消收藏”，`/weekly` 正确跳转。浏览器 `errors` 为空。 |

首次沙箱测试监听本机端口时遇到 `listen EPERM`，已在允许本机监听的环境直接重跑原 npm 命令，上表使用重跑结果。前端仍有已有 Vite dep-scan 在测试服务器关闭期间的 `Request is outdated` 日志，未把它隐瞒为零错误日志。完整测试不是全绿；未顺手修复本次范围之外的故障测试所揭示的业务问题。

浏览器使用单独本地安全 Demo，未操作真实账号或数据库，未做线上验收。暂存截图及测试日志用于本次检查，报告保留结果；临时浏览器会话和开发服务在验收结束后关闭。


#### FretFlow 决策前的并行修改测试快照

北京时间约 18:40 再次执行当前工作区的原有测试和生产构建：前端 **87/94 通过、7 失败**，后端 **47/52 通过、5 失败**，构建成功。前端失败为 `failure-cache-api.test.js` 的 F01–F04，以及 `failure-workflows.test.js` 的 F05 两项 / F06 一项；后端仍为 F11 两项、F12 两项、F15 一项，均属于审计时已记录的故障测试。原有前端 76 项、后端 43 项仍通过。

前端减少的 8 个失败发生于同工作区的并行业务修复，不能归功于 Cleanup。工作区其他修复仍在持续，以上结果仅对应实际运行时所见状态，不代表后续改动已验证；本任务没有把这些外部修改归入清理交付。R3 当时待确认；用户随后确认永久删除，最终结果见下文。


#### FretFlow 永久退役与最终验证

用户明确确认“fretflow 永久删除”后，于同一分支完成最后一项 R3。删除前 AST 扫描确认以下 14 个模块构成专属实现，来自模块外的唯一 import 是 `src/router/index.js` 的页面动态导入；无其他页面或测试依赖：

- `src/views/FretFlowView.vue`、`src/stores/fretflow.js`。
- `src/components/fretflow/` 下的 CagedControls、CircleOfFifthsPanel、FretFlowHeaderActions、FretFlowPracticePanel、FretTrainingControls、Fretboard、MetronomePanel、PianoKeyboardPreview 共 8 个组件。
- `src/utils/fretflow/fretboard.js`、`src/utils/fretflow/music-theory.js`。
- `src/composables/useMetronome.js`、`src/composables/useTrainingAudio.js`。

同步删除 `FRETFLOW_ENABLED` 与对应导航/页面分支；AppShell 的 `ensureAllowedPwaRoute` 及仅调用它的两个 watch 一并移除。路由只保留 `/fretflow/:pathMatch(.*)*` → `/pulse`，让旧书签仍能进入工作台，不再有可以启用 FretFlow 的功能开关。PostCSS 删除 283 条 `.fretflow-*` / `.fretboard-*` 专属规则，以及因此变空的一条响应式区块；没有删除混合规则中的共用声明。

保留 ToolbarSelect、SegmentedTabs、会话 Store 和状态连续性服务等共用代码。没有额外依赖可移除：FretFlow 使用的 Vue / Pinia 仍被主要页面使用。未删除真实用户 localStorage 或服务器偏好数据，未执行数据库操作；曾保存的 FretFlow 偏好不再被功能代码读取。

最终检查（2026-10-01，用户确认后的工作区）：

| 检查 | 结果 |
| --- | --- |
| `npm test` | **105/105 通过**，0 失败/跳过/取消，退出 0。 |
| `npm run backend:test` | **57/57 通过**，0 失败/跳过/取消，退出 0。 |
| `npm run build` | **通过**，Vite 构建和 PWA 产物生成成功。 |
| 全域引用搜索 | 源码/测试/后端仅剩预期的旧地址重定向，无专属模块、音频、功能开关或样式引用。 |
| 共用样式语义比较 | 从 HEAD 排除 H1、H2 和 R3 的已确认删除项后，剩余 **1073 条**规则与当前选择器、声明和所属 at-rule 全部一致。 |
| 生产预览浏览器 | 桌面 Today 正常；`/fretflow` 和 `/fretflow/practice` 都到 `/pulse`；`/weekly` 仍到 `/today?panel=review`；390×844 深色周期复盘页面正常，浏览器 `errors` 为空。 |
| `git diff --check` | **通过**。 |

当前完整测试集较此前增加，并行业务修复解决了此前故障测试中的失败；这些修复不是删除 FretFlow 的效果。前端测试依然输出测试服务器关闭期间已有的 Vite dep-scan `Request is outdated` 日志，但测试命令退出 0；不将通过断言表述为零诊断日志。

至此全部已授权 Cleanup 项已完成，无剩余待确认项。报告保留审计证据、初始失败及中间快照，最终验收以上表为准。本任务没有提交、push 或创建 PR；本次独立预览服务、浏览器会话和临时验证文件在验收后关闭或清理。


### 提交范围与独立验证

用户在全部 Cleanup 验收后，另行授权提交、合并和清理分支。本次提交仅包含 Cleanup：混合文件按代码片段暂存，故障修复、故障测试、对应报告及研究文稿留在工作区，不纳入本次提交。目标为本地 `main` 快进合并并删除 `codex/cleanup-audit-implementation`；没有新增 push 或 PR 操作。

为避免使用并行修复掩盖 Cleanup 提交本身的问题，从 Git 暂存区导出独立源码副本（只链接已安装依赖，不包含其他未提交文件），实际执行：

- `npm test`：**76/76 通过**，退出 0。
- `npm run backend:test`：**43/43 通过**，退出 0。
- `npm run build`：**通过**。
- `git diff --cached --check`：**通过**。

上面的 105/105 与 57/57 是包含并行业务修复的工作区结果；这里的 76/76 与 43/43 才是本次独立 Cleanup 提交包含的测试范围。临时导出目录在交付后删除，其他工作的原始文件及未提交状态保持不变。

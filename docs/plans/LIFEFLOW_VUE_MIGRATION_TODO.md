# LifeFlow Vue 迁移 TODO

更新日期：2026-03-22

## 目标

把当前 LifeFlow 前端逐步迁移到 `Vue 3 + Vite`，但不推倒重来，遵循：

- 后端 API 保持不变
- 先迁前端，不改数据库与后端接口协议
- 分阶段迁移，保证每一阶段都能运行
- 优先迁高复杂度、高收益模块

## 迁移结论

推荐技术栈：

- `Vue 3`
- `Vite`
- `Vue Router`
- `Pinia`
- `@vite-pwa/plugin-pwa`（后续做 PWA 时接入）

不建议现在做的事：

- 不建议立刻重写后端
- 不建议立刻改认证协议
- 不建议一次性整站迁完
- 不建议先迁 React

## 总体策略

采用：

> 新建 Vue 前端工程，逐步替换现有原生前端模块

保留：

- 现有后端
- 现有 API 路径
- 现有数据结构
- 现有账号体系

## 迁移优先级

### 第一优先级

1. 顶部导航与全局壳层
2. 账号菜单 / 同步中心 / 弹窗体系
3. Today 任务模块

### 第二优先级

4. Weekly 模块
5. 周总结模块

### 第三优先级

6. Finance / Science / AI 内容流模块
7. 信源管理弹窗

### 第四优先级

8. 左右侧 widgets
9. 零散设置页和辅助功能

## 阶段 TODO

## Phase 0：迁移准备

### P0-1 建立 Vue 前端目录

- 在项目中创建新的 Vue 前端目录
- 推荐目录：仓库根目录
- 初始化 `Vite + Vue`

完成标准：

- 可以启动本地开发环境
- 能正常渲染一个空白首页

### P0-2 固定基础技术栈

- 安装 `vue-router`
- 安装 `pinia`
- 安装 `@vueuse/core`（可选，但推荐）
- 保留 `markdown-it`、`dompurify`、`sortablejs`

完成标准：

- 路由能切换
- Pinia 可用
- 依赖结构清晰

### P0-3 建立目录结构

建议结构：

- `src/app`
- `src/router`
- `src/stores`
- `src/views`
- `src/components`
- `src/modules`
- `src/services`
- `src/styles`
- `src/utils`

完成标准：

- 有统一的组件、页面、服务层分层

### P0-4 建立 API 层

- 把当前前端里的 `fetchJson / fetchApiJson / remote` 能力抽成统一 API 客户端
- 统一处理：
  - `credentials`
  - `x-session-id`
  - 错误消息
  - 超时

完成标准：

- Vue 工程中可以调现有后端的 `/health` 和 `/api/auth/me`

## Phase 1：全局壳层迁移

### P1-1 迁移 App Shell

- 迁移整体布局：
  - 顶部导航
  - 中间主内容区
  - 左右侧栏
- 保留现有视觉风格

完成标准：

- Vue 版页面结构和当前页面一致

### P1-2 迁移主题切换

- 迁移 light / dark 主题逻辑
- 保留当前主题样式变量

完成标准：

- 主题切换可用
- 页面刷新后主题可恢复

### P1-3 迁移账号胶囊与账号菜单

- 迁移：
  - 账号按钮
  - 资料入口
  - 同步中心入口
  - 修改密码入口
  - 退出登录入口

完成标准：

- 菜单开关、状态显示、退出登录可用

### P1-4 迁移全局弹窗系统

- 把现有各种 modal 抽成统一 Vue 组件
- 包括：
  - 账号资料
  - 同步中心
  - 数据导入 / 导出
  - 修改密码

完成标准：

- 至少 1 个全局 `ModalHost` 可以管理多个弹窗

## Phase 2：Today 模块迁移

### P2-1 迁移任务列表渲染

- 迁移 Today 任务卡片
- 包括：
  - 左侧色条
  - 完成圆圈
  - 标题
  - 标签
  - 右上角菜单

完成标准：

- Vue 版 Today 任务列表渲染完成

### P2-2 迁移任务交互

- 完成 / 恢复任务
- 打开菜单
- 编辑任务
- 存档任务
- 删除任务

完成标准：

- 所有核心任务操作正常

### P2-3 迁移拖拽排序

- 继续使用 `sortablejs`
- 在 Vue 组件中封装任务拖拽

完成标准：

- 排序可视、顺序可保存

### P2-4 迁移备注系统

- 备注输入
- Markdown 渲染
- 时间标签
- 删除备注

完成标准：

- 备注录入和展示与现版本一致

### P2-5 迁移任务颜色 / 标签能力

- 颜色面板
- 标签展示
- 标签编辑

完成标准：

- 任务视觉能力与现版本一致

## Phase 3：Weekly 模块迁移

### P3-1 迁移 Weekly 视图容器

- 周 / 月切换
- 时间范围显示
- 筛选栏

完成标准：

- Weekly 顶部工具区正常工作

### P3-2 迁移 Weekly 任务卡片

- 标题
- 标签
- Days / Notes 指标
- 时间线样式

完成标准：

- Vue 版 Weekly 卡片效果与现版本一致

### P3-3 迁移 Weekly 时间线交互

- hover 高亮
- 节点放大
- 时间线连线

完成标准：

- 时间线体验保持一致

### P3-4 迁移周总结模块

- Markdown 编辑
- Markdown 展示
- 保存与元信息

完成标准：

- 周总结完整可用

## Phase 4：内容流模块迁移

### P4-1 迁移内容 tab 结构

- `Finance`
- `Science`
- `AI`
- 后续动态 tab

完成标准：

- 内容页能按频道切换

### P4-2 迁移内容卡片

- 图片 / fallback
- 标题点击跳转
- 摘要
- 来源 / 时间
- 标签
- 收藏星标

完成标准：

- 内容卡片与现版本行为一致

### P4-3 迁移筛选工具栏

- 搜索
- 标签筛选
- 来源筛选
- 排序
- 收藏筛选

完成标准：

- 工具栏交互完整

### P4-4 迁移信源管理

- 普通 RSS
- RSSHub
- 默认源补齐
- 新增 / 编辑 / 禁用 / 删除

完成标准：

- 内容源管理功能完整可用

## Phase 5：侧栏 Widgets 迁移

### P5-1 日历热力图

- 迁移 Calendar Heatmap
- 保留现有样式与日期逻辑

### P5-2 天气卡片

- 迁移天气组件
- 保留后端天气 API

### P5-3 股票卡片

- 迁移 A 股概览卡片
- 保留红涨绿跌显示

### P5-4 GitHub / Favorites

- 迁移 GitHub 模块
- 迁移 Favorites 模块

## Phase 6：PWA 准备

### P6-1 接入 PWA 插件

- 配置 manifest
- 配置 icons
- 配置安装能力

### P6-2 离线能力规划

- 决定缓存哪些页面
- 决定缓存哪些 API

### P6-3 移动端适配审查

- 顶部导航
- 筛选栏
- 任务卡片
- 周复盘
- 内容卡片

## 状态管理规划

建议 Pinia 按领域拆：

- `useAuthStore`
- `usePreferencesStore`
- `useTasksStore`
- `useWeeklyStore`
- `useContentStore`
- `useWidgetsStore`
- `useSyncStore`

原则：

- UI 状态与业务状态分开
- API 调用放 service 层
- store 只做状态管理与编排

## 可复用组件清单

建议尽早抽成组件：

- `AppShell`
- `TopTabs`
- `ThemeSwitcher`
- `AccountChip`
- `ModalHost`
- `ToolbarFilterBar`
- `DropdownSelect`
- `TaskCard`
- `TaskTag`
- `TaskMenu`
- `TaskNoteCard`
- `WeeklyReviewCard`
- `TimelineList`
- `ContentCard`
- `SourceManagerModal`
- `WidgetCard`

## 风险点

### R1. 一次性重写风险高

对策：

- 严禁整站重写后再切换
- 必须分阶段迁移

### R2. CSS 迁移容易出偏差

对策：

- 先复用现有样式变量
- 不要一开始重做设计系统

### R3. 状态迁移容易失控

对策：

- 先梳理 store 边界
- 不要把所有状态都塞到一个 store

### R4. 内容模块复杂度高

对策：

- 内容模块后迁
- 先完成 Today / Weekly

## 第一阶段建议

如果现在正式开工，建议只做第一阶段：

1. 建立 Vue 工程
2. 接好 API 层
3. 迁移全局壳层
4. 迁移 Today 模块

原因：

- Today 是你收益最高的模块
- 迁完后就能明显改善维护成本
- 不会一上来就碰最复杂的 RSS 内容系统

## 当前建议结论

一句话：

> 先建 Vue 新前端，再按“壳层 -> Today -> Weekly -> 内容流 -> Widgets -> PWA”的顺序渐进迁移，是你这个项目风险最低、收益最高的 Vue 改造路径。

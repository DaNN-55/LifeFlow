---
status: Planned
last: 2026-03-25
---

> [!NOTE]
> **Context**: Standalone `FretFlow/` is being merged into the current `private-dashboard` app.
> _This document reflects the migration thinking at the time of the last update._

# FretFlow Migration Plan

## Goal

将独立项目 `/Users/dan/Programs/LifeFlow/FretFlow` 中与吉他练习相关的全部能力，迁移到当前主项目 `/Users/dan/Programs/LifeFlow/private-dashboard` 的 `FretFlow` 一级 tab（`/fretflow`）内，保留当前 LifeFlow 的导航结构与视觉语言，不再继续依赖旧项目里的 legacy runtime。

结论先写在前面：

- `FretFlow` 继续作为当前项目的独立一级页存在，不并入 `Content`，这和现有 IA 约束一致。
- 迁移目标不是“把旧项目整页 iframe/整坨脚本搬进来”，而是把旧项目能力拆成 Vue 组件 + Pinia store + 可维护的持久化层。
- 旧项目里需要区分三类内容：
  - 当前仍然有效的 live 功能
  - legacy runtime 里仍然保留但当前 UI 已经不再暴露的能力
  - `_archive/` 中的历史组件化方案，仅用于数据结构和交互参考

## Source Inventory

### 当前应作为主参考的旧项目文件

- `FretFlow/vue-app/src/App.vue`
- `FretFlow/vue-app/src/legacy/chord-arpeggio-runtime.js`
- `FretFlow/vue-app/src/legacy/chord-arpeggio.css`
- `FretFlow/vue-app/src/legacy/guitartraining.css`
- `FretFlow/vue-app/src/vue-overrides.css`

### 仅作补充参考的历史文件

- `FretFlow/vue-app/_archive/src/components/CircleOfFifths.vue`
- `FretFlow/vue-app/_archive/src/stores/circle.js`
- `FretFlow/vue-app/_archive/src/views/TrainingView.vue`

### 当前主项目中的承接入口

- `private-dashboard/src/views/FretFlowView.vue`
- `private-dashboard/src/router/index.js`
- `private-dashboard/src/app/constants.js`
- `private-dashboard/src/stores/`
- `private-dashboard/backend/supabase/schema.sql`

## What Exists In Old FretFlow

### A. 当前 live 功能

这些是旧项目 README 和 `App.vue` 里明确仍然对用户开放的能力：

1. 自由训练主空间
   - 训练模式切换：`训练模式 / CAGED 模式 / 五度圈模式`
   - 训练视图切换：`音阶 / 和弦`
   - 根音选择
   - 音阶类型选择：
     - 自然大调
     - 自然小调
     - 大五声音阶
     - 小五声音阶
     - 布鲁斯音阶
   - 和弦类型选择：
     - 大三和弦
     - 小三和弦
     - sus2
     - sus4
     - 属七
     - 大七
     - 小七
   - 和弦把位选择：1-5
   - 当前把位和弦试听按钮
   - 指板渲染：6 根弦、0-15 品
   - 点击品位发声

2. CAGED 模式
   - `C / A / G / E / D` 五个指型切换
   - CAGED system 显示开关
   - 指板在 CAGED 与训练模式之间复用

3. 五度圈模式
   - SVG 五度圈可视化
   - 当前调性高亮
   - hover / click / keyboard 左右切换
   - 展示内容：
     - 关系大小调
     - 大调音阶
     - 小调音阶
     - 大调自然和弦
     - 小调自然和弦
     - 常见和弦进行
   - 点击和弦、进行时的试听反馈

4. 全局节拍器
   - 开关
   - BPM 40-200
   - 拍号 `2/4 3/4 4/4 5/4 6/4`
   - 灯光节拍提示
   - 折叠/展开

5. 乐句库当前 live 形态
   - 已经不是内置库
   - 当前只是外链按钮：新标签页打开 Songsterr

### B. legacy runtime 里仍保留、但当前 UI 没有暴露的能力

这些能力在 `chord-arpeggio-runtime.js` 中仍然存在，但按当前迁移要求，统一视为冗余能力，不进入本次迁移 scope：

1. 历史乐句库
   - 本地上传文件
   - IndexedDB 本地存储
   - 标签筛选
   - 标题搜索
   - 编辑元数据
   - 删除
   - 预览：
     - 图片
     - 音频
     - PDF
     - 曲谱文件
   - alphaTab 曲谱渲染和播放

2. runtime 中还存在但当前 UI 未看到完整挂载的训练能力
   - root highlight hook
   - arpeggio 开关与方向
   - 五度圈前进/后退按钮引用

迁移结论：

- 这些功能本次不迁
- 文档保留它们，仅为了避免后续误判“漏迁”

### C. `_archive` 里给出的结构化参考

归档代码说明了旧项目早期已经尝试过一版组件化拆分，当前只保留其中与训练/五度圈有关的结构参考：

1. 五度圈可以独立组件化

这部分适合在迁移时作为 Vue 组件边界设计参考，但不建议直接拷贝，因为当前主项目的视觉和数据层已经不同。

## Target In Current LifeFlow

### 不变的结构约束

按照已有 IA 文档，迁移后的 FretFlow 仍然落在：

- 一级导航：`/fretflow`
- 页面文件：`private-dashboard/src/views/FretFlowView.vue`

不新增新的一级导航，不并入 `Today` 或 `Content`。

### 建议的页内结构

为了把旧项目能力完整承接，但不把 `/fretflow` 做成一页巨型 DOM，建议在当前 FretFlow 页内做二级 tab + 一个页内下拉跳转：

1. `Practice`
   - 承接训练模式
   - 承接 CAGED
   - 承接全局/页内节拍器

2. `Theory`
   - 承接五度圈
   - 承接调性、和弦、进行试听

3. `songster` 下拉项
   - 不是独立页面
   - 只是页内一个下拉选项或工具入口
   - 点击后新标签页跳转 Songsterr

这样对应关系最清晰：

- 旧项目 `自由训练` -> 当前页内 `Practice`
- 旧项目 `五度圈模式` -> 当前页内 `Theory`
- 旧项目 `乐句库 / Songsterr` -> 当前页内 `songster` 跳转入口

## Recommended Migration Scope

### Scope 1: 必迁

这些是应该确保 100% 迁进当前项目的核心能力：

1. 训练指板
2. 训练模式切换
3. 音阶/和弦配置
4. 和弦把位播放
5. CAGED 模式
6. 五度圈
7. 节拍器
8. `songster` 外链入口

### Scope 2: 应迁，但可以分阶段

1. 训练参数持久化
2. 节拍器偏好持久化
3. 练习记录与进度
4. 课程进度卡片从静态占位变成真实数据

### Out Of Scope: 本次明确不迁

1. 历史本地乐句库
2. alphaTab 曲谱播放
3. 文件预览器
4. IndexedDB 文件库
5. runtime 中未暴露的自由模式/其他残留开关

## Architecture Plan

## 1. View / Component Decomposition

建议新增一个独立域目录：

- `private-dashboard/src/components/fretflow/`

建议拆分如下：

1. `FretFlowView.vue`
   - 页级容器
   - 二级 tab 切换
   - 总体布局

2. `FretFlowPracticePanel.vue`
   - Practice 面板容器

3. `FretTrainingControls.vue`
   - 根音、音阶、和弦、把位、训练视图切换

4. `Fretboard.vue`
   - 纯渲染指板
   - 接收 note state / active state / click callback

5. `CagedControls.vue`
   - CAGED 五个指型按钮
   - CAGED 开关

6. `CircleOfFifthsPanel.vue`
   - 五度圈与右侧信息面板

7. `MetronomePanel.vue`
   - BPM、拍号、灯光、开关、折叠

8. `FretFlowHeaderActions.vue`
   - `songster` 下拉跳转入口

## 2. Store Decomposition

当前主项目没有 `fretflow` store，建议新增：

- `private-dashboard/src/stores/fretflow.js`

建议 store 内拆成 3 个状态域：

1. `practice`
   - `mode`: `training | caged | circle`
   - `trainingView`: `scale | chord`
   - `root`
   - `scaleType`
   - `chordType`
   - `chordPosition`
   - `selectedPatterns`
   - `showCaged`
   - `lastToast`

2. `theory`
   - `activeCircleIndex`
   - `hoverCircleIndex`

3. `metronome`
   - `enabled`
   - `bpm`
   - `signature`
   - `collapsed`
   - `currentBeat`

## 3. Composables / Utility Split

不要把音频、SVG、文件预览再塞回一个 runtime 文件。建议拆：

- `src/composables/useTrainingAudio.js`
- `src/composables/useMetronome.js`
- `src/utils/fretflow/music-theory.js`
- `src/utils/fretflow/fretboard.js`

这样可以把：

- 音阶公式
- 和弦公式
- CAGED pattern 规则
- 五度圈计算

都从 DOM 脚本里剥离出来。

## Persistence Plan

## Phase 1: 不改数据库 schema，先做可用迁移

优先把轻量配置放进 `users.preferences`：

```json
{
  "fretflow": {
    "ui": {
      "activeTab": "practice",
      "practiceSubtab": "training",
      "songsterEnabled": true
    },
    "practice": {
      "root": "C",
      "scaleType": "major",
      "chordType": "majorTriad",
      "chordPosition": 1,
      "trainingView": "scale",
      "selectedPatterns": [1, 3],
      "showCaged": false
    },
    "metronome": {
      "bpm": 120,
      "signature": "4/4",
      "collapsed": false
    },
    "progress": {
      "todayPlan": [],
      "courseModules": []
    }
  }
}
```

优点：

- 后端 schema 无需第一时间新增表
- 和当前 `content / widgets / tasks` 的偏好写法一致
- 足够支持训练配置、节拍器偏好、页签状态

本次方案不包含乐句库恢复，因此第一阶段不新增 FretFlow 专用表。

## Migration Strategy

### Phase 0: 拆解和校验

目标：把旧项目“功能”和“实现”分开。

输出：

1. 指板规则表
2. 音阶/和弦公式表
3. CAGED pattern 规则表
4. 五度圈计算表
5. 指板与主题适配边界清单

产物建议：

- 直接从 legacy runtime 提炼成纯 JS utility
- 不迁旧 CSS 命名，不迁直接 DOM 操作

### Phase 1: 在当前 `/fretflow` 下落 Practice 面板

交付内容：

1. FretFlow 页从占位卡片改成真正的二级结构
2. 完成训练模式 UI
3. 完成指板渲染与点击发声
4. 完成和弦把位播放
5. 完成 CAGED 切换
6. 完成训练参数本地状态和用户偏好持久化
7. 移除自由模式，仅保留音阶/和弦两种训练视图

验收标准：

- 不依赖 `legacy/chord-arpeggio-runtime.js`
- 不引入全局 DOM 查询
- `Practice` 可以独立运行

### Phase 2: 接入 Theory 面板

交付内容：

1. SVG 五度圈组件化
2. 调性/音阶/和弦/进行信息面板
3. 键盘交互
4. 和弦、进行试听

验收标准：

- 计算逻辑可单测
- 视觉风格遵守当前 LifeFlow，而不是完整照搬旧站

### Phase 3: 接入 Metronome

交付内容：

1. 节拍器从全局 floating 组件重建
2. BPM / 拍号 / 灯光 / 折叠
3. 页内固定停靠
4. 偏好持久化

建议：

- 不必先做全局悬浮
- 先放在 `Practice` 面板右侧或顶部工具区

### Phase 4: 接入 `songster` 跳转入口 + 收口当前占位内容

交付内容：

1. `songster` 下拉跳转入口
2. 课程进度卡
3. 今日练习计划卡
4. 练习记录入口占位

说明：

- 这一阶段就能让当前 LifeFlow 中的 FretFlow 页从“静态占位”变成可用练习空间

### Phase 5: 真正接入练习记录

交付内容：

1. 训练 session 记录
2. 今日练习完成情况
3. 课程进度
4. 与 Today / Review 的关联摘要

建议落点：

- `Today` 中可显示 FretFlow 练习任务摘要
- `Review` 中可显示本周练习时长 / 模块进度

## Functional Mapping Table

| 旧项目能力 | 旧实现来源 | 新项目落点 | 迁移建议 |
|---|---|---|---|
| 训练模式切换 | `App.vue` + runtime | `/fretflow > Practice` | 必迁，Vue 组件化 |
| 指板渲染与点按发声 | runtime | `/fretflow > Practice` | 必迁，拆成 `Fretboard + useTrainingAudio` |
| 音阶训练 | runtime | `/fretflow > Practice` | 必迁 |
| 和弦训练 | runtime | `/fretflow > Practice` | 必迁 |
| 和弦把位播放 | runtime | `/fretflow > Practice` | 必迁 |
| CAGED 模式 | runtime | `/fretflow > Practice` | 必迁 |
| 五度圈 | runtime / archive circle component | `/fretflow > Theory` | 必迁 |
| 调性和弦进行试听 | runtime | `/fretflow > Theory` | 必迁 |
| 节拍器 | runtime | `/fretflow > Practice` | 必迁 |
| Songsterr 外链 | `App.vue` | `/fretflow` 页内 `songster` 下拉项 | 必迁 |
| 课程进度卡 | 当前主项目占位 | `/fretflow` | 迁移时一起重做 |
| 今日练习卡 | 当前主项目占位 | `/fretflow` | 迁移时一起重做 |

## UI / UX Rules For Migration

迁移时需要遵守当前主项目约束：

1. 不把旧项目的整套 hero + 大面积营销文案原样搬过来
2. 不继续沿用旧项目 `.chord-arpeggio` 的全局 body class 驱动
3. 不引入新的全局页面布局体系
4. 复用当前项目已有的：
   - `stage-view`
   - `content-panel`
   - `panel-header`
   - 按钮体系
   - modal 体系
5. 视觉上保留 FretFlow 的练习属性，但要落回 LifeFlow 当前皮肤
6. 指板本身不需要完全套当前页面卡片样式，只需要主题色、文字对比和整体氛围与主项目一致
7. 迁移过程必须是原地渐进替换，不能破坏当前 `/fretflow` 已有内容和其他一级页功能

一句话：
做“LifeFlow 风格的 FretFlow”，不是把老站皮肤硬贴进来。

## Risks

### 1. 最大风险：直接迁 legacy runtime

如果直接把 `chord-arpeggio-runtime.js` 绑进当前项目，会带来：

- 大量 `document.getElementById`
- 全局 body class 污染
- 难以维护的状态同步
- 和现有 Vue 响应式系统冲突

结论：
不要直接迁 runtime，最多只迁其中的理论算法和数据规则。

### 2. 音频上下文与浏览器策略

- 训练发声
- 节拍器

都涉及用户手势解锁音频上下文，迁移时要统一处理，避免训练发声和节拍器各自维护一套。

### 3. 数据层边界不清

如果一开始不区分：

- 用户偏好
- 训练记录

后面会非常难扩展。

结论：
第一阶段先把“偏好”与“记录”分开设计。

## Recommended File Plan In Main Project

建议新增/改造文件：

### 新增

- `private-dashboard/src/stores/fretflow.js`
- `private-dashboard/src/components/fretflow/FretFlowPracticePanel.vue`
- `private-dashboard/src/components/fretflow/FretTrainingControls.vue`
- `private-dashboard/src/components/fretflow/Fretboard.vue`
- `private-dashboard/src/components/fretflow/CagedControls.vue`
- `private-dashboard/src/components/fretflow/CircleOfFifthsPanel.vue`
- `private-dashboard/src/components/fretflow/MetronomePanel.vue`
- `private-dashboard/src/components/fretflow/FretFlowHeaderActions.vue`
- `private-dashboard/src/composables/useTrainingAudio.js`
- `private-dashboard/src/composables/useMetronome.js`
- `private-dashboard/src/utils/fretflow/music-theory.js`
- `private-dashboard/src/utils/fretflow/fretboard.js`
- `private-dashboard/src/utils/fretflow/phrase-files.js`

### 修改

- `private-dashboard/src/views/FretFlowView.vue`
- `private-dashboard/src/styles/base.css`
- `private-dashboard/src/stores/account.js` 或对应 preferences merge 入口
- `private-dashboard/backend/src/app.js`
  - 仅当第一阶段要保存 `preferences.fretflow`

## Validation Checklist

### Phase 1 完成后

- `/fretflow` 不再是静态占位页
- `Practice` 可切换训练模式/CAGED
- 指板可点击发声
- 根音/音阶/和弦/把位切换立即刷新
- 用户离开页面后再次回来，配置仍在

### Phase 2 完成后

- 五度圈可 hover / click / keyboard
- 大小调、和弦、进行展示正确
- 和弦与进行试听正常

### Phase 3 完成后

- 节拍器开关稳定
- BPM/拍号切换正确
- 灯光拍点正确
- 折叠状态可保留

### Phase 4 完成后

- `songster` 下拉入口可用
- 不新增独立 `Library` 页面
- 当前 FretFlow 页既有内容没有被错误删空
- `/pulse` `/today` `/content` 页面无行为回归

## Final Recommendation

建议采用下面的实际实施顺序：

1. 先把 `/fretflow` 变成真正的 `Practice / Theory` 双段式页面
2. 第一波只迁 `Practice + Theory + Metronome + songster 跳转`
3. 同步把当前占位卡片重构为真实 FretFlow 内容
4. 最后再把练习记录并入 LifeFlow 的 Today / Review

这样做的好处是：

- 能最快把 FretFlow 从占位页变成可用页
- 不会被冗余历史功能拖慢
- 符合当前项目“先结构收口，再补真实业务内容”的路线

## Changelog

- 2026-03-25: Initial migration plan created after reviewing standalone `FretFlow` live app, legacy runtime, archived componentized attempt, and current `private-dashboard` integration point.

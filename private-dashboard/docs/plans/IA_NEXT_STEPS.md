# LifeFlow 信息架构草案

日期：2026-03-23

## 当前确认方向

- 桌面端保留左右两侧固定边栏。
- 所有页面切换只发生在中间主内容区域。
- 打开网站第一眼直接进入 `Today`，不再做单独的 dashboard 首页。
- 移动端 / PWA 去掉左右边栏，只保留中间主内容。
- 移动端底部导航固定为 3 个一级入口。
- 后续正式落地到 Vue 项目时，只调整结构，不重做视觉样式。

## 样式约束

- 正式实现时，样式要尽量与当前 Vue 项目保持一致。
- 本次调整的重点是信息架构和页面结构变化，不是视觉重设计。
- 允许做的改动：
  - 页面层级调整
  - 一级 / 二级导航重组
  - 模块位置调整
  - 现有组件的增减和复用
- 尽量不做的改动：
  - 整体配色重做
  - 字体系统重做
  - 组件风格大改
  - 与当前 Vue 项目不一致的新视觉语言

结论：

- prototype 可以用于表达结构方向。
- 正式迁回 Vue 项目时，以“保持现有样式，只改变结构”为原则。

## 一级导航

桌面端中间主区域：

- `Today`
- `Content`
- `FretFlow`

移动端 / PWA 底部导航：

- `Today`
- `Content`
- `FretFlow`

规则：

- 一级导航尽量固定为这 3 个，不继续膨胀。
- 后续新增内容优先进入二级导航，不轻易增加一级 tab。

## Today 结构

`Today` 是默认进入页，也是主要输入和操作页。

内部二级导航建议：

- `Today`
- `Review`
- `Timeline`

职责划分：

- `Today`
  - 新建任务
  - 编辑任务
  - 拖拽排序
  - 记录备注
  - 完成 / 恢复
- `Review`
  - 周总结
  - 本周回顾
  - 历史总结入口
- `Timeline`
  - 任务变化时间线
  - 备注时间线
  - 恢复 / 完成等事件总览

结论：

- `Weekly` 不再保留为一级页面。
- 原 Weekly 的能力拆分后并入 `Today > Review` 和 `Today > Timeline`。

## Content 结构

`Content` 是统一内容阅读页。

内部二级导航示例：

- `Finance`
- `Science`
- `AI`
- `+`

后续新增频道：

- 优先放在 `Content` 内部继续扩展
- 例如 `Deep Tech`、`Policy`、`Reading List`

原则：

- 内容类扩展走二级频道
- 不再为每个内容域新增一级 tab

## FretFlow 结构

`FretFlow` 作为独立一级空间存在，不并入 `Content`。

原因：

- 它是练习和学习工作台，不是资讯阅读页。
- 它有独立心智，适合长期保留稳定入口。

建议承载内容：

- 今日练习计划
- 课程进度
- 技巧训练入口
- 练习记录

## 桌面端规则

- 左边栏固定存在
- 右边栏固定存在
- 左右边栏只调整内容，不改其作为固定 rail 的角色
- 中间主区域承载所有一级和二级页面切换

左右边栏更适合承载：

- 日历
- widgets
- 天气
- 市场信息
- 快速摘要
- 辅助入口

## 移动端 / PWA 规则

- 不保留左右边栏
- 只保留中间主内容
- 底部 tab 固定为 `Today / Content / FretFlow`
- `Today` 内部仍可保留 `Today / Review / Timeline`
- `Content` 内部仍可保留多个频道切换

这样做的好处：

- 导航层级稳定
- 手机端更清爽
- 主操作区更聚焦
- 后续做 PWA 更容易

## 当前原型文件

最新静态原型：

- [prototypes/lifeflow-ia-vue-style-prototype.html](/Users/dan/Programs/LifeFlow/prototypes/lifeflow-ia-vue-style-prototype.html)

保留的较早结构稿：

- [prototypes/today-content-fretflow-ia-prototype.html](/Users/dan/Programs/LifeFlow/prototypes/today-content-fretflow-ia-prototype.html)

原型表达的核心内容：

- 桌面端固定双侧栏
- 中间一级导航为 `Today / Content / FretFlow`
- `Today` 内部有 `Review / Timeline`
- `Content` 预留继续新增频道
- 移动端只保留中间内容和底部 3 tab
- 新版原型的视觉语言尽量贴近当前 Vue 项目，而不是重新设计一套新样式

## 当前进度

- 已完成 `Today` 的二级视图草图：`Today / Review / Timeline`
- 已完成 `Content` 的频道切换草图：`Finance / Science / AI`
- 后续新增频道继续通过 `Content` 二级导航扩展
- 已补出与当前 Vue 项目更接近的样式版 prototype
- 已开始把这套结构正式映射回 Vue 项目
- 已落地一级导航：`Today / Content / FretFlow`
- 已把原 `Weekly` 一级页并回 `Today` 内部的 `Review / Timeline`
- 已把 `/` 收口到 `Today`，并保留旧 `/weekly` 到 `Today > Review` 的兼容跳转
- 正式项目实现时继续遵守“尽量保持当前 Vue 项目样式不变，只调整结构”

## 明天继续时建议顺序

1. 先确认这版信息架构不再变动。
2. 继续在 prototype 上细化页面模块，不直接动正式项目。
3. 对新版 Vue 风格 prototype 做一轮细节确认。
4. 继续补齐 `Today / Content / FretFlow` 的真实业务内容，而不是重新设计视觉。
5. 最后再专门处理移动端 / PWA 的底部导航和布局收口。

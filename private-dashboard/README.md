# 个人执行 Dashboard

一个以任务执行、周复盘、资讯阅读和云同步为核心的个人控制台。

## 功能

- 自定义任务、任务颜色、排序、存档与恢复
- 每日完成状态和任务备注记录
- 周/月复盘、周总结与任务时间线
- 本地保存、云同步、待同步重试
- 同步中心、最近同步记录、最近安全备份恢复
- 用户注册、登录、密码修改、恢复码找回密码
- 账号面板设置、用户名修改、退出全部登录
- 首页导入数据 / 导出数据按钮、JSON 导入/恢复
- Finance / Science 资讯流、收藏、稍后读、已读/未读、信源隐藏
- GitHub / Weather / A 股组件
- 适配桌面端和手机端

## 目录结构

```text
private-dashboard/
  index.html
  assets/
  css/
    styles.css
  js/
    app.js
  README.md
```

## 本地运行

最简单的方式：

1. 不要直接双击打开 `private-dashboard/index.html`

如果你更希望通过本地静态服务访问，可以在项目根目录运行任一命令：

```bash
python3 -m http.server 8000
```

或者：

```bash
cd private-dashboard
npm run serve
```

然后访问：

```text
http://localhost:8000/private-dashboard/login.html
```

说明：

- `login.html` 是普通脚本，直接用 `file://` 打开也许还能工作
- `index.html` 依赖 ES Module，直接用 `file://` 打开时浏览器通常只会显示静态壳，表现成“未登录”
- 本地调试请统一使用 `http://localhost:8000/private-dashboard/login.html`

## 数据存储

- 本地：`localStorage`
- 云端：当前实现为后端 API + Supabase 数据库存储

刷新页面后，本地数据会保留在当前浏览器中。

当后端已连接时：

- 页面会优先通过 API 读写云端数据
- 如果后端不可用，会回退到本地保存，并把变更标记为待同步
- 顶部会显示当前是“云端已连接”还是“本地模式”
- 点击顶部云端状态按钮可打开同步中心，查看最近同步尝试、最近成功时间、待同步数量和最近安全备份

## 云端登录准备

当前版本的登录流是：

- 未登录时进入独立登录页
- 可创建账号，也可用恢复码重置密码
- 登录成功后才会连接云端数据
- 当前账号资料弹窗中可修改用户名、导出当前数据、退出全部登录，并重新生成恢复码

前端可选读取运行时变量 `window.LIFEFLOW_API_BASE` 作为后端地址；如果未提供，会按已缓存地址、同机本地地址和默认后端地址顺序探测。

## GitHub Pages 部署

这是纯静态页面，可直接部署到 GitHub Pages。常见做法：

1. 将仓库推送到 GitHub
2. 在仓库设置中启用 GitHub Pages
3. 选择从默认分支部署
4. 访问 `/private-dashboard/` 路径

如果后续要单独部署这个页面，也可以把 `private-dashboard/` 提取成独立仓库。

## 当前边界

- 当前只支持 JSON 导出和 JSON 导入/恢复，不支持 Markdown 导出
- 当前保留摘要型资讯阅读，不提供站内内容详情页
- 当前没有游客试用模式，进入 Dashboard 需要登录
- 资讯已读/稍后读/来源隐藏属于轻量偏好，保存在账号偏好中

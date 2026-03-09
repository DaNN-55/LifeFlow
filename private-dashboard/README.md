# 个人执行 Dashboard V1

一个纯前端的个人执行面板，用于每日打卡、任务备注记录和周复盘。

## 功能

- 四类固定任务：找工作、健身、吉他、仲裁
- 按日期记录每天的完成情况和备注
- 自动保存到浏览器 `localStorage`
- 按周查看完成天数和任务备注聚合
- 支持显示“云端已连接 / 本地模式”状态
- 支持登录页覆盖层与试用模式切换
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

1. 直接在浏览器中打开 `private-dashboard/index.html`

如果你更希望通过本地静态服务访问，可以在项目根目录运行任一命令：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/private-dashboard/
```

## 数据存储

- 存储方式：`localStorage`
- 存储 key：`lifeflow-private-dashboard-v1`

刷新页面后数据会保留在当前浏览器中。

当后端已连接时：

- 页面会优先通过 API 读写 Render + Supabase
- 如果后端不可用，会回退到本地保存
- 顶部会显示当前是“云端已连接”还是“本地模式”

## 云端登录准备

当前版本的登录流是：

- 未登录时进入登录覆盖层
- 可选择“试用模式”直接进入页面
- 试用模式下只使用 `localStorage`
- 登录成功后才会连接 Render + Supabase 云端数据

为了不在页面上暴露配置输入框，前端会从 [index.html](/Users/dan/Programs/LifeFlow/private-dashboard/index.html) 中读取：

```html
window.LIFEFLOW_AUTH_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
};
```

你需要把这里填成自己的 Supabase 项目信息。它们属于前端公开配置，不是敏感密钥。

登录成功后，前端会自动把 `access_token` 带给后端，为后续按 `user_id` 同步数据做准备。

## GitHub Pages 部署

这是纯静态页面，可直接部署到 GitHub Pages。常见做法：

1. 将仓库推送到 GitHub
2. 在仓库设置中启用 GitHub Pages
3. 选择从默认分支部署
4. 访问 `/private-dashboard/` 路径

如果后续要单独部署这个页面，也可以把 `private-dashboard/` 提取成独立仓库。

## V1 已做 / 未做

已做：

- 每日打卡
- 备注自动保存
- 周复盘聚合
- 基础统计
- 响应式布局

未做：

- 自定义任务
- 导出 JSON / Markdown
- 连续打卡天数
- 云同步
- 用户系统

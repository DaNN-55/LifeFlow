# 个人执行 Dashboard V1

一个纯前端的个人执行面板，用于每日打卡、任务备注记录和周复盘。

## 功能

- 四类固定任务：找工作、健身、吉他、仲裁
- 按日期记录每天的完成情况和备注
- 自动保存到浏览器 `localStorage`
- 按周查看完成天数和任务备注聚合
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

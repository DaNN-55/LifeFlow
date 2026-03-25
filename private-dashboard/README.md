# LifeFlow

当前仓库已收口到 `private-dashboard/` 作为唯一主目录。

## 目录

```text
private-dashboard/
├─ src/                 # 当前有效前端源码（Vue + Pinia + Vite）
├─ public/              # 前端静态资源
├─ backend/             # 当前有效后端源码
├─ docs/                # 规划文档、设计稿、原始说明书、原型
├─ package.json         # 前端脚本
└─ vite.config.js
```

## 当前开发入口

- 前端：`private-dashboard/`
- 后端：`private-dashboard/backend/`

## 常用命令

```bash
cd private-dashboard
npm install
npm run dev
```

后端：

```bash
cd private-dashboard
npm run backend:dev
```

测试后端：

```bash
cd private-dashboard
npm run backend:test
```

构建前端：

```bash
cd private-dashboard
npm run build
```

## 说明

- 新功能、修复和整理都应优先落在 `src/` 或 `backend/`。

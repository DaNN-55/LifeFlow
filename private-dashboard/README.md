# LifeFlow 开发入口

项目定位、功能范围、架构、AI Coding 协作边界和已知限制统一维护在[仓库根 README](../README.md)。本文件只保留本地开发所需信息。

## 目录

```text
private-dashboard/
├─ src/             # Vue 3 + Pinia + Vue Router 前端
├─ public/          # PWA 与静态资源
├─ backend/         # Express API、测试与 Supabase schema
├─ docs/            # 历史规划和原型
├─ package.json
└─ vite.config.js
```

## 初始化

要求 Node.js 20 和 npm：

```bash
npm ci
npm --prefix backend ci
cp backend/.env.example backend/.env
```

未填写 Supabase 配置时，后端使用易失的 Memory 模式。

## 常用命令

```bash
# 前端开发服务器
npm run dev

# 后端开发服务器
npm run backend:dev

# 后端测试
npm run backend:test

# Demo 状态单元测试
npm test

# 前端生产构建
npm run build
```

前后端开发服务器需要分别运行。后端配置与数据库初始化见 [backend/README.md](backend/README.md)。

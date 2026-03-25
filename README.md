# LifeFlow

LifeFlow 是一个个人执行与信息管理项目，当前已经整理为以 `private-dashboard/` 为主目录的结构。

## 当前状态

- 主前端：Vue 3 + Vite + Pinia
- 主后端：Node.js + Express
- 吉他训练模块 `FretFlow` 已合并进主前端

## 主目录说明

当前日常开发请只关注：

- `private-dashboard/`

其中：

- `private-dashboard/src/`：当前有效前端源码
- `private-dashboard/public/`：前端静态资源
- `private-dashboard/backend/`：当前有效后端源码
- `private-dashboard/docs/`：规划文档、原型、设计稿、个人说明书

## 快速开始

### 前端

```bash
cd private-dashboard
npm install
npm run dev
```

### 后端

```bash
cd private-dashboard
npm run backend:dev
```

### 前端构建

```bash
cd private-dashboard
npm run build
```

### 后端测试

```bash
cd private-dashboard
npm run backend:test
```

## 项目结构

```text
LifeFlow/
├─ README.md
├─ .gitignore
├─ private-dashboard/
│  ├─ README.md
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ src/
│  ├─ public/
│  ├─ backend/
│  └─ docs/
```

## docs 说明

`private-dashboard/docs/` 当前包含：

- `plans/`：迁移计划、架构规划、信息架构文档
- `prototypes/`：原型页面
- `personal/`：个人说明书等原始资料
- `misc/`：设计稿和零散说明

## 备注

- 当前仓库根目录仍是 `LifeFlow/`，但业务上已经完成向 `private-dashboard/` 的收口。
- 如果后续需要进一步精简，可以把 `private-dashboard/` 单独提取为新的项目根目录。

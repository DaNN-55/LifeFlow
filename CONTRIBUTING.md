# Contributing to LifeFlow

感谢你关注 LifeFlow。欢迎通过公开 Issue 提交展示页或安全 Demo 的体验反馈、可复现 Bug，以及经过讨论的小型改进。

## 先从哪里开始

- 体验反馈：选择 [体验反馈 Issue Form](https://github.com/DaNN-55/LifeFlow/issues/new?template=feedback.yml)。
- Bug 报告：选择 [Bug Issue Form](https://github.com/DaNN-55/LifeFlow/issues/new?template=bug-report.yml)。
- 安全漏洞：先阅读 [SECURITY.md](SECURITY.md)，不要创建公开 Issue。

Issue Form 只收集公开页面或安全 Demo 的上下文。请不要提交任务名、执行备注、用户名、资讯内容或来源 URL、Session、Cookie、密钥和其他私人数据。

## 本地验证

项目要求 Node.js 20.x。安装依赖后可运行：

```bash
npm ci
npm test
npm run build
```

如果改动后端，再运行：

```bash
npm --prefix backend ci
npm run backend:test
```

安全 Demo 不需要后端或真实账号；它使用合成数据和独立的浏览器本地空间。涉及真实账号、Supabase、外部资讯信源或部署的改动，请在 Issue 中先说明范围与证据。

## 提交建议

请保持改动聚焦，说明用户可见的结果、验证命令和未验证边界。不要提交凭据、生产数据或生成目录。

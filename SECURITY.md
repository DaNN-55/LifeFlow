# Security Policy

## 报告安全漏洞

请不要通过公开 GitHub Issue、Pull Request 或公开讨论报告安全漏洞。请使用 GitHub 仓库的私密漏洞报告入口：[Report a vulnerability](https://github.com/DaNN-55/LifeFlow/security/advisories/new)。

如果该入口不可用，请先通过仓库维护者可验证的私密渠道联系，并只提供必要的复现信息；不要发送密码、Session、Cookie、密钥、真实账号数据、资讯内容或来源 URL。

请说明受影响的公开页面或组件、复现步骤、影响范围，以及是否存在临时规避方式。我们会在确认后再决定修复、披露和致谢安排。

## 当前安全边界

- 安全 Demo 使用合成数据和独立的浏览器本地空间，不连接真实账号、Supabase 或外部资讯信源。
- Supabase Store 有自动化错误分类测试；仓库目前没有真实 Supabase 项目的账号端到端验收证据。
- 自定义 RSS / 网页信源尚未完成生产级内网地址拦截和完整 SSRF 防护，不能把当前 Alpha 当作公开生产服务。

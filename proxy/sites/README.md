# 端砚生命科学 · DeepSeek 统一代理

为 `https://okrabing.github.io` 上的页面提供模型接口。访问者无需填写 API Key；服务端通过运行时 Secret `DEEPSEEK_API_KEY` 访问 DeepSeek。密钥不应写入网页、源码、数据库、日志或 Git。

## 接口

- `POST /api/model/chat`：接收 `{model,messages,max_tokens,temperature}`，返回 OpenAI 兼容的 `choices[0].message.content` 和 `usage`。仅支持 `deepseek-flash`、`deepseek-v4-pro`，强制关闭 thinking 与流式输出。
- `GET /health`：返回 `configured`、`rateLimitConfigured` 和 `databaseReady`。`databaseReady` 通过只读查询验证实际表结构可用；查询失败只返回 false，不泄露数据库错误。没有密钥时 `configured:false`，模型接口返回 503。健康检查不会调用 DeepSeek，不能证明真实调用成功。

仅允许 `https://okrabing.github.io` 的浏览器跨域请求及 Content-Type 请求头。CORS 不是身份认证：同账号下的 GitHub Pages 项目共享 origin，非浏览器请求也能伪造 Origin。此服务面向公开原型使用。

## 持久限流

Sites 需要提供名为 `DB` 的 D1 绑定，并应用 `drizzle/` 中的表结构迁移。请求处理不创建或修改表结构。

每次真实调用前，依次通过条件 UPSERT 原子预留以下额度：

- 每个 IP：每个自然分钟最多 10 次。
- 全部访问者：每个自然分钟最多 60 次。
- 全部访问者：每天最多 1000 次，每天 UTC 00:00（北京时间 08:00）重置。

这些是全站共享的数据库计数。额度预留采用保守规则：后续额度不足、上游失败或超时不会退回已预留的计数；IP 限流拒绝不消耗全站分钟和每日额度。分钟窗口不是滚动 60 秒，因此边界附近可出现跨窗口的两轮请求。限流降低公开代理被大量调用的风险，但不是精确费用上限。

数据库只保存计数、过期时间和使用服务端密钥进行 HMAC-SHA256 后的 IP 标识；标识每日变化。不会保存原始 IP、提示词、聊天正文或模型回复。过期计数按每次最多 64 条清理，活跃桶不删除。共用网络的访问者共用 IP 配额。

请求体最多 128 KiB、消息最多 64 条、输出最多 900 token、上游请求最多等待 45 秒。缺少数据库或限流执行出错时拒绝调用模型；上游错误会转换成中文提示，不回传原始错误或凭据。空文字返回不会被当作成功。

## 本地验证

需要支持 `node:sqlite` 的 Node.js 版本（本次使用 Node 23）。

```sh
npm test
npm run build
npm run validate
```

测试使用内存 SQLite 执行同一迁移与条件 UPSERT，验证并发额度、日切换、清理上限、请求过滤、密钥隔离、错误与超时。它们不替代在线 D1 和真实 DeepSeek 联调。

部署由 Sites 工作流处理；部署前在服务端配置 `DEEPSEEK_API_KEY` Secret。发布后的模型地址为服务域名加 `/api/model/chat`。

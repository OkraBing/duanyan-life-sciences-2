# DeepSeek 代理

供 GitHub Pages 页面调用的 Cloudflare Worker。只接受 `https://okrabing.github.io` 的模型请求，DeepSeek 密钥通过 Worker Secret `DEEPSEEK_API_KEY` 配置，不进入网页、仓库或日志。

接口：

- `POST /api/model/chat`：OpenAI 兼容的文字问答，支持 `deepseek-flash` 与 `deepseek-v4-pro`。
- `GET /health`：只报告代理配置状态；不调用模型，也不代表真实调用已经通过。

部署（在本目录运行）：

```sh
npx wrangler login
npx wrangler deploy
npx wrangler secret put DEEPSEEK_API_KEY
```

在密钥交互提示中输入密钥；不要把密钥写入命令参数或提交到 Git。部署后，将 Worker 的 HTTPS 域名加上 `/api/model/chat` 填入网页的代理地址。

运行本地检查：

```sh
node --test worker.test.mjs
```

代理限制请求体为 128 KiB、消息为 1 至 64 条、输出为最多 4096 token，45 秒超时。强制关闭 thinking，保证页面的短分类和连通测试能够在很小的 token 预算内获得文字答案。客户端传入的密钥、目标地址和其他字段均不会转发。

限流配置为每 IP 每分钟约 10 次、每个 Cloudflare 地点所有访问者合计每分钟约 60 次。Cloudflare 的计数具有地点局部性和最终一致性，**这些不是严格的全球用量或费用上限**；共用网络的访问者也会共用 IP 配额。部署前应确认两个 `namespace_id` 未被同账号其他 Worker 用于不同目的。

CORS 只控制浏览器跨域访问，不是身份认证：同一 GitHub Pages 账号下的其他项目共用此 origin，非浏览器客户端也可以伪造 Origin。本服务是公开原型代理；如需限定使用者，应另加登录验证。上游报错会转换成中文提示，不回传上游原始错误或凭据。

参考：[Cloudflare 限流说明](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)、[DeepSeek thinking 参数](https://api-docs.deepseek.com/guides/thinking_mode/)。

const ALLOWED_ORIGIN = 'https://okrabing.github.io';
const UPSTREAM = 'https://api.deepseek.com/chat/completions';
const MODELS = new Set(['deepseek-flash', 'deepseek-v4-pro']);
const BODY_LIMIT = 128 * 1024;

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readLimited(stream, limit) {
  if (!stream) return '';
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestError(413, '请求内容过大，请缩短问题或上下文。');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function payload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new RequestError(400, '请求体必须是 JSON 对象。');
  const model = body.model ?? 'deepseek-flash';
  if (!MODELS.has(model)) throw new RequestError(400, '不支持这个模型。');
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 64)
    throw new RequestError(400, 'messages 必须包含 1 至 64 条消息。');
  const messages = body.messages.map(message => {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)
      || typeof message.content !== 'string' || !message.content.trim())
      throw new RequestError(400, '消息角色或正文格式不正确。');
    return { role: message.role, content: message.content };
  });
  const max = body.max_tokens ?? 900;
  const temperature = body.temperature ?? 0.2;
  if (!Number.isInteger(max) || max < 1)
    throw new RequestError(400, 'max_tokens 必须是正整数。');
  if (typeof temperature !== 'number' || !Number.isFinite(temperature)
    || temperature < 0 || temperature > 2)
    throw new RequestError(400, 'temperature 必须在 0 至 2 之间。');
  // Only this allowlist reaches DeepSeek; caller credentials and arbitrary fields are discarded.
  return { model, messages, stream: false, thinking: { type: 'disabled' },
    max_tokens: Math.min(max, 4096), temperature };
}

function upstreamError(status) {
  if (status === 401 || status === 403) return 'DeepSeek 密钥不可用，请联系页面维护者。';
  if (status === 402) return 'DeepSeek 账户余额不足，请联系页面维护者。';
  if (status === 429) return 'DeepSeek 请求繁忙，请稍后重试。';
  return 'DeepSeek 暂时未能完成请求，请稍后重试。';
}

export function createHandler({ fetchUpstream = fetch, timeoutMs = 45000 } = {}) {
  return async function handle(request, env) {
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin'
    };
    if (origin === ALLOWED_ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
    const json = (status, data, extra = {}) => new Response(JSON.stringify(data),
      { status, headers: { ...headers, ...extra } });
    const path = new URL(request.url).pathname;

    if (path === '/health' && request.method === 'GET') {
      return json(200, { service: 'duanyan-deepseek-proxy', configured: Boolean(env.DEEPSEEK_API_KEY),
        rateLimitConfigured: Boolean(env.PER_IP_LIMITER && env.SERVICE_LIMITER) });
    }
    if (path !== '/api/model/chat') return json(404, { error: '没有这个接口。' });
    if (origin !== ALLOWED_ORIGIN) return json(403, { error: '此来源未获允许。' });
    if (request.method === 'OPTIONS') {
      if (request.headers.get('Access-Control-Request-Method') !== 'POST')
        return json(405, { error: '只支持 POST 请求。' });
      const requested = (request.headers.get('Access-Control-Request-Headers') || '')
        .toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
      if (requested.some(value => value !== 'content-type'))
        return json(403, { error: '不支持这些请求头。' });
      return new Response(null, { status: 204, headers: { ...headers,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
    }
    if (request.method !== 'POST') return json(405, { error: '只支持 POST 请求。' }, { Allow: 'POST, OPTIONS' });
    if (!env.DEEPSEEK_API_KEY || !env.PER_IP_LIMITER || !env.SERVICE_LIMITER)
      return json(503, { error: '模型代理尚未完成配置。' });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || ''))
      return json(415, { error: '请使用 application/json。' });
    if (Number(request.headers.get('Content-Length')) > BODY_LIMIT)
      return json(413, { error: '请求内容过大，请缩短问题或上下文。' });

    try {
      let body;
      const raw = await readLimited(request.body, BODY_LIMIT);
      try { body = JSON.parse(raw); }
      catch { throw new RequestError(400, '请求体不是有效 JSON。'); }
      const out = payload(body);
      // CF-Connecting-IP is supplied by Cloudflare. A missing address shares one fallback bucket.
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const perIp = await env.PER_IP_LIMITER.limit({ key: 'duanyan:' + ip });
      if (!perIp.success) return json(429, { error: '请求太频繁，请一分钟后再试。' }, { 'Retry-After': '60' });
      const service = await env.SERVICE_LIMITER.limit({ key: 'duanyan:all' });
      if (!service.success) return json(429, { error: '当前访问较多，请一分钟后再试。' }, { 'Retry-After': '60' });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchUpstream(UPSTREAM, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY },
          body: JSON.stringify(out)
        });
        if (!response.ok) {
          await response.body?.cancel();
          const status = response.status === 429 ? 429 : 502;
          return json(status, { error: upstreamError(response.status) });
        }
        const data = JSON.parse(await readLimited(response.body, 1024 * 1024));
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim())
          return json(502, { error: '模型没有返回可用文字，请重试。' });
        // Preserve the frontend contract without reflecting arbitrary upstream fields.
        const usage = {};
        for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
          if (Number.isFinite(data.usage?.[key]) && data.usage[key] >= 0) usage[key] = data.usage[key];
        }
        return json(200, { model: out.model,
          choices: [{ message: { role: 'assistant', content } }], usage });
      } catch {
        return json(controller.signal.aborted ? 504 : 502,
          { error: controller.signal.aborted ? '模型响应超时，请稍后重试。' : '代理暂时无法连接模型服务，请稍后重试。' });
      } finally { clearTimeout(timer); }
    } catch (error) {
      if (error instanceof RequestError) return json(error.status, { error: error.message });
      return json(503, { error: '模型代理暂时不可用，请稍后重试。' });
    }
  };
}

export default { fetch: createHandler() };

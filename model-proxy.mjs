#!/usr/bin/env node
/* 端砚 · 生命科学 —— 本地模型代理
 *
 * 做两件事：
 *   1. 把 index.html 当静态页发出来（于是页面有了同源的后端）；
 *   2. 把页面发来的 POST /api/model/chat 转给 DeepSeek，转的时候才带上密钥。
 *
 * 密钥从环境变量读，**不写进这个文件，也不写进页面**。
 * 页面那一侧因此一个凭据都不持有——这正是「后端代理」那个选项的意思。
 * 直连（浏览器直接打 api.deepseek.com）往往会被 CORS 挡住，
 * 所以要长期用就用这条。
 *
 * 跑法（macOS / Linux）：
 *   export DEEPSEEK_API_KEY=你自己的那把
 *   node model-proxy.mjs ./index.html
 *   然后打开 http://127.0.0.1:8787
 *
 * Windows PowerShell：
 *   $env:DEEPSEEK_API_KEY="你自己的那把"
 *   node model-proxy.mjs .\index.html
 *
 * 只监听 127.0.0.1，不对外。需要 Node 18 以上（要用内置 fetch）。
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const KEY  = process.env.DEEPSEEK_API_KEY || '';
const PAGE = resolve(process.argv[2] || './index.html');
const PORT = Number(process.env.PORT || 8787);
const UP   = 'https://api.deepseek.com/chat/completions';

if (!KEY) {
  console.error('没读到 DEEPSEEK_API_KEY。先 export 一下再跑，密钥不要写进任何文件。');
  process.exit(1);
}

const send = (res, code, type, body) => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/site-config.js') {
    return send(res, 200, 'application/javascript; charset=utf-8',
      'window.DUANYAN_CONFIG = Object.freeze({ managedProxy: false, proxyEndpoint: "/api/model/chat" });');
  }
  if (req.method === 'POST' && req.url === '/api/model/chat') {
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > 1e6) { req.destroy(); }      // 别让一个请求把内存吃掉
    });
    req.on('end', async () => {
      let body;
      try { body = JSON.parse(raw); }
      catch { return send(res, 400, 'application/json', '{"error":"请求体不是 JSON"}'); }
      /* 只放行这两个模型名，顺手把页面可能带上的任何凭据字段丢掉：
         凭据只能来自这台机器的环境变量，不能来自请求。 */
      const model = ['deepseek-flash', 'deepseek-v4-pro'].includes(body.model)
        ? body.model : 'deepseek-flash';
      const out = {
        model,
        messages: Array.isArray(body.messages) ? body.messages : [],
        stream: false,
        thinking: { type: 'disabled' },
        max_tokens: Math.min(Number(body.max_tokens) || 900, 4096),
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.2
      };
      try {
        const up = await fetch(UP, {
          method: 'POST',
          signal: AbortSignal.timeout(45000),
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY },
          body: JSON.stringify(out)
        });
        const text = await up.text();
        // 原样回传，包括出错时的状态码和正文——页面那边要靠它说清到底哪儿不对
        console.log(new Date().toISOString().slice(11, 19), model, up.status, text.length + 'B');
        send(res, up.status, 'application/json', text);
      } catch (e) {
        /* 'fetch failed' 四个字修不了任何问题，把底下那层的错误码一起带出来 */
        const why = e.message + (e.cause && e.cause.code ? '（' + e.cause.code + '）' : '');
        console.error('转发失败：', why);
        send(res, 502, 'application/json',
          JSON.stringify({ error: '代理没能连上 DeepSeek：' + why
            + '。这台机器到 api.deepseek.com 的出口不通，或者密钥所在的网络有限制。' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?') || req.url === '/index.html')) {
    try {
      send(res, 200, 'text/html; charset=utf-8', await readFile(PAGE));
    } catch (e) {
      send(res, 404, 'text/plain; charset=utf-8', '读不到页面：' + PAGE + '\n' + e.message);
    }
    return;
  }

  send(res, 404, 'text/plain; charset=utf-8', 'not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('页面   http://127.0.0.1:' + PORT);
  console.log('代理   POST /api/model/chat  →  ' + UP);
  console.log('页面   ' + PAGE);
  console.log('密钥   从 DEEPSEEK_API_KEY 读到了（不回显，不落盘）');
  console.log('\n在页面侧栏「模型接入」里保持「后端代理」，地址 /api/model/chat，点「测一次」。');
});

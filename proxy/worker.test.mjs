import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from './worker.mjs';

const origin = 'https://okrabing.github.io';
const valid = { model: 'deepseek-flash', messages: [{ role: 'user', content: '只回答：收到' }], max_tokens: 16 };
const allow = { limit: async () => ({ success: true }) };
const env = () => ({ DEEPSEEK_API_KEY: 'server-test-secret', PER_IP_LIMITER: allow, SERVICE_LIMITER: allow });
const req = (body = valid, headers = {}) => new Request('https://proxy.example/api/model/chat', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body)
});

test('successful request forwards only approved fields and server credential', async () => {
  let calls = 0;
  const handle = createHandler({ fetchUpstream: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer server-test-secret');
    const body = JSON.parse(options.body);
    assert.deepEqual(body, { ...valid, stream: false, thinking: { type: 'disabled' }, temperature: 0.2 });
    return Response.json({ choices: [{ message: { content: '收到', reasoning_content: 'omit' } }],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 }, irrelevant: 'omit' });
  } });
  const response = await handle(req({ ...valid, api_key: 'client-secret', endpoint: 'https://example.com', stream: true }), env());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { model: valid.model,
    choices: [{ message: { role: 'assistant', content: '收到' } }],
    usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 } });
  assert.equal(calls, 1);
});

test('preflight works only for allowed origin, method and headers', async () => {
  const handle = createHandler({ fetchUpstream: () => assert.fail('must not call upstream') });
  const request = headers => new Request('https://proxy.example/api/model/chat', { method: 'OPTIONS', headers });
  const base = { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' };
  assert.equal((await handle(request(base), env())).status, 204);
  const bad = await handle(request({ ...base, Origin: 'https://attacker.example' }), env());
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal((await handle(request({ ...base, 'Access-Control-Request-Method': 'DELETE' }), env())).status, 405);
  assert.equal((await handle(request({ ...base, 'Access-Control-Request-Headers': 'authorization' }), env())).status, 403);
  assert.equal((await handle(req(valid, { Origin: '' }), env())).status, 403);
});

test('health does not call model and distinguishes missing configuration', async () => {
  const handle = createHandler({ fetchUpstream: () => assert.fail('must not call upstream') });
  const response = await handle(new Request('https://proxy.example/health'), {});
  assert.deepEqual(await response.json(), { service: 'duanyan-deepseek-proxy', configured: false, rateLimitConfigured: false });
  assert.equal((await handle(req(), {})).status, 503);
});

test('invalid JSON, models, roles, empty messages and numeric fields are rejected before upstream', async () => {
  const handle = createHandler({ fetchUpstream: () => assert.fail('must not call upstream') });
  const cases = ['broken', null, [], { ...valid, model: 'arbitrary-model' },
    { ...valid, messages: [] }, { ...valid, messages: [{ role: 'tool', content: 'x' }] },
    { ...valid, messages: [{ role: 'user', content: '  ' }] },
    { ...valid, max_tokens: -1 }, { ...valid, max_tokens: 3.2 }, { ...valid, temperature: 4 }];
  for (const value of cases) assert.equal((await handle(req(value), env())).status, 400);
  assert.equal((await handle(req(valid, { 'Content-Type': 'text/plain' }), env())).status, 415);
});

test('UTF-8 body size is bounded even without Content-Length', async () => {
  const handle = createHandler({ fetchUpstream: () => assert.fail('must not call upstream') });
  const response = await handle(req({ ...valid, messages: [{ role: 'user', content: '字'.repeat(50000) }] }), env());
  assert.equal(response.status, 413);
});

test('output budget is clamped and both documented model IDs work', async () => {
  const handle = createHandler({ fetchUpstream: async (_, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'deepseek-v4-pro');
    assert.equal(body.max_tokens, 4096);
    assert.deepEqual(body.thinking, { type: 'disabled' });
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  } });
  assert.equal((await handle(req({ ...valid, model: 'deepseek-v4-pro', max_tokens: 100000 }), env())).status, 200);
});

test('per-IP and service limits stop calls and expose Retry-After', async () => {
  const handle = createHandler({ fetchUpstream: () => assert.fail('must not call upstream') });
  for (const binding of ['PER_IP_LIMITER', 'SERVICE_LIMITER']) {
    const settings = env();
    settings[binding] = { limit: async ({ key }) => { assert.ok(key.startsWith('duanyan:')); return { success: false }; } };
    const response = await handle(req(), settings);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
  }
});

test('limiter faults fail closed', async () => {
  const handle = createHandler({ fetchUpstream: () => assert.fail('must not call upstream') });
  const settings = env();
  settings.PER_IP_LIMITER = { limit: async () => { throw new Error('internal info'); } };
  const response = await handle(req(), settings);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('internal info'));
});

test('upstream credentials and error payloads are never reflected', async () => {
  for (const status of [401, 402, 429, 500]) {
    const handle = createHandler({ fetchUpstream: async () => new Response('secret server-test-secret', { status }) });
    const response = await handle(req(), env());
    assert.equal(response.status, status === 429 ? 429 : 502);
    assert.ok(!(await response.text()).includes('secret'));
  }
});

test('empty, malformed or reasoning-only success responses fail', async () => {
  for (const data of [{ choices: [{ message: { content: '' } }] }, { choices: [{ message: { reasoning_content: 'hidden' } }] }]) {
    const handle = createHandler({ fetchUpstream: async () => Response.json(data) });
    assert.equal((await handle(req(), env())).status, 502);
  }
});

test('upstream timeout returns a controlled 504', async () => {
  const handle = createHandler({ timeoutMs: 5, fetchUpstream: (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout internal detail')), { once: true });
  }) });
  const response = await handle(req(), env());
  assert.equal(response.status, 504);
  assert.ok(!(await response.text()).includes('internal detail'));
});

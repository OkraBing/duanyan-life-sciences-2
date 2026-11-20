import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../worker/index.js';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const origin = 'https://okrabing.github.io';
const valid = { model: 'deepseek-flash', messages: [{ role: 'user', content: '只回答：收到' }], max_tokens: 16 };
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../drizzle/0000_rate_buckets.sql', import.meta.url), 'utf8'));
  return {
    sql,
    prepare(query) {
      const statement = sql.prepare(query);
      return { first: async () => statement.get() || null, bind(...args) { return {
        first: async () => statement.get(...args) || null,
        run: async () => statement.run(...args)
      }; } };
    }
  };
}
const env = () => ({ DEEPSEEK_API_KEY: 'server-test-secret', DB: database() });
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
  assert.deepEqual(await response.json(), { service: 'duanyan-deepseek-proxy', configured: false,
    rateLimitConfigured: false, databaseReady: false });
  assert.equal((await handle(req(), {})).status, 503);
});

test('health verifies an applied schema without a model key or a write', async () => {
  const handle = createHandler({ fetchUpstream: () => assert.fail('must not call upstream') });
  const DB = database();
  const queries = [];
  const response = await handle(new Request('https://proxy.example/health'), {
    DB: { prepare(query) { queries.push(query); return DB.prepare(query); } }
  });
  assert.deepEqual(await response.json(), { service: 'duanyan-deepseek-proxy', configured: false,
    rateLimitConfigured: true, databaseReady: true });
  assert.deepEqual(queries, ['SELECT bucket FROM rate_buckets LIMIT 1']);
  assert.equal(DB.sql.prepare('SELECT count(*) AS n FROM rate_buckets').get().n, 0);
});

test('health reports an unapplied schema or database failure without exposing details', async () => {
  const handle = createHandler({ fetchUpstream: () => assert.fail('must not call upstream') });
  const DB = database();
  DB.sql.exec('DROP TABLE rate_buckets');
  for (const db of [DB, { prepare() { throw new Error('private database detail'); } }]) {
    const response = await handle(new Request('https://proxy.example/health'), { DB: db });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { service: 'duanyan-deepseek-proxy', configured: false,
      rateLimitConfigured: true, databaseReady: false });
  }
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
    assert.equal(body.max_tokens, 900);
    assert.deepEqual(body.thinking, { type: 'disabled' });
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  } });
  assert.equal((await handle(req({ ...valid, model: 'deepseek-v4-pro', max_tokens: 100000 }), env())).status, 200);
});

test('concurrent requests from one IP reserve exactly 10 slots, without consuming shared budget on rejection', async () => {
  let calls = 0;
  const settings = env();
  const timestamp = 1794614400000;
  const handle = createHandler({ now: () => timestamp, fetchUpstream: async () => {
    calls++; return Response.json({ choices: [{ message: { content: '收到' } }] });
  } });
  const responses = await Promise.all(Array.from({ length: 25 }, () => handle(req(), settings)));
  assert.equal(responses.filter(value => value.status === 200).length, 10);
  assert.equal(responses.filter(value => value.status === 429).length, 15);
  assert.equal(calls, 10);
  const rows = settings.DB.sql.prepare('SELECT * FROM rate_buckets').all();
  assert.equal(rows.find(row => row.bucket.startsWith('day:')).requests, 10);
  assert.equal(rows.find(row => row.bucket.startsWith('minute:')).requests, 10);
  assert.ok(!JSON.stringify(rows).includes('192.0.2.1'));
  assert.ok(!JSON.stringify(rows).includes('只回答'));
  assert.ok(!JSON.stringify(rows).includes('server-test-secret'));
  assert.match(rows.find(row => row.bucket.startsWith('ip:')).bucket, /^ip:\d+:[a-f0-9]{64}$/);
});

test('global minute allowance remains 60 across different IPs', async () => {
  let calls = 0;
  const settings = env();
  const handle = createHandler({ now: () => 1794614400000, fetchUpstream: async () => {
    calls++; return Response.json({ choices: [{ message: { content: '收到' } }] });
  } });
  const responses = await Promise.all(Array.from({ length: 70 }, (_, i) => handle(req(valid,
    { 'CF-Connecting-IP': '192.0.2.' + i }), settings)));
  assert.equal(responses.filter(value => value.status === 200).length, 60);
  assert.equal(responses.filter(value => value.status === 429).length, 10);
  assert.equal(calls, 60);
  assert.equal(settings.DB.sql.prepare("SELECT requests FROM rate_buckets WHERE bucket LIKE 'day:%'").get().requests, 60);
});

test('global daily allowance caps at 1000, then resets for the next UTC day', async () => {
  const settings = env();
  let timestamp = 1794614400000;
  const day = Math.floor(timestamp / 86400000);
  settings.DB.sql.prepare('INSERT INTO rate_buckets VALUES (?, ?, ?)').run('day:' + day, 999, (day + 1) * 86400 + 120);
  const handle = createHandler({ now: () => timestamp, fetchUpstream: async () =>
    Response.json({ choices: [{ message: { content: '收到' } }] }) });
  assert.equal((await handle(req(), settings)).status, 200);
  const denied = await handle(req(), settings);
  assert.equal(denied.status, 429);
  assert.match((await denied.json()).error, /08:00/);
  assert.equal(settings.DB.sql.prepare('SELECT requests FROM rate_buckets WHERE bucket = ?').get('day:' + day).requests, 1000);
  timestamp += 86400000;
  assert.equal((await handle(req(), settings)).status, 200);
});

test('expired counter cleanup is bounded and retains live buckets', async () => {
  const settings = env();
  const timestamp = 1794614400000;
  for (let i = 0; i < 90; i++) settings.DB.sql.prepare('INSERT INTO rate_buckets VALUES (?, 1, 1)').run('expired:' + i);
  settings.DB.sql.prepare('INSERT INTO rate_buckets VALUES (?, 1, ?)').run('live', timestamp / 1000 + 100);
  const handle = createHandler({ now: () => timestamp, fetchUpstream: async () =>
    Response.json({ choices: [{ message: { content: '收到' } }] }) });
  assert.equal((await handle(req(), settings)).status, 200);
  assert.equal(settings.DB.sql.prepare("SELECT count(*) AS n FROM rate_buckets WHERE bucket LIKE 'expired:%'").get().n, 26);
  assert.ok(settings.DB.sql.prepare("SELECT * FROM rate_buckets WHERE bucket = 'live'").get());
});

test('database faults fail closed without disclosing internal errors', async () => {
  const handle = createHandler({ fetchUpstream: () => assert.fail('must not call upstream') });
  const settings = { DEEPSEEK_API_KEY: 'server-test-secret', DB: { prepare() { throw new Error('private database detail'); } } };
  const response = await handle(req(), settings);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private database detail'));
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

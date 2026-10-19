import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore } from '../server/store.js';
import { createApp } from '../server/app.js';
import { createServerTracker } from '../sdk/server.js';

const event = (overrides = {}) => ({
  id: randomUUID(),
  name: 'page_view',
  visitorId: 'visitor-0001',
  sessionId: 'session-0001',
  path: '/menu',
  occurredAt: new Date().toISOString(),
  properties: {},
  ...overrides,
});
async function fixture(t, config) {
  const store = openStore();
  const server = createApp(store, config).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    store,
    base,
    send: (path, body, headers = {}) =>
      fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      }),
  };
}
const browserHeaders = { 'X-Write-Key': 'kitchen-demo-public' };
const adminHeaders = { Authorization: 'Bearer local-review-token' };

test('browser ingestion deduplicates retries and persists accepted events', async (t) => {
  const { send, store } = await fixture(t);
  const e = event();
  assert.equal((await send('/api/events', { events: [e] }, browserHeaders)).status, 202);
  const replay = await send('/api/events', { events: [e] }, browserHeaders);
  assert.deepEqual(await replay.json(), { accepted: 0, received: 1 });
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM events').get().n, 1);
});
test('entire malformed batch is rejected without a partial write', async (t) => {
  const { send, store } = await fixture(t);
  const response = await send(
    '/api/events',
    { events: [event(), event({ name: '<script>' })] },
    browserHeaders,
  );
  assert.equal(response.status, 400);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM events').get().n, 0);
});
test('credentials, origin, size, timestamps and server-only names are enforced', async (t) => {
  const { send, base } = await fixture(t);
  assert.equal((await send('/api/events', { events: [event()] })).status, 401);
  assert.equal((await fetch(base + '/api/analytics?from=2026-01-01&to=2026-01-02')).status, 401);
  assert.equal(
    (await send('/api/server-events', { events: [event()] }, browserHeaders)).status,
    401,
  );
  assert.equal(
    (
      await send(
        '/api/events',
        { events: [event()] },
        { ...browserHeaders, Origin: 'https://evil.example' },
      )
    ).status,
    403,
  );
  for (const bad of [
    event({ name: 'order_created' }),
    event({ path: '/?email=private' }),
    event({ occurredAt: '2000-01-01' }),
    event({ properties: { data: 'x'.repeat(5000) } }),
    event({ occurredAt: new Date(Date.now() + 600000).toISOString() }),
  ]) {
    assert.equal((await send('/api/events', { events: [bad] }, browserHeaders)).status, 400);
  }
  assert.equal(
    (
      await send(
        '/api/events',
        { events: Array.from({ length: 51 }, () => event()) },
        browserHeaders,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await send(
        '/api/events',
        { events: [event({ properties: { huge: 'x'.repeat(270000) } })] },
        browserHeaders,
      )
    ).status,
    413,
  );
});
test('business checkout is idempotent, trusts server prices, and creates one server event', async (t) => {
  const { send, store } = await fixture(t);
  const headers = { 'Idempotency-Key': randomUUID() };
  const body = {
    visitorId: 'visitor-0001',
    sessionId: 'session-0001',
    items: [{ id: 'bowl', quantity: 2, price: 1 }],
  };
  const results = await Promise.all([
    send('/api/orders', body, headers),
    send('/api/orders', body, headers),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
  assert.equal((await results[0].json()).total, 680);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM orders').get().n, 1);
  const e = store.db.prepare('SELECT * FROM events').get();
  assert.equal(e.source, 'server');
  assert.equal(e.name, 'order_created');
  assert.equal(JSON.parse(e.properties).total, 680);
  assert.equal(
    (await send('/api/orders', { ...body, items: [{ id: 'pizza', quantity: 1 }] }, headers)).status,
    409,
  );
  assert.equal(
    (
      await send(
        '/api/orders',
        { ...body, items: [{ id: 'bowl', quantity: -1 }] },
        { 'Idempotency-Key': randomUUID() },
      )
    ).status,
    400,
  );
});
test('order and analytics insert roll back together if event persistence fails', () => {
  const store = openStore();
  store.db.exec(
    "CREATE TRIGGER reject_event BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;",
  );
  assert.throws(
    () => store.order(randomUUID(), 'visitor-0001', 'session-0001', [{ id: 'bowl', quantity: 1 }]),
    /simulated failure/,
  );
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
  store.close();
});
test('UTC date filters include the entire last day, exclude next midnight and count unique visitors', async (t) => {
  const { base, store } = await fixture(t);
  store.ingest(
    [
      event({ occurredAt: '2026-01-01T00:00:00.000Z' }),
      event({ occurredAt: '2026-01-01T23:59:59.999Z' }),
      event({ occurredAt: '2026-01-02T00:00:00.000Z', visitorId: 'visitor-0002' }),
    ],
    'browser',
  );
  const response = await fetch(base + '/api/analytics?from=2026-01-01&to=2026-01-01', {
    headers: adminHeaders,
  });
  const data = await response.json();
  assert.equal(data.summary.pageViews, 2);
  assert.equal(data.summary.visitors, 1);
  assert.equal(data.pages[0].views, 2);
  assert.equal(data.daily.length, 1);
  assert.equal(data.recent.length, 2);
  for (const query of [
    'from=2026-02-30&to=2026-03-01',
    'from=2026-03-01&to=2026-01-01',
    'from=2020-01-01&to=2026-01-01',
    'from=x&to=y',
  ]) {
    assert.equal(
      (await fetch(base + '/api/analytics?' + query, { headers: adminHeaders })).status,
      400,
    );
  }
});
test('rate limiter rejects excess requests', async (t) => {
  const { base } = await fixture(t, { rateLimit: 2 });
  await fetch(base + '/api/health');
  await fetch(base + '/api/health');
  const response = await fetch(base + '/api/health');
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
});
test('server helper retries transient failures with same ID and authenticates to the real endpoint', async (t) => {
  const { base, store } = await fixture(t);
  let attempts = 0;
  const ids = [];
  const tracker = createServerTracker({
    endpoint: base + '/api/server-events',
    apiKey: 'local-server-key',
    sleep: async () => {},
    fetchImpl: async (url, options) => {
      ids.push(JSON.parse(options.body).events[0].id);
      if (++attempts < 3) return { ok: false, status: 503 };
      return fetch(url, options);
    },
  });
  await tracker.track('reservation_requested', {
    visitorId: 'visitor-0001',
    properties: { seats: 2 },
  });
  assert.equal(attempts, 3);
  assert.equal(new Set(ids).size, 1);
  assert.equal(store.db.prepare('SELECT source FROM events').get().source, 'server');
});
test('server helper fails fast on bad credentials and stops after bounded network retries', async () => {
  let calls = 0;
  const tracker = createServerTracker({
    endpoint: 'https://example.invalid',
    apiKey: 'bad',
    fetchImpl: async () => {
      calls++;
      return { ok: false, status: 401 };
    },
    sleep: async () => {},
  });
  await assert.rejects(tracker.track('test', { visitorId: 'visitor-0001' }), /401/);
  assert.equal(calls, 1);
  const failed = createServerTracker({
    endpoint: 'https://example.invalid',
    apiKey: 'bad',
    fetchImpl: async () => {
      calls++;
      throw new Error('offline');
    },
    sleep: async () => {},
  });
  calls = 0;
  await assert.rejects(failed.track('test', { visitorId: 'visitor-0001' }), /offline/);
  assert.equal(calls, 4);
});
test('database survives close and reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ks-test-'));
  const path = join(dir, 'test.sqlite');
  try {
    let store = openStore(path);
    store.ingest([event()], 'browser');
    store.close();
    store = openStore(path);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM events').get().n, 1);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

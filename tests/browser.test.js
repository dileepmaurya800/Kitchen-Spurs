import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
const source =
  readFileSync(new URL('../sdk/browser.js', import.meta.url), 'utf8').replace(
    'export function createAnalytics',
    'function createAnalytics',
  ) + '\ncreateAnalytics;';
function storage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
}
function harness(
  fetchImpl = async () => ({ ok: true }),
  { local = storage(), session = storage() } = {},
) {
  const listeners = new Map();
  const beacons = [];
  let time = Date.now();
  class Clock extends Date {
    static now() {
      return time;
    }
  }
  const env = {
    Date: Clock,
    crypto: { randomUUID },
    Blob,
    AbortSignal,
    location: { pathname: '/menu' },
    fetch: fetchImpl,
    window: {
      localStorage: local,
      sessionStorage: session,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
    },
    document: {
      visibilityState: 'visible',
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
    },
    navigator: {
      sendBeacon: (url, body) => {
        beacons.push({ url, body });
        return true;
      },
    },
    setInterval: () => 1,
    clearInterval: () => {},
  };
  return {
    create: runInNewContext(source, env),
    local,
    session,
    listeners,
    beacons,
    advance: (ms) => {
      time += ms;
    },
  };
}
test('browser retries stable IDs after network failure, removes acknowledged events', async () => {
  const bodies = [];
  let calls = 0;
  const h = harness(async (url, options) => {
    bodies.push(JSON.parse(options.body));
    if (++calls === 1) throw new Error('offline');
    return { ok: true };
  });
  const sdk = h.create();
  sdk.page('/menu?email=private#fragment');
  await sdk.flush();
  assert.equal(bodies[0].events[0].path, '/menu');
  h.advance(100000);
  await sdk.flush();
  assert.equal(bodies[0].events[0].id, bodies[1].events[0].id);
  await sdk.flush();
  assert.equal(calls, 2);
});
test('identity persists, expires sessions after inactivity, and queue survives SDK recreation', async () => {
  const local = storage(),
    session = storage();
  const bodies = [];
  const h = harness(
    async (url, options) => {
      bodies.push(JSON.parse(options.body));
      return { ok: true };
    },
    { local, session },
  );
  const a = h.create();
  const first = a.identity();
  a.track('add_to_cart');
  a.destroy();
  const b = h.create();
  assert.equal(b.identity().visitorId, first.visitorId);
  assert.equal(b.identity().sessionId, first.sessionId);
  await b.flush();
  assert.equal(bodies[0].events[0].name, 'add_to_cart');
  h.advance(1800001);
  assert.notEqual(b.identity().sessionId, first.sessionId);
});
test('beacon retains pending event until fetch acknowledgement; opt-out clears queue', async () => {
  let calls = 0;
  const h = harness(async () => {
    calls++;
    return { ok: true };
  });
  const sdk = h.create();
  sdk.track('add_to_cart');
  h.listeners.get('pagehide')();
  assert.equal(h.beacons.length, 1);
  await sdk.flush();
  assert.equal(calls, 1);
  sdk.track('menu_filtered');
  sdk.setEnabled(false);
  await sdk.flush();
  assert.equal(calls, 1);
  sdk.setEnabled(true);
  await sdk.flush();
  assert.equal(calls, 1);
  sdk.destroy();
  assert.equal(h.listeners.size, 0);
});
test('tracking works when storage is unavailable, and terminal failures do not poison queue', async () => {
  const forbidden = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
  };
  let calls = 0;
  const h = harness(
    async () => {
      calls++;
      return { ok: false, status: 400 };
    },
    { local: forbidden, session: forbidden },
  );
  const sdk = h.create({
    onError: () => {
      throw new Error('bad callback');
    },
  });
  assert.ok(sdk.identity().visitorId);
  sdk.track('bad');
  await sdk.flush();
  h.advance(100000);
  await sdk.flush();
  assert.equal(calls, 1);
});

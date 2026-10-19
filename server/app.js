import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { MENU } from './store.js';
import { validateEvents, validId } from './validation.js';

const equal = (a, b) =>
  typeof a === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createApp(store, config = {}) {
  const app = express();
  const {
    dashboardToken = 'local-review-token',
    serverKey = 'local-server-key',
    publicKey = 'kitchen-demo-public',
    origins = ['http://localhost:3000', 'http://127.0.0.1:3000'],
    rateLimit = 120,
  } = config;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    });
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin))
      return res.status(403).json({ error: 'Origin not allowed' });
    if (origin)
      res.set({
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Write-Key, Idempotency-Key',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  const buckets = new Map();
  app.use('/api', (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of buckets) if (value.until < now) buckets.delete(key);
    const key = req.ip;
    const bucket = buckets.get(key) ?? { count: 0, until: now + 60000 };
    bucket.count++;
    buckets.set(key, bucket);
    if (bucket.count > rateLimit)
      return res.set('Retry-After', '60').status(429).json({ error: 'Rate limit exceeded' });
    next();
  });
  app.use(express.json({ limit: '256kb', type: ['application/json', 'text/plain'] }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/menu', (req, res) => res.json(MENU));
  app.post('/api/events', (req, res) => {
    if (!equal(req.get('X-Write-Key') ?? req.body?.writeKey, publicKey))
      return res.status(401).json({ error: 'Invalid public write key' });
    let events;
    try {
      events = validateEvents(req.body, 'browser');
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(202).json({ accepted: store.ingest(events, 'browser'), received: events.length });
  });
  app.post('/api/server-events', (req, res) => {
    if (!equal(req.get('Authorization'), `Bearer ${serverKey}`))
      return res.status(401).json({ error: 'Invalid server credential' });
    let events;
    try {
      events = validateEvents(req.body, 'server');
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(202).json({ accepted: store.ingest(events, 'server'), received: events.length });
  });
  app.post('/api/orders', (req, res) => {
    const { visitorId, sessionId, items } = req.body ?? {};
    const key = req.get('Idempotency-Key');
    if (
      !validId(key) ||
      !validId(visitorId) ||
      !validId(sessionId) ||
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 20 ||
      items.some(
        (i) =>
          !i ||
          !MENU.some((m) => m.id === i.id) ||
          !Number.isInteger(i.quantity) ||
          i.quantity < 1 ||
          i.quantity > 20,
      ) ||
      new Set(items.map((i) => i.id)).size !== items.length
    )
      return res.status(400).json({
        error: 'Provide valid identities, idempotency key and unique menu items with quantity 1–20',
      });
    const result = store.order(key, visitorId, sessionId, items);
    res.status(result.replayed ? 200 : 201).json(result);
  });
  app.get('/api/analytics', (req, res) => {
    if (!equal(req.get('Authorization'), `Bearer ${dashboardToken}`))
      return res.status(401).json({ error: 'Dashboard token required' });
    const { from, to } = req.query;
    if (
      ![from, to].every(
        (d) =>
          typeof d === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(d) &&
          !Number.isNaN(Date.parse(d)) &&
          new Date(d).toISOString().slice(0, 10) === d,
      ) ||
      from > to ||
      Date.parse(to) - Date.parse(from) > 365 * 86400000
    )
      return res
        .status(400)
        .json({ error: 'Use valid from/to dates (YYYY-MM-DD), up to 366 inclusive days' });
    const end = new Date(Date.parse(to) + 86400000).toISOString();
    res.json({ from, to, timezone: 'UTC', ...store.report(`${from}T00:00:00.000Z`, end) });
  });
  app.use((error, req, res, next) => {
    const status = error.status ?? 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message });
  });
  return app;
}

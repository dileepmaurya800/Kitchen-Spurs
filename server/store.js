import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const MENU = [
  {
    id: 'bowl',
    name: 'Harvest bowl',
    description: 'Roasted vegetables, quinoa, avocado & tahini',
    price: 340,
    category: 'Bowls',
    icon: '🥗',
  },
  {
    id: 'pizza',
    name: 'Garden margherita',
    description: 'San Marzano tomato, mozzarella & fresh basil',
    price: 480,
    category: 'Pizza',
    icon: '🍕',
  },
  {
    id: 'pasta',
    name: 'Pesto rigatoni',
    description: 'Basil pesto, cherry tomatoes & parmesan',
    price: 420,
    category: 'Pasta',
    icon: '🍝',
  },
  {
    id: 'drink',
    name: 'Citrus cooler',
    description: 'Fresh lime, orange, mint & sparkling water',
    price: 160,
    category: 'Drinks',
    icon: '🍋',
  },
];

export function openStore(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('browser','server')),
      visitor_id TEXT NOT NULL, session_id TEXT, path TEXT, occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL, properties TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_time_name ON events(occurred_at,name);
    CREATE INDEX IF NOT EXISTS events_visitor ON events(visitor_id,occurred_at);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL, visitor_id TEXT NOT NULL,
      total INTEGER NOT NULL, items TEXT NOT NULL, created_at TEXT NOT NULL
    );`);
  const insert = db.prepare(`INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?,?,?,?)`);
  function add(event, source) {
    return Number(
      insert.run(
        event.id,
        event.name,
        source,
        event.visitorId,
        event.sessionId ?? null,
        event.path ?? null,
        event.occurredAt,
        new Date().toISOString(),
        JSON.stringify(event.properties ?? {}),
      ).changes,
    );
  }
  function ingest(events, source) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const accepted = events.reduce((n, event) => n + add(event, source), 0);
      db.exec('COMMIT');
      return accepted;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  function order(key, visitorId, sessionId, requested) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const prior = db.prepare('SELECT * FROM orders WHERE idempotency_key=?').get(key);
      if (prior) {
        if (prior.visitor_id !== visitorId || prior.items !== JSON.stringify(requested))
          throw Object.assign(new Error('Idempotency key was already used for another request'), {
            status: 409,
          });
        db.exec('COMMIT');
        return { id: prior.id, total: prior.total, replayed: true };
      }
      const total = requested.reduce(
        (sum, item) => sum + MENU.find((m) => m.id === item.id).price * item.quantity,
        0,
      );
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)').run(
        id,
        key,
        visitorId,
        total,
        JSON.stringify(requested),
        now,
      );
      // Same database transaction is the delivery boundary: no order/event dual-write gap.
      add(
        {
          id: randomUUID(),
          name: 'order_created',
          visitorId,
          sessionId,
          occurredAt: now,
          properties: {
            orderId: id,
            total,
            currency: 'INR',
            itemCount: requested.reduce((n, i) => n + i.quantity, 0),
          },
        },
        'server',
      );
      db.exec('COMMIT');
      return { id, total, replayed: false };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  function report(from, to) {
    const where = 'occurred_at >= ? AND occurred_at < ?';
    const args = [from, to];
    const summary = db
      .prepare(
        `SELECT COUNT(*) events, COUNT(DISTINCT visitor_id) visitors,
      COALESCE(SUM(name='page_view' AND source='browser'),0) pageViews,
      COALESCE(SUM(name='order_created' AND source='server'),0) orders,
      COALESCE(SUM(CASE WHEN name='order_created' AND source='server' THEN json_extract(properties,'$.total') ELSE 0 END),0) revenue
      FROM events WHERE ${where}`,
      )
      .get(...args);
    return {
      summary,
      daily: db
        .prepare(
          `SELECT substr(occurred_at,1,10) day, COUNT(*) events, SUM(name='page_view') pageViews, COUNT(DISTINCT visitor_id) visitors FROM events WHERE ${where} GROUP BY day ORDER BY day`,
        )
        .all(...args),
      pages: db
        .prepare(
          `SELECT path, COUNT(*) views, COUNT(DISTINCT visitor_id) visitors FROM events WHERE ${where} AND name='page_view' AND source='browser' GROUP BY path ORDER BY views DESC,path LIMIT 10`,
        )
        .all(...args),
      trends: db
        .prepare(
          `SELECT name, source, COUNT(*) count FROM events WHERE ${where} GROUP BY name,source ORDER BY count DESC,name LIMIT 20`,
        )
        .all(...args),
      recent: db
        .prepare(
          `SELECT id,name,source,path,occurred_at occurredAt,properties FROM events WHERE ${where} ORDER BY occurred_at DESC,id LIMIT 15`,
        )
        .all(...args)
        .map((e) => ({ ...e, properties: JSON.parse(e.properties) })),
    };
  }
  return { db, ingest, order, report, close: () => db.close() };
}

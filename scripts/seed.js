import { openStore } from '../server/store.js';
import { randomUUID } from 'node:crypto';
const store = openStore(process.env.DATABASE_PATH ?? 'data/analytics.sqlite');
const events = [];
for (let day = 6; day >= 0; day--) {
  for (let visitor = 0; visitor < 8 + (6 - day) * 2; visitor++) {
    const visitorId = `seed-visitor-${day}-${visitor}`,
      sessionId = randomUUID();
    const time = new Date(Date.now() - day * 86400000 - visitor * 60000).toISOString();
    for (const path of ['/', '/menu', ...(visitor % 3 === 0 ? ['/about'] : [])]) {
      events.push({
        id: randomUUID(),
        name: 'page_view',
        visitorId,
        sessionId,
        path,
        occurredAt: time,
        properties: { synthetic: true },
      });
    }
    if (visitor % 2 === 0)
      events.push({
        id: randomUUID(),
        name: 'add_to_cart',
        visitorId,
        sessionId,
        occurredAt: time,
        properties: { itemId: 'bowl', synthetic: true },
      });
  }
}
store.ingest(events, 'browser');
store.close();
console.log(
  `Added ${events.length} SYNTHETIC browser events. No fake orders. Run only when you want sample traffic; repeat runs add more data.`,
);

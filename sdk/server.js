import { randomUUID } from 'node:crypto';
/** Bounded retries reuse the event ID. Caller must await and handle final rejection. */
export function createServerTracker({
  endpoint,
  apiKey,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  return {
    async track(
      name,
      {
        visitorId,
        sessionId,
        properties = {},
        path,
        id = randomUUID(),
        occurredAt = new Date().toISOString(),
      },
    ) {
      const event = { id, name, visitorId, sessionId, properties, path, occurredAt };
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ events: [event] }),
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) return { id, ...(await response.json()) };
          if (response.status !== 429 && response.status < 500)
            throw Object.assign(new Error(`Tracking rejected: ${response.status}`), {
              permanent: true,
            });
          throw new Error(`Tracking failed: ${response.status}`);
        } catch (error) {
          if (error.permanent || attempt === 3) throw error;
          await sleep(Math.min(60000, 1000 * 2 ** attempt) + Math.random() * 300);
        }
      }
    },
  };
}

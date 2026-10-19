/** Framework-independent browser SDK. No secret belongs in this configuration. */
export function createAnalytics({
  endpoint = '/api/events',
  writeKey = 'kitchen-demo-public',
  enabled = true,
  intervalMs = 3000,
  storagePrefix = 'ks',
  onError = () => {},
} = {}) {
  const read = (storage, key, fallback) => {
    try {
      return JSON.parse(storage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const save = (storage, key, value) => {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      /* Private mode/quota: keep memory copy. */
    }
  };
  let local, session;
  try {
    local = window.localStorage;
    session = window.sessionStorage;
  } catch {
    /* Memory only. */
  }
  const visitorId = read(local, `${storagePrefix}:visitor`, null) ?? crypto.randomUUID();
  save(local, `${storagePrefix}:visitor`, visitorId);
  let sessionState = read(session, `${storagePrefix}:session`, null);
  let queue = read(session, `${storagePrefix}:queue`, []);
  if (!Array.isArray(queue)) queue = [];
  queue = queue.filter((e) => Date.parse(e.occurredAt) > Date.now() - 7 * 86400000).slice(-200);
  let inFlight = false,
    failures = 0,
    nextTry = 0,
    destroyed = false;
  const persist = () => save(session, `${storagePrefix}:queue`, queue);
  function identity() {
    if (!sessionState || Date.now() - sessionState.last > 1800000)
      sessionState = { id: crypto.randomUUID(), last: Date.now() };
    sessionState.last = Date.now();
    save(session, `${storagePrefix}:session`, sessionState);
    return { visitorId, sessionId: sessionState.id };
  }
  function track(name, properties = {}, path) {
    if (!enabled || destroyed) return;
    const event = {
      id: crypto.randomUUID(),
      name,
      ...identity(),
      occurredAt: new Date().toISOString(),
      properties,
      ...(path ? { path } : {}),
    };
    queue.push(event);
    if (queue.length > 200) queue.shift();
    persist();
    if (queue.length >= 20) void flush();
    return event.id;
  }
  async function flush() {
    if (!enabled || inFlight || !queue.length || Date.now() < nextTry) return;
    inFlight = true;
    const batch = queue.slice(0, 50);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writeKey, events: batch }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        if ([400, 401, 403, 413].includes(response.status)) {
          const ids = new Set(batch.map((e) => e.id));
          queue = queue.filter((e) => !ids.has(e.id));
          persist();
        }
        throw new Error(`Analytics HTTP ${response.status}`);
      }
      const ids = new Set(batch.map((e) => e.id));
      queue = queue.filter((e) => !ids.has(e.id));
      persist();
      failures = 0;
      nextTry = 0;
    } catch (error) {
      nextTry =
        Date.now() + Math.min(60000, 1000 * 2 ** Math.min(++failures, 6)) + Math.random() * 500;
      try {
        onError(error);
      } catch {
        /* Observability must not break the host application. */
      }
    } finally {
      inFlight = false;
    }
  }
  function beacon() {
    if (!enabled || !queue.length || !navigator.sendBeacon) return;
    // Keep pending IDs until a fetch acknowledgement; a later replay deduplicates.
    const batch = queue.slice(0, 10);
    const body = JSON.stringify({ writeKey, events: batch });
    if (new Blob([body]).size < 60000)
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
  }
  const visibility = () => {
    if (document.visibilityState === 'hidden') beacon();
  };
  const online = () => {
    nextTry = 0;
    void flush();
  };
  const timer = setInterval(() => void flush(), intervalMs);
  window.addEventListener('online', online);
  window.addEventListener('pagehide', beacon);
  document.addEventListener('visibilitychange', visibility);
  return {
    track,
    page: (path = location.pathname) => track('page_view', {}, path.split(/[?#]/)[0]),
    flush,
    identity,
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) {
        queue = [];
        persist();
      }
    },
    destroy() {
      destroyed = true;
      clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('pagehide', beacon);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}

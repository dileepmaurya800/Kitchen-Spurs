import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createAnalytics } from '../sdk/browser.js';
import './styles.css';

let browserConsent = true;
try {
  browserConsent = localStorage.getItem('ks:consent') !== 'false';
} catch {}
const analytics = createAnalytics({
  enabled: browserConsent,
  writeKey: import.meta.env.VITE_PUBLIC_WRITE_KEY ?? 'kitchen-demo-public',
});
const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
const today = () => new Date().toISOString().slice(0, 10);
const ago = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}
function App() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const change = () => setPath(location.pathname);
    window.addEventListener('popstate', change);
    return () => window.removeEventListener('popstate', change);
  }, []);
  useEffect(() => {
    if (!path.startsWith('/dashboard')) analytics.page(path);
  }, [path]);
  function navigate(next) {
    if (next !== path) {
      history.pushState({}, '', next);
      setPath(next);
    }
  }
  const dashboard = path.startsWith('/dashboard');
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          <span className="brand-icon">k.</span>
          <span>
            kitchen spurs<small>GOOD FOOD. CLEAR INSIGHTS.</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">KS</span>
          <div>
            Kitchen Spurs<small>Restaurant workspace</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <a
          href="/dashboard"
          className={dashboard ? 'nav active' : 'nav'}
          onClick={(e) => {
            e.preventDefault();
            navigate('/dashboard');
          }}
        >
          <span>▥</span> Analytics <small>LIVE</small>
        </a>
        <a
          href="/"
          className={!dashboard ? 'nav active' : 'nav'}
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          <span>◈</span> Restaurant demo
        </a>
        <div className="sidebar-note">
          <span className="status-dot" /> Built to connect the dots
          <p>From the first page view to the last bite. Every interaction has a story.</p>
          <code>browser → API → SQLite</code>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">KS</span>
          <div>
            Assignment workspace<small>Analytics SDK · v1.0</small>
          </div>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <span>
            Workspace <b>/</b> {dashboard ? 'Analytics' : 'Restaurant demo'}
          </span>
          <div>
            <span className="status-dot" /> Local environment{' '}
            <span className="avatar small">KS</span>
          </div>
        </div>
        {dashboard ? <Dashboard /> : <Restaurant path={path} navigate={navigate} />}
      </main>
    </div>
  );
}
function Restaurant({ path, navigate }) {
  const [menu, setMenu] = useState([]),
    [cart, setCart] = useState({}),
    [category, setCategory] = useState('All');
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const [pending, setPending] = useState(null),
    [consent, setConsent] = useState(browserConsent);
  useEffect(() => {
    request('/api/menu')
      .then(setMenu)
      .catch((e) => setError(e.message));
  }, []);
  const items = menu.filter((m) => cart[m.id]).map((m) => ({ id: m.id, quantity: cart[m.id] }));
  const total = menu.reduce((sum, m) => sum + m.price * (cart[m.id] ?? 0), 0);
  function add(item) {
    setCart((c) => ({ ...c, [item.id]: Math.min(20, (c[item.id] ?? 0) + 1) }));
    setPending(null);
    setNotice('');
    analytics.track('add_to_cart', { itemId: item.id, category: item.category });
  }
  async function checkout() {
    setBusy(true);
    setError('');
    setNotice('');
    const payload = pending ?? { key: crypto.randomUUID(), identity: analytics.identity(), items };
    setPending(payload);
    analytics.track('checkout_started', { itemCount: items.reduce((n, i) => n + i.quantity, 0) });
    try {
      const data = await request('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': payload.key },
        body: JSON.stringify({ ...payload.identity, items: payload.items }),
      });
      setNotice(
        `Order ${data.id.slice(0, 8)} confirmed · ${money(data.total)}. Your server event is now in Analytics.`,
      );
      setCart({});
      setPending(null);
      await analytics.flush();
    } catch (e) {
      setError(`${e.message}. Retry uses the same order key.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="content">
      <div className="page-heading">
        <div className="eyebrow">THE RESTAURANT DEMO</div>
        <h1>Good food. Better signals.</h1>
        <p>Browse the menu, build your order, and watch the story unfold in Analytics.</p>
      </div>
      <div className="demo-tabs">
        {[
          ['/', 'Discover'],
          ['/menu', 'Our menu'],
          ['/about', 'Our story'],
        ].map(([url, label]) => (
          <a
            className={path === url ? 'selected' : ''}
            href={url}
            key={url}
            onClick={(e) => {
              e.preventDefault();
              navigate(url);
            }}
          >
            {label}
          </a>
        ))}
      </div>
      {path === '/about' ? (
        <section className="hero">
          <div className="eyebrow">ROOTED IN SOMETHING GOOD</div>
          <h2>
            A little local.
            <br />A lot of heart.
          </h2>
          <p>
            Seasonal ingredients, honest cooking, and a table for everyone. This restaurant is a
            demonstration: orders are stored locally and no payment is collected.
          </p>
          <button className="primary" onClick={() => navigate('/menu')}>
            Explore the menu ↗
          </button>
        </section>
      ) : (
        <>
          {path === '/' && (
            <section className="hero">
              <div>
                <div className="eyebrow">FRESH FROM OUR KITCHEN</div>
                <h2>
                  Your next favorite
                  <br />
                  is on the menu.
                </h2>
                <p>
                  Thoughtfully made bowls, stone-baked pizza, and all the good things in between.
                </p>
                <button className="primary" onClick={() => navigate('/menu')}>
                  Find your favorite ↗
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <span>🥗</span>
                <small>FRESH DAILY · MADE WITH CARE</small>
              </div>
            </section>
          )}
          <div className="menu-layout">
            <section>
              <div className="section-heading">
                <h2>Made for your kind of hungry</h2>
                <span>{menu.length} kitchen favorites</span>
              </div>
              <div className="filters">
                {['All', 'Bowls', 'Pizza', 'Pasta', 'Drinks'].map((c) => (
                  <button
                    className={category === c ? 'chip chosen' : 'chip'}
                    key={c}
                    onClick={() => {
                      setCategory(c);
                      analytics.track('menu_filtered', { category: c });
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="menu-grid">
                {menu
                  .filter((m) => category === 'All' || m.category === category)
                  .map((item) => (
                    <article className="food-card" key={item.id}>
                      <div className={`food-art ${item.id}`} aria-hidden="true">
                        {item.icon}
                        <span>{item.category}</span>
                      </div>
                      <div className="food-copy">
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>
                        <div>
                          <strong>{money(item.price)}</strong>
                          <button
                            disabled={busy || cart[item.id] >= 20}
                            onClick={() => add(item)}
                            aria-label={`Add ${item.name}`}
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
            <aside className="cart panel">
              <div className="section-heading">
                <h2>Your table</h2>
                <span>◉</span>
              </div>
              <p className="muted">A little something delicious.</p>
              {!items.length ? (
                <div className="empty-cart">
                  ⌑
                  <p>
                    Your next good meal starts here.
                    <br />
                    Add a favorite from the menu.
                  </p>
                </div>
              ) : (
                <>
                  {items.map((i) => (
                    <div className="cart-row" key={i.id}>
                      <div>
                        {menu.find((m) => m.id === i.id).name}
                        <small>
                          {i.quantity} × {money(menu.find((m) => m.id === i.id).price)}
                        </small>
                      </div>
                      <button
                        disabled={busy}
                        aria-label={`Remove ${i.id}`}
                        onClick={() => {
                          setCart((c) => ({ ...c, [i.id]: 0 }));
                          setPending(null);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="cart-total">
                    <span>Total</span>
                    <strong>{money(total)}</strong>
                  </div>
                </>
              )}
              <button className="primary full" disabled={!items.length || busy} onClick={checkout}>
                {busy ? 'Sending order…' : pending ? 'Retry order →' : 'Place order →'}
              </button>
              <small className="cart-hint">
                Demo checkout · No payment needed
                <br />
                Prices include tax · INR
              </small>
            </aside>
          </div>
        </>
      )}
      {notice && (
        <div className="notice" role="status">
          ✓ {notice}
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="privacy">
        <div>
          <strong>Tracking is visible, by design.</strong>
          <p>
            This demo uses anonymous analytics. No names, emails, or payment details are collected.
          </p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              browserConsent = e.target.checked;
              setConsent(browserConsent);
              try {
                localStorage.setItem('ks:consent', String(browserConsent));
              } catch {}
              analytics.setEnabled(browserConsent);
              if (browserConsent) analytics.page();
            }}
          />{' '}
          Allow browser analytics
        </label>
      </div>
      <Footer />
    </div>
  );
}
function Dashboard() {
  const [from, setFrom] = useState(ago(6)),
    [to, setTo] = useState(today());
  const [token, setToken] = useState(''),
    [credential, setCredential] = useState(''),
    [data, setData] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [updated, setUpdated] = useState(null);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('dashboard-token');
      if (saved) {
        setToken(saved);
        setCredential(saved);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!credential) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const result = await request(`/api/analytics?from=${from}&to=${to}`, {
          headers: { Authorization: `Bearer ${credential}` },
          signal: controller.signal,
        });
        if (active) {
          setData(result);
          setUpdated(new Date());
          setError('');
        }
      } catch (e) {
        if (active && e.name !== 'AbortError') {
          setData(null);
          setError(e.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [credential, from, to]);
  function login(e) {
    e.preventDefault();
    setCredential(token);
    try {
      sessionStorage.setItem('dashboard-token', token);
    } catch {}
  }
  const series = [];
  if (data)
    for (let day = Date.parse(data.from), end = Date.parse(data.to); day <= end; day += 86400000) {
      const date = new Date(day).toISOString().slice(0, 10);
      series.push(
        data.daily.find((r) => r.day === date) ?? {
          day: date,
          events: 0,
          pageViews: 0,
          visitors: 0,
        },
      );
    }
  return (
    <div className="content">
      <div className="heading-row">
        <div className="page-heading">
          <div className="eyebrow">KNOW YOUR KITCHEN</div>
          <h1>
            Analytics overview
            <span className="live-pill">
              <span className="status-dot" /> Live
            </span>
          </h1>
          <p>A clear view of every visit, interaction, and order.</p>
        </div>
        <div className="update-label">
          {loading
            ? 'Fetching events…'
            : updated
              ? `Updated ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Connect your workspace'}
          <small>Refreshes every 10 seconds</small>
        </div>
      </div>
      {!credential && (
        <form className="login panel" onSubmit={login}>
          <div>
            <h2>Connect to your analytics</h2>
            <p>Enter the dashboard token from your server configuration.</p>
          </div>
          <label className="sr-only" htmlFor="token">
            Dashboard token
          </label>
          <input
            id="token"
            type="password"
            placeholder="Dashboard token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
          <button className="primary">Connect →</button>
          <small>
            Local default: <code>local-review-token</code>
          </small>
        </form>
      )}
      {credential && (
        <>
          <div className="toolbar">
            <div className="segmented">
              {[
                [0, 'Today'],
                [6, '7 days'],
                [29, '30 days'],
              ].map(([days, label]) => (
                <button
                  key={days}
                  className={from === ago(days) && to === today() ? 'selected' : ''}
                  onClick={() => {
                    setFrom(ago(days));
                    setTo(today());
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="date-range">
              <label>
                From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <span>→</span>
              <label>
                To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <span className="timezone">UTC</span>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setCredential('');
                setData(null);
                try {
                  sessionStorage.removeItem('dashboard-token');
                } catch {}
              }}
            >
              Disconnect
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {data && (
            <>
              <div className="metric-grid">
                {[
                  ['Page views', data.summary.pageViews, '↗', 'Browser page loads & navigation'],
                  ['Unique visitors', data.summary.visitors, '♧', 'Distinct anonymous visitor IDs'],
                  ['Total events', data.summary.events, '⌁', 'Browser + server activity'],
                  [
                    'Orders created',
                    data.summary.orders,
                    '▣',
                    `${money(data.summary.revenue)} in order value`,
                  ],
                ].map(([label, value, icon, hint]) => (
                  <section className="metric panel" key={label}>
                    <div>
                      <span>{label}</span>
                      <span className="metric-icon">{icon}</span>
                    </div>
                    <strong>{value.toLocaleString()}</strong>
                    <small>{hint}</small>
                  </section>
                ))}
              </div>
              <section className="panel traffic">
                <div className="section-heading">
                  <div>
                    <h2>Activity over time</h2>
                    <p>Every interaction, from browsing to checkout</p>
                  </div>
                  <div className="legend">
                    <i /> All events <i className="light" /> Page views
                  </div>
                </div>
                <TrafficChart series={series} />
                <div className="chart-caption">
                  Daily totals · UTC · Hover over a bar for details
                  <span>
                    {from} — {to}
                  </span>
                </div>
              </section>
              <div className="analytics-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Popular pages</h2>
                    <span className="tag">BROWSER</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Page</th>
                        <th>Views</th>
                        <th>Visitors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pages.map((p) => (
                        <tr key={p.path}>
                          <td>
                            <span className="page-symbol">↗</span> {p.path}
                            <div
                              className="page-bar"
                              style={{
                                width: `${Math.max(3, (p.views / Math.max(...data.pages.map((p) => p.views))) * 85)}%`,
                              }}
                            />
                          </td>
                          <td>{p.views}</td>
                          <td>{p.visitors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.pages.length && (
                    <Empty text="Browse the restaurant to see popular pages." />
                  )}
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Event breakdown</h2>
                    <span className="tag">ALL SOURCES</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Event name</th>
                        <th>Source</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trends.map((t) => (
                        <tr key={t.name + t.source}>
                          <td>
                            <code>{t.name}</code>
                          </td>
                          <td>
                            <span className={`source ${t.source}`}>{t.source}</span>
                          </td>
                          <td>{t.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.trends.length && <Empty text="Your first interaction will appear here." />}
                </section>
              </div>
              <section className="panel recent">
                <div className="section-heading">
                  <div>
                    <h2>Recent activity</h2>
                    <p>The latest 15 events in your selected date range</p>
                  </div>
                  <span className="live-pill">
                    <span className="status-dot" /> Incoming events
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Source</th>
                        <th>Context</th>
                        <th>Time (UTC)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <span className="event-dot" />
                            <code>{e.name}</code>
                          </td>
                          <td>
                            <span className={`source ${e.source}`}>{e.source}</span>
                          </td>
                          <td>
                            {e.path ??
                              (e.properties.total != null
                                ? `${money(e.properties.total)} · ${e.properties.orderId?.slice(0, 8) ?? 'order'}`
                                : (e.properties.itemId ?? e.properties.category ?? '—'))}
                          </td>
                          <td className="muted">{e.occurredAt.replace('T', ' ').slice(0, 19)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.recent.length && (
                  <Empty text="No events in this date range. Visit the restaurant or choose another range." />
                )}
              </section>
              <div className="insight">
                <span>◈</span>
                <div>
                  <strong>A complete picture, one event at a time.</strong>
                  <p>
                    Browser activity and trusted server orders share anonymous visitor IDs. Retried
                    deliveries are counted once.
                  </p>
                </div>
                <span className="tag">CONNECTED BY DESIGN</span>
              </div>
            </>
          )}
        </>
      )}
      <Footer />
    </div>
  );
}
function TrafficChart({ series }) {
  const max = Math.max(1, ...series.map((s) => s.events));
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Daily events: ${series.map((s) => `${s.day}: ${s.events} events, ${s.pageViews} page views`).join('; ')}`}
    >
      <div className="chart-y">
        {[max, Math.round(max / 2), 0].map((n, i) => (
          <span key={i}>{n}</span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="grid-line top" />
        <div className="grid-line middle" />
        <div className="grid-line bottom" />
        {series.map((s, i) => (
          <div
            className="bar-group"
            key={s.day}
            title={`${s.day}: ${s.events} events · ${s.pageViews} page views · ${s.visitors} visitors`}
          >
            <div className="bar-space">
              <div className="bar" style={{ height: `${(s.events / max) * 100}%` }} />
              <div className="bar views" style={{ height: `${(s.pageViews / max) * 100}%` }} />
            </div>
            <span>
              {i % Math.max(1, Math.ceil(series.length / 8)) === 0 || i === series.length - 1
                ? s.day.slice(5)
                : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
const Empty = ({ text }) => <div className="empty">{text}</div>;
const Footer = () => (
  <footer>
    <span>
      <b>k.</b> Kitchen Spurs Analytics
    </span>
    <span>Built with care · Data stays on your server</span>
  </footer>
);
createRoot(document.getElementById('root')).render(<App />);

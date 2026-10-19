import { createApp } from './app.js';
import { openStore } from './store.js';
import { resolve } from 'node:path';
const store = openStore(process.env.DATABASE_PATH ?? 'data/analytics.sqlite');
const app = createApp(store, {
  dashboardToken: process.env.DASHBOARD_TOKEN,
  serverKey: process.env.SERVER_TRACKING_KEY,
  publicKey: process.env.PUBLIC_WRITE_KEY,
  origins: process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()),
});
if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const { default: express } = await import('express');
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (req, res) => res.sendFile(resolve('dist/index.html')));
}
const server = app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1', () =>
  console.log(`Kitchen Spurs: http://localhost:${process.env.PORT ?? 3000}`),
);
function stop() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

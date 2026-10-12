import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const app = buildApp({ logger: true });

try {
  // Loopback only: this serves a private ledger, and the Vite dev server proxies to it.
  await app.listen({ port, host: '127.0.0.1' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

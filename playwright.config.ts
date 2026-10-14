import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';
import { deriveTestDatabaseUrl } from './tests/helpers/testDatabase.js';
import { API_PORT, WEB_PORT } from './tests/e2e/support/env.js';

const { DATABASE_URL } = loadEnv('test', process.cwd(), '');
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set — copy .env.example to .env');
const databaseUrl = deriveTestDatabaseUrl(DATABASE_URL);

// The specs reset the database directly, through the same helpers the integration tests use,
// and those read DATABASE_URL — so point this process (and its workers) at the _test database.
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/support/globalSetup.ts',
  // One database and one server: tests run one at a time.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // In CI, also emit GitHub annotations: failures then show on the run and the pull request
  // without anyone having to open the logs.
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      // The phone first, at the smallest size we support (CLAUDE.md: 375×667).
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 667 } },
    },
  ],
  webServer: [
    {
      command: 'npx tsx src/server/index.ts',
      env: { DATABASE_URL: databaseUrl, PORT: String(API_PORT) },
      // Any answer from the API, including its 401, means it is up.
      url: `http://127.0.0.1:${API_PORT}/api/session`,
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      env: { API_PORT: String(API_PORT) },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

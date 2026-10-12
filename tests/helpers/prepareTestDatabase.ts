import { loadEnv } from 'vite';
import { deriveTestDatabaseUrl, ensureTestDatabase } from './testDatabase.js';

/**
 * Makes sure the _test database exists and is migrated, points DATABASE_URL at it for this
 * process, and returns its URL. Shared by the Vitest and Playwright global setups.
 */
export async function prepareTestDatabase(): Promise<string> {
  const { DATABASE_URL } = loadEnv('test', process.cwd(), '');
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set — copy .env.example to .env');

  const testUrl = deriveTestDatabaseUrl(DATABASE_URL);
  await ensureTestDatabase(testUrl);

  process.env.DATABASE_URL = testUrl;
  const { migrate } = await import('../../src/db/migrate.js');
  const { pool } = await import('../../src/db/client.js');
  await migrate();
  await pool.end();
  return testUrl;
}

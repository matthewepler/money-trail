import { loadEnv } from 'vite';
import { deriveTestDatabaseUrl, ensureTestDatabase } from './helpers/testDatabase.js';

// Runs once before any test file: make sure the _test database exists and is migrated.
export async function setup(): Promise<void> {
  const { DATABASE_URL } = loadEnv('test', process.cwd(), '');
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set — copy .env.example to .env');

  const testUrl = deriveTestDatabaseUrl(DATABASE_URL);
  await ensureTestDatabase(testUrl);

  process.env.DATABASE_URL = testUrl;
  const { migrate } = await import('../src/db/migrate.js');
  const { pool } = await import('../src/db/client.js');
  await migrate();
  await pool.end();
}

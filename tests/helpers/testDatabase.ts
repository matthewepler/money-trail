import { Client } from 'pg';

/** The test database lives beside the dev one, so tests can never truncate real data. */
export function deriveTestDatabaseUrl(devUrl: string): string {
  const url = new URL(devUrl);
  const name = url.pathname.replace(/^\//, '');
  if (name === '') throw new Error('DATABASE_URL has no database name');
  if (!name.endsWith('_test')) url.pathname = `/${name}_test`;
  return url.toString();
}

export function assertTestDatabase(name: string): void {
  if (!name.endsWith('_test')) {
    throw new Error(
      `refusing to run against database '${name}': tests only touch databases ending in _test`,
    );
  }
}

export async function ensureTestDatabase(testUrl: string): Promise<void> {
  const url = new URL(testUrl);
  const name = url.pathname.replace(/^\//, '');
  assertTestDatabase(name);

  // CREATE DATABASE has to be issued from another database on the same server.
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Postgres is not reachable at ${url.host} — is it running? Try: docker compose up -d`,
      { cause: error },
    );
  }
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }
}

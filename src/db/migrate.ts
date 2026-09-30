import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './client.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrationIds(): Promise<Set<string>> {
  const result = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
  return new Set(result.rows.map((row) => row.id));
}

export async function migrate(): Promise<string[]> {
  await ensureMigrationsTable();
  const applied = await appliedMigrationIds();
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
      await client.query('COMMIT');
      newlyApplied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return newlyApplied;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(async (applied) => {
      console.log(applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Already up to date.');
      await pool.end();
    })
    .catch(async (err: unknown) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}

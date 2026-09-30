import { pool } from '../../src/db/client.js';

export async function truncateAll(): Promise<void> {
  await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');
}

export async function insertTestUser(email: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, 'not-a-real-hash'],
  );
  const row = result.rows[0];
  if (!row) throw new Error('insert did not return a row');
  return row.id;
}

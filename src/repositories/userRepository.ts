import { pool } from '../db/client.js';

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
};

// Unlike every other repository, these methods do not take a userId: they run before there is
// a session to take one from — they are how a userId is found in the first place.

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<{ id: string; email: string; password_hash: string }>(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [normalizeEmail(email)],
  );
  const row = result.rows[0];
  return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
}

/** Creates the user, or replaces the password hash of the one with this email. Returns the id. */
export async function upsertUser(email: string, passwordHash: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [normalizeEmail(email), passwordHash],
  );
  const row = result.rows[0];
  if (!row) throw new Error('upsert did not return a row');
  return row.id;
}

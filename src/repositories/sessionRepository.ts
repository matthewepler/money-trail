import { pool } from '../db/client.js';

// Like userRepository, these run before a session exists to supply a userId, so only
// createSession takes one. Lookups and deletes are keyed by the unguessable token hash.

export async function createSession(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    tokenHash,
    userId,
    expiresAt,
  ]);
}

/** The user who owns this session, or null if it is unknown or expired at `now`. */
export async function findSession(tokenHash: string, now: Date): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > $2',
    [tokenHash, now],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

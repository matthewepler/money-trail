import { pool } from '../../../src/db/client.js';
import { seedUser } from '../../../src/db/seed.js';
import { truncateAll } from '../../helpers/db.js';
import { E2E_EMAIL, E2E_PASSWORD } from './env.js';

/** An empty database with the one account a test signs in as. */
export async function resetWithUser(): Promise<void> {
  await truncateAll();
  await seedUser({ email: E2E_EMAIL, password: E2E_PASSWORD });
}

/** What happens when a session expires, or is revoked from another device, mid-visit. */
export async function endAllSessions(): Promise<void> {
  await pool.query('DELETE FROM sessions');
}

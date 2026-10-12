import { ConfigError } from '../domain/errors.js';
import { upsertUser } from '../repositories/userRepository.js';
import { hashPassword } from '../services/passwords.js';
import { pool } from './client.js';

const MIN_PASSWORD_LENGTH = 12;

export async function seedUser(account: { email: string; password: string }): Promise<string> {
  if (account.password.length < MIN_PASSWORD_LENGTH) {
    throw new ConfigError(`SEED_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return upsertUser(account.email, await hashPassword(account.password));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new ConfigError(`missing required environment variable ${name}`);
  return value;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const email = requireEnv('SEED_EMAIL');
    await seedUser({ email, password: requireEnv('SEED_PASSWORD') });
    console.log(`Seeded account ${email}`);
    await pool.end();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await pool.end();
    process.exit(1);
  }
}

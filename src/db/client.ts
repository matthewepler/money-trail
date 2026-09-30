import { Pool } from 'pg';
import { ConfigError } from '../domain/errors.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(`missing required environment variable ${name}`);
  }
  return value;
}

export const pool = new Pool({ connectionString: requireEnv('DATABASE_URL') });

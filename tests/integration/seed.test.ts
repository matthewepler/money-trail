import { beforeEach, describe, expect, it } from 'vitest';
import { seedUser } from '../../src/db/seed.js';
import { ConfigError } from '../../src/domain/errors.js';
import { findUserByEmail } from '../../src/repositories/userRepository.js';
import { verifyPassword } from '../../src/services/passwords.js';
import { truncateAll } from '../helpers/db.js';

beforeEach(async () => {
  await truncateAll();
});

describe('seedUser', () => {
  it('creates the account with a hash that verifies against the password', async () => {
    await seedUser({ email: 'owner@example.com', password: 'a-long-enough-password' });

    const user = await findUserByEmail('owner@example.com');
    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toContain('a-long-enough-password');
    expect(await verifyPassword(user?.passwordHash ?? '', 'a-long-enough-password')).toBe(true);
  });

  it('is repeatable: seeding again with a new password replaces the hash, not the user', async () => {
    const first = await seedUser({ email: 'owner@example.com', password: 'first-password-123' });
    const second = await seedUser({ email: 'owner@example.com', password: 'second-password-123' });

    expect(second).toBe(first);
    const user = await findUserByEmail('owner@example.com');
    expect(await verifyPassword(user?.passwordHash ?? '', 'second-password-123')).toBe(true);
  });

  it('refuses a short password', async () => {
    await expect(seedUser({ email: 'owner@example.com', password: 'short' })).rejects.toThrow(
      ConfigError,
    );
    expect(await findUserByEmail('owner@example.com')).toBeNull();
  });
});

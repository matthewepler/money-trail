import { beforeEach, describe, expect, it } from 'vitest';
import { findUserByEmail, upsertUser } from '../../src/repositories/userRepository.js';
import { truncateAll } from '../helpers/db.js';

beforeEach(async () => {
  await truncateAll();
});

describe('userRepository', () => {
  it('creates a user and finds them by email', async () => {
    const id = await upsertUser('owner@example.com', 'hash-1');

    expect(await findUserByEmail('owner@example.com')).toEqual({
      id,
      email: 'owner@example.com',
      passwordHash: 'hash-1',
    });
  });

  it('matches email case-insensitively and ignores surrounding spaces', async () => {
    const id = await upsertUser('  Owner@Example.com ', 'hash-1');

    expect((await findUserByEmail('OWNER@example.COM'))?.id).toBe(id);
  });

  it('returns null for an unknown email', async () => {
    expect(await findUserByEmail('nobody@example.com')).toBeNull();
  });

  it('updates the hash in place when the same email is upserted again', async () => {
    const first = await upsertUser('owner@example.com', 'hash-1');
    const second = await upsertUser('owner@example.com', 'hash-2');

    expect(second).toBe(first);
    expect((await findUserByEmail('owner@example.com'))?.passwordHash).toBe('hash-2');
  });
});

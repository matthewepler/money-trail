import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSession,
  deleteSession,
  findSession,
} from '../../src/repositories/sessionRepository.js';
import { insertTestUser, truncateAll } from '../helpers/db.js';

const NOW = new Date('2026-10-11T12:00:00Z');
const LATER = new Date('2026-10-12T12:00:00Z');
const EARLIER = new Date('2026-10-10T12:00:00Z');

beforeEach(async () => {
  await truncateAll();
});

describe('sessionRepository', () => {
  it('finds the owning user for a live session', async () => {
    const userId = await insertTestUser('owner@example.com');
    await createSession(userId, 'hash-a', LATER);

    expect(await findSession('hash-a', NOW)).toBe(userId);
  });

  it('does not find an unknown session', async () => {
    expect(await findSession('hash-missing', NOW)).toBeNull();
  });

  it('does not find an expired session', async () => {
    const userId = await insertTestUser('owner@example.com');
    await createSession(userId, 'hash-a', EARLIER);

    expect(await findSession('hash-a', NOW)).toBeNull();
  });

  it('keeps one user’s session pointing at that user only', async () => {
    const ownerId = await insertTestUser('owner@example.com');
    const otherId = await insertTestUser('other@example.com');
    await createSession(ownerId, 'hash-owner', LATER);
    await createSession(otherId, 'hash-other', LATER);

    expect(await findSession('hash-owner', NOW)).toBe(ownerId);
    expect(await findSession('hash-other', NOW)).toBe(otherId);
  });

  it('deletes a session', async () => {
    const userId = await insertTestUser('owner@example.com');
    await createSession(userId, 'hash-a', LATER);

    await deleteSession('hash-a');

    expect(await findSession('hash-a', NOW)).toBeNull();
  });
});

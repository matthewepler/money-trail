import { beforeEach, describe, expect, it } from 'vitest';
import {
  insertTransactions,
  listTransactions,
  summarizeByCategory,
} from '../../src/repositories/transactionRepository.js';
import { insertTestUser, truncateAll } from '../helpers/db.js';

beforeEach(async () => {
  await truncateAll();
});

describe('transactionRepository', () => {
  it('persists transactions scoped to a user and returns them with ids', async () => {
    const userId = await insertTestUser('owner@example.com');

    const [stored] = await insertTransactions(userId, [
      {
        date: '2026-09-29',
        description: 'CORNER BAKERY',
        amountCents: -381,
        account: 'chase-checking',
        category: 'Food',
      },
    ]);

    expect(stored).toMatchObject({
      date: '2026-09-29',
      description: 'CORNER BAKERY',
      amountCents: -381,
      account: 'chase-checking',
      category: 'Food',
    });
    expect(typeof stored?.id).toBe('string');
  });

  it('never returns another user’s transactions', async () => {
    const ownerId = await insertTestUser('owner@example.com');
    const otherId = await insertTestUser('other@example.com');

    await insertTransactions(ownerId, [
      {
        date: '2026-09-29',
        description: 'OWNER TXN',
        amountCents: -100,
        account: 'chase-checking',
        category: null,
      },
    ]);
    await insertTransactions(otherId, [
      {
        date: '2026-09-29',
        description: 'OTHER TXN',
        amountCents: -200,
        account: 'chase-checking',
        category: null,
      },
    ]);

    const ownerTransactions = await listTransactions(ownerId);

    expect(ownerTransactions).toHaveLength(1);
    expect(ownerTransactions[0]?.description).toBe('OWNER TXN');
  });

  it('filters listTransactions by an inclusive date range', async () => {
    const userId = await insertTestUser('owner@example.com');

    await insertTransactions(userId, [
      { date: '2026-08-01', description: 'BEFORE', amountCents: -1, account: 'a', category: null },
      { date: '2026-09-15', description: 'DURING', amountCents: -1, account: 'a', category: null },
      { date: '2026-10-01', description: 'AFTER', amountCents: -1, account: 'a', category: null },
    ]);

    const result = await listTransactions(userId, { from: '2026-09-01', to: '2026-09-30' });

    expect(result).toHaveLength(1);
    expect(result[0]?.description).toBe('DURING');
  });

  it('orders listTransactions newest first', async () => {
    const userId = await insertTestUser('owner@example.com');

    await insertTransactions(userId, [
      { date: '2026-09-01', description: 'OLDER', amountCents: -1, account: 'a', category: null },
      { date: '2026-09-20', description: 'NEWER', amountCents: -1, account: 'a', category: null },
    ]);

    const result = await listTransactions(userId);

    expect(result.map((t) => t.description)).toEqual(['NEWER', 'OLDER']);
  });

  it('summarizes spend by category within a date range, scoped to the user', async () => {
    const ownerId = await insertTestUser('owner@example.com');
    const otherId = await insertTestUser('other@example.com');

    await insertTransactions(ownerId, [
      { date: '2026-09-05', description: 'A', amountCents: -500, account: 'a', category: 'Food' },
      { date: '2026-09-10', description: 'B', amountCents: -300, account: 'a', category: 'Food' },
      {
        date: '2026-09-12',
        description: 'C',
        amountCents: -700,
        account: 'a',
        category: 'Transport',
      },
      { date: '2026-08-01', description: 'D', amountCents: -900, account: 'a', category: 'Food' },
    ]);
    await insertTransactions(otherId, [
      { date: '2026-09-05', description: 'E', amountCents: -1000, account: 'a', category: 'Food' },
    ]);

    const summary = await summarizeByCategory(ownerId, '2026-09-01', '2026-09-30');

    expect(summary).toEqual(
      expect.arrayContaining([
        { category: 'Food', totalCents: -800 },
        { category: 'Transport', totalCents: -700 },
      ]),
    );
    expect(summary).toHaveLength(2);
  });
});

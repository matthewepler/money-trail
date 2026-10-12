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
        category: 'FOOD_AND_DRINK',
        source: 'chase-csv',
        externalId: null,
      },
    ]);

    expect(stored).toMatchObject({
      date: '2026-09-29',
      description: 'CORNER BAKERY',
      amountCents: -381,
      account: 'chase-checking',
      category: 'FOOD_AND_DRINK',
      source: 'chase-csv',
      externalId: null,
      occurrenceIndex: 1,
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
        source: 'chase-csv',
        externalId: null,
      },
    ]);
    await insertTransactions(otherId, [
      {
        date: '2026-09-29',
        description: 'OTHER TXN',
        amountCents: -200,
        account: 'chase-checking',
        category: null,
        source: 'chase-csv',
        externalId: null,
      },
    ]);

    const ownerTransactions = await listTransactions(ownerId);

    expect(ownerTransactions).toHaveLength(1);
    expect(ownerTransactions[0]?.description).toBe('OWNER TXN');
  });

  it('filters listTransactions by an inclusive date range', async () => {
    const userId = await insertTestUser('owner@example.com');

    await insertTransactions(userId, [
      {
        date: '2026-08-01',
        description: 'BEFORE',
        amountCents: -1,
        account: 'a',
        category: null,
        source: 'chase-csv',
        externalId: null,
      },
      {
        date: '2026-09-15',
        description: 'DURING',
        amountCents: -1,
        account: 'a',
        category: null,
        source: 'chase-csv',
        externalId: null,
      },
      {
        date: '2026-10-01',
        description: 'AFTER',
        amountCents: -1,
        account: 'a',
        category: null,
        source: 'chase-csv',
        externalId: null,
      },
    ]);

    const result = await listTransactions(userId, { from: '2026-09-01', to: '2026-09-30' });

    expect(result).toHaveLength(1);
    expect(result[0]?.description).toBe('DURING');
  });

  it('orders listTransactions newest first', async () => {
    const userId = await insertTestUser('owner@example.com');

    await insertTransactions(userId, [
      {
        date: '2026-09-01',
        description: 'OLDER',
        amountCents: -1,
        account: 'a',
        category: null,
        source: 'chase-csv',
        externalId: null,
      },
      {
        date: '2026-09-20',
        description: 'NEWER',
        amountCents: -1,
        account: 'a',
        category: null,
        source: 'chase-csv',
        externalId: null,
      },
    ]);

    const result = await listTransactions(userId);

    expect(result.map((t) => t.description)).toEqual(['NEWER', 'OLDER']);
  });

  it('summarizes spend by category within a date range, scoped to the user', async () => {
    const ownerId = await insertTestUser('owner@example.com');
    const otherId = await insertTestUser('other@example.com');

    await insertTransactions(ownerId, [
      {
        date: '2026-09-05',
        description: 'A',
        amountCents: -500,
        account: 'a',
        category: 'FOOD_AND_DRINK',
        source: 'chase-csv',
        externalId: null,
      },
      {
        date: '2026-09-10',
        description: 'B',
        amountCents: -300,
        account: 'a',
        category: 'FOOD_AND_DRINK',
        source: 'chase-csv',
        externalId: null,
      },
      {
        date: '2026-09-12',
        description: 'C',
        amountCents: -700,
        account: 'a',
        category: 'TRANSPORTATION',
        source: 'chase-csv',
        externalId: null,
      },
      {
        date: '2026-08-01',
        description: 'D',
        amountCents: -900,
        account: 'a',
        category: 'FOOD_AND_DRINK',
        source: 'chase-csv',
        externalId: null,
      },
    ]);
    await insertTransactions(otherId, [
      {
        date: '2026-09-05',
        description: 'E',
        amountCents: -1000,
        account: 'a',
        category: 'FOOD_AND_DRINK',
        source: 'chase-csv',
        externalId: null,
      },
    ]);

    const summary = await summarizeByCategory(ownerId, '2026-09-01', '2026-09-30');

    expect(summary).toEqual(
      expect.arrayContaining([
        { category: 'FOOD_AND_DRINK', totalCents: -800 },
        { category: 'TRANSPORTATION', totalCents: -700 },
      ]),
    );
    expect(summary).toHaveLength(2);
  });

  describe('pagination', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      date: i < 4 ? '2026-09-20' : '2026-09-10',
      description: `ROW ${i}`,
      amountCents: -100 - i,
      account: 'a',
      category: null,
      source: 'chase-csv',
      externalId: null,
    }));

    it('returns one page at a time with limit and offset', async () => {
      const userId = await insertTestUser('owner@example.com');
      await insertTransactions(userId, rows);

      const page = await listTransactions(userId, { limit: 3, offset: 2 });

      expect(page).toHaveLength(3);
    });

    it('walks every row exactly once, even across rows that share a date', async () => {
      const userId = await insertTestUser('owner@example.com');
      await insertTransactions(userId, rows);

      const seen: string[] = [];
      for (let offset = 0; offset < 9; offset += 3) {
        const page = await listTransactions(userId, { limit: 3, offset });
        seen.push(...page.map((t) => t.id));
      }

      expect(seen).toHaveLength(7);
      expect(new Set(seen).size).toBe(7);
    });

    it('returns everything when no limit is given', async () => {
      const userId = await insertTestUser('owner@example.com');
      await insertTransactions(userId, rows);

      expect(await listTransactions(userId)).toHaveLength(7);
    });
  });

  describe('transaction identity (ADR-0006)', () => {
    const coffee = {
      date: '2026-09-29',
      description: 'COFFEE SHOP',
      amountCents: -350,
      account: 'chase-checking',
      category: 'FOOD_AND_DRINK',
      source: 'chase-csv',
      externalId: null,
    };

    it('assigns sequential occurrence indices to identical rows within one batch', async () => {
      const userId = await insertTestUser('owner@example.com');

      const stored = await insertTransactions(userId, [coffee, coffee, coffee]);

      expect(stored.map((t) => t.occurrenceIndex).sort()).toEqual([1, 2, 3]);
    });

    it('continues occurrence indices against rows already persisted from an earlier import', async () => {
      const userId = await insertTestUser('owner@example.com');

      await insertTransactions(userId, [coffee]);
      const second = await insertTransactions(userId, [coffee]);

      expect(second[0]?.occurrenceIndex).toBe(2);
    });

    it('scopes occurrence indices per user', async () => {
      const ownerId = await insertTestUser('owner@example.com');
      const otherId = await insertTestUser('other@example.com');

      await insertTransactions(ownerId, [coffee]);
      const otherStored = await insertTransactions(otherId, [coffee]);

      expect(otherStored[0]?.occurrenceIndex).toBe(1);
    });

    it('does not mix occurrence indices across different sources', async () => {
      const userId = await insertTestUser('owner@example.com');

      await insertTransactions(userId, [coffee]);
      const otherSource = await insertTransactions(userId, [{ ...coffee, source: 'schwab-csv' }]);

      expect(otherSource[0]?.occurrenceIndex).toBe(1);
    });

    it('stores a provider externalId untouched', async () => {
      const userId = await insertTestUser('owner@example.com');

      const [stored] = await insertTransactions(userId, [
        { ...coffee, source: 'plaid', externalId: 'plaid-txn-123' },
      ]);

      expect(stored?.externalId).toBe('plaid-txn-123');
    });
  });
});

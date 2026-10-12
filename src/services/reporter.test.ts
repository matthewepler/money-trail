import { describe, expect, it } from 'vitest';
import { buildSpendingSummary, getSpendingSummary, type CategoryTotal } from './reporter.js';

const out = (category: string | null, totalCents: number): CategoryTotal => ({
  category,
  direction: 'out',
  totalCents,
});
const inn = (category: string | null, totalCents: number): CategoryTotal => ({
  category,
  direction: 'in',
  totalCents,
});

describe('buildSpendingSummary (ADR-0011)', () => {
  it('sums spending per category and puts the biggest spend first', () => {
    const summary = buildSpendingSummary([
      out('FOOD_AND_DRINK', -800),
      out('TRANSPORTATION', -2000),
      out('BANK_FEES', -100),
    ]);

    expect(summary.categories).toEqual([
      { category: 'TRANSPORTATION', totalCents: -2000 },
      { category: 'FOOD_AND_DRINK', totalCents: -800 },
      { category: 'BANK_FEES', totalCents: -100 },
    ]);
    expect(summary.totalCents).toBe(-2900);
  });

  it('nets a refund against the spending in its own category', () => {
    const summary = buildSpendingSummary([
      out('GENERAL_MERCHANDISE', -5000),
      inn('GENERAL_MERCHANDISE', 1200),
    ]);

    expect(summary.categories).toEqual([{ category: 'GENERAL_MERCHANDISE', totalCents: -3800 }]);
  });

  it('leaves income, loan payments, and inbound transfers out of spending', () => {
    const summary = buildSpendingSummary([
      inn('INCOME', 245000),
      out('LOAN_PAYMENTS', -50000),
      inn('TRANSFER_IN', 90000),
      out('FOOD_AND_DRINK', -800),
    ]);

    expect(summary.categories).toEqual([{ category: 'FOOD_AND_DRINK', totalCents: -800 }]);
    expect(summary.totalCents).toBe(-800);
  });

  it('reports transfers out on their own line, outside the spending total', () => {
    const summary = buildSpendingSummary([
      out('TRANSFER_OUT', -50000),
      out('FOOD_AND_DRINK', -800),
    ]);

    expect(summary.transfersOut).toEqual({ totalCents: -50000 });
    expect(summary.totalCents).toBe(-800);
    expect(summary.categories.map((c) => c.category)).not.toContain('TRANSFER_OUT');
  });

  it('counts uncategorized outflow as spending, under a null category', () => {
    const summary = buildSpendingSummary([out(null, -1890)]);

    expect(summary.categories).toEqual([{ category: null, totalCents: -1890 }]);
    expect(summary.totalCents).toBe(-1890);
  });

  it('does not let uncategorized inflow reduce spending', () => {
    const summary = buildSpendingSummary([out(null, -1890), inn(null, 100000)]);

    expect(summary.categories).toEqual([{ category: null, totalCents: -1890 }]);
  });

  it('keeps a category it does not recognize rather than dropping it', () => {
    const summary = buildSpendingSummary([out('SOME_FUTURE_CATEGORY', -700)]);

    expect(summary.categories).toEqual([{ category: 'SOME_FUTURE_CATEGORY', totalCents: -700 }]);
  });

  it('omits a category that nets to zero', () => {
    const summary = buildSpendingSummary([out('FOOD_AND_DRINK', -500), inn('FOOD_AND_DRINK', 500)]);

    expect(summary.categories).toEqual([]);
  });

  it('is all zeros for an empty period', () => {
    expect(buildSpendingSummary([])).toEqual({
      categories: [],
      totalCents: 0,
      transfersOut: { totalCents: 0 },
    });
  });
});

describe('getSpendingSummary', () => {
  it('asks the repository for the signed-in user and range, then classifies', async () => {
    const calls: unknown[][] = [];
    const sumByCategoryAndDirection = async (...args: unknown[]) => {
      calls.push(args);
      return [out('FOOD_AND_DRINK', -800)];
    };

    const summary = await getSpendingSummary({ sumByCategoryAndDirection }, 'user-1', {
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(calls).toEqual([['user-1', '2026-09-01', '2026-09-30']]);
    expect(summary.totalCents).toBe(-800);
  });
});

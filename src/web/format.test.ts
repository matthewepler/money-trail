import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatSpend } from './format.js';

describe('formatMoney', () => {
  it('formats integer cents as dollars, with grouping', () => {
    expect(formatMoney(475)).toBe('$4.75');
    expect(formatMoney(245000)).toBe('$2,450.00');
    expect(formatMoney(123456789)).toBe('$1,234,567.89');
  });

  it('keeps the sign of money out', () => {
    expect(formatMoney(-475)).toBe('-$4.75');
  });

  it('can show money in with a plus sign, for the ledger', () => {
    expect(formatMoney(245000, { signed: true })).toBe('+$2,450.00');
    expect(formatMoney(-475, { signed: true })).toBe('-$4.75');
  });

  it('shows zero as plain $0.00, never negative zero', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(-0)).toBe('$0.00');
    expect(formatMoney(0, { signed: true })).toBe('$0.00');
  });

  it('does not drift on cents that are awkward in floating point', () => {
    expect(formatMoney(1005)).toBe('$10.05');
    expect(formatMoney(29)).toBe('$0.29');
    expect(formatMoney(-1)).toBe('-$0.01');
  });
});

describe('formatSpend', () => {
  it('shows signed cents as a positive amount spent — the one place the sign flips', () => {
    expect(formatSpend(-95000)).toBe('$950.00');
    expect(formatSpend(-1)).toBe('$0.01');
  });

  it('shows no spending as $0.00, not negative zero', () => {
    expect(formatSpend(0)).toBe('$0.00');
  });

  it('shows a net refund as a negative amount spent', () => {
    expect(formatSpend(500)).toBe('-$5.00');
  });
});

describe('formatDate', () => {
  it('formats an ISO date without letting the time zone move the day', () => {
    expect(formatDate('2026-09-28')).toBe('Sep 28, 2026');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDate('2026-12-31')).toBe('Dec 31, 2026');
  });
});

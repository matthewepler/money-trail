import { describe, expect, it } from 'vitest';
import { currentMonthRange } from './dateRange.js';

describe('currentMonthRange', () => {
  it('spans the first to the last day of the month containing the date', () => {
    expect(currentMonthRange(new Date(2026, 9, 15))).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('handles short months, leap years, and December', () => {
    expect(currentMonthRange(new Date(2026, 1, 3))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(currentMonthRange(new Date(2028, 1, 3))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    expect(currentMonthRange(new Date(2026, 11, 31))).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });

  it('uses the local calendar day, so late on the last evening is still that month', () => {
    expect(currentMonthRange(new Date(2026, 8, 30, 23, 59))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });
});

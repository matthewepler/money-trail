import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './category.js';

describe('CATEGORIES', () => {
  it('holds the 16 Plaid PFC primaries, each unique and SCREAMING_SNAKE', () => {
    expect(CATEGORIES).toHaveLength(16);
    expect(new Set(CATEGORIES).size).toBe(16);
    for (const category of CATEGORIES) {
      expect(category).toMatch(/^[A-Z]+(_[A-Z]+)*$/);
    }
  });
});

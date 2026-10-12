import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../domain/category.js';
import { categoryLabel } from './categoryLabels.js';

describe('categoryLabel', () => {
  it('gives every known category a readable label, not its constant', () => {
    for (const category of CATEGORIES) {
      const label = categoryLabel(category);
      expect(label).not.toBe(category);
      expect(label).not.toMatch(/_/);
      expect(label.length).toBeGreaterThan(2);
    }
  });

  it('uses the wording we chose for the common ones', () => {
    expect(categoryLabel('FOOD_AND_DRINK')).toBe('Food & drink');
    expect(categoryLabel('RENT_AND_UTILITIES')).toBe('Rent & utilities');
  });

  it('calls a missing category Uncategorized', () => {
    expect(categoryLabel(null)).toBe('Uncategorized');
  });

  it('makes a readable label for a category added later, instead of showing nothing', () => {
    expect(categoryLabel('SOME_FUTURE_CATEGORY')).toBe('Some future category');
  });
});

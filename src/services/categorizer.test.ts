import { describe, expect, it } from 'vitest';
import { categorize, type CategoryRule } from './categorizer.js';

const rules: CategoryRule[] = [
  { category: 'INCOME', patterns: [/\bpayroll\b/i], direction: 'in' },
  { category: 'TRANSFER_OUT', patterns: [/\bvenmo\b/i], direction: 'out' },
  { category: 'TRANSFER_IN', patterns: [/\bvenmo\b/i], direction: 'in' },
  { category: 'FOOD_AND_DRINK', patterns: [/\bbakery\b/i, /\bcoffee\b/i] },
  { category: 'GENERAL_MERCHANDISE', patterns: [/\bbak/i] },
];

const spend = (description: string) => categorize({ description, amountCents: -500 }, rules);

describe('categorize', () => {
  it('returns the category of the first rule that matches', () => {
    expect(spend('CORNER BAKERY')).toBe('FOOD_AND_DRINK');
  });

  it('lets an earlier rule win when a later one also matches', () => {
    // GENERAL_MERCHANDISE would match /bak/ too, but FOOD_AND_DRINK is listed first.
    expect(spend('BAKERY')).toBe('FOOD_AND_DRINK');
  });

  it('matches if any one of a rule’s patterns matches', () => {
    expect(spend('BLUE BOTTLE COFFEE')).toBe('FOOD_AND_DRINK');
  });

  it('returns null, not a catch-all, when nothing matches', () => {
    expect(spend('SOMETHING UNRECOGNIZED')).toBeNull();
  });

  it('returns null when there are no rules', () => {
    expect(categorize({ description: 'COFFEE', amountCents: -500 }, [])).toBeNull();
  });

  it('applies a rule marked "in" only to money coming in', () => {
    expect(categorize({ description: 'ACME PAYROLL', amountCents: 245000 }, rules)).toBe('INCOME');
    expect(categorize({ description: 'ACME PAYROLL', amountCents: -245000 }, rules)).toBeNull();
  });

  it('chooses between same-pattern rules by direction', () => {
    expect(categorize({ description: 'VENMO', amountCents: -2000 }, rules)).toBe('TRANSFER_OUT');
    expect(categorize({ description: 'VENMO', amountCents: 2000 }, rules)).toBe('TRANSFER_IN');
  });

  it('does not apply a directional rule to a zero amount', () => {
    expect(categorize({ description: 'VENMO', amountCents: 0 }, rules)).toBeNull();
  });

  it('applies a rule without a direction to zero amounts too', () => {
    expect(categorize({ description: 'COFFEE', amountCents: 0 }, rules)).toBe('FOOD_AND_DRINK');
  });

  it('gives the same answer repeatedly for a global-flag pattern', () => {
    const globalRules: CategoryRule[] = [{ category: 'MEDICAL', patterns: [/pharmacy/gi] }];
    const transaction = { description: 'CITY PHARMACY', amountCents: -100 };

    expect(categorize(transaction, globalRules)).toBe('MEDICAL');
    expect(categorize(transaction, globalRules)).toBe('MEDICAL');
  });
});

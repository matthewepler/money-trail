import { describe, expect, it } from 'vitest';
import { CATEGORIES, type Category } from '../domain/category.js';
import { categorize } from './categorizer.js';
import { DEFAULT_CATEGORY_RULES } from './categoryRules.js';

describe('DEFAULT_CATEGORY_RULES', () => {
  it('only assigns known categories', () => {
    for (const rule of DEFAULT_CATEGORY_RULES) {
      expect(CATEGORIES).toContain(rule.category);
    }
  });

  it('has patterns that are case-insensitive and cannot match an empty description', () => {
    for (const rule of DEFAULT_CATEGORY_RULES) {
      expect(rule.patterns.length).toBeGreaterThan(0);
      for (const pattern of rule.patterns) {
        expect(pattern.flags).toContain('i');
        expect(''.search(pattern)).toBe(-1);
      }
    }
  });

  const cases: [string, number, Category | null][] = [
    ['POS DEBIT CORNER BAKERY BROOKLYN NY 1234', -475, 'FOOD_AND_DRINK'],
    ['TST*EXAMPLE THAI KITCHEN', -9238, 'FOOD_AND_DRINK'],
    ['STARBUCKS STORE 12345', -650, 'FOOD_AND_DRINK'],
    ['UBER EATS HELP.UBER.COM', -2310, 'FOOD_AND_DRINK'],
    ['UBER TRIP HELP.UBER.COM', -1450, 'TRANSPORTATION'],
    ['SHELL OIL 57444', -4210, 'TRANSPORTATION'],
    ['AMTRAK TICKET', -8900, 'TRAVEL'],
    ['DELTA AIRLINES', -31200, 'TRAVEL'],
    ['NETFLIX.COM', -1549, 'ENTERTAINMENT'],
    ['AMZN MKTP US*2A1B3C', -2999, 'GENERAL_MERCHANDISE'],
    ['AMAZON.COM REFUND', 2999, 'GENERAL_MERCHANDISE'],
    ['THE HOME DEPOT #1234', -5600, 'HOME_IMPROVEMENT'],
    ['CVS/PHARMACY #0123', -1200, 'MEDICAL'],
    ['MAIN STREET BARBER', -5000, 'PERSONAL_CARE'],
    ['PLANET FITNESS', -1000, 'PERSONAL_CARE'],
    ['NYC DMV', -3000, 'GOVERNMENT_AND_NON_PROFIT'],
    ['GEICO AUTO INSURANCE', -12000, 'GENERAL_SERVICES'],
    ['VERIZON WIRELESS PAYMENTS', -8000, 'RENT_AND_UTILITIES'],
    ['RENT PAYMENT', -200000, 'RENT_AND_UTILITIES'],
    ['CHASE CREDIT CRD AUTOPAY', -50000, 'LOAN_PAYMENTS'],
    ['MONTHLY SERVICE FEE', -1200, 'BANK_FEES'],
    ['OVERDRAFT FEE', -3400, 'BANK_FEES'],
    ['ORIG CO NAME:ACME PAYROLL CO ENTRY DESCR:PAYROLL SEC:PPD', 245000, 'INCOME'],
    ['Online Transfer to SAV ...1234 transaction#: 000000000', -50000, 'TRANSFER_OUT'],
    ['Online Transfer from CHK ...5678 transaction#: 000000000', 50000, 'TRANSFER_IN'],
    ['ATM WITHDRAWAL 123 MAIN ST', -6000, 'TRANSFER_OUT'],
    ['Zelle payment to JANE DOE 1234567', -4000, 'TRANSFER_OUT'],
    ['Zelle payment from JANE DOE 1234567', 4000, 'TRANSFER_IN'],
    ['VENMO PAYMENT 1234', -1500, 'TRANSFER_OUT'],
    ['VENMO CASHOUT 1234', 1500, 'TRANSFER_IN'],
    ['REMOTE ONLINE DEPOSIT', 10000, 'TRANSFER_IN'],
    ['NON-CHASE ATM FEE-WITH', -300, 'BANK_FEES'],
    ['NON-CHASE ATM WITHDRAW', -6000, 'TRANSFER_OUT'],
    ['WIRE REVERSAL RETURNED INSUFFICIENT FUNDS', 103000, 'TRANSFER_IN'],
    ['MONTHLY SERVICE FEE REFUND', 1200, null],
    ['Payment to Chase card ending in 1234', -50000, 'LOAN_PAYMENTS'],
    ['FIDELITY INVESTMENTS', -100000, 'TRANSFER_OUT'],
    ['FIDELITY INVESTMENTS', 100000, 'TRANSFER_IN'],
    ['EXAMPLE BANK TRANSFER', -5000, 'TRANSFER_OUT'],
    ['SHOPRITE STORE S1', -4500, 'FOOD_AND_DRINK'],
    ['DOLLAR GENERAL #123', -1200, 'GENERAL_MERCHANDISE'],
    ['MARKET, INC. #12 "DOWNTOWN"', -1890, null],
    ['CHECK 1042', -12500, null],
    ['CURRENT BALANCE ADJUSTMENT', -100, null],
  ];

  it.each(cases)('categorizes %j (%d cents) as %s', (description, amountCents, expected) => {
    expect(categorize({ description, amountCents }, DEFAULT_CATEGORY_RULES)).toBe(expected);
  });
});

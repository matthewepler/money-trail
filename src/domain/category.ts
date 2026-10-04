// Plaid Personal Finance Category (PFCv1) primaries, verified against Plaid's published
// taxonomy on 2026-10-03 (ADR-0005). Stored verbatim; labels live in src/web/ only.
export const CATEGORIES = [
  'INCOME',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'LOAN_PAYMENTS',
  'BANK_FEES',
  'ENTERTAINMENT',
  'FOOD_AND_DRINK',
  'GENERAL_MERCHANDISE',
  'HOME_IMPROVEMENT',
  'MEDICAL',
  'PERSONAL_CARE',
  'GENERAL_SERVICES',
  'GOVERNMENT_AND_NON_PROFIT',
  'TRANSPORTATION',
  'TRAVEL',
  'RENT_AND_UTILITIES',
] as const;

export type Category = (typeof CATEGORIES)[number];

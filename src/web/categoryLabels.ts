import type { Category } from '../domain/category.js';

// Labels live here and nowhere else: the database and rule files hold only the constants
// (ADR-0005). Typing this as Record<Category, string> makes a new category without a label
// a compile error.
const LABELS: Record<Category, string> = {
  INCOME: 'Income',
  TRANSFER_IN: 'Transfers in',
  TRANSFER_OUT: 'Transfers out',
  LOAN_PAYMENTS: 'Loan payments',
  BANK_FEES: 'Bank fees',
  ENTERTAINMENT: 'Entertainment',
  FOOD_AND_DRINK: 'Food & drink',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Home improvement',
  MEDICAL: 'Medical',
  PERSONAL_CARE: 'Personal care',
  GENERAL_SERVICES: 'Services',
  GOVERNMENT_AND_NON_PROFIT: 'Government & non-profit',
  TRANSPORTATION: 'Transportation',
  TRAVEL: 'Travel',
  RENT_AND_UTILITIES: 'Rent & utilities',
};

function isKnown(category: string): category is Category {
  return category in LABELS;
}

// A category Plaid adds later is stored verbatim, so show it readably rather than as nothing.
function humanize(constant: string): string {
  const words = constant.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function categoryLabel(category: string | null): string {
  if (category === null) return 'Uncategorized';
  return isKnown(category) ? LABELS[category] : humanize(category);
}

// Money is integer cents everywhere else; it becomes dollars here, at the edge, and nowhere
// else. Dividing by 100 is safe for display: Intl rounds to two decimals.

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signedMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  signDisplay: 'exceptZero',
});
const date = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatMoney(cents: number, options: { signed?: boolean } = {}): string {
  // `cents === 0 ? 0 : cents` turns -0 into 0, which Intl would otherwise print as "-$0.00".
  const dollars = (cents === 0 ? 0 : cents) / 100;
  return (options.signed ? signedMoney : money).format(dollars);
}

/**
 * Totals arrive signed — negative is money out (ADR-0004). Spending is shown as a positive
 * amount, and this is the one place the sign is flipped.
 */
export function formatSpend(totalCents: number): string {
  return formatMoney(-totalCents);
}

/** An ISO date ('2026-09-28'), formatted without the time zone shifting the day. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return date.format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
}

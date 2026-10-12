const pad = (n: number) => String(n).padStart(2, '0');

/** First to last day of the month containing `today`, as ISO dates, in the local calendar. */
export function currentMonthRange(today: Date): { from: string; to: string } {
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prefix = `${year}-${pad(month + 1)}`;
  return { from: `${prefix}-01`, to: `${prefix}-${pad(lastDay)}` };
}

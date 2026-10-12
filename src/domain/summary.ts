export type SpendingSummary = {
  /**
   * Spending per category, biggest first. Signed cents — negative is money out (ADR-0004);
   * the view flips the sign, once. A null category is uncategorized.
   */
  categories: { category: string | null; totalCents: number }[];
  totalCents: number;
  /** Transfers out, apart from the total until they can be matched to a deposit (ADR-0011). */
  transfersOut: { totalCents: number };
};

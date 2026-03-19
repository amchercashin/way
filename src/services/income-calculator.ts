export function calcAssetIncomePerYear(
  quantity: number,
  paymentAmount: number,
  frequencyPerYear: number,
): number {
  const result = quantity * paymentAmount * frequencyPerYear;
  return isFinite(result) ? result : 0;
}

export function calcAssetIncomePerMonth(
  quantity: number,
  paymentAmount: number,
  frequencyPerYear: number,
): number {
  return calcAssetIncomePerYear(quantity, paymentAmount, frequencyPerYear) / 12;
}

interface IncomeItem {
  quantity: number;
  paymentAmount: number;
  frequencyPerYear: number;
}

export function calcPortfolioIncome(items: IncomeItem[]): {
  perYear: number;
  perMonth: number;
} {
  const perYear = items.reduce(
    (sum, item) =>
      sum + calcAssetIncomePerYear(item.quantity, item.paymentAmount, item.frequencyPerYear),
    0,
  );
  return { perYear, perMonth: perYear / 12 };
}

export function calcYieldPercent(annualIncome: number, portfolioValue: number): number {
  if (portfolioValue === 0) return 0;
  return (annualIncome / portfolioValue) * 100;
}

export interface PaymentRecord {
  amount: number;
  date: Date;
}

export function calcCAGR(
  history: PaymentRecord[],
  now: Date = new Date(),
): number | null {
  if (history.length === 0) return null;
  const currentYear = now.getFullYear();
  const byYear = new Map<number, number>();
  for (const p of history) {
    const year = p.date.getFullYear();
    if (year >= currentYear) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + p.amount);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  if (years.length === 0) return null;
  const firstYear = years[0];
  const lastYear = currentYear - 1; // always last full calendar year
  if (lastYear <= firstYear) return null;
  const incomeFirst = byYear.get(firstYear)!;
  const incomeLast = byYear.get(lastYear) ?? 0;
  if (incomeFirst <= 0 || incomeLast <= 0) return null;
  const span = lastYear - firstYear;
  return (Math.pow(incomeLast / incomeFirst, 1 / span) - 1) * 100;
}

/**
 * Calculates per-unit payment amount from payment history.
 * For monthly payers (freq >= 12): returns the most recent payment.
 * For less frequent payers: returns sum of last 12 months / frequencyPerYear.
 */
export function calcFactPaymentPerUnit(
  history: PaymentRecord[],
  frequencyPerYear: number,
  now: Date = new Date(),
): number {
  if (history.length === 0) return 0;

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  if (frequencyPerYear >= 12) {
    const recent = history
      .filter((p) => p.date > twelveMonthsAgo && p.date <= now)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return recent.length > 0 ? recent[0].amount : 0;
  }

  const sum = history
    .filter((p) => p.date > twelveMonthsAgo && p.date <= now)
    .reduce((acc, p) => acc + p.amount, 0);
  if (sum === 0) return 0;
  if (frequencyPerYear <= 0) return 0;
  return sum / frequencyPerYear;
}

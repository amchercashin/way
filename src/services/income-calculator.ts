export function calcAssetIncomePerYear(
  quantity: number,
  annualIncomePerUnit: number,
): number {
  const result = quantity * annualIncomePerUnit;
  return isFinite(result) ? result : 0;
}

export function calcAssetIncomePerMonth(
  quantity: number,
  annualIncomePerUnit: number,
): number {
  return calcAssetIncomePerYear(quantity, annualIncomePerUnit) / 12;
}

interface IncomeItem {
  quantity: number;
  annualIncome: number;
}

export function calcPortfolioIncome(items: IncomeItem[]): {
  perYear: number;
  perMonth: number;
} {
  const perYear = items.reduce(
    (sum, item) =>
      sum + calcAssetIncomePerYear(item.quantity, item.annualIncome),
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

export interface AnnualIncomeResult {
  annualIncome: number;
  usedPayments: PaymentRecord[];
}

export function calcAnnualIncomePerUnit(
  history: PaymentRecord[],
  now: Date = new Date(),
): AnnualIncomeResult {
  const empty = { annualIncome: 0, usedPayments: [] as PaymentRecord[] };
  if (history.length === 0) return empty;

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const usedPayments = history
    .filter(p => p.date >= twelveMonthsAgo)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (usedPayments.length === 0) return empty;

  const annualIncome = usedPayments.reduce((sum, p) => sum + p.amount, 0);
  return { annualIncome, usedPayments };
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

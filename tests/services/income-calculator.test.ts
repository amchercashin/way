import { describe, it, expect } from 'vitest';
import {
  calcAssetIncomePerYear,
  calcAssetIncomePerMonth,
  calcPortfolioIncome,
  calcYieldPercent,
  calcCAGR,
  calcAnnualIncomePerUnit,
} from '@/services/income-calculator';

describe('income-calculator', () => {
  describe('calcAnnualIncomePerUnit', () => {
    it('sums all payments within 12-month window', () => {
      const history = [
        { amount: 514, date: new Date('2025-07-08') },
        { amount: 793, date: new Date('2025-12-20') },
        { amount: 400, date: new Date('2025-04-10') },
      ];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(514 + 793 + 400);
      expect(result.usedPayments).toHaveLength(3);
    });

    it('excludes payments older than 12 months', () => {
      const history = [
        { amount: 100, date: new Date('2025-01-01') }, // > 12 months ago
        { amount: 200, date: new Date('2025-06-01') }, // within window
        { amount: 300, date: new Date('2026-01-01') }, // within window
      ];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(500);
      expect(result.usedPayments).toHaveLength(2);
    });

    it('returns 0 for empty history', () => {
      const result = calcAnnualIncomePerUnit([], new Date('2026-03-16'));
      expect(result.annualIncome).toBe(0);
      expect(result.usedPayments).toHaveLength(0);
    });

    it('returns 0 when all payments are older than 12 months', () => {
      const history = [
        { amount: 100, date: new Date('2024-01-01') },
        { amount: 200, date: new Date('2024-06-01') },
      ];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(0);
      expect(result.usedPayments).toHaveLength(0);
    });

    it('boundary: payment exactly 12 months ago is included', () => {
      const now = new Date('2026-03-16');
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const history = [{ amount: 50, date: twelveMonthsAgo }];
      const result = calcAnnualIncomePerUnit(history, now);
      expect(result.annualIncome).toBe(50);
    });

    it('boundary: payment one day before 12-month window is excluded', () => {
      const now = new Date('2026-03-16');
      const justOutside = new Date('2025-03-15');
      const history = [{ amount: 50, date: justOutside }];
      const result = calcAnnualIncomePerUnit(history, now);
      expect(result.annualIncome).toBe(0);
    });

    it('usedPayments sorted descending by date', () => {
      const history = [
        { amount: 10, date: new Date('2025-06-01') },
        { amount: 20, date: new Date('2026-01-01') },
        { amount: 15, date: new Date('2025-09-01') },
      ];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.usedPayments[0].date.getTime()).toBeGreaterThan(
        result.usedPayments[1].date.getTime(),
      );
      expect(result.usedPayments[1].date.getTime()).toBeGreaterThan(
        result.usedPayments[2].date.getTime(),
      );
    });

    it('handles single payment within window', () => {
      const history = [{ amount: 186, date: new Date('2025-07-15') }];
      const result = calcAnnualIncomePerUnit(history, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(186);
      expect(result.usedPayments).toHaveLength(1);
    });

    it('includes many payments within window regardless of count', () => {
      const payments = Array.from({ length: 14 }, (_, i) => ({
        amount: 100,
        date: new Date(2025, 6 + i, 1), // Jul 2025 .. Aug 2026
      }));
      const result = calcAnnualIncomePerUnit(payments, new Date('2026-06-15'));
      const inWindow = payments.filter(p => p.date >= new Date(2025, 5, 15));
      expect(result.annualIncome).toBe(inWindow.length * 100);
      expect(result.usedPayments).toHaveLength(inWindow.length);
    });
  });

  describe('calcAssetIncomePerYear', () => {
    it('calculates annual income from quantity and annualIncomePerUnit', () => {
      expect(calcAssetIncomePerYear(800, 186)).toBe(148800);
    });

    it('returns 0 for NaN quantity', () => {
      expect(calcAssetIncomePerYear(NaN, 186)).toBe(0);
    });

    it('returns 0 for NaN annualIncomePerUnit', () => {
      expect(calcAssetIncomePerYear(800, NaN)).toBe(0);
    });

    it('returns 0 for Infinity quantity', () => {
      expect(calcAssetIncomePerYear(Infinity, 186)).toBe(0);
    });
  });

  describe('calcAssetIncomePerMonth', () => {
    it('normalizes yearly income to monthly', () => {
      expect(calcAssetIncomePerMonth(800, 186)).toBeCloseTo(12400, 0);
    });

    it('returns 0 for NaN inputs', () => {
      expect(calcAssetIncomePerMonth(NaN, 186)).toBe(0);
    });
  });

  describe('calcPortfolioIncome', () => {
    it('sums annual income across multiple assets', () => {
      const items = [
        { quantity: 800, annualIncome: 186 },
        { quantity: 500, annualIncome: 73.8 },
        { quantity: 1, annualIncome: 540000 },
      ];
      const result = calcPortfolioIncome(items);
      expect(result.perYear).toBeCloseTo(725700, 0);
      expect(result.perMonth).toBeCloseTo(60475, 0);
    });
    it('returns zero for empty portfolio', () => {
      const result = calcPortfolioIncome([]);
      expect(result.perYear).toBe(0);
      expect(result.perMonth).toBe(0);
    });
  });

  describe('calcYieldPercent', () => {
    it('calculates yield from income and portfolio value', () => {
      expect(calcYieldPercent(725700, 8200000)).toBeCloseTo(8.85, 1);
    });
    it('returns 0 when portfolio value is 0', () => {
      expect(calcYieldPercent(100000, 0)).toBe(0);
    });
  });

  describe('calcCAGR (calendar-year, to last full year)', () => {
    it('calculates CAGR from first data year to last full year', () => {
      // Data in 2021, 2023, 2025; now=2026 → last full year = 2025
      const history = [
        { amount: 10, date: new Date('2021-07-01') },
        { amount: 12, date: new Date('2023-07-01') },
        { amount: 15, date: new Date('2025-07-01') },
      ];
      // CAGR = (15/10)^(1/4) - 1 = 10.67%
      const result = calcCAGR(history, new Date('2026-03-16'));
      expect(result).toBeCloseTo(10.67, 0);
    });
    it('returns null for payments in only one year', () => {
      const history = [
        { amount: 10, date: new Date('2023-01-01') },
        { amount: 20, date: new Date('2023-06-01') },
      ];
      expect(calcCAGR(history, new Date('2024-03-16'))).toBeNull();
    });
    it('returns null when first year income is 0', () => {
      const history = [
        { amount: 0, date: new Date('2021-07-01') },
        { amount: 15, date: new Date('2025-07-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('excludes current year from calculation', () => {
      const history = [
        { amount: 10, date: new Date('2025-07-01') },
        { amount: 20, date: new Date('2026-01-15') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('returns null when last full year has zero income', () => {
      // Data only in 2022, now=2026 → last full year=2025, income=0 → null
      const history = [
        { amount: 10, date: new Date('2022-06-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('returns null when data stops before last full year', () => {
      // Data in 2020 and 2022, now=2026 → last full year=2025, income=0 → null
      const history = [
        { amount: 10, date: new Date('2020-06-01') },
        { amount: 20, date: new Date('2022-06-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('handles data spanning to last full year', () => {
      // Data in 2020 and 2025, now=2026 → span=5
      const history = [
        { amount: 10, date: new Date('2020-06-01') },
        { amount: 20, date: new Date('2025-06-01') },
      ];
      // CAGR = (20/10)^(1/5) - 1 = 14.87%
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeCloseTo(14.87, 0);
    });
  });

  describe('NaN/Infinity guards', () => {
    it('calcYieldPercent returns finite number for large values', () => {
      const result = calcYieldPercent(1e15, 1e16);
      expect(isFinite(result)).toBe(true);
    });
  });
});

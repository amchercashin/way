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
    it('Lukoil (freq=2): sums last 2 payments', () => {
      const history = [
        { amount: 514, date: new Date('2025-07-08') },
        { amount: 793, date: new Date('2025-12-20') },
        { amount: 400, date: new Date('2024-07-10') },
      ];
      const result = calcAnnualIncomePerUnit(history, 2, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(1307);
      expect(result.usedPayments).toHaveLength(2);
    });

    it('bond (freq=4): sums last 4 coupons', () => {
      const history = [
        { amount: 30, date: new Date('2025-06-01') },
        { amount: 30, date: new Date('2025-09-01') },
        { amount: 30, date: new Date('2025-12-01') },
        { amount: 30, date: new Date('2026-03-01') },
      ];
      const result = calcAnnualIncomePerUnit(history, 4, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(120);
    });

    it('annual stock (freq=1): takes last 1 payment', () => {
      const history = [
        { amount: 186, date: new Date('2025-07-15') },
        { amount: 150, date: new Date('2024-07-15') },
      ];
      const result = calcAnnualIncomePerUnit(history, 1, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(186);
    });

    it('monthly rent (freq=12): sums last 12 payments', () => {
      const payments = Array.from({ length: 14 }, (_, i) => ({
        amount: 45000,
        date: new Date(2025, 3 + i, 1), // Apr 2025 .. May 2026
      }));
      const result = calcAnnualIncomePerUnit(payments, 12, new Date('2026-06-15'));
      expect(result.annualIncome).toBe(540000);
      expect(result.usedPayments).toHaveLength(12);
    });

    it('returns 0 for empty history', () => {
      const result = calcAnnualIncomePerUnit([], 2, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(0);
      expect(result.usedPayments).toHaveLength(0);
    });

    it('returns 0 when latest payment is stale (>18 months ago)', () => {
      const history = [{ amount: 100, date: new Date('2024-01-01') }];
      const result = calcAnnualIncomePerUnit(history, 1, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(0);
    });

    it('returns 0 for freq=0', () => {
      const history = [{ amount: 100, date: new Date('2025-09-01') }];
      const result = calcAnnualIncomePerUnit(history, 0, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(0);
    });

    it('returns 0 for negative freq', () => {
      const history = [{ amount: 100, date: new Date('2025-09-01') }];
      const result = calcAnnualIncomePerUnit(history, -1, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(0);
    });

    it('fewer payments than freq: takes what is available', () => {
      const history = [{ amount: 36.9, date: new Date('2025-09-01') }];
      const result = calcAnnualIncomePerUnit(history, 2, new Date('2026-03-16'));
      expect(result.annualIncome).toBe(36.9);
      expect(result.usedPayments).toHaveLength(1);
    });

    it('boundary: exactly 18 months ago is NOT stale', () => {
      const now = new Date('2026-03-16');
      const eighteenMonthsAgo = new Date(now);
      eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
      // eighteenMonthsAgo = 2024-09-16
      const history = [{ amount: 50, date: eighteenMonthsAgo }];
      const result = calcAnnualIncomePerUnit(history, 1, now);
      expect(result.annualIncome).toBe(50);
    });

    it('usedPayments sorted descending by date', () => {
      const history = [
        { amount: 10, date: new Date('2025-06-01') },
        { amount: 20, date: new Date('2026-01-01') },
        { amount: 15, date: new Date('2025-09-01') },
      ];
      const result = calcAnnualIncomePerUnit(history, 3, new Date('2026-03-16'));
      expect(result.usedPayments[0].date.getTime()).toBeGreaterThan(
        result.usedPayments[1].date.getTime(),
      );
      expect(result.usedPayments[1].date.getTime()).toBeGreaterThan(
        result.usedPayments[2].date.getTime(),
      );
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
      expect(result.perYear).toBeCloseTo(688700, 0);
      expect(result.perMonth).toBeCloseTo(57391.67, 0);
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

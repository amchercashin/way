import { describe, it, expect } from 'vitest';
import {
  calcAssetIncomePerYear,
  calcAssetIncomePerMonth,
  calcPortfolioIncome,
  calcYieldPercent,
  calcCAGR,
  calcFactPaymentPerUnit,
} from '@/services/income-calculator';

describe('income-calculator', () => {
  describe('calcAssetIncomePerYear', () => {
    it('calculates annual income for stock with 1x/year dividend', () => {
      expect(calcAssetIncomePerYear(800, 186, 1)).toBe(148800);
    });
    it('calculates annual income for bond with 2x/year coupon', () => {
      expect(calcAssetIncomePerYear(500, 36.9, 2)).toBe(36900);
    });
    it('calculates annual income for monthly rent (quantity=1)', () => {
      expect(calcAssetIncomePerYear(1, 45000, 12)).toBe(540000);
    });
  });

  describe('calcAssetIncomePerMonth', () => {
    it('normalizes yearly dividend to monthly', () => {
      expect(calcAssetIncomePerMonth(800, 186, 1)).toBeCloseTo(12400, 0);
    });
  });

  describe('calcPortfolioIncome', () => {
    it('sums normalized income across multiple assets', () => {
      const items = [
        { quantity: 800, paymentAmount: 186, frequencyPerYear: 1 },
        { quantity: 500, paymentAmount: 36.9, frequencyPerYear: 2 },
        { quantity: 1, paymentAmount: 45000, frequencyPerYear: 12 },
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
    it('calcAssetIncomePerYear returns 0 for NaN paymentAmount', () => {
      expect(calcAssetIncomePerYear(800, NaN, 1)).toBe(0);
    });

    it('calcAssetIncomePerYear returns 0 for NaN quantity', () => {
      expect(calcAssetIncomePerYear(NaN, 186, 1)).toBe(0);
    });

    it('calcAssetIncomePerYear returns 0 for NaN frequency', () => {
      expect(calcAssetIncomePerYear(800, 186, NaN)).toBe(0);
    });

    it('calcFactPaymentPerUnit returns 0 for frequencyPerYear=0', () => {
      const history = [{ amount: 36.9, date: new Date('2025-09-01') }];
      expect(calcFactPaymentPerUnit(history, 0, new Date('2026-03-16'))).toBe(0);
    });

    it('calcFactPaymentPerUnit returns 0 for negative frequency', () => {
      const history = [{ amount: 36.9, date: new Date('2025-09-01') }];
      expect(calcFactPaymentPerUnit(history, -1, new Date('2026-03-16'))).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('calcAssetIncomePerYear returns 0 for Infinity quantity', () => {
      expect(calcAssetIncomePerYear(Infinity, 186, 1)).toBe(0);
    });

    it('calcAssetIncomePerMonth returns 0 for NaN inputs', () => {
      expect(calcAssetIncomePerMonth(NaN, 186, 1)).toBe(0);
    });

    it('calcFactPaymentPerUnit handles single payment with freq=2 (halved)', () => {
      // Only 1 of 2 expected payments in window — returns sum/2
      const history = [{ amount: 36.9, date: new Date('2025-09-01') }];
      const result = calcFactPaymentPerUnit(history, 2, new Date('2026-03-16'));
      expect(result).toBe(18.45);
    });

    it('calcYieldPercent returns finite number for large values', () => {
      const result = calcYieldPercent(1e15, 1e16);
      expect(isFinite(result)).toBe(true);
    });
  });

  describe('calcFactPaymentPerUnit', () => {
    it('for yearly (freq=1): sum of last 12 months / 1', () => {
      const history = [
        { amount: 186, date: new Date('2025-07-15') },
        { amount: 150, date: new Date('2024-01-01') },
      ];
      const result = calcFactPaymentPerUnit(history, 1, new Date('2026-03-16'));
      expect(result).toBe(186);
    });
    it('for semi-annual (freq=2): sum of last 12 months / 2', () => {
      const history = [
        { amount: 36.9, date: new Date('2025-09-01') },
        { amount: 36.9, date: new Date('2025-03-20') },
      ];
      const result = calcFactPaymentPerUnit(history, 2, new Date('2026-03-16'));
      expect(result).toBe(36.9);
    });
    it('for quarterly (freq=4): sum of last 12 months / 4', () => {
      const history = [
        { amount: 10, date: new Date('2025-06-01') },
        { amount: 12, date: new Date('2025-09-01') },
        { amount: 11, date: new Date('2025-12-01') },
        { amount: 13, date: new Date('2026-03-01') },
      ];
      const result = calcFactPaymentPerUnit(history, 4, new Date('2026-03-16'));
      expect(result).toBe(11.5);
    });
    it('for monthly (freq>=12): returns last payment', () => {
      const history = [
        { amount: 45000, date: new Date('2026-03-01') },
        { amount: 44000, date: new Date('2026-02-01') },
        { amount: 43000, date: new Date('2026-01-01') },
      ];
      const result = calcFactPaymentPerUnit(history, 12, new Date('2026-03-16'));
      expect(result).toBe(45000);
    });
    it('returns 0 for empty history', () => {
      expect(calcFactPaymentPerUnit([], 1, new Date())).toBe(0);
    });
    it('returns 0 when no payments in last 12 months', () => {
      const history = [{ amount: 50, date: new Date('2020-01-01') }];
      expect(calcFactPaymentPerUnit(history, 1, new Date('2026-03-16'))).toBe(0);
    });
    it('handles more payments than frequency in 12-month window', () => {
      const history = [
        { amount: 186, date: new Date('2025-07-15') },
        { amount: 186, date: new Date('2025-12-15') },
      ];
      const result = calcFactPaymentPerUnit(history, 1, new Date('2026-03-16'));
      expect(result).toBe(372);
    });
  });
});

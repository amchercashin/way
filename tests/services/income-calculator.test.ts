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

  describe('calcCAGR (calendar-year)', () => {
    it('calculates CAGR from first to last full calendar year', () => {
      const history = [
        { amount: 10, date: new Date('2021-07-01') },
        { amount: 12, date: new Date('2022-07-01') },
        { amount: 15, date: new Date('2023-07-01') },
      ];
      const result = calcCAGR(history, new Date('2026-03-16'));
      expect(result).toBeCloseTo(22.47, 0);
    });
    it('returns null for payments in only one year', () => {
      const history = [
        { amount: 10, date: new Date('2023-01-01') },
        { amount: 20, date: new Date('2023-06-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('returns null when first year income is 0', () => {
      const history = [
        { amount: 0, date: new Date('2021-07-01') },
        { amount: 15, date: new Date('2023-07-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('excludes current year from last_full_year', () => {
      const history = [
        { amount: 10, date: new Date('2025-07-01') },
        { amount: 20, date: new Date('2026-01-15') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('handles gaps between years', () => {
      const history = [
        { amount: 10, date: new Date('2020-06-01') },
        { amount: 20, date: new Date('2024-06-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeCloseTo(18.92, 0);
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

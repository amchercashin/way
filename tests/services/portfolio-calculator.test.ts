import { describe, expect, it } from 'vitest';
import { calculatePortfolioSnapshot } from '@/services/portfolio-calculator';
import type { Asset, PaymentHistory } from '@/models/types';
import type { Holding } from '@/models/account';

function asset(overrides: Partial<Asset>): Asset {
  return {
    id: 1,
    type: 'Акции',
    name: 'Сбер',
    dataSource: 'manual',
    paymentPerUnitSource: 'fact',
    frequencyPerYear: 1,
    frequencySource: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function holding(overrides: Partial<Holding>): Holding {
  return {
    id: 1,
    accountId: 1,
    assetId: 1,
    quantity: 10,
    quantitySource: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('portfolio-calculator', () => {
  it('keeps RUB portfolios compatible with previous calculations', () => {
    const snapshot = calculatePortfolioSnapshot({
      assets: [asset({ id: 1, currentPrice: 100, paymentPerUnit: 12, paymentPerUnitSource: 'manual' })],
      holdings: [holding({ assetId: 1, quantity: 10 })],
      paymentHistory: [],
      ndflRates: new Map(),
      exchangeRates: new Map(),
      now: new Date('2026-04-28'),
    });

    expect(snapshot.portfolio.totalValue).toBe(1000);
    expect(snapshot.portfolio.totalIncomePerMonth).toBe(10);
    expect(snapshot.portfolio.totalIncomePerYear).toBe(120);
    expect(snapshot.portfolio.yieldPercent).toBe(12);
  });

  it('normalizes foreign asset value and income to RUB using manual rates', () => {
    const snapshot = calculatePortfolioSnapshot({
      assets: [asset({ id: 1, currentPrice: 100, currency: 'USD', paymentPerUnit: 12, paymentPerUnitSource: 'manual' })],
      holdings: [holding({ assetId: 1, quantity: 2 })],
      paymentHistory: [],
      ndflRates: new Map(),
      exchangeRates: new Map([['USD', 90]]),
      now: new Date('2026-04-28'),
    });

    expect(snapshot.portfolio.totalValue).toBe(18_000);
    expect(snapshot.portfolio.totalIncomePerMonth).toBe(180);
    expect(snapshot.assetsById.get(1)?.currency).toBe('USD');
    expect(snapshot.assetsById.get(1)?.rateToRub).toBe(90);
  });

  it('uses fact payments, excludes forecasts, and applies NDFL', () => {
    const history: PaymentHistory[] = [
      { assetId: 1, amount: 10, date: new Date('2026-01-01'), type: 'dividend', dataSource: 'moex' },
      { assetId: 1, amount: 5, date: new Date('2026-03-01'), type: 'dividend', dataSource: 'dohod', isForecast: true },
    ];

    const snapshot = calculatePortfolioSnapshot({
      assets: [asset({ id: 1, currentPrice: 100 })],
      holdings: [holding({ assetId: 1, quantity: 10 })],
      paymentHistory: history,
      ndflRates: new Map([['Акции', 13]]),
      exchangeRates: new Map(),
      now: new Date('2026-04-28'),
    });

    expect(snapshot.portfolio.totalIncomePerYear).toBeCloseTo(87);
    expect(snapshot.portfolio.totalIncomePerMonth).toBeCloseTo(7.25);
  });
});

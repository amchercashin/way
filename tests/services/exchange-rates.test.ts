import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { getRateToRub, normalizeCurrency, ratesArrayToMap, updateExchangeRate } from '@/services/exchange-rates';
import type { ExchangeRate } from '@/models/types';

describe('exchange-rates', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('treats missing currency as RUB', () => {
    expect(normalizeCurrency(undefined)).toBe('RUB');
    expect(normalizeCurrency('')).toBe('RUB');
    expect(normalizeCurrency(' usd ')).toBe('USD');
  });

  it('always returns 1 for RUB', () => {
    expect(getRateToRub('RUB', new Map())).toBe(1);
  });

  it('returns manual rate for foreign currency and 0 when missing', () => {
    const rates = new Map([['USD', 90]]);
    expect(getRateToRub('USD', rates)).toBe(90);
    expect(getRateToRub('EUR', rates)).toBe(0);
  });

  it('converts exchange rate rows to a normalized map', () => {
    const rows: ExchangeRate[] = [
      { currency: ' usd ', rateToRub: 90, updatedAt: new Date(), source: 'manual' },
      { currency: 'EUR', rateToRub: 100, updatedAt: new Date(), source: 'manual' },
    ];

    expect(ratesArrayToMap(rows)).toEqual(new Map([
      ['USD', 90],
      ['EUR', 100],
    ]));
  });

  it('stores manual exchange rates with normalized currency', async () => {
    await updateExchangeRate(' usd ', 90);

    const rate = await db.exchangeRates.get('USD');
    expect(rate).toMatchObject({
      currency: 'USD',
      rateToRub: 90,
      source: 'manual',
    });
    expect(rate?.updatedAt).toBeInstanceOf(Date);
  });
});

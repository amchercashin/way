import { db } from '@/db/database';
import type { ExchangeRate } from '@/models/types';

export const BASE_CURRENCY = 'RUB';

export function normalizeCurrency(currency: string | undefined | null): string {
  const normalized = currency?.trim().toUpperCase();
  return normalized || BASE_CURRENCY;
}

export function ratesArrayToMap(rates: ExchangeRate[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const rate of rates) {
    if (rate.rateToRub > 0 && isFinite(rate.rateToRub)) {
      map.set(normalizeCurrency(rate.currency), rate.rateToRub);
    }
  }
  return map;
}

export function getRateToRub(
  currency: string | undefined | null,
  rates: Map<string, number>,
): number {
  const normalized = normalizeCurrency(currency);
  if (normalized === BASE_CURRENCY) return 1;
  return rates.get(normalized) ?? 0;
}

export async function getExchangeRates(): Promise<ExchangeRate[]> {
  return db.exchangeRates.toArray();
}

export async function updateExchangeRate(currency: string, rateToRub: number): Promise<void> {
  const normalized = normalizeCurrency(currency);
  if (normalized === BASE_CURRENCY) return;
  if (!isFinite(rateToRub) || rateToRub <= 0) return;
  await db.exchangeRates.put({
    currency: normalized,
    rateToRub,
    updatedAt: new Date(),
    source: 'manual',
  });
}

export async function deleteExchangeRate(currency: string): Promise<void> {
  const normalized = normalizeCurrency(currency);
  if (normalized === BASE_CURRENCY) return;
  await db.exchangeRates.delete(normalized);
}

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { ratesArrayToMap } from '@/services/exchange-rates';
import type { ExchangeRate } from '@/models/types';

export function useExchangeRates(): ExchangeRate[] {
  return useLiveQuery(() => db.exchangeRates.toArray(), [], []);
}

export function useExchangeRateMap(): Map<string, number> {
  const rates = useExchangeRates();
  return useMemo(() => ratesArrayToMap(rates), [rates]);
}

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { PortfolioStats, CategoryStats } from '@/models/types';
import { calculatePortfolioSnapshot, type CalculatedAssetStats } from '@/services/portfolio-calculator';
import { getNdflRates } from '@/services/app-settings';
import { ratesArrayToMap } from '@/services/exchange-rates';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
  assetsById: Map<number, CalculatedAssetStats>;
  isLoading: boolean;
} {
  const assets = useLiveQuery(() => db.assets.toArray(), []);
  const holdings = useLiveQuery(() => db.holdings.toArray(), []);
  const allHistory = useLiveQuery(() => db.paymentHistory.toArray(), []);
  const ndflRates = useLiveQuery(() => getNdflRates(), []);
  const exchangeRates = useLiveQuery(() => db.exchangeRates.toArray(), []);
  const isLoading =
    assets === undefined ||
    holdings === undefined ||
    allHistory === undefined ||
    ndflRates === undefined ||
    exchangeRates === undefined;

  const { portfolio, categories, assetsById } = calculatePortfolioSnapshot({
    assets: assets ?? [],
    holdings: holdings ?? [],
    paymentHistory: allHistory ?? [],
    ndflRates: ndflRates ?? new Map(),
    exchangeRates: ratesArrayToMap(exchangeRates ?? []),
  });

  return { portfolio, categories, assetsById, isLoading };
}

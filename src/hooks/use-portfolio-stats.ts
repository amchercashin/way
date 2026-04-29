import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { PortfolioStats, CategoryStats } from '@/models/types';
import { calculatePortfolioSnapshot, type CalculatedAssetStats } from '@/services/portfolio-calculator';
import { useAllPaymentHistory } from './use-payment-history';
import { useNdflRates } from './use-ndfl-rates';
import { useExchangeRateMap } from './use-exchange-rates';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
  assetsById: Map<number, CalculatedAssetStats>;
} {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const holdings = useLiveQuery(() => db.holdings.toArray(), [], []);
  const allHistory = useAllPaymentHistory();
  const ndflRates = useNdflRates();
  const exchangeRates = useExchangeRateMap();

  const { portfolio, categories, assetsById } = calculatePortfolioSnapshot({
    assets,
    holdings,
    paymentHistory: allHistory,
    ndflRates,
    exchangeRates,
  });

  return { portfolio, categories, assetsById };
}

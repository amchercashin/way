import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { AssetType, PortfolioStats, CategoryStats } from '@/models/types';
import { calcFactPaymentPerUnit, calcAssetIncomePerMonth, calcYieldPercent, type PaymentRecord } from '@/services/income-calculator';
import { useAllPaymentHistory } from './use-payment-history';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
} {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const allHistory = useAllPaymentHistory();

  const { portfolio, categories } = useMemo(() => {
    const now = new Date();

    // Build history lookup
    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }

    // Helper: resolve paymentPerUnit once per asset
    const resolvePaymentPerUnit = (asset: (typeof assets)[number]): number => {
      if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
        return asset.paymentPerUnit;
      }
      const history = historyByAsset.get(asset.id!) ?? [];
      return calcFactPaymentPerUnit(history, asset.frequencyPerYear, now);
    };

    // Single pass: accumulate portfolio totals AND per-category stats
    let totalValue = 0;
    let totalIncomePerMonth = 0;
    const categoryMap = new Map<AssetType, { value: number; incomePerMonth: number; count: number }>();

    for (const asset of assets) {
      const price = asset.currentPrice ?? asset.averagePrice ?? 0;
      const assetValue = price * asset.quantity;
      totalValue += assetValue;

      const paymentPerUnit = resolvePaymentPerUnit(asset);
      const assetIncomePerMonth = calcAssetIncomePerMonth(
        asset.quantity,
        paymentPerUnit,
        asset.frequencyPerYear,
      );
      totalIncomePerMonth += assetIncomePerMonth;

      // Accumulate category stats
      const cat = categoryMap.get(asset.type);
      if (cat) {
        cat.value += assetValue;
        cat.incomePerMonth += assetIncomePerMonth;
        cat.count += 1;
      } else {
        categoryMap.set(asset.type, { value: assetValue, incomePerMonth: assetIncomePerMonth, count: 1 });
      }
    }

    const totalIncomePerYear = totalIncomePerMonth * 12;
    const yieldPercent = totalValue > 0 ? calcYieldPercent(totalIncomePerYear, totalValue) : 0;

    const portfolio: PortfolioStats = {
      totalIncomePerMonth,
      totalIncomePerYear,
      totalValue,
      yieldPercent,
    };

    // Convert categoryMap to CategoryStats array
    const categories: CategoryStats[] = [];
    for (const [type, cat] of categoryMap) {
      const catIncomePerYear = cat.incomePerMonth * 12;
      categories.push({
        type,
        assetCount: cat.count,
        totalIncomePerMonth: cat.incomePerMonth,
        totalIncomePerYear: catIncomePerYear,
        totalValue: cat.value,
        yieldPercent: cat.value > 0 ? calcYieldPercent(catIncomePerYear, cat.value) : 0,
        portfolioSharePercent: totalValue > 0 ? (cat.value / totalValue) * 100 : 0,
      });
    }
    categories.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);

    return { portfolio, categories };
  }, [assets, allHistory]);

  return { portfolio, categories };
}

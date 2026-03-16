import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { AssetType, PortfolioStats, CategoryStats } from '@/models/types';
import { calcFactPerMonth, calcMainNumber, calcYieldPercent, type PaymentRecord } from '@/services/income-calculator';
import { useAllPaymentHistory } from './use-payment-history';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
} {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const schedules = useLiveQuery(() => db.paymentSchedules.toArray(), [], []);
  const allHistory = useAllPaymentHistory();

  const { portfolio, categories } = useMemo(() => {
    const scheduleByAssetId = new Map(
      schedules.map((s) => [s.assetId, s]),
    );

    const now = new Date();

    // Build history-by-asset map
    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }

    // Portfolio totals
    let totalValue = 0;
    let totalIncomePerMonth = 0;
    const categoryMap = new Map<AssetType, typeof assets>();

    for (const asset of assets) {
      const price = asset.currentPrice ?? asset.averagePrice ?? 0;
      const assetValue = price * asset.quantity;
      totalValue += assetValue;

      // Group by category
      const catAssets = categoryMap.get(asset.type) ?? [];
      catAssets.push(asset);
      categoryMap.set(asset.type, catAssets);

      // Compute main number
      const schedule = scheduleByAssetId.get(asset.id!);
      const history = historyByAsset.get(asset.id!) ?? [];
      const factPerMonth = calcFactPerMonth(history, asset.quantity, now);
      totalIncomePerMonth += calcMainNumber({
        activeMetric: schedule?.activeMetric ?? 'fact',
        forecastAmount: schedule?.forecastAmount ?? null,
        frequencyPerYear: schedule?.frequencyPerYear ?? 1,
        quantity: asset.quantity,
        factPerMonth,
      });
    }

    const totalIncomePerYear = totalIncomePerMonth * 12;
    const yieldPercent = totalValue > 0 ? calcYieldPercent(totalIncomePerYear, totalValue) : 0;

    const portfolio: PortfolioStats = {
      totalIncomePerMonth,
      totalIncomePerYear,
      totalValue,
      yieldPercent,
    };

    // Category aggregation
    const categories: CategoryStats[] = [];
    for (const [type, categoryAssets] of categoryMap) {
      let catValue = 0;
      let catIncomePerMonth = 0;
      for (const asset of categoryAssets) {
        const price = asset.currentPrice ?? asset.averagePrice ?? 0;
        const assetValue = price * asset.quantity;
        catValue += assetValue;

        const schedule = scheduleByAssetId.get(asset.id!);
        const history = historyByAsset.get(asset.id!) ?? [];
        const factPerMonth = calcFactPerMonth(history, asset.quantity, now);
        catIncomePerMonth += calcMainNumber({
          activeMetric: schedule?.activeMetric ?? 'fact',
          forecastAmount: schedule?.forecastAmount ?? null,
          frequencyPerYear: schedule?.frequencyPerYear ?? 1,
          quantity: asset.quantity,
          factPerMonth,
        });
      }
      const catIncomePerYear = catIncomePerMonth * 12;
      categories.push({
        type,
        assetCount: categoryAssets.length,
        totalIncomePerMonth: catIncomePerMonth,
        totalIncomePerYear: catIncomePerYear,
        totalValue: catValue,
        yieldPercent: catValue > 0 ? calcYieldPercent(catIncomePerYear, catValue) : 0,
        portfolioSharePercent: totalValue > 0 ? (catValue / totalValue) * 100 : 0,
      });
    }
    categories.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);

    return { portfolio, categories };
  }, [assets, schedules, allHistory]);

  return { portfolio, categories };
}

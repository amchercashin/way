import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { AssetType, CategoryStats, PortfolioStats } from '@/models/types';
import { calcPortfolioIncome, calcYieldPercent } from '@/services/income-calculator';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
} {
  const assets = useLiveQuery(() => db.assets.toArray()) ?? [];
  const schedules = useLiveQuery(() => db.paymentSchedules.toArray()) ?? [];

  return useMemo(() => {
    const scheduleByAssetId = new Map(schedules.map((s) => [s.assetId, s]));

    let totalValue = 0;
    const categoryMap = new Map<AssetType, { assets: typeof assets; value: number }>();

    for (const asset of assets) {
      const value = (asset.currentPrice ?? asset.averagePrice ?? 0) * asset.quantity;
      totalValue += value;

      const existing = categoryMap.get(asset.type);
      if (existing) {
        existing.assets.push(asset);
        existing.value += value;
      } else {
        categoryMap.set(asset.type, { assets: [asset], value });
      }
    }

    const incomeItems = assets
      .filter((asset) => scheduleByAssetId.has(asset.id!))
      .map((asset) => {
        const schedule = scheduleByAssetId.get(asset.id!)!;
        return {
          quantity: asset.quantity,
          paymentAmount: schedule.lastPaymentAmount,
          frequencyPerYear: schedule.frequencyPerYear,
        };
      });

    const totalIncome = calcPortfolioIncome(incomeItems);
    const yieldPercent = calcYieldPercent(totalIncome.perYear, totalValue);

    const portfolio: PortfolioStats = {
      totalIncomePerMonth: totalIncome.perMonth,
      totalIncomePerYear: totalIncome.perYear,
      totalValue,
      yieldPercent,
    };

    const categories: CategoryStats[] = [];
    for (const [type, data] of categoryMap) {
      const catIncomeItems = data.assets
        .filter((asset) => scheduleByAssetId.has(asset.id!))
        .map((asset) => {
          const schedule = scheduleByAssetId.get(asset.id!)!;
          return {
            quantity: asset.quantity,
            paymentAmount: schedule.lastPaymentAmount,
            frequencyPerYear: schedule.frequencyPerYear,
          };
        });
      const catIncome = calcPortfolioIncome(catIncomeItems);
      const catYield = calcYieldPercent(catIncome.perYear, data.value);

      categories.push({
        type,
        assetCount: data.assets.length,
        totalIncomePerMonth: catIncome.perMonth,
        totalIncomePerYear: catIncome.perYear,
        totalValue: data.value,
        yieldPercent: catYield,
        portfolioSharePercent: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      });
    }

    categories.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);

    return { portfolio, categories };
  }, [assets, schedules]);
}

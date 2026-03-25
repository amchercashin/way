import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { PortfolioStats, CategoryStats } from '@/models/types';
import { calcAnnualIncomePerUnit, calcAssetIncomePerMonth, calcYieldPercent, type PaymentRecord } from '@/services/income-calculator';
import { useAllPaymentHistory } from './use-payment-history';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
} {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const holdings = useLiveQuery(() => db.holdings.toArray(), [], []);
  const allHistory = useAllPaymentHistory();

  const { portfolio, categories } = useMemo(() => {
    const now = new Date();

    const quantityByAsset = new Map<number, number>();
    for (const h of holdings) {
      quantityByAsset.set(h.assetId, (quantityByAsset.get(h.assetId) ?? 0) + h.quantity);
    }

    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      if (h.excluded) continue;
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }

    const resolveAnnualIncome = (asset: (typeof assets)[number]): number => {
      if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
        return asset.paymentPerUnit;
      }
      const history = historyByAsset.get(asset.id!) ?? [];
      return calcAnnualIncomePerUnit(history, asset.frequencyPerYear, now).annualIncome;
    };

    let totalValue = 0;
    let totalIncomePerMonth = 0;
    const categoryMap = new Map<string, { value: number; incomePerMonth: number; count: number }>();

    for (const asset of assets) {
      const totalQuantity = quantityByAsset.get(asset.id!) ?? 0;
      const price = asset.currentPrice ?? 0;
      const nkd = asset.type === 'Облигации' ? (asset.accruedInterest ?? 0) : 0;
      const assetValue = (price + nkd) * totalQuantity;
      totalValue += assetValue;

      const annualIncome = resolveAnnualIncome(asset);
      const assetIncomePerMonth = calcAssetIncomePerMonth(totalQuantity, annualIncome);
      totalIncomePerMonth += assetIncomePerMonth;

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

    const portfolio: PortfolioStats = { totalIncomePerMonth, totalIncomePerYear, totalValue, yieldPercent };

    const categories: CategoryStats[] = [];
    for (const [type, cat] of categoryMap) {
      const catIncomePerYear = cat.incomePerMonth * 12;
      categories.push({
        type, assetCount: cat.count,
        totalIncomePerMonth: cat.incomePerMonth, totalIncomePerYear: catIncomePerYear,
        totalValue: cat.value,
        yieldPercent: cat.value > 0 ? calcYieldPercent(catIncomePerYear, cat.value) : 0,
        portfolioSharePercent: totalValue > 0 ? (cat.value / totalValue) * 100 : 0,
      });
    }
    categories.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);

    return { portfolio, categories };
  }, [assets, holdings, allHistory]);

  return { portfolio, categories };
}

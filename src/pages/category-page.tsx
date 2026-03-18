import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';
import { AssetRow } from '@/components/category/asset-row';
import { useAssetsByType } from '@/hooks/use-assets';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useAllPaymentHistory } from '@/hooks/use-payment-history';
import { calcFactPaymentPerUnit, type PaymentRecord } from '@/services/income-calculator';
import { ASSET_TYPE_LABELS, type AssetType } from '@/models/types';

export function CategoryPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const assetType = type as AssetType;
  const assets = useAssetsByType(assetType);
  const { categories } = usePortfolioStats();
  const allHistory = useAllPaymentHistory();

  const catStats = categories.find((c) => c.type === assetType);

  const { historyByAsset, categoryHistory, now } = useMemo(() => {
    const now = new Date();
    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }

    const categoryAssetIds = new Set(assets.map((a) => a.id!));
    const assetMap = new Map(assets.map((a) => [a.id!, a.quantity]));
    const categoryHistory = (allHistory ?? [])
      .filter((h) => categoryAssetIds.has(h.assetId))
      .map((h) => ({
        amount: h.amount * (assetMap.get(h.assetId) ?? 1),
        date: new Date(h.date),
      }));

    return { historyByAsset, categoryHistory, now };
  }, [assets, allHistory]);

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-[var(--way-ash)] text-lg" aria-label="Назад">
      ‹
    </button>
  );

  return (
    <AppShell
      leftAction={backButton}
      title={ASSET_TYPE_LABELS[assetType] ?? type}
    >
      {catStats && (
        <StatBlocks
          incomePerMonth={catStats.totalIncomePerMonth}
          totalValue={catStats.totalValue}
          yieldPercent={catStats.yieldPercent}
          portfolioSharePercent={catStats.portfolioSharePercent}
        />
      )}

      {assets.map((asset) => {
        let paymentPerUnit: number;
        if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
          paymentPerUnit = asset.paymentPerUnit;
        } else {
          const history = historyByAsset.get(asset.id!) ?? [];
          paymentPerUnit = calcFactPaymentPerUnit(history, asset.frequencyPerYear, now);
        }
        return <AssetRow key={asset.id} asset={asset} paymentPerUnit={paymentPerUnit} />;
      })}

      <Link
        to={`/add-asset?type=${assetType}`}
        className="block text-center py-3 border border-dashed border-[var(--way-shadow)] rounded-xl text-[var(--way-ash)] text-sm mt-3 active:border-[var(--way-gold)] active:text-[var(--way-gold)]"
      >
        + Добавить
      </Link>

      <PaymentHistoryChart history={categoryHistory} quantity={1} />
    </AppShell>
  );
}

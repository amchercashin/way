import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { AssetRow } from '@/components/category/asset-row';
import { useAssetsByType } from '@/hooks/use-assets';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useAllPaymentHistory } from '@/hooks/use-payment-history';
import { calcFactPaymentPerUnit, type PaymentRecord } from '@/services/income-calculator';
import { db } from '@/db/database';

export function CategoryPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const decodedType = decodeURIComponent(type ?? '');
  const assets = useAssetsByType(decodedType);
  const { categories } = usePortfolioStats();
  const allHistory = useAllPaymentHistory();
  const holdings = useLiveQuery(() => db.holdings.toArray(), [], []);

  const catStats = categories.find((c) => c.type === decodedType);

  const quantityByAsset = useMemo(() => {
    const map = new Map<number, number>();
    for (const h of holdings) {
      map.set(h.assetId, (map.get(h.assetId) ?? 0) + h.quantity);
    }
    return map;
  }, [holdings]);

  const { historyByAsset, now } = useMemo(() => {
    const now = new Date();
    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }
    return { historyByAsset, now };
  }, [allHistory]);

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-[var(--way-ash)] text-lg" aria-label="Назад">
      ‹
    </button>
  );

  return (
    <AppShell
      leftAction={backButton}
      title={decodedType}
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
        return <AssetRow key={asset.id} asset={asset} paymentPerUnit={paymentPerUnit} totalQuantity={quantityByAsset.get(asset.id!) ?? 0} />;
      })}

      <Link
        to={`/add-asset?type=${encodeURIComponent(decodedType)}`}
        className="block text-center py-3 border border-dashed border-[var(--way-shadow)] rounded-xl text-[var(--way-ash)] text-sm mt-3 active:border-[var(--way-gold)] active:text-[var(--way-gold)]"
      >
        + Добавить
      </Link>

    </AppShell>
  );
}

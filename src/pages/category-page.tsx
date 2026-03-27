import { useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';
import { useLiveQuery } from 'dexie-react-hooks';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { AssetRow } from '@/components/category/asset-row';
import { PageTip } from '@/components/onboarding/PageTip';
import { useAssetsByType } from '@/hooks/use-assets';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useNdflRates } from '@/hooks/use-ndfl-rates';
import { useAllPaymentHistory } from '@/hooks/use-payment-history';
import { calcAnnualIncomePerUnit, type PaymentRecord } from '@/services/income-calculator';
import { db } from '@/db/database';

export function CategoryPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const decodedType = decodeURIComponent(type ?? '');
  const assets = useAssetsByType(decodedType);
  const firstAssetRef = useRef<HTMLDivElement>(null);
  const { categories } = usePortfolioStats();
  const ndflRates = useNdflRates();
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
      if (h.excluded) continue;
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }
    return { historyByAsset, now };
  }, [allHistory]);

  const backButton = (
    <button onClick={() => withViewTransition(() => navigate(-1))} className="text-[var(--hi-ash)] text-[length:var(--hi-text-nav)] min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Назад">
      ‹
    </button>
  );

  return (
    <AppShell leftAction={backButton} title={decodedType}>
      <PageTip storageKey="hi-tip-category" targetRef={firstAssetRef} text="Доход и доходность — по каждому активу отдельно. Нажмите для подробностей" />
      {catStats && (
        <StatBlocks
          incomePerMonth={catStats.totalIncomePerMonth}
          totalValue={catStats.totalValue}
          yieldPercent={catStats.yieldPercent}
          portfolioSharePercent={catStats.portfolioSharePercent}
        />
      )}

      {assets.map((asset, index) => {
        let annualIncome: number;
        if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
          annualIncome = asset.paymentPerUnit;
        } else {
          const history = historyByAsset.get(asset.id!) ?? [];
          annualIncome = calcAnnualIncomePerUnit(history, asset.frequencyPerYear, now).annualIncome;
        }
        const ndflRate = ndflRates.get(decodedType) ?? 0;
        annualIncome = annualIncome * (1 - ndflRate / 100);
        return (
          <div key={asset.id} ref={index === 0 ? firstAssetRef : undefined}>
            <AssetRow asset={asset} annualIncome={annualIncome} totalQuantity={quantityByAsset.get(asset.id!) ?? 0} />
          </div>
        );
      })}
    </AppShell>
  );
}

import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { IncomeChart } from '@/components/shared/income-chart';
import { AssetRow } from '@/components/category/asset-row';
import { useAssetsByType } from '@/hooks/use-assets';
import { useAllPaymentSchedules } from '@/hooks/use-payment-schedules';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { ASSET_TYPE_LABELS, type AssetType } from '@/models/types';

export function CategoryPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const assetType = type as AssetType;
  const assets = useAssetsByType(assetType);
  const schedules = useAllPaymentSchedules();
  const { categories } = usePortfolioStats();

  const catStats = categories.find((c) => c.type === assetType);
  const scheduleMap = new Map(schedules.map((s) => [s.assetId, s]));

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">
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

      {assets.map((asset) => (
        <AssetRow key={asset.id} asset={asset} schedule={scheduleMap.get(asset.id!)} />
      ))}

      <Link
        to={`/add-asset?type=${assetType}`}
        className="block text-center py-3 border border-dashed border-gray-700 rounded-xl text-gray-600 text-sm mt-3 active:border-[#4ecca3] active:text-[#4ecca3]"
      >
        + Добавить
      </Link>

      <IncomeChart categories={[]} cagr={null} />
    </AppShell>
  );
}

import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { IncomeChart } from '@/components/shared/income-chart';
import { AssetField } from '@/components/asset-detail/asset-field';
import { ExpectedPayment } from '@/components/asset-detail/expected-payment';
import { useAsset, updateAsset } from '@/hooks/use-assets';
import { usePaymentSchedule, upsertPaymentSchedule } from '@/hooks/use-payment-schedules';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { calcAssetIncomePerMonth, calcYieldPercent } from '@/services/income-calculator';
import { formatFrequency } from '@/lib/utils';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assetId = Number(id);
  const asset = useAsset(assetId);
  const schedule = usePaymentSchedule(assetId);
  const { portfolio } = usePortfolioStats();

  if (!asset) {
    return <AppShell title="Загрузка..."><div /></AppShell>;
  }

  const incomePerMonth = schedule
    ? calcAssetIncomePerMonth(asset.quantity, schedule.lastPaymentAmount, schedule.frequencyPerYear)
    : 0;
  const value = (asset.currentPrice ?? asset.averagePrice ?? 0) * asset.quantity;
  const yieldPct = calcYieldPercent(incomePerMonth * 12, value);
  const sharePercent = portfolio.totalValue > 0 ? (value / portfolio.totalValue) * 100 : 0;

  const title = asset.ticker ? `${asset.ticker} · ${asset.name}` : asset.name;

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title={title}>
      <StatBlocks
        incomePerMonth={incomePerMonth}
        totalValue={value}
        yieldPercent={yieldPct}
        portfolioSharePercent={sharePercent}
      />

      <AssetField
        label="Количество"
        value={`${asset.quantity} шт`}
        source={asset.dataSource}
        onSave={(v) => {
          const num = parseInt(v);
          if (num > 0) updateAsset(assetId, { quantity: num, dataSource: 'manual' });
        }}
      />

      {schedule && (
        <>
          <AssetField
            label="Последний дивиденд"
            value={`₽ ${schedule.lastPaymentAmount} / ${asset.ticker ? 'акция' : 'период'}`}
            source={schedule.dataSource}
            onSave={(v) => {
              const num = parseFloat(v.replace(/[^\d.]/g, ''));
              if (num > 0) upsertPaymentSchedule(assetId, { ...schedule, lastPaymentAmount: num, dataSource: 'manual' });
            }}
          />
          <AssetField
            label="Частота"
            value={formatFrequency(schedule.frequencyPerYear)}
            source={schedule.dataSource}
            editable={false}
          />
          <ExpectedPayment schedule={schedule} quantity={asset.quantity} />
        </>
      )}

      <IncomeChart categories={[]} cagr={null} />
    </AppShell>
  );
}

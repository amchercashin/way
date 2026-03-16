import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';
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
    : null;
  const value = (asset.currentPrice ?? asset.averagePrice) != null
    ? (asset.currentPrice ?? asset.averagePrice)! * asset.quantity
    : null;
  const yieldPct = (incomePerMonth != null && value != null)
    ? calcYieldPercent(incomePerMonth * 12, value)
    : null;
  const sharePercent = (value != null && portfolio.totalValue > 0)
    ? (value / portfolio.totalValue) * 100
    : null;

  const handleSavePayment = (v: string) => {
    const num = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''));
    if (isNaN(num) || num < 0) return;
    upsertPaymentSchedule(assetId, {
      frequencyPerYear: schedule?.frequencyPerYear ?? 1,
      lastPaymentAmount: num,
      dataSource: 'manual',
    });
  };

  const handleSaveFrequency = (v: string) => {
    const num = parseInt(v);
    if (isNaN(num) || num < 1 || num > 12) return;
    upsertPaymentSchedule(assetId, {
      frequencyPerYear: num,
      lastPaymentAmount: schedule?.lastPaymentAmount ?? 0,
      dataSource: 'manual',
    });
  };

  const handleSaveQuantity = (v: string) => {
    const num = parseInt(v);
    if (num > 0) updateAsset(assetId, { quantity: num, dataSource: 'manual' });
  };

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
        onSave={handleSaveQuantity}
      />

      <AssetField
        label="Последняя выплата"
        value={schedule ? `₽ ${schedule.lastPaymentAmount}` : '— Укажите'}
        source={schedule?.dataSource}
        onSave={handleSavePayment}
      />

      <AssetField
        label="Частота (раз/год)"
        value={schedule ? formatFrequency(schedule.frequencyPerYear) : '— Укажите'}
        source={schedule?.dataSource}
        onSave={handleSaveFrequency}
      />

      {schedule && (
        <ExpectedPayment schedule={schedule} quantity={asset.quantity} />
      )}

      <PaymentHistoryChart history={[]} quantity={1} />
    </AppShell>
  );
}

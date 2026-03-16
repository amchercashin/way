import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';
import { AssetField } from '@/components/asset-detail/asset-field';
import { ExpectedPayment } from '@/components/asset-detail/expected-payment';
import { IncomeMetricPanel } from '@/components/asset-detail/income-metric-panel';
import { useAsset, updateAsset } from '@/hooks/use-assets';
import { usePaymentSchedule, upsertPaymentSchedule } from '@/hooks/use-payment-schedules';
import { updateForecast } from '@/hooks/use-payment-schedules';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { usePaymentHistory } from '@/hooks/use-payment-history';
import { calcFactPerMonth, calcDecayAverage, calcMainNumber, calcYieldPercent } from '@/services/income-calculator';
import { formatFrequency } from '@/lib/utils';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assetId = Number(id);
  const asset = useAsset(assetId);
  const schedule = usePaymentSchedule(assetId);
  const { portfolio } = usePortfolioStats();
  const history = usePaymentHistory(assetId);
  const [panelOpen, setPanelOpen] = useState(false);

  if (!asset) {
    return <AppShell title="Загрузка..."><div /></AppShell>;
  }

  const now = new Date();
  const historyRecords = history.map((h) => ({ amount: h.amount, date: new Date(h.date) }));
  const factPerMonth = calcFactPerMonth(historyRecords, asset.quantity, now);
  const decayAverage = calcDecayAverage(historyRecords, now);

  const activeMetric = schedule?.activeMetric ?? 'fact';
  const forecastAmount = schedule?.forecastAmount ?? null;

  const incomePerMonth = calcMainNumber({
    activeMetric,
    forecastAmount,
    frequencyPerYear: schedule?.frequencyPerYear ?? 1,
    quantity: asset.quantity,
    factPerMonth,
  });

  const forecastPerMonth = forecastAmount != null && schedule
    ? (forecastAmount * schedule.frequencyPerYear * asset.quantity) / 12
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
        activeMetric={activeMetric}
        onIncomeTap={() => setPanelOpen(!panelOpen)}
      />

      {panelOpen && (
        <IncomeMetricPanel
          factPerMonth={factPerMonth}
          forecastPerMonth={forecastPerMonth}
          activeMetric={activeMetric}
          decayAverage={decayAverage}
          forecastAmount={forecastAmount}
          onSelectMetric={(m) => updateForecast(assetId, { activeMetric: m })}
          onSetForecastAmount={(amount) => updateForecast(assetId, {
            forecastAmount: amount,
            forecastMethod: 'manual',
          })}
          onApplyDecayAverage={() => {
            if (decayAverage != null) {
              updateForecast(assetId, {
                forecastAmount: decayAverage,
                forecastMethod: 'decay',
                activeMetric: 'forecast',
              });
            }
          }}
        />
      )}

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

      <PaymentHistoryChart history={historyRecords} quantity={asset.quantity} />
    </AppShell>
  );
}

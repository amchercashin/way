import { useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';
import { AssetField } from '@/components/asset-detail/asset-field';
import { ExpectedPayment } from '@/components/asset-detail/expected-payment';
import { useAsset, updateAsset } from '@/hooks/use-assets';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { usePaymentHistory } from '@/hooks/use-payment-history';
import { calcFactPaymentPerUnit, calcAssetIncomePerMonth, calcYieldPercent } from '@/services/income-calculator';
import { formatFrequency } from '@/lib/utils';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assetId = Number(id);
  const asset = useAsset(assetId);
  const { portfolio } = usePortfolioStats();
  const history = usePaymentHistory(assetId);

  const computed = useMemo(() => {
    if (!asset) return null;
    const now = new Date();
    const historyRecords = history.map((h) => ({ amount: h.amount, date: new Date(h.date) }));

    let paymentPerUnit: number;
    if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
      paymentPerUnit = asset.paymentPerUnit;
    } else {
      paymentPerUnit = calcFactPaymentPerUnit(historyRecords, asset.frequencyPerYear, now);
    }

    const incomePerMonth = calcAssetIncomePerMonth(asset.quantity, paymentPerUnit, asset.frequencyPerYear);

    const value = (asset.currentPrice ?? asset.averagePrice) != null
      ? (asset.currentPrice ?? asset.averagePrice)! * asset.quantity
      : null;
    const yieldPct = (value != null)
      ? calcYieldPercent(incomePerMonth * 12, value)
      : null;
    const sharePercent = (value != null && portfolio.totalValue > 0)
      ? (value / portfolio.totalValue) * 100
      : null;

    const isManual =
      asset.paymentPerUnitSource === 'manual' ||
      asset.quantitySource === 'manual' ||
      asset.frequencySource === 'manual';

    return { paymentPerUnit, incomePerMonth, value, yieldPct, sharePercent, isManual, historyRecords };
  }, [asset, history, portfolio.totalValue]);

  const handleSaveQuantity = useCallback((v: string) => {
    const num = parseInt(v);
    if (num > 0) updateAsset(assetId, { quantity: num, quantitySource: 'manual' });
  }, [assetId]);

  const handleSavePaymentPerUnit = useCallback((v: string) => {
    const num = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''));
    if (isNaN(num) || num < 0) return;
    updateAsset(assetId, { paymentPerUnit: num, paymentPerUnitSource: 'manual' });
  }, [assetId]);

  const handleSaveFrequency = useCallback((v: string) => {
    const num = parseInt(v);
    if (isNaN(num) || num < 1 || num > 12) return;
    updateAsset(assetId, { frequencyPerYear: num, frequencySource: 'manual' });
  }, [assetId]);

  if (!asset || !computed) {
    return <AppShell title="Загрузка..."><div /></AppShell>;
  }

  const { paymentPerUnit, incomePerMonth, value, yieldPct, sharePercent, isManual, historyRecords } = computed;

  const title = asset.ticker ? `${asset.ticker} · ${asset.name}` : asset.name;

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-[var(--way-ash)] text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title={title}>
      <StatBlocks
        incomePerMonth={incomePerMonth}
        totalValue={value}
        yieldPercent={yieldPct}
        portfolioSharePercent={sharePercent}
        isManualIncome={isManual}
      />

      <AssetField
        label="Количество"
        value={`${asset.quantity} шт`}
        sourceLabel={asset.quantitySource === 'import' ? 'импорт' : 'ручной'}
        isManualSource={asset.quantitySource === 'manual'}
        onSave={handleSaveQuantity}
        resetLabel={asset.importedQuantity != null && asset.quantitySource === 'manual' ? 'Вернуться к импорту' : undefined}
        onReset={asset.importedQuantity != null ? () => updateAsset(assetId, {
          quantity: asset.importedQuantity!,
          quantitySource: 'import',
        }) : undefined}
      />

      <AssetField
        label="Выплата на шт."
        value={paymentPerUnit > 0 ? `₽ ${paymentPerUnit}` : '— Укажите'}
        sourceLabel={asset.paymentPerUnitSource === 'fact' ? 'факт' : 'ручной'}
        isManualSource={asset.paymentPerUnitSource === 'manual'}
        subtitle={asset.paymentPerUnitSource === 'fact' ? 'расчёт из истории выплат' : undefined}
        onSave={handleSavePaymentPerUnit}
        resetLabel={asset.paymentPerUnitSource === 'manual' ? 'Вернуться к расчёту на основе факта' : undefined}
        onReset={asset.paymentPerUnitSource === 'manual' ? () => updateAsset(assetId, {
          paymentPerUnitSource: 'fact',
          paymentPerUnit: undefined,
        }) : undefined}
      />

      <AssetField
        label="Частота"
        value={formatFrequency(asset.frequencyPerYear)}
        sourceLabel={asset.frequencySource === 'moex' ? 'moex' : 'ручной'}
        isManualSource={asset.frequencySource === 'manual'}
        onSave={handleSaveFrequency}
        resetLabel={asset.moexFrequency != null && asset.frequencySource === 'manual' ? 'Вернуться к MOEX' : undefined}
        onReset={asset.moexFrequency != null ? () => updateAsset(assetId, {
          frequencyPerYear: asset.moexFrequency!,
          frequencySource: 'moex',
        }) : undefined}
      />

      <ExpectedPayment
        paymentPerUnit={paymentPerUnit}
        quantity={asset.quantity}
        nextExpectedDate={asset.nextExpectedDate}
        nextExpectedCutoffDate={asset.nextExpectedCutoffDate}
        nextExpectedCreditDate={asset.nextExpectedCreditDate}
      />

      <PaymentHistoryChart
        history={historyRecords}
        paymentPerUnit={paymentPerUnit}
        frequencyPerYear={asset.frequencyPerYear}
      />
    </AppShell>
  );
}

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
import { useHoldingsByAsset } from '@/hooks/use-holdings';
import { useAccounts } from '@/hooks/use-accounts';
import { calcFactPaymentPerUnit, calcAssetIncomePerMonth, calcYieldPercent } from '@/services/income-calculator';
import { formatFrequency } from '@/lib/utils';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assetId = Number(id);
  const asset = useAsset(assetId);
  const { portfolio } = usePortfolioStats();
  const history = usePaymentHistory(assetId);
  const holdings = useHoldingsByAsset(assetId);
  const accounts = useAccounts();

  const computed = useMemo(() => {
    if (!asset) return null;
    const now = new Date();
    const activeHistory = history.filter((h) => !h.excluded);
    const historyRecords = activeHistory.map((h) => ({ amount: h.amount, date: new Date(h.date) }));
    const allHistoryRecords = history.map((h) => ({ amount: h.amount, date: new Date(h.date), excluded: h.excluded }));

    let paymentPerUnit: number;
    if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
      paymentPerUnit = asset.paymentPerUnit;
    } else {
      paymentPerUnit = calcFactPaymentPerUnit(historyRecords, asset.frequencyPerYear, now);
    }

    const totalQuantity = holdings.reduce((sum, h) => sum + h.quantity, 0);
    const weightedAvgPrice = totalQuantity > 0
      ? holdings.reduce((sum, h) => sum + (h.averagePrice ?? 0) * h.quantity, 0) / totalQuantity
      : undefined;

    const incomePerMonth = calcAssetIncomePerMonth(totalQuantity, paymentPerUnit, asset.frequencyPerYear);

    const price = asset.currentPrice ?? weightedAvgPrice ?? 0;
    const value = price * totalQuantity;
    const yieldPct = value > 0
      ? calcYieldPercent(incomePerMonth * 12, value)
      : null;
    const sharePercent = (value > 0 && portfolio.totalValue > 0)
      ? (value / portfolio.totalValue) * 100
      : null;

    const isManual =
      asset.paymentPerUnitSource === 'manual' ||
      asset.frequencySource === 'manual';

    return { paymentPerUnit, incomePerMonth, value, yieldPct, sharePercent, isManual, allHistoryRecords, totalQuantity };
  }, [asset, history, holdings, portfolio.totalValue]);

  const handleSavePaymentPerUnit = useCallback((v: string) => {
    const num = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''));
    if (isNaN(num) || num < 0) return;
    updateAsset(assetId, { paymentPerUnit: num, paymentPerUnitSource: 'manual' });
  }, [assetId]);

  const handleSaveFrequency = useCallback((v: string) => {
    const num = parseInt(v);
    if (isNaN(num) || num < 1) return;
    updateAsset(assetId, { frequencyPerYear: num, frequencySource: 'manual' });
  }, [assetId]);

  if (!asset || !computed) {
    return <AppShell title="Загрузка..."><div /></AppShell>;
  }

  const { paymentPerUnit, incomePerMonth, value, yieldPct, sharePercent, isManual, allHistoryRecords, totalQuantity } = computed;

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

      <div
        className="bg-[var(--way-stone)] rounded-lg p-3 mb-2 cursor-pointer hover:border-[var(--way-gold)] border border-transparent transition-colors"
        onClick={() => navigate('/data', {
          state: holdings.length > 0
            ? { highlightAccountId: holdings[0].accountId, highlightAssetId: assetId }
            : undefined
        })}
      >
        <div className="font-mono text-[10px] text-[var(--way-ash)] mb-1">Количество</div>
        <div className="font-mono text-[14px] text-[var(--way-text)]">
          {totalQuantity} шт.
        </div>
        {holdings.length > 1 && (
          <div className="mt-1.5 space-y-0.5">
            {holdings.map((h) => {
              const account = accounts.find(a => a.id === h.accountId);
              return (
                <div key={h.id} className="flex justify-between text-[11px]">
                  <span className="text-[var(--way-muted)]">{account?.name ?? 'Счёт'}</span>
                  <span className="text-[var(--way-ash)] tabular-nums">{h.quantity} шт.</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AssetField
        label="Выплата на шт."
        value={paymentPerUnit > 0 ? `₽ ${paymentPerUnit}` : '— Укажите'}
        sourceLabel={asset.paymentPerUnitSource === 'fact' ? 'последний факт' : 'ручной'}
        isManualSource={asset.paymentPerUnitSource === 'manual'}
        subtitle={
          <button
            onClick={() => navigate('/payments', { state: { highlightAssetId: assetId } })}
            className="text-[var(--way-gold)] hover:underline"
          >
            {asset.paymentPerUnitSource === 'fact' ? 'расчёт из истории выплат →' : 'история выплат →'}
          </button>
        }
        onSave={handleSavePaymentPerUnit}
        resetLabel={asset.paymentPerUnitSource === 'manual' ? 'Последний факт' : undefined}
        onReset={asset.paymentPerUnitSource === 'manual' ? () => updateAsset(assetId, {
          paymentPerUnitSource: 'fact',
          paymentPerUnit: undefined,
        }) : undefined}
      />

      <AssetField
        label="Выплат в год"
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
        quantity={totalQuantity}
        nextExpectedDate={asset.nextExpectedDate}
        nextExpectedCutoffDate={asset.nextExpectedCutoffDate}
        nextExpectedCreditDate={asset.nextExpectedCreditDate}
      />

      <PaymentHistoryChart
        history={allHistoryRecords}
        paymentPerUnit={paymentPerUnit}
        frequencyPerYear={asset.frequencyPerYear}
      />
    </AppShell>
  );
}

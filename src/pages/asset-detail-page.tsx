import { useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';
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
import { calcAnnualIncomePerUnit, calcAssetIncomePerMonth, calcYieldPercent } from '@/services/income-calculator';

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

    let annualIncome: number;
    let usedPayments: { amount: number; date: Date }[] = [];
    if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
      annualIncome = asset.paymentPerUnit;
    } else {
      const result = calcAnnualIncomePerUnit(historyRecords, asset.frequencyPerYear, now);
      annualIncome = result.annualIncome;
      usedPayments = result.usedPayments;
    }

    const totalQuantity = holdings.reduce((sum, h) => sum + h.quantity, 0);
    const weightedAvgPrice = totalQuantity > 0
      ? holdings.reduce((sum, h) => sum + (h.averagePrice ?? 0) * h.quantity, 0) / totalQuantity
      : undefined;

    const incomePerMonth = calcAssetIncomePerMonth(totalQuantity, annualIncome);

    const price = asset.currentPrice ?? weightedAvgPrice ?? 0;
    const nkd = asset.type === 'Облигации' ? (asset.accruedInterest ?? 0) : 0;
    const value = (price + nkd) * totalQuantity;
    const yieldPct = value > 0
      ? calcYieldPercent(incomePerMonth * 12, value)
      : null;
    const sharePercent = (value > 0 && portfolio.totalValue > 0)
      ? (value / portfolio.totalValue) * 100
      : null;

    const isManual = asset.paymentPerUnitSource === 'manual';

    return { annualIncome, usedPayments, incomePerMonth, value, yieldPct, sharePercent, isManual, allHistoryRecords, totalQuantity };
  }, [asset, history, holdings, portfolio.totalValue]);

  const handleSavePaymentPerUnit = useCallback((v: string) => {
    const num = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''));
    if (isNaN(num) || num < 0) return;
    updateAsset(assetId, { paymentPerUnit: num, paymentPerUnitSource: 'manual' });
  }, [assetId]);

  if (!asset || !computed) {
    return <AppShell title="Загрузка..."><div /></AppShell>;
  }

  const { annualIncome, usedPayments, incomePerMonth, value, yieldPct, sharePercent, isManual, allHistoryRecords, totalQuantity } = computed;

  const title = asset.ticker ? `${asset.ticker} · ${asset.name}` : asset.name;

  const backButton = (
    <button onClick={() => withViewTransition(() => navigate(-1))} className="text-[var(--hi-ash)] text-[length:var(--hi-text-nav)] min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Назад">‹</button>
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
        className="bg-[var(--hi-stone)] rounded-lg p-3 mb-2 cursor-pointer hover:border-[var(--hi-gold)] border border-transparent transition-colors"
        onClick={() => withViewTransition(() => navigate('/data', {
          state: holdings.length > 0
            ? { highlightAccountId: holdings[0].accountId, highlightAssetId: assetId }
            : undefined
        }))}
      >
        <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-ash)] mb-1">Количество</div>
        <div className="font-mono text-[length:var(--hi-text-heading)] text-[var(--hi-text)]">
          {totalQuantity} шт.
        </div>
        {holdings.length > 1 && (
          <div className="mt-1.5 space-y-0.5">
            {holdings.map((h) => {
              const account = accounts.find(a => a.id === h.accountId);
              return (
                <div key={h.id} className="flex justify-between text-[length:var(--hi-text-body)]">
                  <span className="text-[var(--hi-muted)]">{account?.name ?? 'Счёт'}</span>
                  <span className="text-[var(--hi-ash)] tabular-nums">{h.quantity} шт.</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AssetField
        label="Выплата на шт. / год"
        value={annualIncome > 0 ? `₽ ${annualIncome.toLocaleString('ru-RU')}` : '— Укажите'}
        sourceLabel={asset.paymentPerUnitSource === 'fact' ? 'факт' : 'ручной'}
        isManualSource={asset.paymentPerUnitSource === 'manual'}
        subtitle={
          asset.paymentPerUnitSource === 'fact' && usedPayments.length > 0 ? (
            <div className="space-y-0.5 mt-1">
              {usedPayments.map((p, i) => (
                <button
                  key={i}
                  onClick={() => withViewTransition(() => navigate('/payments', { state: { highlightAssetId: assetId } }))}
                  className="flex justify-between w-full text-[length:var(--hi-text-caption)] text-[var(--hi-muted)] hover:text-[var(--hi-gold)] transition-colors"
                >
                  <span>{p.date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span className="flex items-center gap-1">
                    {p.amount.toLocaleString('ru-RU')} ₽
                    <span className="text-[var(--hi-ash)]">›</span>
                  </span>
                </button>
              ))}
            </div>
          ) : undefined
        }
        onSave={handleSavePaymentPerUnit}
        resetLabel={asset.paymentPerUnitSource === 'manual' ? 'Факт' : undefined}
        onReset={asset.paymentPerUnitSource === 'manual' ? () => updateAsset(assetId, {
          paymentPerUnitSource: 'fact',
          paymentPerUnit: undefined,
        }) : undefined}
      />

      <PaymentHistoryChart
        history={allHistoryRecords}
        paymentPerUnit={annualIncome}
      />

      <ExpectedPayment
        annualIncomePerUnit={annualIncome}
        frequencyPerYear={asset.frequencyPerYear}
        nextExpectedDate={asset.nextExpectedDate}
      />
    </AppShell>
  );
}

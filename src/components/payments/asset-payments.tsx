import { useState, useRef, useEffect } from 'react';
import type { Asset, PaymentHistory } from '@/models/types';
import { PaymentRow } from './payment-row';
import { AddPaymentForm } from './add-payment-form';
import { toggleExcluded, deletePayment, addPayment } from '@/hooks/use-payment-history';
import { isSyncable, syncAssetPayments, deleteManualPayments } from '@/services/moex-sync';

const PAYMENT_TYPE_MAP: Record<string, PaymentHistory['type']> = {
  'Акции': 'dividend',
  'Облигации': 'coupon',
  'Недвижимость': 'rent',
  'Вклады': 'interest',
  'Фонды': 'distribution',
  'Крипта': 'other',
  'Валюта': 'other',
  'Прочее': 'other',
};

interface AssetPaymentsProps {
  asset: Asset;
  payments: PaymentHistory[];
  isHighlighted?: boolean;
}

export function AssetPayments({ asset, payments, isHighlighted }: AssetPaymentsProps) {
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(!isHighlighted);
  const [syncing, setSyncing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted) {
      requestAnimationFrame(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [isHighlighted]);

  const sorted = [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const paymentType = PAYMENT_TYPE_MAP[asset.type] ?? 'other';
  const identLine = [asset.ticker, asset.isin].filter(Boolean).join(' · ');
  const syncable = isSyncable(asset);
  const manualCount = payments.filter(p => p.dataSource === 'manual').length;
  const hasManual = manualCount > 0;
  const allMoex = payments.length > 0 && !hasManual;

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (syncing) return;

    if (hasManual) {
      const ok = window.confirm(`Ручные выплаты (${manualCount} шт.) будут удалены при синхронизации с MOEX. Продолжить?`);
      if (!ok) return;
      await deleteManualPayments(asset.id!);
    }

    setSyncing(true);
    try {
      await syncAssetPayments(asset.id!);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      ref={ref}
      className={`border-t border-[var(--hi-shadow)]/30${isHighlighted ? ' animate-highlight-pulse' : ''}`}
    >
      {/* Asset header */}
      <div
        className="flex justify-between items-start px-3 py-2 bg-[var(--hi-void)] cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
        data-onboarding="asset-header"
        data-expanded={String(!collapsed)}
      >
        <div className="flex gap-1.5 min-w-0">
          <span className="text-[var(--hi-muted)] text-[length:var(--hi-text-caption)] mt-0.5 flex-shrink-0">{collapsed ? '▸' : '▾'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--hi-text)] text-[length:var(--hi-text-body)] font-medium truncate">
                {asset.name}
              </span>
              {collapsed && sorted.length > 0 && (
                <span className="text-[var(--hi-muted)] text-[length:var(--hi-text-caption)] flex-shrink-0">({sorted.length})</span>
              )}
              {syncable && payments.length > 0 && (
                <span className={`text-[length:var(--hi-text-micro)] px-1 py-0.5 rounded flex-shrink-0 ${
                  allMoex
                    ? 'bg-[#2d5a2d] text-[#6bba6b]'
                    : 'bg-[#5a5a2d] text-[#baba6b]'
                }`}>
                  {allMoex ? 'moex' : 'ручной'}
                </span>
              )}
              {syncable && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  data-onboarding="asset-sync-btn"
                  className="text-[var(--hi-ash)] text-[length:var(--hi-text-title)] hover:text-[var(--hi-gold)] transition-colors flex-shrink-0 disabled:opacity-50 ml-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="Синхронизировать выплаты с MOEX"
                >
                  <span className={syncing ? 'inline-block animate-spin' : ''}>⟳</span>
                </button>
              )}
            </div>
            {identLine && (
              <div className="text-[length:var(--hi-text-caption)] text-[var(--hi-muted)] mt-0.5">
                {identLine}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setAddFormOpen(!addFormOpen); }}
          data-onboarding="add-payment-btn"
          className="text-[var(--hi-muted)] text-[length:var(--hi-text-body)] hover:text-[var(--hi-gold)] transition-colors flex-shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          + выплата
        </button>
      </div>

      {/* Content (collapsible) */}
      {!collapsed && (
        <>
          {addFormOpen && (
            <AddPaymentForm
              assetId={asset.id!}
              paymentType={paymentType}
              onAdd={async (p) => {
                await addPayment(p);
                setAddFormOpen(false);
              }}
              onCancel={() => setAddFormOpen(false)}
            />
          )}

          {sorted.length > 0 ? (
            sorted.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                onToggleExcluded={toggleExcluded}
                onDelete={deletePayment}
              />
            ))
          ) : (
            <div className="pl-7 pr-3 py-2 text-[var(--hi-muted)] text-[length:var(--hi-text-body)] font-mono">
              Нет выплат
            </div>
          )}
        </>
      )}
    </div>
  );
}

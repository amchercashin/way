import { useState, useRef, useEffect } from 'react';
import type { Asset, PaymentHistory } from '@/models/types';
import { PaymentRow } from './payment-row';
import { AddPaymentForm } from './add-payment-form';
import { toggleExcluded, deletePayment, addPayment } from '@/hooks/use-payment-history';

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
  const [collapsed, setCollapsed] = useState(!isHighlighted && payments.length === 0);
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
  const label = asset.ticker ? `${asset.ticker} · ${asset.name}` : asset.name;

  return (
    <div
      ref={ref}
      className={`border-t border-[var(--way-shadow)]/30${isHighlighted ? ' animate-highlight-pulse' : ''}`}
    >
      {/* Asset header */}
      <div
        className="flex justify-between items-center px-3 py-2 bg-[var(--way-void)] cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[var(--way-muted)] text-[length:var(--way-text-caption)]">{collapsed ? '▸' : '▾'}</span>
          <span className="text-[var(--way-text)] text-[length:var(--way-text-heading)] font-medium truncate">
            {label}
          </span>
          {collapsed && sorted.length > 0 && (
            <span className="text-[var(--way-muted)] text-[length:var(--way-text-body)] flex-shrink-0">({sorted.length})</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setAddFormOpen(!addFormOpen); }}
          className="text-[var(--way-muted)] text-[length:var(--way-text-body)] hover:text-[var(--way-gold)] transition-colors flex-shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
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
            <div className="px-3 py-2 text-[var(--way-muted)] text-[length:var(--way-text-body)] font-mono">
              Нет выплат
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
};

interface AssetPaymentsProps {
  asset: Asset;
  payments: PaymentHistory[];
  isHighlighted?: boolean;
}

export function AssetPayments({ asset, payments, isHighlighted }: AssetPaymentsProps) {
  const [addFormOpen, setAddFormOpen] = useState(false);
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
      <div className="flex justify-between items-center px-3 py-2 bg-[var(--way-void)]">
        <span className="text-[var(--way-text)] text-[13px] font-medium truncate">
          {label}
        </span>
        <button
          onClick={() => setAddFormOpen(!addFormOpen)}
          className="text-[var(--way-muted)] text-[11px] hover:text-[var(--way-gold)] transition-colors flex-shrink-0"
        >
          + выплата
        </button>
      </div>

      {/* Add form */}
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

      {/* Payment rows */}
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
        <div className="px-3 py-2 text-[var(--way-muted)] text-[11px] font-mono">
          Нет выплат
        </div>
      )}
    </div>
  );
}

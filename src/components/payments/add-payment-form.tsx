import { useState } from 'react';
import type { PaymentHistory } from '@/models/types';

interface AddPaymentFormProps {
  assetId: number;
  paymentType: PaymentHistory['type'];
  currency: string;
  onAdd: (payment: Omit<PaymentHistory, 'id'>) => void;
  onCancel: () => void;
}

export function AddPaymentForm({ assetId, paymentType, currency, onAdd, onCancel }: AddPaymentFormProps) {
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [amountStr, setAmountStr] = useState('');

  const handleSubmit = () => {
    const amount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amount) || amount <= 0 || !dateStr) return;

    onAdd({
      assetId,
      amount,
      date: new Date(dateStr),
      type: paymentType,
      dataSource: 'manual',
    });

    setAmountStr('');
  };

  return (
    <div className="grid grid-cols-[minmax(118px,0.95fr)_minmax(0,1fr)_32px_32px] items-center gap-1.5 px-3 py-2 bg-[var(--hi-void)] border-t border-[var(--hi-shadow)]/30">
      <input
        type="date"
        value={dateStr}
        onChange={(e) => setDateStr(e.target.value)}
        aria-label="Дата выплаты"
        className="min-w-0 w-full bg-transparent border border-[var(--hi-shadow)] rounded px-2 py-1 text-base text-[var(--hi-text)] font-mono"
      />
      <input
        type="text"
        inputMode="decimal"
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        placeholder="До НДФЛ"
        aria-label={`Сумма выплаты до НДФЛ, ${currency}`}
        className="min-w-0 w-full bg-transparent border border-[var(--hi-shadow)] rounded px-2 py-1 text-base text-[var(--hi-text)] font-mono"
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <button
        onClick={handleSubmit}
        className="min-w-8 min-h-8 text-[#6bba6b] text-[length:var(--hi-text-body)] hover:text-green-300 transition-colors"
      >
        ✓
      </button>
      <button
        onClick={onCancel}
        className="min-w-8 min-h-8 text-[var(--hi-muted)] text-[length:var(--hi-text-body)] hover:text-[var(--hi-ash)] transition-colors"
      >
        ×
      </button>
    </div>
  );
}

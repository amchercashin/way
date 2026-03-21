import { useState } from 'react';
import type { PaymentHistory } from '@/models/types';

interface AddPaymentFormProps {
  assetId: number;
  paymentType: PaymentHistory['type'];
  onAdd: (payment: Omit<PaymentHistory, 'id'>) => void;
  onCancel: () => void;
}

export function AddPaymentForm({ assetId, paymentType, onAdd, onCancel }: AddPaymentFormProps) {
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
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--way-void)] border-t border-[var(--way-shadow)]/30">
      <input
        type="date"
        value={dateStr}
        onChange={(e) => setDateStr(e.target.value)}
        className="bg-transparent border border-[var(--way-shadow)] rounded px-2 py-1 text-[12px] text-[var(--way-text)] font-mono w-[130px]"
      />
      <input
        type="text"
        inputMode="decimal"
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        placeholder="Сумма ₽"
        className="bg-transparent border border-[var(--way-shadow)] rounded px-2 py-1 text-[12px] text-[var(--way-text)] font-mono w-[90px]"
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <button
        onClick={handleSubmit}
        className="text-[#6bba6b] text-xs hover:text-green-300 transition-colors"
      >
        ✓
      </button>
      <button
        onClick={onCancel}
        className="text-[var(--way-muted)] text-xs hover:text-[var(--way-ash)] transition-colors"
      >
        ×
      </button>
    </div>
  );
}

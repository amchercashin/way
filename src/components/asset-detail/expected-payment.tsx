interface ExpectedPaymentProps {
  paymentPerUnit: number;
  quantity: number;
  nextExpectedDate?: Date;
  nextExpectedCutoffDate?: Date;
  nextExpectedCreditDate?: Date;
}

export function ExpectedPayment({
  paymentPerUnit,
  quantity,
  nextExpectedDate,
  nextExpectedCutoffDate,
  nextExpectedCreditDate,
}: ExpectedPaymentProps) {
  const totalAmount = paymentPerUnit * quantity;

  if (!nextExpectedDate && !nextExpectedCutoffDate) return null;

  const formatDate = (date?: Date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="border border-[rgba(200,180,140,0.08)] rounded-lg p-3.5 mt-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--way-gold)] mb-2">Ожидаемая выплата</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="font-mono text-[9px] text-[var(--way-muted)]">Размер</span>
          <span className="font-mono text-[13px] text-[var(--way-text)]">
            ₽{paymentPerUnit} × {quantity} = ₽{Math.round(totalAmount).toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[9px] text-[var(--way-muted)]">Отсечка (ожид.)</span>
          <span className="font-mono text-[13px] text-[var(--way-text)]">{formatDate(nextExpectedCutoffDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[9px] text-[var(--way-muted)]">Выплата (ожид.)</span>
          <span className="font-mono text-[13px] text-[var(--way-text)]">{formatDate(nextExpectedDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[9px] text-[var(--way-muted)]">Зачисление (ожид.)</span>
          <span className="font-mono text-[13px] text-[var(--way-text)]">{formatDate(nextExpectedCreditDate)}</span>
        </div>
      </div>
    </div>
  );
}

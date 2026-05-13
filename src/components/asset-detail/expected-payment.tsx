interface ExpectedPaymentProps {
  annualIncomePerUnit: number;
  frequencyPerYear: number;
  nextExpectedDate?: Date;
}

export function ExpectedPayment({
  annualIncomePerUnit,
  frequencyPerYear,
  nextExpectedDate,
}: ExpectedPaymentProps) {
  if (!nextExpectedDate || frequencyPerYear <= 0) return null;

  const perPayment = annualIncomePerUnit / frequencyPerYear;

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="border border-[rgba(200,180,140,0.08)] rounded-lg p-3.5 mt-3">
      <div className="font-mono text-[length:var(--hi-text-caption)] uppercase tracking-wider text-[var(--hi-gold)] mb-2">Ожидаемая выплата до НДФЛ</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)]">Выплата на единицу</span>
          <span className="font-mono text-[length:var(--hi-text-body)] text-[var(--hi-text)]">
            {perPayment.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)]">Дата (ожид.)</span>
          <span className="font-mono text-[length:var(--hi-text-body)] text-[var(--hi-text)]">{formatDate(nextExpectedDate)}</span>
        </div>
      </div>
    </div>
  );
}

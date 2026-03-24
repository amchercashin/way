import type { PaymentHistory } from '@/models/types';

interface PaymentRowProps {
  payment: PaymentHistory;
  onToggleExcluded: (id: number) => void;
  onDelete: (id: number) => void;
}

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function PaymentRow({ payment, onToggleExcluded, onDelete }: PaymentRowProps) {
  const isExcluded = payment.excluded;

  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center pl-7 pr-3 py-0.5 text-[length:var(--way-text-body)] border-t border-[var(--way-void)] transition-opacity${isExcluded ? ' opacity-50' : ''}`}
      style={isExcluded ? { borderLeftWidth: 2, borderLeftColor: 'var(--way-gold)' } : undefined}
    >
      {/* Date */}
      <span className={`font-mono tabular-nums text-[var(--way-text)]${isExcluded ? ' line-through' : ''}`}>
        {formatDate(payment.date)}
      </span>

      {/* Amount */}
      <span className={`font-mono tabular-nums text-right text-[var(--way-ash)]${isExcluded ? ' line-through' : ''}`}>
        {payment.amount.toFixed(2)} ₽
      </span>

      {/* Source badge */}
      <span className={`text-[10px] leading-tight px-1 py-px rounded ${
        payment.dataSource === 'moex'
          ? 'bg-[#2d5a2d] text-[#6bba6b]'
          : 'bg-[#5a5a2d] text-[#baba6b]'
      }`}>
        {payment.dataSource === 'moex' ? 'moex' : 'ручной'}
      </span>

      {/* Actions */}
      <div className="flex gap-1 ml-1">
        {isExcluded ? (
          <>
            <button
              onClick={() => onToggleExcluded(payment.id!)}
              className="text-[#6bba6b] hover:text-green-300 text-[length:var(--way-text-heading)] min-w-[32px] min-h-[28px] flex items-center justify-center transition-colors"
              title="Восстановить"
            >
              ↩
            </button>
            <button
              onClick={() => onDelete(payment.id!)}
              className="text-red-400 hover:text-red-300 text-[length:var(--way-text-title)] min-w-[32px] min-h-[28px] flex items-center justify-center transition-colors"
              title="Удалить навсегда"
            >
              ×
            </button>
          </>
        ) : (
          <button
            onClick={() => onToggleExcluded(payment.id!)}
            className="text-[var(--way-gold)] hover:text-yellow-300 text-[length:var(--way-text-heading)] min-w-[32px] min-h-[28px] flex items-center justify-center transition-colors"
            title="Исключить из расчётов"
          >
            ⊘
          </button>
        )}
      </div>
    </div>
  );
}

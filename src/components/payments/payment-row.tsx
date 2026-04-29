import type { PaymentHistory } from '@/models/types';
import { formatMoney } from '@/lib/utils';

interface PaymentRowProps {
  payment: PaymentHistory;
  currency: string;
  onDelete: (id: number) => void;
}

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

const SOURCE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  moex:   { label: 'moex',   bg: 'bg-[#2d5a2d]', text: 'text-[#6bba6b]' },
  dohod:  { label: 'dohod',  bg: 'bg-[#2d3d5a]', text: 'text-[#6b9eba]' },
  parus:  { label: 'parus',  bg: 'bg-[#4a2d5a]', text: 'text-[#ba8bd4]' },
  manual: { label: 'ручной', bg: 'bg-[#5a5a2d]', text: 'text-[#baba6b]' },
  import: { label: 'импорт', bg: 'bg-[#3a3a3a]', text: 'text-[#9a9a9a]' },
};

export function PaymentRow({ payment, currency, onDelete }: PaymentRowProps) {
  const isForecast = payment.isForecast;
  const badge = SOURCE_BADGE[payment.dataSource] ?? SOURCE_BADGE.manual;

  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center pl-7 pr-3 py-0.5 text-[length:var(--hi-text-body)] border-t border-[var(--hi-void)]${isForecast ? ' opacity-60' : ''}`}
    >
      {/* Date */}
      <span className="font-mono tabular-nums text-[var(--hi-text)]">
        {formatDate(payment.date)}
      </span>

      {/* Amount */}
      <span className="font-mono tabular-nums text-right text-[var(--hi-ash)]">
        {formatMoney(payment.amount, currency)}
      </span>

      {/* Source badge + forecast label */}
      <span className="flex items-center gap-1">
        <span className={`text-[10px] leading-tight px-1 py-px rounded ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
        {isForecast && (
          <span className="text-[length:var(--hi-text-micro)] text-[var(--hi-muted)] italic">
            прогноз
          </span>
        )}
      </span>

      {/* Actions: delete for manual only */}
      <div className="flex gap-1 ml-1">
        <button
          onClick={() => onDelete(payment.id!)}
          className="text-red-400 hover:text-red-300 text-[length:var(--hi-text-title)] min-w-[32px] min-h-[28px] flex items-center justify-center transition-colors"
          title="Удалить"
        >
          ×
        </button>
      </div>
    </div>
  );
}

import { formatCurrencyFull, formatPercent, formatCurrency } from '@/lib/utils';
import { useCountUp } from '@/hooks/use-count-up';

interface HeroIncomeProps {
  income: number | null;
  yieldPercent: number | null;
  totalValue: number | null;
  mode: 'month' | 'year';
  onToggle: () => void;
}

export function HeroIncome({ income, yieldPercent, totalValue, mode, onToggle }: HeroIncomeProps) {
  const animatedIncome = useCountUp(income);

  return (
    <div className="text-center mb-4" style={{ animation: 'way-fade-slide-up 0.7s ease-out 0.2s both' }}>
      <div className="font-mono text-[length:var(--way-text-caption)] uppercase tracking-[0.3em] text-[var(--way-ash)]"
           style={{ animation: 'way-fade-in 0.5s ease-out 0.3s both' }}>
        расчётный пассивный доход
      </div>
      <div className="font-serif text-[length:var(--way-text-display)] font-light text-[var(--way-gold)] tracking-tight mt-1"
           style={{ animation: 'way-fade-scale-in 0.8s ease-out 0.4s both' }}>
        {formatCurrencyFull(animatedIncome)}
      </div>
      <div className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)] mt-0.5"
           style={{ animation: 'way-fade-in 0.5s ease-out 0.6s both' }}>
        доходность {formatPercent(yieldPercent)} · портфель {formatCurrency(totalValue)}
      </div>
      <div style={{ animation: 'way-fade-in 0.5s ease-out 0.7s both' }}>
        <button
          onClick={onToggle}
          className="mt-3 inline-flex border border-[rgba(200,180,140,0.12)] rounded overflow-hidden"
        >
          <span className={`px-4 py-2 font-mono text-[length:var(--way-text-caption)] tracking-[0.15em] transition-colors ${
            mode === 'month'
              ? 'bg-[rgba(200,180,140,0.08)] text-[var(--way-gold)]'
              : 'text-[var(--way-ash)]'
          }`}>
            МЕС
          </span>
          <span className={`px-4 py-2 font-mono text-[length:var(--way-text-caption)] tracking-[0.15em] transition-colors ${
            mode === 'year'
              ? 'bg-[rgba(200,180,140,0.08)] text-[var(--way-gold)]'
              : 'text-[var(--way-ash)]'
          }`}>
            ГОД
          </span>
        </button>
      </div>
    </div>
  );
}

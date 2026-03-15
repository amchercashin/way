import { formatCurrencyFull, formatPercent, formatCurrency } from '@/lib/utils';

interface HeroIncomeProps {
  income: number;
  yieldPercent: number;
  totalValue: number;
  mode: 'month' | 'year';
  onToggle: () => void;
}

export function HeroIncome({ income, yieldPercent, totalValue, mode, onToggle }: HeroIncomeProps) {
  return (
    <div className="text-center mb-4">
      <div className="text-gray-500 text-xs">расчётный пассивный доход</div>
      <div className="text-[#4ecca3] text-[32px] font-bold tracking-tight mt-1">
        {formatCurrencyFull(income)}
      </div>
      <div className="text-gray-600 text-xs mt-0.5">
        доходность {formatPercent(yieldPercent)} · портфель {formatCurrency(totalValue)}
      </div>
      <button
        onClick={onToggle}
        className="mt-3 inline-flex bg-[#1a1a2e] rounded-full p-0.5"
      >
        <span className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
          mode === 'month' ? 'bg-[#4ecca3] text-black' : 'text-gray-500'
        }`}>
          мес
        </span>
        <span className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
          mode === 'year' ? 'bg-[#4ecca3] text-black' : 'text-gray-500'
        }`}>
          год
        </span>
      </button>
    </div>
  );
}

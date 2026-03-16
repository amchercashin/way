import { formatCurrency, formatPercent } from '@/lib/utils';

interface StatBlocksProps {
  incomePerMonth: number | null;
  totalValue: number | null;
  yieldPercent: number | null;
  portfolioSharePercent: number | null;
  activeMetric?: 'fact' | 'forecast';
  onIncomeTap?: () => void;
}

function statColor(raw: number | null, accent: boolean): string {
  if (raw == null) return 'text-gray-600';
  return accent ? 'text-[#4ecca3]' : 'text-white';
}

export function StatBlocks({ incomePerMonth, totalValue, yieldPercent, portfolioSharePercent, activeMetric, onIncomeTap }: StatBlocksProps) {
  const stats = [
    { label: 'Доход/мес', value: formatCurrency(incomePerMonth), color: statColor(incomePerMonth, true) },
    { label: 'Стоимость', value: formatCurrency(totalValue), color: statColor(totalValue, false) },
    { label: 'Доходность', value: formatPercent(yieldPercent), color: statColor(yieldPercent, true) },
    { label: 'Доля портф.', value: formatPercent(portfolioSharePercent), color: statColor(portfolioSharePercent, false) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`bg-[#1a1a2e] rounded-xl p-3 text-center ${index === 0 && onIncomeTap ? 'cursor-pointer' : ''}`}
          onClick={index === 0 ? onIncomeTap : undefined}
        >
          <div className="text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</div>
          <div className={`text-[15px] font-semibold mt-1 ${stat.color}`}>
            {stat.value}
          </div>
          {index === 0 && activeMetric && (
            <div className="flex justify-center gap-1 mt-1">
              <span className={`text-[9px] w-3.5 h-3.5 leading-[14px] rounded-full text-center font-semibold ${
                activeMetric === 'fact' ? 'bg-[#4ecca3] text-[#0d1117]' : 'bg-[#333] text-gray-600'
              }`}>ф</span>
              <span className={`text-[9px] w-3.5 h-3.5 leading-[14px] rounded-full text-center font-semibold ${
                activeMetric === 'forecast' ? 'bg-[#4ecca3] text-[#0d1117]' : 'bg-[#333] text-gray-600'
              }`}>п</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

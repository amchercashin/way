import { formatCurrency, formatPercent } from '@/lib/utils';

interface StatBlocksProps {
  incomePerMonth: number | null;
  totalValue: number | null;
  yieldPercent: number | null;
  portfolioSharePercent: number | null;
  isManualIncome?: boolean;
}

function statColor(raw: number | null, accent: boolean): string {
  if (raw == null) return 'text-gray-600';
  return accent ? 'text-[#4ecca3]' : 'text-white';
}

export function StatBlocks({ incomePerMonth, totalValue, yieldPercent, portfolioSharePercent, isManualIncome }: StatBlocksProps) {
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
          className="bg-[#1a1a2e] rounded-xl p-3 text-center"
        >
          <div className="text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</div>
          <div className={`text-[15px] font-semibold mt-1 ${stat.color}`}>
            {stat.value}
          </div>
          {index === 0 && isManualIncome != null && (
            <div className="flex justify-center mt-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                isManualIncome
                  ? 'bg-[#431407] text-[#fb923c]'
                  : 'bg-[#14532d] text-[#4ade80]'
              }`}>
                {isManualIncome ? 'р' : 'ф'}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

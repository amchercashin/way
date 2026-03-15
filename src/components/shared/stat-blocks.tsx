import { formatCurrency, formatPercent } from '@/lib/utils';

interface StatBlocksProps {
  incomePerMonth: number;
  totalValue: number;
  yieldPercent: number;
  portfolioSharePercent: number;
}

export function StatBlocks({ incomePerMonth, totalValue, yieldPercent, portfolioSharePercent }: StatBlocksProps) {
  const stats = [
    { label: 'Доход/мес', value: formatCurrency(incomePerMonth), green: true },
    { label: 'Стоимость', value: formatCurrency(totalValue), green: false },
    { label: 'Доходность', value: formatPercent(yieldPercent), green: true },
    { label: 'Доля портф.', value: formatPercent(portfolioSharePercent), green: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-[#1a1a2e] rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</div>
          <div className={`text-[15px] font-semibold mt-1 ${stat.green ? 'text-[#4ecca3]' : 'text-white'}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

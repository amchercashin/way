import { formatCurrency, formatPercent } from '@/lib/utils';

interface StatBlocksProps {
  incomePerMonth: number | null;
  totalValue: number | null;
  yieldPercent: number | null;
  portfolioSharePercent: number | null;
  isManualIncome?: boolean;
}

function statColor(raw: number | null, accent: boolean): string {
  if (raw == null) return 'text-[var(--way-muted)]';
  return accent ? 'text-[var(--way-gold)]' : 'text-[var(--way-text)]';
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
          className="bg-[rgba(200,180,140,0.03)] border border-[rgba(200,180,140,0.04)] rounded-lg p-3 text-center"
        >
          <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--way-shadow)]">{stat.label}</div>
          <div className={`font-mono text-[14px] font-medium mt-1 ${stat.color}`}>
            {stat.value}
          </div>
          {index === 0 && isManualIncome != null && (
            <div className="flex justify-center mt-1">
              <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded ${
                isManualIncome
                  ? 'bg-[rgba(90,85,72,0.15)] text-[var(--way-ash)]'
                  : 'bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]'
              }`}>
                {isManualIncome ? 'ручной' : 'факт'}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

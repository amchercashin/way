import { formatCurrency } from '@/lib/utils';
import type { PaymentRecord } from '@/services/income-calculator';
import { calcCAGR } from '@/services/income-calculator';

interface PaymentHistoryChartProps {
  history: PaymentRecord[];
  quantity: number;
}

export function PaymentHistoryChart({ history, quantity }: PaymentHistoryChartProps) {
  if (history.length === 0) {
    return (
      <div className="bg-[#1a1a2e] rounded-xl p-4 mt-4 text-center text-gray-600 text-xs">
        Нет данных о выплатах
      </div>
    );
  }

  const now = new Date();
  const cagr = calcCAGR(history, now);

  const byYear = new Map<number, number>();
  for (const p of history) {
    const year = p.date.getFullYear();
    byYear.set(year, (byYear.get(year) ?? 0) + p.amount * quantity);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const values = years.map((y) => byYear.get(y)!);
  const maxValue = Math.max(...values, 1);

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-4 mt-4">
      {cagr != null && (
        <div className="text-xs text-[#4ecca3] font-semibold mb-3">
          CAGR {cagr > 0 ? '+' : ''}{cagr.toFixed(1)}%
        </div>
      )}
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {years.map((year, i) => {
          const height = Math.max((values[i] / maxValue) * 100, 2);
          return (
            <div key={year} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-[#4ecca3] rounded-t"
                style={{ height: `${height}%` }}
                title={formatCurrency(values[i])}
              />
              <span className="text-[9px] text-gray-500">
                &apos;{String(year).slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

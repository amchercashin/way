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
      <div className="bg-[rgba(200,180,140,0.02)] border border-[rgba(200,180,140,0.04)] rounded-lg p-4 mt-4 text-center font-mono text-[var(--way-muted)] text-xs">
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

  const barOpacity = (i: number) => {
    const min = 0.15;
    const max = 1;
    const t = years.length > 1 ? i / (years.length - 1) : 1;
    return min + t * (max - min);
  };

  return (
    <div className="bg-[rgba(200,180,140,0.02)] rounded-lg p-4 mt-4">
      {cagr != null && (
        <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--way-shadow)] mb-3">
          CAGR {cagr > 0 ? '+' : ''}{cagr.toFixed(1)}%
        </div>
      )}
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {years.map((year, i) => {
          const heightPx = Math.max(Math.round((values[i] / maxValue) * 100), 3);
          return (
            <div key={year} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
              <div
                className="w-full rounded-t min-w-[4px]"
                style={{
                  height: heightPx,
                  background: `rgba(200,180,140,${barOpacity(i)})`,
                  transformOrigin: 'bottom',
                  animation: `way-bar-grow 0.8s ease-out ${1.2 + i * 0.1}s both`,
                }}
                title={formatCurrency(values[i])}
              />
              <span className="font-mono text-[8px] text-[var(--way-shadow)] mt-1 shrink-0">
                &apos;{String(year).slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

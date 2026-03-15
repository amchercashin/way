import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS, type AssetType } from '@/models/types';
import { formatCurrency } from '@/lib/utils';

export interface CategoryIncome {
  type: AssetType;
  incomePerMonth: number;
}

interface IncomeChartProps {
  categories: CategoryIncome[];
  cagr?: number | null;
}

export function IncomeChart({ categories, cagr }: IncomeChartProps) {
  const maxIncome = Math.max(...categories.map((c) => c.incomePerMonth), 1);

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-3 mt-4">
      {cagr != null && (
        <div className="text-center text-[13px] font-bold text-[#4ecca3] mb-2">
          CAGR {cagr > 0 ? '+' : ''}{cagr.toFixed(1)}%
        </div>
      )}
      {categories.length === 0 ? (
        <div className="h-11 flex items-center justify-center text-gray-600 text-xs">
          График будет доступен при наличии активов
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.type}>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-gray-400">{ASSET_TYPE_LABELS[cat.type]}</span>
                <span className="text-gray-300">{formatCurrency(cat.incomePerMonth)}/мес</span>
              </div>
              <div className="bg-[#0d1117] rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${(cat.incomePerMonth / maxIncome) * 100}%`,
                    backgroundColor: ASSET_TYPE_COLORS[cat.type],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

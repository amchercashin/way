interface IncomeChartProps {
  cagr?: number | null;
}

export function IncomeChart({ cagr }: IncomeChartProps) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-3 mt-4">
      {cagr != null && (
        <div className="text-center text-[13px] font-bold text-[#4ecca3] mb-2">
          CAGR {cagr > 0 ? '+' : ''}{cagr.toFixed(1)}%
        </div>
      )}
      <div className="h-11 flex items-center justify-center text-gray-600 text-xs">
        График будет доступен при наличии истории выплат
      </div>
    </div>
  );
}

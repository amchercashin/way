import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface IncomeMetricPanelProps {
  factPerMonth: number;
  forecastPerMonth: number | null;
  activeMetric: 'fact' | 'forecast';
  decayAverage: number | null;
  forecastAmount: number | null;
  onSelectMetric: (metric: 'fact' | 'forecast') => void;
  onSetForecastAmount: (amount: number) => void;
  onApplyDecayAverage?: () => void;
}

export function IncomeMetricPanel({
  factPerMonth,
  forecastPerMonth,
  activeMetric,
  decayAverage,
  forecastAmount,
  onSelectMetric,
  onSetForecastAmount,
  onApplyDecayAverage,
}: IncomeMetricPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEditing = () => {
    setDraft(forecastAmount != null ? String(forecastAmount) : '');
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    const num = parseFloat(draft.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!isNaN(num) && num >= 0) {
      onSetForecastAmount(num);
      if (activeMetric !== 'forecast') onSelectMetric('forecast');
    }
  };

  return (
    <div className="bg-[#1a1a2e] border border-[#4ecca344] rounded-b-xl p-2.5 mb-2">
      <div
        className={`p-2 rounded-lg text-center cursor-pointer mb-1.5 ${
          activeMetric === 'fact' ? 'bg-[#252540] border border-[#4ecca3]' : 'bg-[#252540]'
        }`}
        onClick={() => onSelectMetric('fact')}
      >
        <div className={`text-[9px] uppercase ${activeMetric === 'fact' ? 'text-[#4ecca3]' : 'text-gray-500'}`}>
          Факт 12 мес {activeMetric === 'fact' && '✓'}
        </div>
        <div className={`text-sm font-semibold mt-0.5 ${activeMetric === 'fact' ? 'text-[#4ecca3]' : 'text-gray-400'}`}>
          {formatCurrency(factPerMonth)}
        </div>
      </div>

      <div
        className={`p-2 rounded-lg text-center cursor-pointer ${
          activeMetric === 'forecast' ? 'bg-[#252540] border border-[#4ecca3]' : 'bg-[#252540]'
        }`}
        onClick={() => forecastAmount != null && onSelectMetric('forecast')}
      >
        <div className={`text-[9px] uppercase ${activeMetric === 'forecast' ? 'text-[#4ecca3]' : 'text-gray-500'}`}>
          Прогноз {activeMetric === 'forecast' && '✓'}
        </div>
        {editing ? (
          <input
            className="w-full bg-[#0d1117] border border-[#4ecca3] rounded-lg px-2 py-1 text-sm text-white text-center outline-none mt-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            placeholder="Сумма на ед."
          />
        ) : (
          <div
            className={`text-sm font-semibold mt-0.5 cursor-pointer ${
              activeMetric === 'forecast' ? 'text-[#4ecca3]' : 'text-gray-400'
            } ${forecastAmount != null ? 'underline decoration-dashed decoration-[#4ecca366] underline-offset-2' : ''}`}
            onClick={(e) => { e.stopPropagation(); startEditing(); }}
          >
            {forecastPerMonth != null ? formatCurrency(forecastPerMonth) : '— Укажите'}
          </div>
        )}
      </div>

      {decayAverage != null && (
        <div className="mt-2">
          <button
            className="text-[10px] text-gray-300 bg-[#0d1117] px-2 py-1 rounded-md border border-[#333] w-full text-left"
            onClick={() => onApplyDecayAverage?.()}
          >
            ⟳ Подставить среднее: <span className="text-[#4ecca3] font-semibold">{formatCurrency(decayAverage)}</span>
          </button>
          <div className="text-[8px] text-gray-600 mt-1">
            Последние годовые ÷ всё прошедшее время.
          </div>
        </div>
      )}
    </div>
  );
}

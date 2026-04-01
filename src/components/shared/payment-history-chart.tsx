import { useState, useRef, useEffect, useMemo } from 'react';
import { formatCompact } from '@/lib/utils';
import type { PaymentRecord } from '@/services/income-calculator';
import { calcCAGR } from '@/services/income-calculator';

export interface ChartPaymentRecord extends PaymentRecord {
  isForecast?: boolean;
}

interface PaymentHistoryChartProps {
  history: ChartPaymentRecord[];
  paymentPerUnit?: number;
}

export function PaymentHistoryChart({
  history,
  paymentPerUnit,
}: PaymentHistoryChartProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();

  // Group history by year (per-unit amounts — no quantity multiplication)
  const byYear = useMemo(() => {
    const map = new Map<number, { total: number; forecastTotal: number; payments: { date: Date; amount: number; isForecast?: boolean }[] }>();
    for (const p of history) {
      const year = p.date.getFullYear();
      const entry = map.get(year) ?? { total: 0, forecastTotal: 0, payments: [] };
      if (p.isForecast) {
        entry.forecastTotal += p.amount;
      } else {
        entry.total += p.amount;
      }
      entry.payments.push({ date: p.date, amount: p.amount, isForecast: p.isForecast });
      map.set(year, entry);
    }
    for (const entry of map.values()) {
      entry.payments.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    return map;
  }, [history]);

  // Build continuous year range: first data year → current year (fill gaps with zero)
  const years = useMemo(() => {
    const dataYears = [...byYear.keys()].sort((a, b) => a - b);
    if (dataYears.length === 0) return [];
    const firstYear = dataYears[0];
    const lastYear = Math.max(dataYears[dataYears.length - 1], currentYear);
    const range: number[] = [];
    for (let y = firstYear; y <= lastYear; y++) {
      range.push(y);
      // Ensure every year has an entry in byYear (even if zero)
      if (!byYear.has(y)) {
        byYear.set(y, { total: 0, forecastTotal: 0, payments: [] });
      }
    }
    return range;
  }, [byYear, currentYear]);

  // No-history fallback: single bar with calculated annual
  const isNoHistory = history.length === 0;
  const fallbackAnnual =
    isNoHistory && paymentPerUnit != null
      ? paymentPerUnit
      : null;

  // Nothing to show at all
  if (isNoHistory && fallbackAnnual == null) {
    return (
      <div className="bg-[rgba(200,180,140,0.02)] border border-[rgba(200,180,140,0.04)] rounded-lg p-4 mt-4 text-center font-mono text-[var(--hi-muted)] text-xs">
        Нет данных о выплатах
      </div>
    );
  }

  // For fallback: fake single-year data
  const displayYears = isNoHistory ? [currentYear] : years;
  const displayValues = isNoHistory
    ? [fallbackAnnual!]
    : displayYears.map((y) => byYear.get(y)!.total + (byYear.get(y)!.forecastTotal ?? 0));
  const maxValue = Math.max(...displayValues, 1);

  // CAGR from per-unit history (excludes current year, needs >=2 full years)
  const activeHistory = useMemo(() => history.filter(p => !p.isForecast), [history]);
  const cagr = useMemo(
    () => (isNoHistory ? null : calcCAGR(activeHistory, new Date())),
    [activeHistory, isNoHistory],
  );

  const barOpacity = (i: number) => {
    const min = 0.15;
    const max = 0.85;
    const t = displayYears.length > 1 ? i / (displayYears.length - 1) : 1;
    return min + t * (max - min);
  };

  // Scroll to right edge on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [displayYears.length]);

  // Close panel on click outside
  useEffect(() => {
    if (selectedYear == null) return;
    const handler = (e: MouseEvent) => {
      const chart = scrollRef.current?.parentElement;
      if (chart && !chart.contains(e.target as Node)) {
        setSelectedYear(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [selectedYear]);

  const handleBarClick = (year: number) => {
    setSelectedYear((prev) => (prev === year ? null : year));
  };

  // Format date as "14 мар"
  const formatShortDate = (date: Date) =>
    date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');

  // Detail panel content
  const renderDetailPanel = () => {
    if (selectedYear == null) return null;

    const isCurrentYear = selectedYear === currentYear;

    // No-history fallback panel
    if (isNoHistory && paymentPerUnit != null) {
      return (
        <div className="bg-[#252220] border border-[rgba(200,180,140,0.1)] rounded-lg px-3 py-2.5 mt-2.5 animate-[hi-panel-in_0.2s_ease]">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-gold)] font-medium">{selectedYear}</span>
            <span className="font-mono text-[length:var(--hi-text-caption)] text-[#b0a898]">{formatCompact(fallbackAnnual!)} ₽ / ед.</span>
          </div>
          <div className="font-mono text-[length:var(--hi-text-micro)] text-[#3a3530] italic">
            Расчётно: {formatCompact(paymentPerUnit)} ₽ / год
          </div>
        </div>
      );
    }

    const yearData = byYear.get(selectedYear);
    if (!yearData) return null;

    return (
      <div className="bg-[#252220] border border-[rgba(200,180,140,0.1)] rounded-lg px-3 py-2.5 mt-2.5 animate-[hi-panel-in_0.2s_ease]">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-gold)] font-medium">
            {selectedYear}
            {isCurrentYear && (
              <span className="text-[length:var(--hi-text-micro)] text-[var(--hi-muted)] font-normal ml-1.5">· неполный</span>
            )}
          </span>
          <span className="font-mono text-[length:var(--hi-text-caption)] text-[#b0a898]">
            {formatCompact(yearData.total)} ₽ / ед.
          </span>
        </div>
        {yearData.payments.map((p, i) => (
          <div key={i} className={`flex justify-between font-mono text-[length:var(--hi-text-caption)] mb-0.5${p.isForecast ? ' opacity-60' : ''}`}>
            <span className="text-[#4a4540]">
              {formatShortDate(p.date)}
              {p.isForecast && <span className="text-[length:var(--hi-text-micro)] text-[var(--hi-muted)] italic ml-1">прогноз</span>}
            </span>
            <span className="text-[#b0a898]">{formatCompact(p.amount)} ₽</span>
          </div>
        ))}
        {isCurrentYear && (
          <div className="font-mono text-[length:var(--hi-text-micro)] text-[#3a3530] italic mt-1.5">
            Год не завершён — итого за {selectedYear} обновится
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[rgba(200,180,140,0.02)] rounded-lg p-4 mt-4">
      {/* Header */}
      <div className="flex justify-between items-baseline mb-3">
        <span className="font-mono text-[length:var(--hi-text-caption)] uppercase tracking-wider text-[var(--hi-muted)]">
          Выплата на единицу, ₽
        </span>
        {cagr != null && (
          <span className="font-mono text-[length:var(--hi-text-micro)] text-[var(--hi-gold)] tracking-wide">
            CAGR {cagr > 0 ? '+' : ''}{cagr.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Bars */}
      <div
        ref={scrollRef}
        className="flex items-end gap-[5px] overflow-x-auto"
        style={{
          height: 120,
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(200,180,140,0.15) transparent',
        }}
      >
        {displayYears.map((year, i) => {
          const isCurrentYr = year === currentYear;
          const isSelected = year === selectedYear;

          return (
            <div
              key={year}
              className="flex flex-col items-center justify-end cursor-pointer"
              style={{
                flex: '1 1 0',
                maxWidth: 64,
                minWidth: 36,
                height: '100%',
                scrollSnapAlign: 'start',
              }}
              onClick={() => handleBarClick(year)}
            >
              {/* Value label — facts only */}
              <span
                className="font-mono text-[length:var(--hi-text-micro)] mb-[3px] whitespace-nowrap shrink-0"
                style={{ color: isCurrentYr ? '#4a4540' : '#b0a898' }}
              >
                {formatCompact(byYear.get(year)?.total ?? 0)}
              </span>

              {/* Bar — stacked: fact + forecast */}
              {(() => {
                const yearData = byYear.get(year);
                const forecastValue = yearData?.forecastTotal ?? 0;
                const factValue = yearData?.total ?? 0;
                const factHeightPx = Math.max(Math.round((factValue / maxValue) * 100), factValue > 0 ? 3 : 0);
                const forecastHeightPx = forecastValue > 0
                  ? Math.max(Math.round((forecastValue / maxValue) * 100), 3)
                  : 0;

                return (
                  <div className="w-full flex flex-col items-stretch" style={{ minWidth: 6 }}>
                    {forecastHeightPx > 0 && (
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: forecastHeightPx,
                          background: 'rgba(200,180,140,0.12)',
                          border: '1px dashed rgba(200,180,140,0.25)',
                          borderBottom: 'none',
                          transformOrigin: 'bottom',
                          animation: `hi-bar-grow 0.8s ease-out ${1.2 + i * 0.1}s both`,
                        }}
                      />
                    )}
                    <div
                      className={`w-full ${forecastHeightPx > 0 ? '' : 'rounded-t'}`}
                      style={{
                        height: factHeightPx || 3,
                        background: isCurrentYr
                          ? 'rgba(200,180,140,0.05)'
                          : `rgba(200,180,140,${barOpacity(i)})`,
                        border: isCurrentYr ? '1px dashed rgba(200,180,140,0.3)' : 'none',
                        outline: isSelected ? '1px solid rgba(200,180,140,0.5)' : 'none',
                        outlineOffset: isSelected ? 1 : 0,
                        transformOrigin: 'bottom',
                        animation: `hi-bar-grow 0.8s ease-out ${1.2 + i * 0.1}s both`,
                      }}
                    />
                  </div>
                );
              })()}

              {/* Year label */}
              <span
                className="font-mono text-[length:var(--hi-text-micro)] mt-1 shrink-0"
                style={{ color: isCurrentYr ? 'var(--hi-gold)' : '#4a4540' }}
              >
                &apos;{String(year).slice(2)}{isCurrentYr ? '~' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {renderDetailPanel()}
    </div>
  );
}

# Chart Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the payment history chart to only exist on the asset detail page, showing per-unit payments with flex bars, horizontal scroll, compact K-labels, and an interactive detail panel.

**Architecture:** Rewrite `PaymentHistoryChart` as a stateful component with `selectedYear` state for the detail panel. Add `formatCompact()` to utils. Remove chart from main and category pages. No new dependencies.

**Tech Stack:** React 19, Tailwind v4 (inline classes), Vitest, TypeScript strict mode

---

### Task 1: Add `formatCompact` utility with tests

**Files:**
- Modify: `src/lib/utils.ts`
- Modify: `tests/lib/utils.test.ts`

- [ ] **Step 1: Write tests for `formatCompact`**

Add to `tests/lib/utils.test.ts`:

```typescript
import { formatCompact } from '@/lib/utils';

describe('formatCompact', () => {
  it('returns integer string for values under 1000', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(52)).toBe('52');
    expect(formatCompact(120)).toBe('120');
    expect(formatCompact(999)).toBe('999');
  });

  it('formats thousands with K suffix, dropping .0', () => {
    expect(formatCompact(1000)).toBe('1K');
    expect(formatCompact(2000)).toBe('2K');
    expect(formatCompact(85000)).toBe('85K');
    expect(formatCompact(142000)).toBe('142K');
  });

  it('keeps one decimal when significant', () => {
    expect(formatCompact(1050)).toBe('1.1K');
    expect(formatCompact(1200)).toBe('1.2K');
    expect(formatCompact(1949)).toBe('1.9K');
    expect(formatCompact(3400)).toBe('3.4K');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/utils.test.ts`
Expected: FAIL — `formatCompact` is not exported from `@/lib/utils`

- [ ] **Step 3: Implement `formatCompact`**

Add to `src/lib/utils.ts`:

```typescript
export function formatCompact(value: number): string {
  if (value < 1000) return String(Math.round(value));
  const k = value / 1000;
  const rounded = Math.round(k * 10) / 10;
  return rounded % 1 === 0 ? `${rounded}K` : `${rounded.toFixed(1)}K`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/utils.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts tests/lib/utils.test.ts
git commit -m "feat: add formatCompact utility for chart labels"
```

---

### Task 2: Remove chart from main page

**Files:**
- Modify: `src/pages/main-page.tsx`

- [ ] **Step 1: Remove chart-related code from `main-page.tsx`**

Remove these lines/blocks:
1. Import of `PaymentHistoryChart` (line 5)
2. Import of `useAllPaymentHistory` (line 9)
3. Import of `useLiveQuery` from `dexie-react-hooks` (line 10)
4. Import of `db` from `@/db/database` (line 11)
5. The `allHistory` variable (line 23): `const allHistory = useAllPaymentHistory();`
6. The `assets` variable (line 24): `const assets = useLiveQuery(() => db.assets.toArray(), [], []);`
7. The entire `portfolioHistory` useMemo (lines 26–32)
8. The `<PaymentHistoryChart ... />` JSX (line 101)

After cleanup the imports should be:
```typescript
import { useState, useEffect, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { HeroIncome } from '@/components/main/hero-income';
import { CategoryCard } from '@/components/main/category-card';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useMoexSync } from '@/hooks/use-moex-sync';
import { getAppSettings } from '@/services/app-settings';
```

Note: `useMemo` is also removed from the react import since it was only used for `portfolioHistory`.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: no TypeScript errors (strict mode with `noUnusedLocals`)

- [ ] **Step 3: Commit**

```bash
git add src/pages/main-page.tsx
git commit -m "refactor: remove payment history chart from main page"
```

---

### Task 3: Remove chart from category page

**Files:**
- Modify: `src/pages/category-page.tsx`

- [ ] **Step 1: Remove chart-related code from `category-page.tsx`**

1. Remove import of `PaymentHistoryChart` (line 5)
2. Remove `<PaymentHistoryChart history={categoryHistory} quantity={1} />` JSX (line 82)
3. In the `useMemo` (lines 23–42), remove:
   - The `categoryAssetIds` variable (line 32)
   - The `assetMap` variable (line 33)
   - The entire `categoryHistory` variable (lines 34–39)
   - Remove `categoryHistory` from the return object (line 41) — return only `{ historyByAsset, now }`
4. Update the destructuring on line 23: `const { historyByAsset, now } = useMemo(...)`

The cleaned-up memo should be:
```typescript
const { historyByAsset, now } = useMemo(() => {
  const now = new Date();
  const historyByAsset = new Map<number, PaymentRecord[]>();
  for (const h of (allHistory ?? [])) {
    const arr = historyByAsset.get(h.assetId) ?? [];
    arr.push({ amount: h.amount, date: new Date(h.date) });
    historyByAsset.set(h.assetId, arr);
  }
  return { historyByAsset, now };
}, [allHistory]);
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/category-page.tsx
git commit -m "refactor: remove payment history chart from category page"
```

---

### Task 4: Rewrite `PaymentHistoryChart` component

**Files:**
- Rewrite: `src/components/shared/payment-history-chart.tsx`

This is the core task. The component gets a full rewrite with new props, flex layout, scroll, compact labels, detail panel, and no-history fallback.

- [ ] **Step 1: Rewrite the component**

Replace the entire content of `src/components/shared/payment-history-chart.tsx` with:

```typescript
import { useState, useRef, useEffect, useMemo } from 'react';
import { formatCompact } from '@/lib/utils';
import type { PaymentRecord } from '@/services/income-calculator';
import { calcCAGR } from '@/services/income-calculator';

interface PaymentHistoryChartProps {
  history: PaymentRecord[];
  paymentPerUnit?: number;
  frequencyPerYear?: number;
}

/** Maps frequencyPerYear → Russian abbreviated label for the detail panel */
function frequencyLabel(freq: number): string {
  if (freq >= 12) return `${freq} мес`;
  if (freq === 4) return '4 кв';
  if (freq === 2) return '2 полуг';
  return `${freq} год`;
}

export function PaymentHistoryChart({
  history,
  paymentPerUnit,
  frequencyPerYear,
}: PaymentHistoryChartProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const currentYear = now.getFullYear();

  // Group history by year (per-unit amounts — no quantity multiplication)
  const byYear = useMemo(() => {
    const map = new Map<number, { total: number; payments: { date: Date; amount: number }[] }>();
    for (const p of history) {
      const year = p.date.getFullYear();
      const entry = map.get(year) ?? { total: 0, payments: [] };
      entry.total += p.amount;
      entry.payments.push({ date: p.date, amount: p.amount });
      map.set(year, entry);
    }
    // Sort payments within each year by date
    for (const entry of map.values()) {
      entry.payments.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    return map;
  }, [history]);

  const years = useMemo(() => [...byYear.keys()].sort((a, b) => a - b), [byYear]);

  // No-history fallback: single bar with calculated annual
  const isNoHistory = history.length === 0;
  const fallbackAnnual =
    isNoHistory && paymentPerUnit != null && frequencyPerYear != null
      ? paymentPerUnit * frequencyPerYear
      : null;

  // Nothing to show at all
  if (isNoHistory && fallbackAnnual == null) {
    return (
      <div className="bg-[rgba(200,180,140,0.02)] border border-[rgba(200,180,140,0.04)] rounded-lg p-4 mt-4 text-center font-mono text-[var(--way-muted)] text-xs">
        Нет данных о выплатах
      </div>
    );
  }

  // For fallback: fake single-year data
  const displayYears = isNoHistory ? [currentYear] : years;
  const displayValues = isNoHistory
    ? [fallbackAnnual!]
    : displayYears.map((y) => byYear.get(y)!.total);
  const maxValue = Math.max(...displayValues, 1);

  // CAGR from per-unit history (excludes current year, needs ≥2 full years)
  const cagr = isNoHistory ? null : calcCAGR(history, now);

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
    if (isNoHistory && paymentPerUnit != null && frequencyPerYear != null) {
      return (
        <div className="bg-[#252220] border border-[rgba(200,180,140,0.1)] rounded-lg px-3 py-2.5 mt-2.5 animate-[way-fade-in_0.2s_ease]">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="font-mono text-[11px] text-[var(--way-gold)] font-medium">{selectedYear}</span>
            <span className="font-mono text-[10px] text-[#b0a898]">{formatCompact(fallbackAnnual!)} ₽ / ед.</span>
          </div>
          <div className="font-mono text-[8px] text-[#3a3530] italic">
            Расчётно: {paymentPerUnit} ₽ × {frequencyLabel(frequencyPerYear)}
          </div>
        </div>
      );
    }

    const yearData = byYear.get(selectedYear);
    if (!yearData) return null;

    return (
      <div className="bg-[#252220] border border-[rgba(200,180,140,0.1)] rounded-lg px-3 py-2.5 mt-2.5 animate-[way-fade-in_0.2s_ease]">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="font-mono text-[11px] text-[var(--way-gold)] font-medium">
            {selectedYear}
            {isCurrentYear && (
              <span className="text-[9px] text-[var(--way-muted)] font-normal ml-1.5">· неполный</span>
            )}
          </span>
          <span className="font-mono text-[10px] text-[#b0a898]">
            {formatCompact(yearData.total)} ₽ / ед.
          </span>
        </div>
        {yearData.payments.map((p, i) => (
          <div key={i} className="flex justify-between font-mono text-[9px] mb-0.5">
            <span className="text-[#4a4540]">{formatShortDate(p.date)}</span>
            <span className="text-[#b0a898]">{formatCompact(p.amount)} ₽</span>
          </div>
        ))}
        {isCurrentYear && (
          <div className="font-mono text-[8px] text-[#3a3530] italic mt-1.5">
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
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--way-muted)]">
          Выплата на единицу, ₽
        </span>
        {cagr != null && (
          <span className="font-mono text-[10px] text-[var(--way-gold)] tracking-wide">
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
          const value = displayValues[i];
          const heightPx = Math.max(Math.round((value / maxValue) * 100), 3);
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
              {/* Value label */}
              <span
                className="font-mono text-[8px] mb-[3px] whitespace-nowrap shrink-0"
                style={{ color: isCurrentYr ? '#4a4540' : '#b0a898' }}
              >
                {formatCompact(value)}
              </span>

              {/* Bar */}
              <div
                className="w-full rounded-t"
                style={{
                  height: heightPx,
                  minWidth: 6,
                  background: isCurrentYr
                    ? 'rgba(200,180,140,0.05)'
                    : `rgba(200,180,140,${barOpacity(i)})`,
                  border: isCurrentYr ? '1px dashed rgba(200,180,140,0.3)' : 'none',
                  outline: isSelected ? '1px solid rgba(200,180,140,0.5)' : 'none',
                  outlineOffset: isSelected ? 1 : 0,
                  transformOrigin: 'bottom',
                  animation: `way-bar-grow 0.8s ease-out ${1.2 + i * 0.1}s both`,
                }}
              />

              {/* Year label */}
              <span
                className="font-mono text-[9px] mt-1 shrink-0"
                style={{ color: isCurrentYr ? 'var(--way-gold)' : '#4a4540' }}
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
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/payment-history-chart.tsx
git commit -m "feat: rewrite PaymentHistoryChart with flex bars, scroll, detail panel"
```

---

### Task 5: Update asset detail page to pass new props

**Files:**
- Modify: `src/pages/asset-detail-page.tsx`

- [ ] **Step 1: Update chart props in `asset-detail-page.tsx`**

Change line 141 from:
```tsx
<PaymentHistoryChart history={historyRecords} quantity={asset.quantity} />
```
to:
```tsx
<PaymentHistoryChart
  history={historyRecords}
  paymentPerUnit={paymentPerUnit}
  frequencyPerYear={asset.frequencyPerYear}
/>
```

No import changes needed — `PaymentHistoryChart` is already imported.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/asset-detail-page.tsx
git commit -m "refactor: pass per-unit props to PaymentHistoryChart"
```

---

### Task 6: Visual verification and final tests

**Files:**
- None new — verify existing code

- [ ] **Step 1: Run all tests**

Run: `npm run test`
Expected: all tests pass

- [ ] **Step 2: Run dev server and verify visually**

Run: `npm run dev`

Check these scenarios in browser:
1. **Asset with history** — navigate to an asset detail page that has payment history. Verify:
   - Bars render with compact labels on top
   - Current year bar is dashed with `~` suffix
   - CAGR shows in header
   - Tapping a bar opens detail panel with payment dates/amounts
   - Tapping same bar closes panel
   - Horizontal scroll works when many bars present
   - Bars expand to fill width when few years
2. **Asset without history** — navigate to an asset with no payment history but manual paymentPerUnit. Verify:
   - Single bar shows calculated annual value
   - No CAGR displayed
   - Detail panel shows "Расчётно: X ₽ × N мес"
3. **Main page** — verify chart is gone
4. **Category page** — verify chart is gone, asset list still works

- [ ] **Step 3: Take screenshots of key states**

Capture screenshots for visual verification of:
- Asset detail with history (panel open)
- Asset detail without history
- Main page (no chart)

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -p  # stage only intentional changes
git commit -m "fix: visual polish for chart redesign"
```

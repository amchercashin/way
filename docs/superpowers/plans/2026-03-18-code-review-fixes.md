# Code Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 25+ issues found in code review across data protection, network resilience, calculation correctness, performance, and test coverage.

**Architecture:** Targeted point fixes in existing files. No new abstractions, no architecture changes. Each phase is independently shippable.

**Tech Stack:** React 19, Dexie (IndexedDB), Vitest, TypeScript

---

## File Map

**Phase 1 — Data Protection:**
- Modify: `src/services/backup.ts` (validation + date rehydration)
- Modify: `src/services/income-calculator.ts` (NaN/Infinity guards)
- Modify: `src/App.tsx` (Error Boundary wrapper)
- Create: `src/components/error-boundary.tsx`
- Modify: `src/components/asset-detail/asset-field.tsx` (stale draft fix)

**Phase 2 — Network Resilience:**
- Modify: `src/services/moex-sync.ts` (lastSyncAt conditional)
- Modify: `src/hooks/use-moex-sync.ts` (lastSyncAt conditional)

**Phase 3 — Calculation Correctness:**
- Modify: `src/services/income-calculator.ts` (frequencyPerYear guard)
- Modify: `src/services/moex-sync.ts` (frequency clamp)
- Modify: `src/services/import-parser.ts` (CSV quoted fields)

**Phase 4 — Performance:**
- Modify: `src/hooks/use-portfolio-stats.ts` (dedup paymentPerUnit, already has useMemo)
- Modify: `src/pages/asset-detail-page.tsx` (useMemo + useCallback)
- Modify: `src/pages/category-page.tsx` (useMemo)
- Modify: `src/pages/main-page.tsx` (useMemo)

**Phase 5 — Tests:**
- Modify: `tests/services/income-calculator.test.ts` (edge cases)
- Modify: `tests/services/backup.test.ts` (validation + date rehydration)
- Modify: `tests/services/import-parser.test.ts` (CSV quoted fields)

---

## Phase 1: Data Protection

### Task 1.1: Backup validation and date rehydration

**Files:**
- Modify: `src/services/backup.ts:19-63`
- Modify: `tests/services/backup.test.ts`

- [ ] **Step 1: Write failing tests for backup validation**

Add to `tests/services/backup.test.ts`:

```typescript
it('rejects invalid JSON', async () => {
  await expect(importAllData('not json')).rejects.toThrow('Невалидный формат');
});

it('rejects JSON without assets array', async () => {
  await expect(importAllData(JSON.stringify({ foo: 'bar' }))).rejects.toThrow('Невалидный формат');
});

it('rejects JSON with non-array assets', async () => {
  await expect(importAllData(JSON.stringify({ assets: 'string' }))).rejects.toThrow('Невалидный формат');
});

it('preserves existing data when import validation fails', async () => {
  const now = new Date();
  await db.assets.add({
    type: 'stock', ticker: 'KEEP', name: 'Keep Me',
    quantity: 1, quantitySource: 'manual',
    paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
    dataSource: 'manual', createdAt: now, updatedAt: now,
  });

  await expect(importAllData('not json')).rejects.toThrow();
  expect(await db.assets.count()).toBe(1);
  const kept = (await db.assets.toArray())[0];
  expect(kept.ticker).toBe('KEEP');
});

it('rehydrates Date fields from ISO strings on import', async () => {
  const now = new Date();
  await db.assets.add({
    type: 'stock', ticker: 'SBER', name: 'Сбербанк',
    quantity: 800, quantitySource: 'manual',
    paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
    dataSource: 'manual', createdAt: now, updatedAt: now,
  });
  await db.paymentHistory.add({
    assetId: 1, amount: 34.84, date: new Date('2025-07-18'),
    type: 'dividend', dataSource: 'moex',
  });

  const json = await exportAllData();
  await importAllData(json);

  const history = await db.paymentHistory.toArray();
  expect(history[0].date).toBeInstanceOf(Date);
  expect(history[0].date.getTime()).toBe(new Date('2025-07-18').getTime());

  const assets = await db.assets.toArray();
  expect(assets[0].createdAt).toBeInstanceOf(Date);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/backup.test.ts`
Expected: New tests FAIL (validation not implemented, dates not rehydrated)

- [ ] **Step 3: Implement backup validation and date rehydration**

Replace the `importAllData` function in `src/services/backup.ts`:

```typescript
export async function importAllData(json: string): Promise<void> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Невалидный формат: некорректный JSON');
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.assets)) {
    throw new Error('Невалидный формат: отсутствует массив assets');
  }

  const settingsTable = db.table('settings');

  // Rehydrate Date fields before writing
  const assets = (data.assets as Record<string, unknown>[]).map((a) => ({
    ...a,
    createdAt: a.createdAt ? new Date(a.createdAt as string) : new Date(),
    updatedAt: a.updatedAt ? new Date(a.updatedAt as string) : new Date(),
    nextExpectedDate: a.nextExpectedDate ? new Date(a.nextExpectedDate as string) : undefined,
    nextExpectedCutoffDate: a.nextExpectedCutoffDate ? new Date(a.nextExpectedCutoffDate as string) : undefined,
    nextExpectedCreditDate: a.nextExpectedCreditDate ? new Date(a.nextExpectedCreditDate as string) : undefined,
  }));

  const paymentHistory = ((data.paymentHistory as Record<string, unknown>[] | undefined) ?? []).map((h) => ({
    ...h,
    date: h.date ? new Date(h.date as string) : new Date(),
  }));

  // Backward compat: migrate old format with paymentSchedules
  let migratedAssets = assets;
  if ((data.paymentSchedules as unknown[] | undefined)?.length) {
    const scheduleByAssetId = new Map<number, Record<string, unknown>>();
    for (const s of data.paymentSchedules as Record<string, unknown>[]) {
      scheduleByAssetId.set(s.assetId as number, s);
    }
    migratedAssets = assets.map((asset) => {
      if (asset.frequencyPerYear != null) return asset;
      const schedule = scheduleByAssetId.get(asset.id as number);
      const type = asset.type as string;
      const ds = asset.dataSource as string;
      return {
        ...asset,
        frequencyPerYear: schedule?.frequencyPerYear ?? FREQUENCY_DEFAULTS[type] ?? 12,
        frequencySource: schedule?.dataSource === 'moex' ? 'moex' : 'manual',
        moexFrequency: schedule?.dataSource === 'moex' ? schedule.frequencyPerYear : undefined,
        paymentPerUnitSource: schedule?.activeMetric === 'forecast' && schedule?.forecastMethod === 'manual' ? 'manual' : 'fact',
        paymentPerUnit: schedule?.activeMetric === 'forecast' && schedule?.forecastMethod === 'manual' ? schedule.forecastAmount : undefined,
        quantitySource: ds === 'import' ? 'import' : 'manual',
        importedQuantity: ds === 'import' ? asset.quantity : undefined,
        nextExpectedDate: schedule?.nextExpectedDate ? new Date(schedule.nextExpectedDate as string) : undefined,
        nextExpectedCutoffDate: schedule?.nextExpectedCutoffDate ? new Date(schedule.nextExpectedCutoffDate as string) : undefined,
        nextExpectedCreditDate: schedule?.nextExpectedCreditDate ? new Date(schedule.nextExpectedCreditDate as string) : undefined,
      };
    });
  }

  await db.transaction('rw', db.assets, db.paymentHistory, db.importRecords, settingsTable, async () => {
    await db.assets.clear();
    await db.paymentHistory.clear();
    await db.importRecords.clear();
    await settingsTable.clear();

    if (migratedAssets.length) await db.assets.bulkAdd(migratedAssets);
    if (paymentHistory.length) await db.paymentHistory.bulkAdd(paymentHistory);
    if ((data.importRecords as unknown[] | undefined)?.length) {
      await db.importRecords.bulkAdd(data.importRecords as Record<string, unknown>[]);
    }
    if ((data.settings as unknown[] | undefined)?.length) {
      for (const s of data.settings as Record<string, unknown>[]) await settingsTable.put(s);
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/backup.test.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/backup.ts tests/services/backup.test.ts
git commit -m "fix: validate backup schema and rehydrate dates on import"
```

### Task 1.2: NaN/Infinity guards in income calculator

**Files:**
- Modify: `src/services/income-calculator.ts:1-7,73-94`

- [ ] **Step 1: Write failing tests**

Add to `tests/services/income-calculator.test.ts`:

```typescript
describe('NaN/Infinity guards', () => {
  it('calcAssetIncomePerYear returns 0 for NaN paymentAmount', () => {
    expect(calcAssetIncomePerYear(800, NaN, 1)).toBe(0);
  });

  it('calcAssetIncomePerYear returns 0 for NaN quantity', () => {
    expect(calcAssetIncomePerYear(NaN, 186, 1)).toBe(0);
  });

  it('calcAssetIncomePerYear returns 0 for NaN frequency', () => {
    expect(calcAssetIncomePerYear(800, 186, NaN)).toBe(0);
  });

  it('calcFactPaymentPerUnit returns 0 for frequencyPerYear=0', () => {
    const history = [{ amount: 36.9, date: new Date('2025-09-01') }];
    expect(calcFactPaymentPerUnit(history, 0, new Date('2026-03-16'))).toBe(0);
  });

  it('calcFactPaymentPerUnit returns 0 for negative frequency', () => {
    const history = [{ amount: 36.9, date: new Date('2025-09-01') }];
    expect(calcFactPaymentPerUnit(history, -1, new Date('2026-03-16'))).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: NaN tests FAIL (NaN propagates, division by zero returns Infinity)

- [ ] **Step 3: Implement guards**

In `src/services/income-calculator.ts`, modify `calcAssetIncomePerYear` (line 1-7):

```typescript
export function calcAssetIncomePerYear(
  quantity: number,
  paymentAmount: number,
  frequencyPerYear: number,
): number {
  const result = quantity * paymentAmount * frequencyPerYear;
  return isFinite(result) ? result : 0;
}
```

Modify `calcFactPaymentPerUnit` — add guard before line 94 (`return sum / frequencyPerYear`):

```typescript
  if (frequencyPerYear <= 0) return 0;
  return sum / frequencyPerYear;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/income-calculator.ts tests/services/income-calculator.test.ts
git commit -m "fix: guard against NaN/Infinity in income calculations"
```

### Task 1.3: Global Error Boundary

**Files:**
- Create: `src/components/error-boundary.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create ErrorBoundary component**

Create `src/components/error-boundary.tsx`:

```typescript
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--way-void)] flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-[var(--way-ash)] text-sm mb-4">Произошла ошибка</div>
            <button
              onClick={() => window.location.reload()}
              className="text-[var(--way-gold)] border border-[rgba(200,180,140,0.2)] px-4 py-2 rounded-lg text-sm"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap App with ErrorBoundary**

In `src/App.tsx`, add import and wrap:

```typescript
import { ErrorBoundary } from '@/components/error-boundary';
```

Wrap `<BrowserRouter>` inside `<ErrorBoundary>`:

```typescript
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* ... routes unchanged ... */}
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/error-boundary.tsx src/App.tsx
git commit -m "fix: add global ErrorBoundary to prevent white screen crashes"
```

### Task 1.4: Fix stale draft in AssetField

**Files:**
- Modify: `src/components/asset-detail/asset-field.tsx:1,25-26`

- [ ] **Step 1: Add useEffect import and sync logic**

In `src/components/asset-detail/asset-field.tsx`:

Change line 1 import to:
```typescript
import { useState, useEffect } from 'react';
```

Add after line 26 (`const [draft, setDraft] = useState(value);`):

```typescript
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
```

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/asset-detail/asset-field.tsx
git commit -m "fix: sync AssetField draft when value changes externally"
```

---

## Phase 2: Network Resilience

### Task 2.1: Conditional lastSyncAt

**Files:**
- Modify: `src/services/moex-sync.ts:113-115`
- Modify: `src/hooks/use-moex-sync.ts:20`

- [ ] **Step 1: Make lastSyncAt conditional in moex-sync.ts**

In `src/services/moex-sync.ts`, replace lines 113-115:

```typescript
  // old:
  await db
    .table('settings')
    .put({ key: 'lastSyncAt', value: new Date().toISOString() });
```

with:

```typescript
  if (result.synced > 0) {
    await db
      .table('settings')
      .put({ key: 'lastSyncAt', value: new Date().toISOString() });
  }
```

- [ ] **Step 2: Make lastSyncAt conditional in use-moex-sync.ts**

In `src/hooks/use-moex-sync.ts`, replace line 20 (`setLastSyncAt(new Date());`):

```typescript
      if (result.synced > 0) {
        setLastSyncAt(new Date());
      }
```

- [ ] **Step 3: Run existing sync tests**

Run: `npx vitest run tests/services/moex-sync.test.ts`
Expected: ALL tests PASS (the "saves lastSyncAt" test calls syncAllAssets with 0 syncable assets, but it adds no assets to sync, so synced=0. This test may need to be updated.)

Review: If the "saves lastSyncAt timestamp" test fails because `synced=0`, update it to add a syncable asset.

- [ ] **Step 4: Commit**

```bash
git add src/services/moex-sync.ts src/hooks/use-moex-sync.ts
git commit -m "fix: only update lastSyncAt when at least one asset synced"
```

---

## Phase 3: Calculation Correctness

### Task 3.1: Frequency clamp in moex-sync

**Files:**
- Modify: `src/services/moex-sync.ts:261-264`

- [ ] **Step 1: Add clamp**

In `src/services/moex-sync.ts`, replace lines 261-264:

```typescript
  const frequencyPerYear =
    bondData.couponPeriod > 0
      ? Math.round(365 / bondData.couponPeriod)
      : 2;
```

with:

```typescript
  const frequencyPerYear =
    bondData.couponPeriod > 0
      ? Math.min(Math.round(365 / bondData.couponPeriod), 52)
      : 2;
```

- [ ] **Step 2: Run existing sync tests**

Run: `npx vitest run tests/services/moex-sync.test.ts`
Expected: ALL tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/moex-sync.ts
git commit -m "fix: clamp bond frequencyPerYear to max 52 (weekly)"
```

### Task 3.2: CSV parser — handle quoted fields

**Files:**
- Modify: `src/services/import-parser.ts:124-138`
- Modify: `tests/services/import-parser.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/services/import-parser.test.ts`:

```typescript
it('handles quoted fields with commas in CSV', () => {
  const csv = `Тикер,Название,Тип,Количество,Ср. цена
SBER,"Сбербанк, привилегированная",Акция,800,317.63
GAZP,Газпром,Акция,200,150.00`;
  const rows = parseCSV(csv);
  expect(rows).toHaveLength(2);
  expect(rows[0].name).toBe('Сбербанк, привилегированная');
  expect(rows[0].quantity).toBe(800);
  expect(rows[1].name).toBe('Газпром');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/import-parser.test.ts`
Expected: FAIL — name is `"Сбербанк` because naive split breaks quoted fields.

- [ ] **Step 3: Add CSV split helper and update parseCSV**

In `src/services/import-parser.ts`, add a helper function before `parseCSV` and replace the CSV split logic:

```typescript
function splitCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCSV(text: string): ImportAssetRow[] {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  const colMap = mapHeaders(headers);
  if (colMap.name === undefined) return [];

  const rows: ImportAssetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const row = cellsToRow(cells, colMap);
    if (row) rows.push(row);
  }
  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/import-parser.test.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/import-parser.ts tests/services/import-parser.test.ts
git commit -m "fix: handle quoted fields with commas in CSV parser"
```

---

## Phase 4: Performance

### Task 4.1: Dedup paymentPerUnit in usePortfolioStats

**Files:**
- Modify: `src/hooks/use-portfolio-stats.ts:14-94`

- [ ] **Step 1: Extract resolvePaymentPerUnit helper, compute once per asset**

The hook already has `useMemo` (line 14). The issue is duplicated `paymentPerUnit` resolution at lines 36-42 and 68-74. Refactor the `useMemo` body to compute per-asset stats in a single pass:

Replace the entire `useMemo` callback (lines 14-95) with:

```typescript
  const { portfolio, categories } = useMemo(() => {
    const now = new Date();

    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }

    function resolvePaymentPerUnit(asset: typeof assets[number]): number {
      if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
        return asset.paymentPerUnit;
      }
      const history = historyByAsset.get(asset.id!) ?? [];
      return calcFactPaymentPerUnit(history, asset.frequencyPerYear, now);
    }

    let totalValue = 0;
    let totalIncomePerMonth = 0;
    const categoryMap = new Map<AssetType, { assets: typeof assets; value: number; incomePerMonth: number }>();

    for (const asset of assets) {
      const price = asset.currentPrice ?? asset.averagePrice ?? 0;
      const assetValue = price * asset.quantity;
      totalValue += assetValue;

      const paymentPerUnit = resolvePaymentPerUnit(asset);
      const assetIncome = calcAssetIncomePerMonth(asset.quantity, paymentPerUnit, asset.frequencyPerYear);
      totalIncomePerMonth += assetIncome;

      const cat = categoryMap.get(asset.type) ?? { assets: [], value: 0, incomePerMonth: 0 };
      cat.assets.push(asset);
      cat.value += assetValue;
      cat.incomePerMonth += assetIncome;
      categoryMap.set(asset.type, cat);
    }

    const totalIncomePerYear = totalIncomePerMonth * 12;
    const yieldPercent = totalValue > 0 ? calcYieldPercent(totalIncomePerYear, totalValue) : 0;

    const portfolio: PortfolioStats = { totalIncomePerMonth, totalIncomePerYear, totalValue, yieldPercent };

    const categories: CategoryStats[] = [];
    for (const [type, cat] of categoryMap) {
      const catIncomePerYear = cat.incomePerMonth * 12;
      categories.push({
        type,
        assetCount: cat.assets.length,
        totalIncomePerMonth: cat.incomePerMonth,
        totalIncomePerYear: catIncomePerYear,
        totalValue: cat.value,
        yieldPercent: cat.value > 0 ? calcYieldPercent(catIncomePerYear, cat.value) : 0,
        portfolioSharePercent: totalValue > 0 ? (cat.value / totalValue) * 100 : 0,
      });
    }
    categories.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);

    return { portfolio, categories };
  }, [assets, allHistory]);
```

- [ ] **Step 2: Run full test suite**

Run: `npm run test`
Expected: ALL tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-portfolio-stats.ts
git commit -m "perf: deduplicate paymentPerUnit resolution in usePortfolioStats"
```

### Task 4.2: useMemo in pages

**Files:**
- Modify: `src/pages/asset-detail-page.tsx`
- Modify: `src/pages/category-page.tsx`
- Modify: `src/pages/main-page.tsx`

- [ ] **Step 1: Memoize asset-detail-page computations**

In `src/pages/asset-detail-page.tsx`:

Add `useMemo, useCallback` to imports:
```typescript
import { useMemo, useCallback } from 'react';
```

Wrap lines 25-39 in useMemo:

```typescript
  const { historyRecords, paymentPerUnit, incomePerMonth, value, yieldPct, sharePercent } = useMemo(() => {
    const now = new Date();
    const historyRecords = history.map((h) => ({ amount: h.amount, date: new Date(h.date) }));

    let paymentPerUnit: number;
    if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
      paymentPerUnit = asset.paymentPerUnit;
    } else {
      paymentPerUnit = calcFactPaymentPerUnit(historyRecords, asset.frequencyPerYear, now);
    }

    const incomePerMonth = calcAssetIncomePerMonth(asset.quantity, paymentPerUnit, asset.frequencyPerYear);

    const value = (asset.currentPrice ?? asset.averagePrice) != null
      ? (asset.currentPrice ?? asset.averagePrice)! * asset.quantity
      : null;
    const yieldPct = (value != null)
      ? calcYieldPercent(incomePerMonth * 12, value)
      : null;
    const sharePercent = (value != null && portfolio.totalValue > 0)
      ? (value / portfolio.totalValue) * 100
      : null;

    return { historyRecords, paymentPerUnit, incomePerMonth, value, yieldPct, sharePercent };
  }, [asset, history, portfolio.totalValue]);
```

Wrap handlers with useCallback:

```typescript
  const handleSaveQuantity = useCallback((v: string) => {
    const num = parseInt(v);
    if (num > 0) updateAsset(assetId, { quantity: num, quantitySource: 'manual' });
  }, [assetId]);

  const handleSavePaymentPerUnit = useCallback((v: string) => {
    const num = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''));
    if (isNaN(num) || num < 0) return;
    updateAsset(assetId, { paymentPerUnit: num, paymentPerUnitSource: 'manual' });
  }, [assetId]);

  const handleSaveFrequency = useCallback((v: string) => {
    const num = parseInt(v);
    if (isNaN(num) || num < 1 || num > 12) return;
    updateAsset(assetId, { frequencyPerYear: num, frequencySource: 'manual' });
  }, [assetId]);
```

- [ ] **Step 2: Memoize category-page computations**

In `src/pages/category-page.tsx`:

Add `useMemo` to imports:
```typescript
import { useMemo } from 'react';
```

Wrap lines 22-37 in useMemo:

```typescript
  const { historyByAsset, categoryHistory } = useMemo(() => {
    const now = new Date();
    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }

    const categoryAssetIds = new Set(assets.map((a) => a.id!));
    const assetMap = new Map(assets.map((a) => [a.id!, a.quantity]));
    const categoryHistory = (allHistory ?? [])
      .filter((h) => categoryAssetIds.has(h.assetId))
      .map((h) => ({
        amount: h.amount * (assetMap.get(h.assetId) ?? 1),
        date: new Date(h.date),
      }));

    return { historyByAsset, categoryHistory, now };
  }, [assets, allHistory]);
```

Update the `now` reference in the asset map (line 49-52 area) to use the memoized `now` or simply inline it where used. Since `now` is only used inside `calcFactPaymentPerUnit`, add it to the destructured return above as shown.

- [ ] **Step 3: Memoize main-page computations**

In `src/pages/main-page.tsx`:

Add `useMemo` to the import (line 1):
```typescript
import { useState, useEffect, useRef, useMemo } from 'react';
```

Wrap lines 21-23 in useMemo:

```typescript
  const portfolioHistory = useMemo(() => {
    const assetMap = new Map(assets.map((a) => [a.id!, a.quantity]));
    return (allHistory ?? []).map((h) => ({
      amount: h.amount * (assetMap.get(h.assetId) ?? 1),
      date: new Date(h.date),
    }));
  }, [assets, allHistory]);
```

Remove the standalone `assetMap` and `portfolioHistory` declarations that were replaced.

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: ALL tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/asset-detail-page.tsx src/pages/category-page.tsx src/pages/main-page.tsx
git commit -m "perf: memoize expensive computations in page components"
```

---

## Phase 5: Tests for Critical Paths

### Task 5.1: Income calculator edge cases

**Files:**
- Modify: `tests/services/income-calculator.test.ts`

- [ ] **Step 1: Add edge case tests**

These tests should already pass after Phase 1 Task 1.2 fixes. Add to `tests/services/income-calculator.test.ts`:

```typescript
describe('edge cases', () => {
  it('calcAssetIncomePerYear returns 0 for Infinity quantity', () => {
    expect(calcAssetIncomePerYear(Infinity, 186, 1)).toBe(0);
  });

  it('calcAssetIncomePerMonth returns 0 for NaN inputs', () => {
    expect(calcAssetIncomePerMonth(NaN, 186, 1)).toBe(0);
  });

  it('calcFactPaymentPerUnit handles single payment with freq=2 (halved)', () => {
    // Only 1 of 2 expected payments in window — returns sum/2
    const history = [{ amount: 36.9, date: new Date('2025-09-01') }];
    const result = calcFactPaymentPerUnit(history, 2, new Date('2026-03-16'));
    expect(result).toBe(18.45);
  });

  it('calcYieldPercent returns finite number for large values', () => {
    const result = calcYieldPercent(1e15, 1e16);
    expect(isFinite(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: ALL tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/services/income-calculator.test.ts
git commit -m "test: add edge case coverage for income calculator"
```

### Task 5.2: Backup validation tests (already added in Task 1.1)

Tests were already added in Task 1.1. No additional work needed.

### Task 5.3: CSV quoted fields tests (already added in Task 3.2)

Tests were already added in Task 3.2. No additional work needed.

---

## Verification

After all phases:

- [ ] **Run full build:** `npm run build` — must succeed
- [ ] **Run all tests:** `npm run test` — all must pass
- [ ] **Manual check:** Open the app with `npm run dev`, verify main page loads, sync works, asset detail page works

# Income Model Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fact/forecast income model with simplified fact/manual model, eliminate PaymentSchedule table, merge fields into Asset.

**Architecture:** Single unified formula `paymentPerUnit × frequencyPerYear × quantity / 12` replaces the multi-path calcMainNumber. Each field (paymentPerUnit, quantity, frequency) tracks its own data source. PaymentSchedule table is deleted via Dexie v4 migration with data transfer to Asset.

**Tech Stack:** React, TypeScript, Dexie (IndexedDB), Vitest, Tailwind CSS

---

## Chunk 1: Data Model, Calculator, and Database Migration

### Task 1: Update Asset type and remove PaymentSchedule type

**Files:**
- Modify: `src/models/types.ts:23-56`

- [ ] **Step 1: Update Asset interface and remove PaymentSchedule**

Replace lines 23-56 in `src/models/types.ts`:

```typescript
export interface Asset {
  id?: number;
  type: AssetType;
  ticker?: string;
  isin?: string;
  moexSecid?: string;
  name: string;
  currency?: string;
  emitter?: string;
  securityCategory?: string;
  issueInfo?: string;
  dataSource: DataSource;
  createdAt: Date;
  updatedAt: Date;
  averagePrice?: number;
  currentPrice?: number;
  faceValue?: number;

  // quantity with source tracking
  quantity: number;
  quantitySource: 'import' | 'manual';
  importedQuantity?: number;

  // payment per unit with source tracking
  paymentPerUnit?: number;
  paymentPerUnitSource: 'fact' | 'manual';

  // frequency with source tracking
  frequencyPerYear: number;
  frequencySource: 'moex' | 'manual';
  moexFrequency?: number;

  // transferred from PaymentSchedule
  nextExpectedDate?: Date;
  nextExpectedCutoffDate?: Date;
  nextExpectedCreditDate?: Date;
}

// PaymentSchedule — DELETED (merged into Asset)
```

- [ ] **Step 2: Verify TypeScript compilation fails where PaymentSchedule is used**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Multiple TS errors referencing PaymentSchedule — confirms all dependents need updating.

- [ ] **Step 3: Commit**

```bash
git add src/models/types.ts
git commit -m "refactor: merge PaymentSchedule fields into Asset, delete PaymentSchedule type"
```

### Task 2: Rewrite income-calculator with new calcFactPaymentPerUnit

**Files:**
- Modify: `src/services/income-calculator.ts`
- Modify: `tests/services/income-calculator.test.ts`

- [ ] **Step 1: Write tests for calcFactPaymentPerUnit**

Replace entire `tests/services/income-calculator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  calcAssetIncomePerYear,
  calcAssetIncomePerMonth,
  calcPortfolioIncome,
  calcYieldPercent,
  calcCAGR,
  calcFactPaymentPerUnit,
} from '@/services/income-calculator';

describe('income-calculator', () => {
  describe('calcAssetIncomePerYear', () => {
    it('calculates annual income for stock with 1x/year dividend', () => {
      expect(calcAssetIncomePerYear(800, 186, 1)).toBe(148800);
    });

    it('calculates annual income for bond with 2x/year coupon', () => {
      expect(calcAssetIncomePerYear(500, 36.9, 2)).toBe(36900);
    });

    it('calculates annual income for monthly rent (quantity=1)', () => {
      expect(calcAssetIncomePerYear(1, 45000, 12)).toBe(540000);
    });
  });

  describe('calcAssetIncomePerMonth', () => {
    it('normalizes yearly dividend to monthly', () => {
      expect(calcAssetIncomePerMonth(800, 186, 1)).toBeCloseTo(12400, 0);
    });
  });

  describe('calcPortfolioIncome', () => {
    it('sums normalized income across multiple assets', () => {
      const items = [
        { quantity: 800, paymentAmount: 186, frequencyPerYear: 1 },
        { quantity: 500, paymentAmount: 36.9, frequencyPerYear: 2 },
        { quantity: 1, paymentAmount: 45000, frequencyPerYear: 12 },
      ];
      const result = calcPortfolioIncome(items);
      expect(result.perYear).toBeCloseTo(725700, 0);
      expect(result.perMonth).toBeCloseTo(60475, 0);
    });

    it('returns zero for empty portfolio', () => {
      const result = calcPortfolioIncome([]);
      expect(result.perYear).toBe(0);
      expect(result.perMonth).toBe(0);
    });
  });

  describe('calcYieldPercent', () => {
    it('calculates yield from income and portfolio value', () => {
      expect(calcYieldPercent(725700, 8200000)).toBeCloseTo(8.85, 1);
    });

    it('returns 0 when portfolio value is 0', () => {
      expect(calcYieldPercent(100000, 0)).toBe(0);
    });
  });

  describe('calcCAGR (calendar-year)', () => {
    it('calculates CAGR from first to last full calendar year', () => {
      const history = [
        { amount: 10, date: new Date('2021-07-01') },
        { amount: 12, date: new Date('2022-07-01') },
        { amount: 15, date: new Date('2023-07-01') },
      ];
      const result = calcCAGR(history, new Date('2026-03-16'));
      expect(result).toBeCloseTo(22.47, 0);
    });

    it('returns null for payments in only one year', () => {
      const history = [
        { amount: 10, date: new Date('2023-01-01') },
        { amount: 20, date: new Date('2023-06-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });

    it('returns null when first year income is 0', () => {
      const history = [
        { amount: 0, date: new Date('2021-07-01') },
        { amount: 15, date: new Date('2023-07-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });

    it('excludes current year from last_full_year', () => {
      const history = [
        { amount: 10, date: new Date('2025-07-01') },
        { amount: 20, date: new Date('2026-01-15') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });

    it('handles gaps between years', () => {
      const history = [
        { amount: 10, date: new Date('2020-06-01') },
        { amount: 20, date: new Date('2024-06-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeCloseTo(18.92, 0);
    });
  });

  describe('calcFactPaymentPerUnit', () => {
    it('for yearly (freq=1): sum of last 12 months / 1', () => {
      const history = [
        { amount: 186, date: new Date('2025-07-15') },
        { amount: 150, date: new Date('2024-01-01') }, // outside 12-month window
      ];
      const result = calcFactPaymentPerUnit(history, 1, new Date('2026-03-16'));
      expect(result).toBe(186);
    });

    it('for semi-annual (freq=2): sum of last 12 months / 2', () => {
      const history = [
        { amount: 36.9, date: new Date('2025-09-01') },
        { amount: 36.9, date: new Date('2025-03-20') },
      ];
      const result = calcFactPaymentPerUnit(history, 2, new Date('2026-03-16'));
      expect(result).toBe(36.9);
    });

    it('for quarterly (freq=4): sum of last 12 months / 4', () => {
      const history = [
        { amount: 10, date: new Date('2025-06-01') },
        { amount: 12, date: new Date('2025-09-01') },
        { amount: 11, date: new Date('2025-12-01') },
        { amount: 13, date: new Date('2026-03-01') },
      ];
      const result = calcFactPaymentPerUnit(history, 4, new Date('2026-03-16'));
      expect(result).toBe(11.5); // 46 / 4
    });

    it('for monthly (freq>=12): returns last payment', () => {
      const history = [
        { amount: 45000, date: new Date('2026-03-01') },
        { amount: 44000, date: new Date('2026-02-01') },
        { amount: 43000, date: new Date('2026-01-01') },
      ];
      const result = calcFactPaymentPerUnit(history, 12, new Date('2026-03-16'));
      expect(result).toBe(45000);
    });

    it('returns 0 for empty history', () => {
      expect(calcFactPaymentPerUnit([], 1, new Date())).toBe(0);
    });

    it('returns 0 when no payments in last 12 months', () => {
      const history = [{ amount: 50, date: new Date('2020-01-01') }];
      expect(calcFactPaymentPerUnit(history, 1, new Date('2026-03-16'))).toBe(0);
    });

    it('handles more payments than frequency in 12-month window', () => {
      // Stock paid twice but frequency is 1 — paymentPerUnit = sum/freq = 372
      const history = [
        { amount: 186, date: new Date('2025-07-15') },
        { amount: 186, date: new Date('2025-12-15') },
      ];
      const result = calcFactPaymentPerUnit(history, 1, new Date('2026-03-16'));
      expect(result).toBe(372); // 372 * 1 * qty / 12 = correct monthly
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: FAIL — `calcFactPaymentPerUnit` not exported.

- [ ] **Step 3: Rewrite income-calculator.ts**

Replace entire `src/services/income-calculator.ts`:

```typescript
export function calcAssetIncomePerYear(
  quantity: number,
  paymentAmount: number,
  frequencyPerYear: number,
): number {
  return quantity * paymentAmount * frequencyPerYear;
}

export function calcAssetIncomePerMonth(
  quantity: number,
  paymentAmount: number,
  frequencyPerYear: number,
): number {
  return calcAssetIncomePerYear(quantity, paymentAmount, frequencyPerYear) / 12;
}

interface IncomeItem {
  quantity: number;
  paymentAmount: number;
  frequencyPerYear: number;
}

export function calcPortfolioIncome(items: IncomeItem[]): {
  perYear: number;
  perMonth: number;
} {
  const perYear = items.reduce(
    (sum, item) =>
      sum + calcAssetIncomePerYear(item.quantity, item.paymentAmount, item.frequencyPerYear),
    0,
  );
  return { perYear, perMonth: perYear / 12 };
}

export function calcYieldPercent(annualIncome: number, portfolioValue: number): number {
  if (portfolioValue === 0) return 0;
  return (annualIncome / portfolioValue) * 100;
}

export interface PaymentRecord {
  amount: number;
  date: Date;
}

export function calcCAGR(
  history: PaymentRecord[],
  now: Date = new Date(),
): number | null {
  if (history.length === 0) return null;
  const currentYear = now.getFullYear();
  const byYear = new Map<number, number>();
  for (const p of history) {
    const year = p.date.getFullYear();
    if (year >= currentYear) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + p.amount);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  if (years.length < 2) return null;
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const incomeFirst = byYear.get(firstYear)!;
  const incomeLast = byYear.get(lastYear)!;
  if (incomeFirst <= 0) return null;
  const span = lastYear - firstYear;
  return (Math.pow(incomeLast / incomeFirst, 1 / span) - 1) * 100;
}

/**
 * Calculates per-unit payment amount from payment history.
 * For monthly payers (freq >= 12): returns the most recent payment.
 * For less frequent payers: returns sum of last 12 months / frequencyPerYear.
 */
export function calcFactPaymentPerUnit(
  history: PaymentRecord[],
  frequencyPerYear: number,
  now: Date = new Date(),
): number {
  if (history.length === 0) return 0;

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  if (frequencyPerYear >= 12) {
    // Monthly: return the most recent payment
    const recent = history
      .filter((p) => p.date > twelveMonthsAgo && p.date <= now)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return recent.length > 0 ? recent[0].amount : 0;
  }

  // Less frequent: sum of last 12 months / frequency
  const sum = history
    .filter((p) => p.date > twelveMonthsAgo && p.date <= now)
    .reduce((acc, p) => acc + p.amount, 0);
  if (sum === 0) return 0;
  return sum / frequencyPerYear;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/income-calculator.ts tests/services/income-calculator.test.ts
git commit -m "refactor: replace calcMainNumber/calcDecayAverage/calcFactPerMonth with calcFactPaymentPerUnit"
```

### Task 3: Database migration v4

**Files:**
- Modify: `src/db/database.ts`

- [ ] **Step 1: Add Dexie v4 migration**

Replace entire `src/db/database.ts`:

```typescript
import Dexie, { type EntityTable } from 'dexie';
import type { Asset, PaymentHistory, ImportRecord } from '@/models/types';

const FREQUENCY_DEFAULTS: Record<string, number> = {
  stock: 1,
  bond: 2,
  fund: 12,
  realestate: 12,
  deposit: 12,
  other: 12,
};

class CashFlowDB extends Dexie {
  assets!: EntityTable<Asset, 'id'>;
  paymentHistory!: EntityTable<PaymentHistory, 'id'>;
  importRecords!: EntityTable<ImportRecord, 'id'>;

  constructor() {
    super('CashFlowDB');
    this.version(1).stores({
      assets: '++id, type, ticker',
      paymentSchedules: '++id, assetId',
      paymentHistory: '++id, assetId, date',
      importRecords: '++id, date',
      settings: 'key',
    });
    this.version(2).stores({
      assets: '++id, type, ticker, isin',
    });
    this.version(3).stores({
      assets: '++id, type, ticker, isin',
      paymentSchedules: '++id, assetId',
      paymentHistory: '++id, [assetId+date]',
      importRecords: '++id, date',
      settings: 'key',
    });
    this.version(4)
      .stores({
        assets: '++id, type, ticker, isin',
        paymentSchedules: null, // delete table
        paymentHistory: '++id, [assetId+date]',
        importRecords: '++id, date',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        const schedules = await tx.table('paymentSchedules').toArray();
        const scheduleByAssetId = new Map<number, Record<string, unknown>>();
        for (const s of schedules) {
          scheduleByAssetId.set(s.assetId, s);
        }

        await tx.table('assets').toCollection().modify((asset: Record<string, unknown>) => {
          const schedule = scheduleByAssetId.get(asset.id as number);

          if (schedule) {
            asset.frequencyPerYear = schedule.frequencyPerYear;
            const isFromMoex = schedule.dataSource === 'moex';
            asset.frequencySource = isFromMoex ? 'moex' : 'manual';
            asset.moexFrequency = isFromMoex ? schedule.frequencyPerYear : undefined;

            asset.nextExpectedDate = schedule.nextExpectedDate;
            asset.nextExpectedCutoffDate = schedule.nextExpectedCutoffDate;
            asset.nextExpectedCreditDate = schedule.nextExpectedCreditDate;

            const wasManualForecast =
              schedule.activeMetric === 'forecast' &&
              schedule.forecastMethod === 'manual' &&
              schedule.forecastAmount != null;
            asset.paymentPerUnitSource = wasManualForecast ? 'manual' : 'fact';
            asset.paymentPerUnit = wasManualForecast ? schedule.forecastAmount : undefined;
          } else {
            const type = asset.type as string;
            asset.frequencyPerYear = FREQUENCY_DEFAULTS[type] ?? 12;
            asset.frequencySource = 'manual';
            asset.paymentPerUnitSource = 'fact';
          }

          // Quantity source
          const ds = asset.dataSource as string;
          asset.quantitySource = ds === 'import' ? 'import' : 'manual';
          asset.importedQuantity = ds === 'import' ? asset.quantity : undefined;
        });
      });
  }
}

export const db = new CashFlowDB();
```

- [ ] **Step 2: Verify app starts without errors**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build may have TS errors from other files still referencing PaymentSchedule — that's expected at this stage. Database migration logic itself is correct.

- [ ] **Step 3: Commit**

```bash
git add src/db/database.ts
git commit -m "feat: add Dexie v4 migration - merge PaymentSchedule into Asset, delete table"
```

## Chunk 2: Hooks, Services, and Backend Logic

### Task 4: Delete use-payment-schedules hook

**Files:**
- Delete: `src/hooks/use-payment-schedules.ts`

- [ ] **Step 1: Delete the file**

```bash
rm src/hooks/use-payment-schedules.ts
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-payment-schedules.ts
git commit -m "refactor: delete use-payment-schedules hook (PaymentSchedule removed)"
```

### Task 5: Update use-assets hook (deleteAsset)

**Files:**
- Modify: `src/hooks/use-assets.ts:33-39`

- [ ] **Step 1: Remove paymentSchedules from deleteAsset transaction**

Replace `deleteAsset` function (lines 33-39):

```typescript
export async function deleteAsset(id: number): Promise<void> {
  await db.transaction('rw', db.assets, db.paymentHistory, async () => {
    await db.paymentHistory.where('assetId').equals(id).delete();
    await db.assets.delete(id);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-assets.ts
git commit -m "refactor: remove paymentSchedules from deleteAsset transaction"
```

### Task 6: Rewrite use-portfolio-stats hook

**Files:**
- Modify: `src/hooks/use-portfolio-stats.ts`

- [ ] **Step 1: Rewrite to use Asset fields instead of PaymentSchedule**

Replace entire `src/hooks/use-portfolio-stats.ts`:

```typescript
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { AssetType, PortfolioStats, CategoryStats } from '@/models/types';
import { calcFactPaymentPerUnit, calcAssetIncomePerMonth, calcYieldPercent, type PaymentRecord } from '@/services/income-calculator';
import { useAllPaymentHistory } from './use-payment-history';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
} {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const allHistory = useAllPaymentHistory();

  const { portfolio, categories } = useMemo(() => {
    const now = new Date();

    // Build history-by-asset map
    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }

    let totalValue = 0;
    let totalIncomePerMonth = 0;
    const categoryMap = new Map<AssetType, typeof assets>();

    for (const asset of assets) {
      const price = asset.currentPrice ?? asset.averagePrice ?? 0;
      const assetValue = price * asset.quantity;
      totalValue += assetValue;

      const catAssets = categoryMap.get(asset.type) ?? [];
      catAssets.push(asset);
      categoryMap.set(asset.type, catAssets);

      // Determine paymentPerUnit
      let paymentPerUnit: number;
      if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
        paymentPerUnit = asset.paymentPerUnit;
      } else {
        const history = historyByAsset.get(asset.id!) ?? [];
        paymentPerUnit = calcFactPaymentPerUnit(history, asset.frequencyPerYear, now);
      }

      totalIncomePerMonth += calcAssetIncomePerMonth(
        asset.quantity,
        paymentPerUnit,
        asset.frequencyPerYear,
      );
    }

    const totalIncomePerYear = totalIncomePerMonth * 12;
    const yieldPercent = totalValue > 0 ? calcYieldPercent(totalIncomePerYear, totalValue) : 0;

    const portfolio: PortfolioStats = {
      totalIncomePerMonth,
      totalIncomePerYear,
      totalValue,
      yieldPercent,
    };

    const categories: CategoryStats[] = [];
    for (const [type, categoryAssets] of categoryMap) {
      let catValue = 0;
      let catIncomePerMonth = 0;
      for (const asset of categoryAssets) {
        const price = asset.currentPrice ?? asset.averagePrice ?? 0;
        catValue += price * asset.quantity;

        let paymentPerUnit: number;
        if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
          paymentPerUnit = asset.paymentPerUnit;
        } else {
          const history = historyByAsset.get(asset.id!) ?? [];
          paymentPerUnit = calcFactPaymentPerUnit(history, asset.frequencyPerYear, now);
        }

        catIncomePerMonth += calcAssetIncomePerMonth(
          asset.quantity,
          paymentPerUnit,
          asset.frequencyPerYear,
        );
      }
      const catIncomePerYear = catIncomePerMonth * 12;
      categories.push({
        type,
        assetCount: categoryAssets.length,
        totalIncomePerMonth: catIncomePerMonth,
        totalIncomePerYear: catIncomePerYear,
        totalValue: catValue,
        yieldPercent: catValue > 0 ? calcYieldPercent(catIncomePerYear, catValue) : 0,
        portfolioSharePercent: totalValue > 0 ? (catValue / totalValue) * 100 : 0,
      });
    }
    categories.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);

    return { portfolio, categories };
  }, [assets, allHistory]);

  return { portfolio, categories };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-portfolio-stats.ts
git commit -m "refactor: use-portfolio-stats reads from Asset fields instead of PaymentSchedule"
```

### Task 7: Rewrite moex-sync to write Asset fields

**Files:**
- Modify: `src/services/moex-sync.ts`

- [ ] **Step 1: Rewrite moex-sync.ts**

Replace entire `src/services/moex-sync.ts`:

```typescript
import Dexie from 'dexie';
import { db } from '@/db/database';
import type { Asset, PaymentHistory } from '@/models/types';
import type { DividendHistoryRow } from './moex-api';
import {
  resolveSecurityInfo,
  fetchStockPrice,
  fetchBondData,
  fetchDividends,
  fetchCouponHistory,
} from './moex-api';

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export async function syncAllAssets(): Promise<SyncResult> {
  const assets = await db.assets.toArray();
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] };

  for (const asset of assets) {
    if ((!asset.ticker && !asset.isin && !asset.moexSecid) || !['stock', 'bond', 'fund'].includes(asset.type)) {
      result.skipped++;
      continue;
    }

    try {
      await syncSingleAsset(asset);
      result.synced++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${asset.ticker}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await db
    .table('settings')
    .put({ key: 'lastSyncAt', value: new Date().toISOString() });

  return result;
}

export async function getLastSyncAt(): Promise<Date | null> {
  const setting = await db.table('settings').get('lastSyncAt');
  return setting ? new Date(setting.value) : null;
}

async function syncSingleAsset(asset: Asset): Promise<void> {
  let secid = asset.moexSecid;
  let boardId: string;
  let market: 'shares' | 'bonds';

  if (secid) {
    const info = await resolveSecurityInfo(secid);
    if (!info) throw new Error('Не найден на MOEX');
    boardId = info.primaryBoardId;
    market = info.market;
  } else {
    let info = asset.ticker
      ? await resolveSecurityInfo(asset.ticker)
      : null;
    if (!info && asset.isin) {
      info = await resolveSecurityInfo(asset.isin);
    }
    if (!info) throw new Error('Не найден на MOEX');

    secid = info.secid;
    boardId = info.primaryBoardId;
    market = info.market;

    await db.assets.update(asset.id!, { moexSecid: secid });
  }

  if (market === 'bonds') {
    await syncBond(secid, asset, boardId);
  } else {
    await syncStock(secid, asset, boardId);
  }
}

async function syncStock(secid: string, asset: Asset, boardId: string): Promise<void> {
  const price = await fetchStockPrice(secid, boardId);
  if (price) {
    const currentPrice = price.currentPrice ?? price.prevPrice;
    if (currentPrice != null) {
      await db.assets.update(asset.id!, {
        currentPrice,
        updatedAt: new Date(),
      });
    }
  }

  const divInfo = await fetchDividends(secid);
  if (divInfo) {
    await writePaymentHistory(asset.id!, divInfo.history, 'dividend');
    await updateMoexAssetFields(asset, {
      frequencyPerYear: divInfo.summary.frequencyPerYear,
      nextExpectedCutoffDate: divInfo.summary.nextExpectedCutoffDate ?? undefined,
    });
  }
}

async function syncBond(secid: string, asset: Asset, boardId: string): Promise<void> {
  const bondData = await fetchBondData(secid, boardId);
  if (!bondData) throw new Error('Нет данных на MOEX');

  const pricePercent = bondData.currentPrice ?? bondData.prevPrice;
  if (pricePercent != null) {
    await db.assets.update(asset.id!, {
      currentPrice: bondData.faceValue * (pricePercent / 100),
      faceValue: bondData.faceValue,
      updatedAt: new Date(),
    });
  }

  const frequencyPerYear =
    bondData.couponPeriod > 0
      ? Math.round(365 / bondData.couponPeriod)
      : 2;

  await updateMoexAssetFields(asset, {
    frequencyPerYear,
    nextExpectedDate: bondData.nextCouponDate
      ? new Date(bondData.nextCouponDate)
      : undefined,
  });

  const couponHistory = await fetchCouponHistory(secid);
  if (couponHistory.length > 0) {
    await writePaymentHistory(asset.id!, couponHistory, 'coupon');
  }
}

async function writePaymentHistory(
  assetId: number,
  rows: DividendHistoryRow[],
  type: PaymentHistory['type'],
): Promise<void> {
  const existing = await db.paymentHistory
    .where('[assetId+date]')
    .between([assetId, Dexie.minKey], [assetId, Dexie.maxKey])
    .toArray();

  const existingDates = new Set(existing.map((r) => r.date.getTime()));

  const newRecords = rows
    .filter((r) => !existingDates.has(r.date.getTime()))
    .map((r) => ({
      assetId,
      amount: r.amount,
      date: r.date,
      type,
      dataSource: 'moex' as const,
    }));

  if (newRecords.length > 0) {
    await db.paymentHistory.bulkAdd(newRecords);
  }
}

async function updateMoexAssetFields(
  asset: Asset,
  data: {
    frequencyPerYear: number;
    nextExpectedDate?: Date;
    nextExpectedCutoffDate?: Date;
  },
): Promise<void> {
  const updates: Partial<Asset> = {};

  // Always update moexFrequency (for "return to MOEX" button)
  updates.moexFrequency = data.frequencyPerYear;

  // Only update frequencyPerYear if source is moex (respect manual overrides)
  if (asset.frequencySource !== 'manual') {
    updates.frequencyPerYear = data.frequencyPerYear;
    updates.frequencySource = 'moex';
  }

  // Always update info dates
  if (data.nextExpectedDate) updates.nextExpectedDate = data.nextExpectedDate;
  if (data.nextExpectedCutoffDate) updates.nextExpectedCutoffDate = data.nextExpectedCutoffDate;

  await db.assets.update(asset.id!, updates);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/moex-sync.ts
git commit -m "refactor: moex-sync writes to Asset fields instead of PaymentSchedule"
```

### Task 8: Rewrite import-diff and import-applier

**Files:**
- Modify: `src/services/import-diff.ts`
- Modify: `src/services/import-applier.ts`

- [ ] **Step 1: Rewrite import-diff.ts to read from Asset**

Replace entire `src/services/import-diff.ts`:

```typescript
import { db } from '@/db/database';
import type { Asset } from '@/models/types';
import type { ImportAssetRow } from './import-parser';

export type ImportMode = 'update' | 'add';

export interface DiffChange {
  field: string;
  oldValue: string | number | undefined;
  newValue: string | number | undefined;
}

export interface DiffItem {
  status: 'added' | 'changed' | 'unchanged' | 'conflict';
  imported: ImportAssetRow;
  existingAsset?: Asset;
  changes: DiffChange[];
}

export interface ImportDiff {
  mode: ImportMode;
  items: DiffItem[];
  summary: {
    added: number;
    changed: number;
    unchanged: number;
    conflicts: number;
  };
}

export async function computeImportDiff(
  rows: ImportAssetRow[],
  mode: ImportMode,
): Promise<ImportDiff> {
  const existingAssets = await db.assets.toArray();
  const byTicker = new Map<string, Asset>();
  const byIsin = new Map<string, Asset>();
  for (const asset of existingAssets) {
    if (asset.ticker) byTicker.set(asset.ticker, asset);
    if (asset.isin) byIsin.set(asset.isin, asset);
  }

  const items: DiffItem[] = [];

  for (const row of rows) {
    const existing =
      (row.ticker ? byTicker.get(row.ticker) : undefined) ??
      (row.isin ? byIsin.get(row.isin) : undefined);

    if (!existing) {
      items.push({ status: 'added', imported: row, changes: [] });
    } else if (mode === 'add') {
      items.push({ status: 'unchanged', imported: row, existingAsset: existing, changes: [] });
    } else {
      const changes = compareFields(row, existing);
      if (changes.length === 0) {
        items.push({ status: 'unchanged', imported: row, existingAsset: existing, changes: [] });
      } else if (existing.dataSource === 'manual') {
        items.push({ status: 'conflict', imported: row, existingAsset: existing, changes });
      } else {
        items.push({ status: 'changed', imported: row, existingAsset: existing, changes });
      }
    }
  }

  return {
    mode,
    items,
    summary: {
      added: items.filter((i) => i.status === 'added').length,
      changed: items.filter((i) => i.status === 'changed').length,
      unchanged: items.filter((i) => i.status === 'unchanged').length,
      conflicts: items.filter((i) => i.status === 'conflict').length,
    },
  };
}

function compareFields(
  row: ImportAssetRow,
  existing: Asset,
): DiffChange[] {
  const changes: DiffChange[] = [];

  if (row.quantity !== existing.quantity) {
    changes.push({ field: 'quantity', oldValue: existing.quantity, newValue: row.quantity });
  }
  if (row.averagePrice != null && row.averagePrice !== existing.averagePrice) {
    changes.push({ field: 'averagePrice', oldValue: existing.averagePrice, newValue: row.averagePrice });
  }
  if (row.currentPrice != null && row.currentPrice !== existing.currentPrice) {
    changes.push({ field: 'currentPrice', oldValue: existing.currentPrice, newValue: row.currentPrice });
  }
  if (row.name !== existing.name) {
    changes.push({ field: 'name', oldValue: existing.name, newValue: row.name });
  }
  if (row.lastPaymentAmount != null && row.lastPaymentAmount !== existing.paymentPerUnit) {
    changes.push({ field: 'paymentPerUnit', oldValue: existing.paymentPerUnit, newValue: row.lastPaymentAmount });
  }
  if (row.frequencyPerYear != null && row.frequencyPerYear !== existing.frequencyPerYear) {
    changes.push({ field: 'frequencyPerYear', oldValue: existing.frequencyPerYear, newValue: row.frequencyPerYear });
  }

  return changes;
}
```

- [ ] **Step 2: Rewrite import-applier.ts to write Asset fields**

Replace entire `src/services/import-applier.ts`:

```typescript
import { db } from '@/db/database';
import type { ImportRecord } from '@/models/types';
import type { ImportAssetRow } from './import-parser';
import type { ImportDiff } from './import-diff';

const FREQUENCY_DEFAULTS: Record<string, number> = {
  stock: 1, bond: 2, fund: 12, realestate: 12, deposit: 12, other: 12,
};

export async function applyImportDiff(
  diff: ImportDiff,
  source: ImportRecord['source'],
  resolutions: Map<number, 'import' | 'keep'>,
): Promise<ImportRecord> {
  let itemsAdded = 0;
  let itemsChanged = 0;
  let itemsUnchanged = 0;

  await db.transaction('rw', db.assets, async () => {
    for (let i = 0; i < diff.items.length; i++) {
      const item = diff.items[i];

      switch (item.status) {
        case 'added': {
          const now = new Date();
          const freq = item.imported.frequencyPerYear ?? FREQUENCY_DEFAULTS[item.imported.type] ?? 12;
          await db.assets.add({
            type: item.imported.type,
            ticker: item.imported.ticker,
            isin: item.imported.isin,
            name: item.imported.name,
            quantity: item.imported.quantity,
            quantitySource: 'import',
            importedQuantity: item.imported.quantity,
            averagePrice: item.imported.averagePrice,
            currentPrice: item.imported.currentPrice ?? item.imported.averagePrice,
            faceValue: item.imported.faceValue,
            currency: item.imported.currency,
            emitter: item.imported.emitter,
            securityCategory: item.imported.securityCategory,
            issueInfo: item.imported.issueInfo,
            paymentPerUnit: item.imported.lastPaymentAmount ?? undefined,
            paymentPerUnitSource: item.imported.lastPaymentAmount ? 'manual' : 'fact',
            frequencyPerYear: freq,
            frequencySource: 'manual',
            dataSource: 'import',
            createdAt: now,
            updatedAt: now,
          });
          itemsAdded++;
          break;
        }

        case 'changed': {
          await updateAsset(item.existingAsset!.id!, item.imported);
          itemsChanged++;
          break;
        }

        case 'conflict': {
          const resolution = resolutions.get(i) ?? 'keep';
          if (resolution === 'import') {
            await updateAsset(item.existingAsset!.id!, item.imported);
            itemsChanged++;
          } else {
            itemsUnchanged++;
          }
          break;
        }

        case 'unchanged':
          itemsUnchanged++;
          break;
      }
    }
  });

  const record: Omit<ImportRecord, 'id'> = {
    date: new Date(),
    source,
    mode: diff.mode,
    itemsChanged,
    itemsAdded,
    itemsUnchanged,
  };

  await db.importRecords.add(record as ImportRecord);
  return record as ImportRecord;
}

async function updateAsset(assetId: number, row: ImportAssetRow): Promise<void> {
  const updates: Record<string, unknown> = {
    quantity: row.quantity,
    quantitySource: 'import',
    importedQuantity: row.quantity,
    name: row.name,
    dataSource: 'import',
    updatedAt: new Date(),
  };
  if (row.averagePrice != null) updates.averagePrice = row.averagePrice;
  if (row.currentPrice != null) updates.currentPrice = row.currentPrice;
  if (row.faceValue != null) updates.faceValue = row.faceValue;
  if (row.isin) updates.isin = row.isin;
  if (row.currency) updates.currency = row.currency;
  if (row.emitter) updates.emitter = row.emitter;
  if (row.securityCategory) updates.securityCategory = row.securityCategory;
  if (row.issueInfo) updates.issueInfo = row.issueInfo;
  if (row.lastPaymentAmount != null) {
    updates.paymentPerUnit = row.lastPaymentAmount;
    updates.paymentPerUnitSource = 'manual';
  }
  if (row.frequencyPerYear != null) {
    updates.frequencyPerYear = row.frequencyPerYear;
    updates.frequencySource = 'manual';
  }
  await db.assets.update(assetId, updates);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/import-diff.ts src/services/import-applier.ts
git commit -m "refactor: import-diff and import-applier use Asset fields instead of PaymentSchedule"
```

### Task 9: Rewrite backup.ts

**Files:**
- Modify: `src/services/backup.ts`

- [ ] **Step 1: Remove paymentSchedules from backup, add backward-compat import**

Replace entire `src/services/backup.ts`:

```typescript
import { db } from '@/db/database';

const FREQUENCY_DEFAULTS: Record<string, number> = {
  stock: 1, bond: 2, fund: 12, realestate: 12, deposit: 12, other: 12,
};

export async function exportAllData(): Promise<string> {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    assets: await db.assets.toArray(),
    paymentHistory: await db.paymentHistory.toArray(),
    importRecords: await db.importRecords.toArray(),
    settings: await db.table('settings').toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json);
  const settingsTable = db.table('settings');
  await db.transaction('rw', db.assets, db.paymentHistory, db.importRecords, settingsTable, async () => {
    await db.assets.clear();
    await db.paymentHistory.clear();
    await db.importRecords.clear();
    await settingsTable.clear();

    let assets = data.assets ?? [];

    // Backward compat: migrate old format with paymentSchedules
    if (data.paymentSchedules?.length) {
      const scheduleByAssetId = new Map<number, Record<string, unknown>>();
      for (const s of data.paymentSchedules) {
        scheduleByAssetId.set(s.assetId, s);
      }
      assets = assets.map((asset: Record<string, unknown>) => {
        if (asset.frequencyPerYear != null) return asset; // already migrated
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
          nextExpectedDate: schedule?.nextExpectedDate,
          nextExpectedCutoffDate: schedule?.nextExpectedCutoffDate,
          nextExpectedCreditDate: schedule?.nextExpectedCreditDate,
        };
      });
    }

    if (assets.length) await db.assets.bulkAdd(assets);
    if (data.paymentHistory?.length) await db.paymentHistory.bulkAdd(data.paymentHistory);
    if (data.importRecords?.length) await db.importRecords.bulkAdd(data.importRecords);
    if (data.settings?.length) {
      for (const s of data.settings) await settingsTable.put(s);
    }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/backup.ts
git commit -m "refactor: backup exports without paymentSchedules, imports handle old format"
```

## Chunk 3: UI Components

### Task 10: Update StatBlocks — ф/р indicator

**Files:**
- Modify: `src/components/shared/stat-blocks.tsx`

- [ ] **Step 1: Replace fact/forecast indicators with ф/р**

Replace entire `src/components/shared/stat-blocks.tsx`:

```typescript
import { formatCurrency, formatPercent } from '@/lib/utils';

interface StatBlocksProps {
  incomePerMonth: number | null;
  totalValue: number | null;
  yieldPercent: number | null;
  portfolioSharePercent: number | null;
  isManualIncome?: boolean;
}

function statColor(raw: number | null, accent: boolean): string {
  if (raw == null) return 'text-gray-600';
  return accent ? 'text-[#4ecca3]' : 'text-white';
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
          className="bg-[#1a1a2e] rounded-xl p-3 text-center"
        >
          <div className="text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</div>
          <div className={`text-[15px] font-semibold mt-1 ${stat.color}`}>
            {stat.value}
          </div>
          {index === 0 && isManualIncome != null && (
            <div className="flex justify-center mt-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                isManualIncome
                  ? 'bg-[#431407] text-[#fb923c]'
                  : 'bg-[#14532d] text-[#4ade80]'
              }`}>
                {isManualIncome ? 'р' : 'ф'}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/stat-blocks.tsx
git commit -m "refactor: StatBlocks uses isManualIncome for ф/р indicator"
```

### Task 11: Update AssetField — per-field sources and reset button

**Files:**
- Modify: `src/components/asset-detail/asset-field.tsx`

- [ ] **Step 1: Extend AssetField with source badge and reset action**

Replace entire `src/components/asset-detail/asset-field.tsx`:

```typescript
import { useState } from 'react';

interface AssetFieldProps {
  label: string;
  value: string;
  sourceLabel?: string;
  isManualSource?: boolean;
  subtitle?: string;
  editable?: boolean;
  onSave?: (newValue: string) => void;
  resetLabel?: string;
  onReset?: () => void;
}

export function AssetField({
  label,
  value,
  sourceLabel,
  isManualSource,
  subtitle,
  editable = true,
  onSave,
  resetLabel,
  onReset,
}: AssetFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    setDraft(value.replace(/[^\d.,]/g, ''));
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    if (draft !== value) {
      onSave?.(draft);
    }
  };

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-3 mb-2">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      {editing ? (
        <div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-[#0d1117] border border-[#f59e0b] rounded-lg px-2 py-1 text-sm text-white outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <button
              className="bg-[#2d6a4f] text-white px-2 py-1 rounded-lg text-xs"
              onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
            >
              ✓
            </button>
          </div>
          {resetLabel && onReset && (
            <button
              className="w-full mt-2 border border-[#334155] text-[#94a3b8] py-1 rounded-lg text-[11px]"
              onMouseDown={(e) => {
                e.preventDefault();
                setEditing(false);
                onReset();
              }}
            >
              ↩ {resetLabel}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center">
            <span
              className={`text-sm font-medium text-white ${editable ? 'cursor-pointer' : ''}`}
              onClick={() => editable && startEditing()}
            >
              {value}
            </span>
            {sourceLabel && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                isManualSource
                  ? 'bg-[#431407] text-[#fb923c]'
                  : 'bg-[#14532d] text-[#4ade80]'
              }`}>
                {sourceLabel}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[10px] text-gray-600 mt-1">{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/asset-detail/asset-field.tsx
git commit -m "refactor: AssetField supports source badges and reset buttons"
```

### Task 12: Update ExpectedPayment — use Asset fields

**Files:**
- Modify: `src/components/asset-detail/expected-payment.tsx`

- [ ] **Step 1: Rewrite props to use Asset fields**

Replace entire `src/components/asset-detail/expected-payment.tsx`:

```typescript
interface ExpectedPaymentProps {
  paymentPerUnit: number;
  quantity: number;
  nextExpectedDate?: Date;
  nextExpectedCutoffDate?: Date;
  nextExpectedCreditDate?: Date;
}

export function ExpectedPayment({
  paymentPerUnit,
  quantity,
  nextExpectedDate,
  nextExpectedCutoffDate,
  nextExpectedCreditDate,
}: ExpectedPaymentProps) {
  const totalAmount = paymentPerUnit * quantity;

  if (!nextExpectedDate && !nextExpectedCutoffDate) return null;

  const formatDate = (date?: Date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="bg-gradient-to-br from-[#1a2e1a] to-[#1a1a2e] border border-[#4ecca333] rounded-xl p-3.5 mt-3">
      <div className="text-[#4ecca3] text-xs font-semibold mb-2">Ожидаемая выплата</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Размер</span>
          <span className="text-white">
            ₽{paymentPerUnit} × {quantity} = ₽{Math.round(totalAmount).toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Отсечка (ожид.)</span>
          <span className="text-white">{formatDate(nextExpectedCutoffDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Выплата (ожид.)</span>
          <span className="text-white">{formatDate(nextExpectedDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Зачисление (ожид.)</span>
          <span className="text-white">{formatDate(nextExpectedCreditDate)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/asset-detail/expected-payment.tsx
git commit -m "refactor: ExpectedPayment uses Asset fields instead of PaymentSchedule"
```

### Task 13: Update AssetRow — add ф/р badge

**Files:**
- Modify: `src/components/category/asset-row.tsx`

- [ ] **Step 1: Rewrite AssetRow to use Asset fields and show badge**

Replace entire `src/components/category/asset-row.tsx`:

```typescript
import { Link } from 'react-router-dom';
import type { Asset } from '@/models/types';
import { formatCurrency, formatFrequency } from '@/lib/utils';
import { calcAssetIncomePerMonth } from '@/services/income-calculator';

interface AssetRowProps {
  asset: Asset;
  paymentPerUnit: number;
}

export function AssetRow({ asset, paymentPerUnit }: AssetRowProps) {
  const incomePerMonth = calcAssetIncomePerMonth(
    asset.quantity,
    paymentPerUnit,
    asset.frequencyPerYear,
  );
  const incomePerYear = incomePerMonth * 12;
  const value = (asset.currentPrice ?? asset.averagePrice) != null
    ? (asset.currentPrice ?? asset.averagePrice)! * asset.quantity
    : null;

  const isManual =
    asset.paymentPerUnitSource === 'manual' ||
    asset.quantitySource === 'manual' ||
    asset.frequencySource === 'manual';

  return (
    <Link
      to={`/asset/${asset.id}`}
      className="block bg-[#1a1a2e] rounded-xl p-3 mb-1.5 active:bg-[#222244] transition-colors"
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm font-semibold text-white">{asset.ticker ?? asset.name}</span>
          {asset.ticker && (
            <span className="text-xs text-gray-600 ml-2">{asset.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[#4ecca3]">{formatCurrency(incomePerMonth)}</span>
          <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${
            isManual
              ? 'bg-[#431407] text-[#fb923c]'
              : 'bg-[#14532d] text-[#4ade80]'
          }`}>
            {isManual ? 'р' : 'ф'}
          </span>
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-gray-600 mt-1">
        <span>
          {asset.quantity} шт · {formatCurrency(value)}
        </span>
        <span>
          <span className="bg-[#e9c46a22] text-[#e9c46a] px-1.5 py-0.5 rounded text-[10px]">
            {formatFrequency(asset.frequencyPerYear)}
          </span>
          {' '}
          {formatCurrency(incomePerYear)}/год
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/category/asset-row.tsx
git commit -m "refactor: AssetRow uses Asset fields, shows ф/р badge"
```

### Task 14: Delete IncomeMetricPanel

**Files:**
- Delete: `src/components/asset-detail/income-metric-panel.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm src/components/asset-detail/income-metric-panel.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/components/asset-detail/income-metric-panel.tsx
git commit -m "refactor: delete IncomeMetricPanel (replaced by inline field editing)"
```

## Chunk 4: Pages and Final Integration

### Task 15: Rewrite asset-detail-page

**Files:**
- Modify: `src/pages/asset-detail-page.tsx`

- [ ] **Step 1: Rewrite page with new field structure**

Replace entire `src/pages/asset-detail-page.tsx`:

```typescript
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';
import { AssetField } from '@/components/asset-detail/asset-field';
import { ExpectedPayment } from '@/components/asset-detail/expected-payment';
import { useAsset, updateAsset } from '@/hooks/use-assets';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { usePaymentHistory } from '@/hooks/use-payment-history';
import { calcFactPaymentPerUnit, calcAssetIncomePerMonth, calcYieldPercent } from '@/services/income-calculator';
import { formatFrequency } from '@/lib/utils';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assetId = Number(id);
  const asset = useAsset(assetId);
  const { portfolio } = usePortfolioStats();
  const history = usePaymentHistory(assetId);

  if (!asset) {
    return <AppShell title="Загрузка..."><div /></AppShell>;
  }

  const now = new Date();
  const historyRecords = history.map((h) => ({ amount: h.amount, date: new Date(h.date) }));

  // Determine paymentPerUnit
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

  const isManual =
    asset.paymentPerUnitSource === 'manual' ||
    asset.quantitySource === 'manual' ||
    asset.frequencySource === 'manual';

  const handleSaveQuantity = (v: string) => {
    const num = parseInt(v);
    if (num > 0) updateAsset(assetId, { quantity: num, quantitySource: 'manual' });
  };

  const handleSavePaymentPerUnit = (v: string) => {
    const num = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''));
    if (isNaN(num) || num < 0) return;
    updateAsset(assetId, { paymentPerUnit: num, paymentPerUnitSource: 'manual' });
  };

  const handleSaveFrequency = (v: string) => {
    const num = parseInt(v);
    if (isNaN(num) || num < 1 || num > 12) return;
    updateAsset(assetId, { frequencyPerYear: num, frequencySource: 'manual' });
  };

  const title = asset.ticker ? `${asset.ticker} · ${asset.name}` : asset.name;

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title={title}>
      <StatBlocks
        incomePerMonth={incomePerMonth}
        totalValue={value}
        yieldPercent={yieldPct}
        portfolioSharePercent={sharePercent}
        isManualIncome={isManual}
      />

      <AssetField
        label="Количество"
        value={`${asset.quantity} шт`}
        sourceLabel={asset.quantitySource === 'import' ? 'import' : 'ручной'}
        isManualSource={asset.quantitySource === 'manual'}
        onSave={handleSaveQuantity}
        resetLabel={asset.importedQuantity != null && asset.quantitySource === 'manual' ? 'Вернуться к импорту' : undefined}
        onReset={asset.importedQuantity != null ? () => updateAsset(assetId, {
          quantity: asset.importedQuantity!,
          quantitySource: 'import',
        }) : undefined}
      />

      <AssetField
        label="Выплата на шт."
        value={paymentPerUnit > 0 ? `₽ ${paymentPerUnit}` : '— Укажите'}
        sourceLabel={asset.paymentPerUnitSource === 'fact' ? 'ф' : 'р'}
        isManualSource={asset.paymentPerUnitSource === 'manual'}
        subtitle={asset.paymentPerUnitSource === 'fact' ? 'расчёт из истории выплат' : undefined}
        onSave={handleSavePaymentPerUnit}
        resetLabel={asset.paymentPerUnitSource === 'manual' ? 'Вернуться к расчёту на основе факта' : undefined}
        onReset={asset.paymentPerUnitSource === 'manual' ? () => updateAsset(assetId, {
          paymentPerUnitSource: 'fact',
          paymentPerUnit: undefined,
        }) : undefined}
      />

      <AssetField
        label="Частота"
        value={formatFrequency(asset.frequencyPerYear)}
        sourceLabel={asset.frequencySource === 'moex' ? 'moex' : 'ручной'}
        isManualSource={asset.frequencySource === 'manual'}
        onSave={handleSaveFrequency}
        resetLabel={asset.moexFrequency != null && asset.frequencySource === 'manual' ? 'Вернуться к MOEX' : undefined}
        onReset={asset.moexFrequency != null ? () => updateAsset(assetId, {
          frequencyPerYear: asset.moexFrequency!,
          frequencySource: 'moex',
        }) : undefined}
      />

      <ExpectedPayment
        paymentPerUnit={paymentPerUnit}
        quantity={asset.quantity}
        nextExpectedDate={asset.nextExpectedDate}
        nextExpectedCutoffDate={asset.nextExpectedCutoffDate}
        nextExpectedCreditDate={asset.nextExpectedCreditDate}
      />

      <PaymentHistoryChart history={historyRecords} quantity={asset.quantity} />
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/asset-detail-page.tsx
git commit -m "refactor: asset-detail-page uses Asset fields, inline editing with reset buttons"
```

### Task 16: Rewrite category-page

**Files:**
- Modify: `src/pages/category-page.tsx`

- [ ] **Step 1: Remove PaymentSchedule dependency, pass paymentPerUnit to AssetRow**

Replace entire `src/pages/category-page.tsx`:

```typescript
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';
import { AssetRow } from '@/components/category/asset-row';
import { useAssetsByType } from '@/hooks/use-assets';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useAllPaymentHistory } from '@/hooks/use-payment-history';
import { calcFactPaymentPerUnit, type PaymentRecord } from '@/services/income-calculator';
import { ASSET_TYPE_LABELS, type AssetType } from '@/models/types';

export function CategoryPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const assetType = type as AssetType;
  const assets = useAssetsByType(assetType);
  const { categories } = usePortfolioStats();
  const allHistory = useAllPaymentHistory();

  const catStats = categories.find((c) => c.type === assetType);

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

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">
      ‹
    </button>
  );

  return (
    <AppShell
      leftAction={backButton}
      title={ASSET_TYPE_LABELS[assetType] ?? type}
    >
      {catStats && (
        <StatBlocks
          incomePerMonth={catStats.totalIncomePerMonth}
          totalValue={catStats.totalValue}
          yieldPercent={catStats.yieldPercent}
          portfolioSharePercent={catStats.portfolioSharePercent}
        />
      )}

      {assets.map((asset) => {
        let paymentPerUnit: number;
        if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
          paymentPerUnit = asset.paymentPerUnit;
        } else {
          const history = historyByAsset.get(asset.id!) ?? [];
          paymentPerUnit = calcFactPaymentPerUnit(history, asset.frequencyPerYear, now);
        }
        return <AssetRow key={asset.id} asset={asset} paymentPerUnit={paymentPerUnit} />;
      })}

      <Link
        to={`/add-asset?type=${assetType}`}
        className="block text-center py-3 border border-dashed border-gray-700 rounded-xl text-gray-600 text-sm mt-3 active:border-[#4ecca3] active:text-[#4ecca3]"
      >
        + Добавить
      </Link>

      <PaymentHistoryChart history={categoryHistory} quantity={1} />
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/category-page.tsx
git commit -m "refactor: category-page uses Asset fields, passes paymentPerUnit to AssetRow"
```

### Task 17: Rewrite add-asset-page

**Files:**
- Modify: `src/pages/add-asset-page.tsx`

- [ ] **Step 1: Remove upsertPaymentSchedule, save fields directly to Asset**

Replace the import line 9 and `handleSubmit` function (lines 35-58):

Remove import:
```typescript
// DELETE: import { upsertPaymentSchedule } from '@/hooks/use-payment-schedules';
```

Replace `handleSubmit`:

```typescript
  const FREQ_DEFAULTS: Record<string, number> = {
    stock: 1, bond: 2, fund: 12, realestate: 12, deposit: 12, other: 12,
  };

  const handleSubmit = async () => {
    if (!name || !paymentAmount) return;
    if (isBirzha && !quantity) return;

    const freq = parseInt(frequency) || FREQ_DEFAULTS[type] || 12;

    await addAsset({
      type,
      name,
      ticker: isBirzha && ticker ? ticker : undefined,
      quantity: isBirzha ? parseInt(quantity) : 1,
      quantitySource: 'manual',
      averagePrice: isBirzha && price ? parseFloat(price) : undefined,
      currentPrice: isBirzha
        ? (price ? parseFloat(price) : undefined)
        : (assetValue ? parseFloat(assetValue) : undefined),
      faceValue: type === 'bond' ? 1000 : undefined,
      paymentPerUnit: parseFloat(paymentAmount),
      paymentPerUnitSource: 'manual',
      frequencyPerYear: freq,
      frequencySource: 'manual',
      dataSource: 'manual',
    });

    navigate(-1);
  };
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/add-asset-page.tsx
git commit -m "refactor: add-asset-page saves income fields directly to Asset"
```

### Task 18: Delete DataSourceTag if unused, final cleanup

**Files:**
- Check: `src/components/shared/data-source-tag.tsx`

- [ ] **Step 1: Check if DataSourceTag is still imported anywhere**

Run: `grep -r 'DataSourceTag' src/ --include='*.tsx' --include='*.ts'`

If only imported in its own file and nowhere else → delete it.
If still used elsewhere → leave it.

- [ ] **Step 2: Verify full build**

Run: `npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Final commit**

Stage only the specific files that were changed/deleted (e.g., `data-source-tag.tsx` if deleted, any remaining fixes):

```bash
git status
# Stage specific changed files by name
git commit -m "refactor: income model redesign complete - fact/manual replaces fact/forecast"
```

# Multi-Account Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-account support: Account + Holding entities, new "Данные" page, reworked import, read-only asset detail.

**Architecture:** Three new Dexie tables (accounts, holdings). Asset loses quantity/averagePrice fields (moved to Holding). Import targets a specific account. "Данные" page replaces "Импорт" as central data management hub.

**Tech Stack:** React 19, Dexie (IndexedDB), Tailwind v4, shadcn/ui, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-multi-account-design.md`

**Note:** During Phase 1 (Tasks 1-8), the app will be in a partially broken state — quantity shows as 0, import doesn't work, etc. This is expected; full functionality is restored in Phase 2. Work on a feature branch.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/models/account.ts` | Account and Holding interfaces, type suggestions list, color helpers |
| `src/hooks/use-accounts.ts` | CRUD for accounts table |
| `src/hooks/use-holdings.ts` | CRUD for holdings table, aggregate queries |
| `src/pages/data-page.tsx` | New "Данные" page — account cards, tables, inline edit |
| `src/components/data/account-section.tsx` | Collapsible account card with holdings tables |
| `src/components/data/holdings-table.tsx` | Table of holdings grouped by type within an account |
| `src/components/data/inline-cell.tsx` | Tappable inline-editable table cell |
| `src/components/data/import-flow.tsx` | Import modal: file upload → preview → apply |
| `src/components/data/import-preview.tsx` | Diff table with summary chips |
| `src/components/data/add-account-sheet.tsx` | Bottom sheet: "Пустой" or "Из импорта" |
| `src/components/data/add-asset-sheet.tsx` | Bottom sheet: form to add asset to account |
| `src/components/data/type-combobox.tsx` | Combobox: dropdown with suggestions + free input |
| `tests/models/account.test.ts` | Tests for type color helper |
| `tests/hooks/use-holdings.test.ts` | Tests for aggregate calculations |
| `tests/services/import-diff-v2.test.ts` | Tests for account-scoped import diff |
| `tests/services/import-applier-v2.test.ts` | Tests for account-scoped import apply |
| `tests/services/backup-v2.test.ts` | Tests for new backup format |

### Modified files
| File | Changes |
|------|---------|
| `src/models/types.ts` | Remove AssetType enum, LABELS, COLORS. Remove quantity/averagePrice/quantitySource/importedQuantity from Asset. Change `type: AssetType` → `type: string`. Update CategoryStats.type to string. Update ImportRecord: remove `mode` field (import is always full snapshot), add `itemsRemoved: number`, add `accountId: number`. |
| `src/db/database.ts` | Add Account/Holding entity tables, v5 schema with clear-all migration |
| `src/hooks/use-assets.ts` | Remove `useAssetsByType` (enum-based), update `deleteAsset` to also delete holdings |
| `src/hooks/use-portfolio-stats.ts` | Aggregate quantity from holdings instead of asset.quantity |
| `src/services/import-parser.ts` | Change `type` output from AssetType enum to string |
| `src/services/sber-html-parser.ts` | Return string types instead of AssetType. Add `extractAgreementNumber()`. |
| `src/services/import-diff.ts` | Accept accountId, compare holdings within account |
| `src/services/import-applier.ts` | Create/update holdings instead of asset.quantity. Handle "removed" status. |
| `src/services/backup.ts` | Export/import accounts + holdings tables. Drop v1 backward compat. |
| `src/services/moex-sync.ts` | No changes to sync logic (operates on Asset, not Holding) |
| `src/pages/main-page.tsx` | Use string type for category cards |
| `src/pages/category-page.tsx` | Use string type, aggregate quantity from holdings |
| `src/pages/asset-detail-page.tsx` | Read-only holdings breakdown, navigation to /data |
| `src/components/main/category-card.tsx` | Use color helper instead of ASSET_TYPE_COLORS enum |
| `src/components/category/asset-row.tsx` | Get quantity from holdings aggregate |
| `src/components/layout/drawer-menu.tsx` | "Импорт данных" → "Данные", path → `/data` |
| `src/App.tsx` | Remove import routes, add `/data`, remove `/add-asset` |

### Deleted files
| File | Reason |
|------|--------|
| `src/pages/import-page.tsx` | Replaced by data-page |
| `src/pages/import-sber-page.tsx` | Integrated into import-flow component |
| `src/pages/import-ai-page.tsx` | Integrated into import-flow component |
| `src/pages/import-file-page.tsx` | Integrated into import-flow component |
| `src/pages/import-preview-page.tsx` | Replaced by import-preview component |
| `src/pages/add-asset-page.tsx` | Replaced by add-asset-sheet on data page |

---

## Phase 1: Data Model + Core Logic

### Task 1: Types — Account and Holding interfaces

**Files:**
- Create: `src/models/account.ts`
- Modify: `src/models/types.ts`
- Test: `tests/models/account.test.ts`

- [ ] **Step 1: Create `src/models/account.ts`**

```typescript
export interface Account {
  id?: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Holding {
  id?: number;
  accountId: number;
  assetId: number;
  quantity: number;
  quantitySource: 'import' | 'manual';
  importedQuantity?: number;
  averagePrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Known types with predefined colors and default frequencies
export const KNOWN_TYPE_CONFIG: Record<string, { label: string; color: string; defaultFrequency: number }> = {
  'Акции': { label: 'Акции', color: '#c8b48c', defaultFrequency: 1 },
  'Облигации': { label: 'Облигации', color: '#8b7355', defaultFrequency: 2 },
  'Фонды': { label: 'Фонды', color: '#a09080', defaultFrequency: 12 },
  'Вклады': { label: 'Вклады', color: '#6b8070', defaultFrequency: 12 },
  'Недвижимость': { label: 'Недвижимость', color: '#7a6a5a', defaultFrequency: 12 },
  'Крипта': { label: 'Крипта', color: '#5a5548', defaultFrequency: 12 },
};

/** All type suggestions for the combobox: known types + existing types from DB */
export function getTypeSuggestions(existingTypes: string[]): string[] {
  const known = Object.keys(KNOWN_TYPE_CONFIG);
  const combined = new Set([...known, ...existingTypes]);
  return Array.from(combined);
}

/** Get color for a type — predefined or hash-derived */
export function getTypeColor(type: string): string {
  if (KNOWN_TYPE_CONFIG[type]) return KNOWN_TYPE_CONFIG[type].color;
  // Hash-based color from Wabi-Sabi palette range
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = type.charCodeAt(i) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 20%, 55%)`;
}

/** Get default frequency for a type */
export function getDefaultFrequency(type: string): number | undefined {
  return KNOWN_TYPE_CONFIG[type]?.defaultFrequency;
}
```

- [ ] **Step 2: Write tests for color/frequency helpers**

```typescript
// tests/models/account.test.ts
import { describe, it, expect } from 'vitest';
import { getTypeColor, getDefaultFrequency, getTypeSuggestions, KNOWN_TYPE_CONFIG } from '@/models/account';

describe('getTypeColor', () => {
  it('returns predefined color for known types', () => {
    expect(getTypeColor('Акции')).toBe('#c8b48c');
    expect(getTypeColor('Облигации')).toBe('#8b7355');
  });
  it('returns consistent hash color for custom types', () => {
    const color1 = getTypeColor('Мой тип');
    const color2 = getTypeColor('Мой тип');
    expect(color1).toBe(color2);
    expect(color1).toMatch(/^hsl\(/);
  });
});

describe('getDefaultFrequency', () => {
  it('returns frequency for known types', () => {
    expect(getDefaultFrequency('Акции')).toBe(1);
    expect(getDefaultFrequency('Облигации')).toBe(2);
  });
  it('returns undefined for custom types', () => {
    expect(getDefaultFrequency('Мой тип')).toBeUndefined();
  });
});

describe('getTypeSuggestions', () => {
  it('includes known types + existing', () => {
    const result = getTypeSuggestions(['Мой тип']);
    expect(result).toContain('Акции');
    expect(result).toContain('Мой тип');
  });
  it('deduplicates', () => {
    const result = getTypeSuggestions(['Акции']);
    expect(result.filter(t => t === 'Акции')).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/models/account.test.ts`
Expected: PASS

- [ ] **Step 4: Modify `src/models/types.ts`**

Remove:
- `AssetType` type alias (line 3)
- `ASSET_TYPE_LABELS` (lines 5-12)
- `ASSET_TYPE_COLORS` (lines 14-21)
- From Asset interface: `quantity`, `quantitySource`, `importedQuantity`, `averagePrice` (lines 39, 44-46)

Change:
- `type: AssetType` → `type: string` (line 25)
- `CategoryStats`: `type: AssetType` → `type: string` (line 92)

Update `ImportRecord`:
- Remove `mode: 'update' | 'add'` (import is always full snapshot now)
- Add `itemsRemoved: number`
- Add `accountId: number` (which account was imported into)

Keep everything else unchanged (all MOEX fields, payment fields, etc.).

- [ ] **Step 5: Fix all TypeScript compilation errors**

Run: `npx tsc --noEmit`

Every file that imports `AssetType` or accesses `asset.quantity` will error. Fix each import and reference. This is a large step — use the compiler output to find every usage. Key files:
- `use-assets.ts`: remove `useAssetsByType` (uses AssetType param)
- `use-portfolio-stats.ts`: change `Map<AssetType, ...>` → `Map<string, ...>`
- `import-parser.ts`: change `parseTypeLabel` return and `ImportAssetRow.type` to string
- `sber-html-parser.ts`: change `SBER_TYPE_MAP` values to Russian strings, `SecurityInfo.type` to string
- `import-diff.ts`: update Asset references (quantity removed)
- `import-applier.ts`: update Asset creation (quantity moved to holding)
- `category-card.tsx`: use `getTypeColor()` instead of `ASSET_TYPE_COLORS[type]`
- `category-page.tsx`: change type param handling
- `asset-detail-page.tsx`: remove quantity editing
- `add-asset-page.tsx`: will be deleted later, but needs to compile for now
- `asset-row.tsx`: needs quantity from somewhere

**Do NOT fix the logic yet** — just make it compile. Quantity-related logic will be wrong (returns 0) until holdings are wired.

- [ ] **Step 6: Commit**

```bash
git add src/models/ tests/models/
git commit -m "feat: add Account/Holding types, convert AssetType to free-form string"
```

---

### Task 2: Database schema v5

**Files:**
- Modify: `src/db/database.ts`
- Test: `tests/db/database.test.ts`

- [ ] **Step 1: Update database.ts**

Add Account and Holding imports, add EntityTable properties, add version 5:

```typescript
import type { Asset, PaymentHistory, ImportRecord } from '@/models/types';
import type { Account, Holding } from '@/models/account';

class CashFlowDB extends Dexie {
  assets!: EntityTable<Asset, 'id'>;
  accounts!: EntityTable<Account, 'id'>;
  holdings!: EntityTable<Holding, 'id'>;
  paymentHistory!: EntityTable<PaymentHistory, 'id'>;
  importRecords!: EntityTable<ImportRecord, 'id'>;

  constructor() {
    super('CashFlowDB');
    // ... keep versions 1-4 as-is ...
    this.version(5)
      .stores({
        assets: '++id, type, ticker, isin',
        accounts: '++id',
        holdings: '++id, accountId, assetId, &[accountId+assetId]',
        paymentHistory: '++id, [assetId+date]',
        importRecords: '++id, date',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        // Clean slate: clear all data
        await tx.table('assets').clear();
        await tx.table('paymentHistory').clear();
        await tx.table('importRecords').clear();
      });
  }
}
```

Update `FREQUENCY_DEFAULTS` keys to use Russian strings:
```typescript
const FREQUENCY_DEFAULTS: Record<string, number> = {
  'Акции': 1, 'Облигации': 2, 'Фонды': 12,
  'Недвижимость': 12, 'Вклады': 12, 'Крипта': 12,
  // Keep old enum keys for v4 upgrade function
  stock: 1, bond: 2, fund: 12, realestate: 12, deposit: 12, other: 12,
};
```

- [ ] **Step 2: Run existing DB tests to verify no regressions in v1-v4**

Run: `npx vitest run tests/db/database.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/db/database.ts
git commit -m "feat: add accounts/holdings tables, v5 clean-slate migration"
```

---

### Task 3: Hooks — accounts and holdings CRUD

**Files:**
- Create: `src/hooks/use-accounts.ts`
- Create: `src/hooks/use-holdings.ts`
- Modify: `src/hooks/use-assets.ts`
- Test: `tests/hooks/use-holdings.test.ts`

- [ ] **Step 1: Create `src/hooks/use-accounts.ts`**

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Account } from '@/models/account';

export function useAccounts() {
  return useLiveQuery(() => db.accounts.toArray()) ?? [];
}

export function useAccount(id: number) {
  return useLiveQuery(() => db.accounts.get(id), [id]);
}

export async function addAccount(name: string): Promise<number> {
  const now = new Date();
  return (await db.accounts.add({ name, createdAt: now, updatedAt: now })) as number;
}

export async function updateAccount(id: number, changes: Partial<Account>): Promise<void> {
  await db.accounts.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteAccount(id: number): Promise<void> {
  await db.transaction('rw', db.accounts, db.holdings, db.assets, db.paymentHistory, async () => {
    const holdings = await db.holdings.where('accountId').equals(id).toArray();
    const assetIds = holdings.map(h => h.assetId);

    // Delete all holdings for this account
    await db.holdings.where('accountId').equals(id).delete();

    // Delete orphaned assets (no remaining holdings)
    for (const assetId of assetIds) {
      const remaining = await db.holdings.where('assetId').equals(assetId).count();
      if (remaining === 0) {
        await db.paymentHistory.where('assetId').equals(assetId).delete();
        await db.assets.delete(assetId);
      }
    }

    await db.accounts.delete(id);
  });
}
```

- [ ] **Step 2: Create `src/hooks/use-holdings.ts`**

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Holding } from '@/models/account';

export function useHoldings() {
  return useLiveQuery(() => db.holdings.toArray()) ?? [];
}

export function useHoldingsByAccount(accountId: number) {
  return useLiveQuery(
    () => db.holdings.where('accountId').equals(accountId).toArray(),
    [accountId],
  ) ?? [];
}

export function useHoldingsByAsset(assetId: number) {
  return useLiveQuery(
    () => db.holdings.where('assetId').equals(assetId).toArray(),
    [assetId],
  ) ?? [];
}

/** Total quantity for an asset across all accounts */
export function useTotalQuantity(assetId: number): number {
  const holdings = useHoldingsByAsset(assetId);
  return holdings.reduce((sum, h) => sum + h.quantity, 0);
}

export async function addHolding(holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date();
  return (await db.holdings.add({ ...holding, createdAt: now, updatedAt: now })) as number;
}

export async function updateHolding(id: number, changes: Partial<Holding>): Promise<void> {
  await db.holdings.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteHolding(id: number): Promise<void> {
  await db.transaction('rw', db.holdings, db.assets, db.paymentHistory, async () => {
    const holding = await db.holdings.get(id);
    if (!holding) return;

    await db.holdings.delete(id);

    // Delete orphaned asset
    const remaining = await db.holdings.where('assetId').equals(holding.assetId).count();
    if (remaining === 0) {
      await db.paymentHistory.where('assetId').equals(holding.assetId).delete();
      await db.assets.delete(holding.assetId);
    }
  });
}
```

- [ ] **Step 3: Update `src/hooks/use-assets.ts`**

Remove `useAssetsByType` (depended on AssetType enum). Keep the rest. Update `deleteAsset` to also delete holdings:

```typescript
export async function deleteAsset(id: number): Promise<void> {
  await db.transaction('rw', db.assets, db.holdings, db.paymentHistory, async () => {
    await db.holdings.where('assetId').equals(id).delete();
    await db.paymentHistory.where('assetId').equals(id).delete();
    await db.assets.delete(id);
  });
}
```

- [ ] **Step 4: Write tests for holdings aggregate**

```typescript
// tests/hooks/use-holdings.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';

describe('holdings aggregation', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates holding with unique compound key', async () => {
    const accountId = await db.accounts.add({ name: 'Test', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Акции', name: 'SBER', dataSource: 'import',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId, assetId, quantity: 100, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const holdings = await db.holdings.where('accountId').equals(accountId).toArray();
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(100);
  });

  it('enforces unique [accountId+assetId]', async () => {
    const accountId = await db.accounts.add({ name: 'Test', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Акции', name: 'SBER', dataSource: 'import',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId, assetId, quantity: 100, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });
    await expect(db.holdings.add({
      accountId, assetId, quantity: 50, quantitySource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/hooks/use-holdings.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/ tests/hooks/
git commit -m "feat: add accounts and holdings hooks with CRUD operations"
```

---

### Task 4: Update portfolio stats to use holdings

**Files:**
- Modify: `src/hooks/use-portfolio-stats.ts`
- Modify: `src/components/category/asset-row.tsx`

- [ ] **Step 1: Update `use-portfolio-stats.ts`**

Key changes:
- Query holdings alongside assets
- Build `totalQuantityByAsset: Map<number, number>` from holdings
- Use `totalQuantityByAsset.get(asset.id!) ?? 0` instead of `asset.quantity`
- Change `Map<AssetType, ...>` → `Map<string, ...>`

```typescript
export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
} {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const holdings = useLiveQuery(() => db.holdings.toArray(), [], []);
  const allHistory = useAllPaymentHistory();

  const { portfolio, categories } = useMemo(() => {
    // Build quantity-by-asset from holdings
    const quantityByAsset = new Map<number, number>();
    for (const h of holdings) {
      quantityByAsset.set(h.assetId, (quantityByAsset.get(h.assetId) ?? 0) + h.quantity);
    }

    // ... rest of computation uses quantityByAsset.get(asset.id!) ?? 0
    // instead of asset.quantity
    // categoryMap key changes from AssetType to string
  }, [assets, holdings, allHistory]);

  return { portfolio, categories };
}
```

- [ ] **Step 2: Update `asset-row.tsx`**

Pass quantity as a prop instead of reading `asset.quantity`:

```typescript
interface AssetRowProps {
  asset: Asset;
  paymentPerUnit: number;
  totalQuantity: number; // new prop — sum from holdings
}
```

Update `category-page.tsx` to pass `totalQuantity` from holdings aggregation.

- [ ] **Step 3: Run full test suite to catch regressions**

Run: `npm run test`
Expected: Some import-related tests may fail (expected — will fix in Task 6)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-portfolio-stats.ts src/components/category/asset-row.tsx src/pages/category-page.tsx
git commit -m "feat: portfolio stats aggregate quantity from holdings"
```

---

### Task 5: Update import pipeline for accounts

**Files:**
- Modify: `src/services/import-parser.ts`
- Modify: `src/services/sber-html-parser.ts`
- Modify: `src/services/import-diff.ts`
- Modify: `src/services/import-applier.ts`
- Test: `tests/services/import-diff-v2.test.ts`
- Test: `tests/services/import-applier-v2.test.ts`

- [ ] **Step 1: Update `import-parser.ts`**

Change `ImportAssetRow.type` from `AssetType` to `string`. Update `parseTypeLabel` to return Russian strings instead of enum values:

```typescript
const TYPE_LABEL_MAP: Record<string, string> = {
  'акции': 'Акции', 'stocks': 'Акции', 'stock': 'Акции',
  'облигации': 'Облигации', 'bonds': 'Облигации', 'bond': 'Облигации',
  'фонды': 'Фонды', 'funds': 'Фонды', 'fund': 'Фонды',
  'недвижимость': 'Недвижимость', 'realestate': 'Недвижимость',
  'вклады': 'Вклады', 'deposit': 'Вклады', 'deposits': 'Вклады',
};
```

- [ ] **Step 2: Update `sber-html-parser.ts`**

Change `SBER_TYPE_MAP` values to Russian strings:
```typescript
const SBER_TYPE_MAP: Record<string, string> = {
  'обыкновенная акция': 'Акции',
  'привилегированная акция': 'Акции',
  'государственная облигация': 'Облигации',
  'корпоративная облигация': 'Облигации',
  'облигация': 'Облигации',
  'муниципальная облигация': 'Облигации',
  'фонд закрытого типа': 'Фонды',
  'фонд открытого типа': 'Фонды',
  'биржевой паевой инвестиционный фонд': 'Фонды',
};
```

Add agreement number extraction:
```typescript
export function extractAgreementNumber(html: string): string | undefined {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim();
  if (!title) return undefined;
  // Title format: "Отчет брокера\n          40R9B"
  const lines = title.split(/\n/).map(l => l.trim()).filter(Boolean);
  return lines.length >= 2 ? lines[lines.length - 1] : undefined;
}
```

- [ ] **Step 3: Rewrite `import-diff.ts` for account scope**

Key changes:
- Accept `accountId` parameter — compare against holdings in that specific account
- Add `'removed'` status for holdings in account but not in import (full snapshot)
- Compare based on holdings (quantity, averagePrice) not asset fields

```typescript
export type DiffStatus = 'added' | 'changed' | 'unchanged' | 'removed';

export interface DiffItem {
  status: DiffStatus;
  imported?: ImportAssetRow;      // undefined for 'removed' items
  existingAsset?: Asset;
  existingHolding?: Holding;
  changes: DiffChange[];
}

export interface ImportDiff {
  accountId: number | null;  // null = new account
  items: DiffItem[];
  summary: { added: number; changed: number; unchanged: number; removed: number };
}

export async function computeImportDiff(
  rows: ImportAssetRow[],
  accountId: number | null,
): Promise<ImportDiff> {
  // 1. Load all assets (for global ticker/isin matching)
  const allAssets = await db.assets.toArray();
  const byTicker = new Map<string, Asset>();
  const byIsin = new Map<string, Asset>();
  for (const a of allAssets) {
    if (a.ticker) byTicker.set(a.ticker, a);
    if (a.isin) byIsin.set(a.isin, a);
  }

  // 2. If existing account, load its holdings
  const existingHoldings: Holding[] = accountId
    ? await db.holdings.where('accountId').equals(accountId).toArray()
    : [];
  // Map assetId → holding for quick lookup
  const holdingByAssetId = new Map<number, Holding>();
  for (const h of existingHoldings) holdingByAssetId.set(h.assetId, h);

  const items: DiffItem[] = [];
  const matchedAssetIds = new Set<number>();

  // 3. For each imported row: match to existing asset by ticker/isin
  for (const row of rows) {
    const existingAsset =
      (row.isin ? byIsin.get(row.isin) : undefined) ??
      (row.ticker ? byTicker.get(row.ticker) : undefined);

    if (!existingAsset) {
      // New asset, new holding
      items.push({ status: 'added', imported: row, changes: [] });
    } else {
      matchedAssetIds.add(existingAsset.id!);
      const existingHolding = holdingByAssetId.get(existingAsset.id!);

      if (!existingHolding) {
        // Asset exists globally but not in this account → new holding
        items.push({ status: 'added', imported: row, existingAsset, changes: [] });
      } else {
        // Compare holding fields (quantity, averagePrice) + asset fields (currentPrice, name)
        const changes = compareFields(row, existingAsset, existingHolding);
        items.push({
          status: changes.length > 0 ? 'changed' : 'unchanged',
          imported: row,
          existingAsset,
          existingHolding,
          changes,
        });
      }
    }
  }

  // 4. Holdings in account NOT in import → 'removed'
  for (const holding of existingHoldings) {
    if (!matchedAssetIds.has(holding.assetId)) {
      const asset = allAssets.find(a => a.id === holding.assetId);
      items.push({ status: 'removed', existingAsset: asset, existingHolding: holding, changes: [] });
    }
  }

  return {
    accountId,
    items,
    summary: {
      added: items.filter(i => i.status === 'added').length,
      changed: items.filter(i => i.status === 'changed').length,
      unchanged: items.filter(i => i.status === 'unchanged').length,
      removed: items.filter(i => i.status === 'removed').length,
    },
  };
}

// Compare holding-level fields (quantity, averagePrice) and asset-level fields (currentPrice, name)
function compareFields(row: ImportAssetRow, asset: Asset, holding: Holding): DiffChange[] {
  const changes: DiffChange[] = [];
  if (row.quantity !== holding.quantity)
    changes.push({ field: 'quantity', oldValue: holding.quantity, newValue: row.quantity });
  if (row.averagePrice != null && row.averagePrice !== holding.averagePrice)
    changes.push({ field: 'averagePrice', oldValue: holding.averagePrice, newValue: row.averagePrice });
  if (row.currentPrice != null && row.currentPrice !== asset.currentPrice)
    changes.push({ field: 'currentPrice', oldValue: asset.currentPrice, newValue: row.currentPrice });
  if (row.name !== asset.name)
    changes.push({ field: 'name', oldValue: asset.name, newValue: row.name });
  return changes;
}
```

- [ ] **Step 4: Rewrite `import-applier.ts` for account scope**

Key changes:
- Create account if accountId is null (new account from import)
- Create Asset if ticker not found globally
- Create/update/delete Holdings in the target account
- Update Asset-level fields (currentPrice, name, type, dataSource) on matched assets

```typescript
export async function applyImportDiff(
  diff: ImportDiff,
  source: ImportRecord['source'],
  accountName?: string, // for new account creation
): Promise<{ record: ImportRecord; accountId: number }> {
  let itemsAdded = 0, itemsChanged = 0, itemsUnchanged = 0, itemsRemoved = 0;
  let accountId = diff.accountId;

  await db.transaction('rw', db.accounts, db.assets, db.holdings, db.paymentHistory, db.importRecords, async () => {
    // Create account if new
    if (accountId == null) {
      const now = new Date();
      accountId = await db.accounts.add({ name: accountName!, createdAt: now, updatedAt: now }) as number;
    }

    for (const item of diff.items) {
      switch (item.status) {
        case 'added': {
          // Find or create Asset
          let assetId: number;
          if (item.existingAsset) {
            // Asset exists globally — update asset-level fields
            assetId = item.existingAsset.id!;
            await updateAssetFields(assetId, item.imported!);
          } else {
            // Create new Asset
            assetId = await createAsset(item.imported!);
          }
          // Create Holding
          const now = new Date();
          await db.holdings.add({
            accountId: accountId!, assetId,
            quantity: item.imported!.quantity,
            quantitySource: 'import',
            importedQuantity: item.imported!.quantity,
            averagePrice: item.imported!.averagePrice,
            createdAt: now, updatedAt: now,
          });
          itemsAdded++;
          break;
        }
        case 'changed': {
          // Update Holding
          await db.holdings.update(item.existingHolding!.id!, {
            quantity: item.imported!.quantity,
            quantitySource: 'import',
            importedQuantity: item.imported!.quantity,
            averagePrice: item.imported!.averagePrice ?? item.existingHolding!.averagePrice,
            updatedAt: new Date(),
          });
          // Update Asset-level fields (currentPrice, name, dataSource)
          await updateAssetFields(item.existingAsset!.id!, item.imported!);
          itemsChanged++;
          break;
        }
        case 'removed': {
          // Delete holding
          await db.holdings.delete(item.existingHolding!.id!);
          // Delete orphaned asset
          const remaining = await db.holdings.where('assetId').equals(item.existingHolding!.assetId).count();
          if (remaining === 0) {
            await db.paymentHistory.where('assetId').equals(item.existingHolding!.assetId).delete();
            await db.assets.delete(item.existingHolding!.assetId);
          }
          itemsRemoved++;
          break;
        }
        case 'unchanged':
          itemsUnchanged++;
          break;
      }
    }

    // Write import record
    await db.importRecords.add({
      date: new Date(), source, accountId: accountId!,
      itemsAdded, itemsChanged, itemsUnchanged, itemsRemoved,
    } as ImportRecord);
  });

  return { record: { date: new Date(), source, accountId: accountId!, itemsAdded, itemsChanged, itemsUnchanged, itemsRemoved } as ImportRecord, accountId: accountId! };
}

// Create a new Asset from import row
async function createAsset(row: ImportAssetRow): Promise<number> {
  const freq = row.frequencyPerYear ?? getDefaultFrequency(row.type) ?? 12;
  const now = new Date();
  return await db.assets.add({
    type: row.type, ticker: row.ticker, isin: row.isin, name: row.name,
    currentPrice: row.currentPrice ?? row.averagePrice, faceValue: row.faceValue,
    currency: row.currency, emitter: row.emitter,
    securityCategory: row.securityCategory, issueInfo: row.issueInfo,
    paymentPerUnit: row.lastPaymentAmount ?? undefined,
    paymentPerUnitSource: row.lastPaymentAmount ? 'manual' : 'fact',
    frequencyPerYear: freq, frequencySource: 'manual',
    dataSource: 'import', createdAt: now, updatedAt: now,
  }) as number;
}

// Update asset-level fields from import row (shared across accounts)
async function updateAssetFields(assetId: number, row: ImportAssetRow): Promise<void> {
  const updates: Record<string, unknown> = {
    name: row.name, dataSource: 'import', updatedAt: new Date(),
  };
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

- [ ] **Step 5: Write tests**

Test files: `tests/services/import-diff-v2.test.ts`, `tests/services/import-applier-v2.test.ts`

Cover:
- Import into new account → creates account, assets, holdings
- Import into existing account → updates holdings, adds new, removes missing
- Same ticker in import matches existing asset → creates holding, updates asset fields
- Removed holding deletes orphaned asset

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/services/import-diff-v2.test.ts tests/services/import-applier-v2.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/ tests/services/
git commit -m "feat: import pipeline creates holdings per account, full snapshot diff"
```

---

### Task 6: Update backup service

**Files:**
- Modify: `src/services/backup.ts`
- Test: `tests/services/backup-v2.test.ts`

- [ ] **Step 1: Update `exportAllData`**

```typescript
export async function exportAllData(): Promise<string> {
  const data = {
    version: 3,
    exportedAt: new Date().toISOString(),
    accounts: await db.accounts.toArray(),
    assets: await db.assets.toArray(),
    holdings: await db.holdings.toArray(),
    paymentHistory: await db.paymentHistory.toArray(),
    importRecords: await db.importRecords.toArray(),
    settings: await db.table('settings').toArray(),
  };
  return JSON.stringify(data, null, 2);
}
```

- [ ] **Step 2: Update `importAllData`**

Add accounts/holdings handling. Remove old paymentSchedules backward compat. Validate accounts array presence for v3 format.

- [ ] **Step 3: Write tests**

Test: export includes accounts/holdings, import restores them, old v2 format rejected with clear error.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/services/backup-v2.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/backup.ts tests/services/backup-v2.test.ts
git commit -m "feat: backup v3 format with accounts and holdings"
```

---

### Task 7: Update asset detail page (read-only holdings)

**Files:**
- Modify: `src/pages/asset-detail-page.tsx`

- [ ] **Step 1: Make holdings display read-only**

- Import `useHoldingsByAsset` and `useAccounts`
- Compute `totalQuantity` from holdings
- Show breakdown: account name → quantity, averagePrice per holding
- Remove `handleSaveQuantity` handler and quantity editing UI
- Keep paymentPerUnit and frequency editing
- Add tap handler on account row → `navigate('/data', { state: { accountId, assetId } })`

- [ ] **Step 2: Verify page renders correctly**

Run: `npm run dev` and check asset detail page shows holdings breakdown.

- [ ] **Step 3: Commit**

```bash
git add src/pages/asset-detail-page.tsx
git commit -m "feat: asset detail shows read-only holdings breakdown with navigation to data page"
```

---

### Task 8: Phase 1 integration — verify everything compiles and tests pass

- [ ] **Step 1: Run TypeScript check**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 2: Run all tests**

Run: `npm run test`
Expected: All tests pass. Old import tests may need updates.

- [ ] **Step 3: Fix any remaining test failures**

Update old test files that reference `asset.quantity` or `AssetType` enum.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix: update remaining tests for multi-account model"
```

---

## Phase 2: Данные Page

### Task 9: Data page scaffold with account cards

**Files:**
- Create: `src/pages/data-page.tsx`
- Create: `src/components/data/account-section.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/drawer-menu.tsx`

- [ ] **Step 1: Create `data-page.tsx` scaffold**

Route: `/data`. Uses `useAccounts()` and `useHoldings()`. Renders list of AccountSection components. "+ Добавить счёт" button at bottom.

- [ ] **Step 2: Create `account-section.tsx`**

Collapsible card. Header: chevron, name (way-text color), status badge (derived), total value, "Импорт" button, "⋯" menu. Body: will hold holdings table (next task).

- [ ] **Step 3: Update `App.tsx` — add `/data` route, remove import routes and `/add-asset`**

```typescript
// Remove: ImportPage, ImportAIPage, ImportFilePage, ImportSberPage, ImportPreviewPage, AddAssetPage
// Add: DataPage
<Route path="/data" element={<DataPage />} />
```

- [ ] **Step 4: Update `drawer-menu.tsx`**

Change: `{ label: 'Импорт данных', path: '/import', icon: Download }` → `{ label: 'Данные', path: '/data', icon: Database }`

- [ ] **Step 5: Verify navigation works**

Run: `npm run dev` — open menu, tap "Данные", see account cards.

- [ ] **Step 6: Commit**

```bash
git add src/pages/data-page.tsx src/components/data/ src/App.tsx src/components/layout/drawer-menu.tsx
git commit -m "feat: add data page with account cards, update navigation"
```

---

### Task 10: Holdings table with type grouping

**Files:**
- Create: `src/components/data/holdings-table.tsx`
- Modify: `src/components/data/account-section.tsx`

- [ ] **Step 1: Create `holdings-table.tsx`**

Groups holdings by asset type. For each type group: sub-header with type name + sum. Table: Тикер (name below), Кол-во, Цена пок., Стоимость. "+ Добавить актив" button at bottom.

- [ ] **Step 2: Integrate into account-section.tsx**

Pass holdings and assets to HoldingsTable.

- [ ] **Step 3: Verify rendering with real data**

Import test data via Sber report (manually via console or temp UI) to see populated tables.

- [ ] **Step 4: Commit**

```bash
git add src/components/data/
git commit -m "feat: holdings table grouped by type with value subtotals"
```

---

### Task 11: Inline cell editing

**Files:**
- Create: `src/components/data/inline-cell.tsx`
- Modify: `src/components/data/holdings-table.tsx`

- [ ] **Step 1: Create `inline-cell.tsx`**

Tappable cell component. Tap → input field appears with current value. On blur/enter → save callback. On escape → cancel. Supports number and text modes.

- [ ] **Step 2: Wire up editing in holdings-table**

- quantity, averagePrice → `updateHolding(holdingId, { ... })` + set `quantitySource: 'manual'`
- name, type, currentPrice → `updateAsset(assetId, { ... })`
- Account name → `updateAccount(accountId, { name })`

- [ ] **Step 3: Verify editing works**

Run dev server, tap cells, edit values, verify they persist after reload.

- [ ] **Step 4: Commit**

```bash
git add src/components/data/
git commit -m "feat: inline cell editing on data page"
```

---

### Task 12: Type combobox component

**Files:**
- Create: `src/components/data/type-combobox.tsx`

- [ ] **Step 1: Create combobox**

Input + dropdown. Shows `getTypeSuggestions(existingTypes)`. Filtering on input. Free text allowed. On select/enter → save.

Use shadcn Popover + Command pattern, or simple custom dropdown matching existing design system.

- [ ] **Step 2: Integrate into inline editing for type cells**

- [ ] **Step 3: Commit**

```bash
git add src/components/data/type-combobox.tsx
git commit -m "feat: type combobox with suggestions and free input"
```

---

### Task 13: Add account and add asset flows

**Files:**
- Create: `src/components/data/add-account-sheet.tsx`
- Create: `src/components/data/add-asset-sheet.tsx`
- Modify: `src/pages/data-page.tsx`

- [ ] **Step 1: Create `add-account-sheet.tsx`**

Bottom sheet (shadcn Sheet). Two options: "Пустой" (enter name) or "Из импорта" (triggers import flow). On "Пустой": text input for name → `addAccount(name)`.

- [ ] **Step 2: Create `add-asset-sheet.tsx`**

Bottom sheet. Form fields: name, type (combobox), ticker (optional), quantity, averagePrice. On submit:
1. Check if Asset with this ticker exists → `db.assets.where('ticker').equals(ticker).first()`
2. If yes → create Holding only
3. If no → create Asset + Holding atomically (Dexie transaction)

- [ ] **Step 3: Wire into data page**

"+ Добавить счёт" → opens add-account-sheet.
"+ Добавить актив" in account → opens add-asset-sheet with accountId.

- [ ] **Step 4: Verify full flow**

Add empty account, add asset to it, verify appears in table.

- [ ] **Step 5: Commit**

```bash
git add src/components/data/ src/pages/data-page.tsx
git commit -m "feat: add account and add asset flows on data page"
```

---

### Task 14: Delete account and delete holding

**Files:**
- Modify: `src/components/data/account-section.tsx`
- Modify: `src/components/data/holdings-table.tsx`

- [ ] **Step 1: Add delete to account "⋯" menu**

Confirmation dialog → `deleteAccount(id)` from use-accounts hook.

- [ ] **Step 2: Add delete to holding rows**

Swipe-to-delete or long-press → confirm → `deleteHolding(id)` from use-holdings hook.

- [ ] **Step 3: Verify cascade deletion**

Delete account → all holdings gone. Delete last holding for an asset → asset gone.

- [ ] **Step 4: Commit**

```bash
git add src/components/data/
git commit -m "feat: delete accounts and holdings with cascade"
```

---

### Task 15: Import flow (Sber into account)

**Files:**
- Create: `src/components/data/import-flow.tsx`
- Create: `src/components/data/import-preview.tsx`

- [ ] **Step 1: Create `import-flow.tsx`**

Modal/sheet with steps:
1. File upload (accept .html)
2. Parse with `parseSberHTML()` + `extractAgreementNumber()`
3. Compute diff with `computeImportDiff(rows, accountId)`
4. Show preview → import-preview component
5. On confirm → `applyImportDiff(diff, 'sber_html', accountName)`

Two entry points:
- From "Импорт" button in account header → accountId passed, name not changed
- From "Из импорта" in add-account-sheet → accountId=null, name from `extractAgreementNumber` (editable)

- [ ] **Step 2: Create `import-preview.tsx`**

Compact table: summary chips (new/changed/removed/ok), table rows with inline diff (old struck through → new), colored left borders. Buttons: Отмена / Применить.

- [ ] **Step 3: Test full import flow**

Upload `test-data/40R9B_10032026.HTML` → verify account created with name "Сбер / 40R9B" → verify holdings populated → re-import → verify diff preview shows changes.

- [ ] **Step 4: Commit**

```bash
git add src/components/data/import-flow.tsx src/components/data/import-preview.tsx
git commit -m "feat: Sber import flow with preview into account"
```

---

### Task 16: Delete old import pages

**Files:**
- Delete: `src/pages/import-page.tsx`
- Delete: `src/pages/import-sber-page.tsx`
- Delete: `src/pages/import-ai-page.tsx`
- Delete: `src/pages/import-file-page.tsx`
- Delete: `src/pages/import-preview-page.tsx`
- Delete: `src/pages/add-asset-page.tsx`

- [ ] **Step 1: Delete files**

- [ ] **Step 2: Verify no remaining imports reference these files**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old import and add-asset pages"
```

---

## Phase 3: Main Page + Category Adaptation

### Task 17: Main page with string-based categories

**Files:**
- Modify: `src/pages/main-page.tsx`
- Modify: `src/components/main/category-card.tsx`

- [ ] **Step 1: Update `category-card.tsx`**

Replace `ASSET_TYPE_COLORS[type]` with `getTypeColor(type)`. Replace `ASSET_TYPE_LABELS[type]` with just `type` (already a Russian string).

```typescript
import { getTypeColor } from '@/models/account';

// In component:
const color = getTypeColor(type);
const label = type; // type is already "Акции", "Облигации", etc.
```

- [ ] **Step 2: Update `main-page.tsx`**

CategoryCards already receive `type` from `usePortfolioStats()`. The type is now a string — just pass it through. No functional changes needed if CategoryCard handles strings.

- [ ] **Step 3: Verify main page renders**

Run dev server, check category cards show correct labels and colors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/main-page.tsx src/components/main/category-card.tsx
git commit -m "feat: main page uses string-based category types with color helper"
```

---

### Task 18: Category page with string types

**Files:**
- Modify: `src/pages/category-page.tsx`

- [ ] **Step 1: Update category page**

- Route param `:type` is now a URL-encoded string
- `useAssetsByType` removed — filter assets manually: `assets.filter(a => a.type === type)`
- Pass `totalQuantity` to AssetRow (from holdings aggregation)

- [ ] **Step 2: Verify category page works**

Navigate from main page → category → see assets.

- [ ] **Step 3: Commit**

```bash
git add src/pages/category-page.tsx
git commit -m "feat: category page works with string-based asset types"
```

---

### Task 19: Navigation from asset detail to data page

**Files:**
- Modify: `src/pages/asset-detail-page.tsx`
- Modify: `src/pages/data-page.tsx`

- [ ] **Step 1: Add navigation handler on asset detail**

When user taps on a holding row → `navigate('/data', { state: { highlightAccountId, highlightAssetId } })`.

- [ ] **Step 2: Handle highlight state on data page**

Read `location.state`. If present: auto-expand the target account, scroll to the row, apply pulse animation CSS class.

```css
@keyframes way-highlight-pulse {
  0% { background-color: var(--way-gold); opacity: 0.2; }
  100% { background-color: transparent; opacity: 0; }
}
```

- [ ] **Step 3: Verify navigation flow**

Asset detail → tap account holding → navigates to data page → row highlighted.

- [ ] **Step 4: Commit**

```bash
git add src/pages/asset-detail-page.tsx src/pages/data-page.tsx
git commit -m "feat: navigate from asset detail to data page with row highlight"
```

---

### Task 20: Final integration and cleanup

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npm run test`
Expected: All pass

- [ ] **Step 3: Clean up old test files that test removed features**

Update `tests/services/import-diff.test.ts` and `tests/services/import-applier.test.ts` if they reference old API signatures.

- [ ] **Step 4: Visual verification**

Open dev server on mobile viewport:
- [ ] Main page: category cards with correct colors and labels
- [ ] Данные page: accounts, tables, inline editing
- [ ] Import: upload Sber report, preview, apply
- [ ] Asset detail: holdings breakdown, tap navigates to data

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: final cleanup and integration verification"
```

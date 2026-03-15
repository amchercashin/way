# Plan 3a: Import Core — Parsers, Diff, Preview UI

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import portfolio data from Markdown tables (AI-generated) and CSV files, preview changes as a color-coded diff, and apply approved changes to the database.

**Architecture:** Pipeline: **Parse → Diff → Preview → Apply**. Parser converts raw text into typed `ImportAssetRow[]`. Diff engine compares imported rows against existing DB assets by ticker, producing a color-coded diff. Preview page shows the diff with conflict resolution. Applier writes approved changes to DB and creates an `ImportRecord`. Data flows between pages via React Router location state.

**Tech Stack:** React 19, React Router v7 (location state), Dexie.js, Vitest + fake-indexeddb

**Spec:** `docs/superpowers/specs/2026-03-15-passive-income-tracker-design.md` (sections 2.3, 4.1, 5.1)

**Design decisions:**
- Match existing assets by `ticker` only (assets without ticker always treated as "added")
- Import mode "Обновить" = merge (update matching tickers, add new, leave missing alone — NOT delete)
- Import mode "Добавить" = only add tickers not already in DB
- Conflict = imported value differs from existing AND existing `dataSource === 'manual'`
- For non-manual existing data (`dataSource: 'moex' | 'import'`), overwrite without conflict
- CSV parser uses simple comma split (no quoted value support for MVP)
- MD parser uses flexible header matching via regex (tolerates AI-generated header variations)
- Number parsing handles both `.` and `,` decimal separators (Russian locale)
- Data passes between pages via `navigate(path, { state: {...} })`
- Drawer menu already links to `/import` — just needs route added

---

## File Structure

```
src/services/
├── import-parser.ts        # MD + CSV parsing → ImportAssetRow[]
├── import-diff.ts          # Diff engine: compare imports vs DB
└── import-applier.ts       # Apply diff to DB, create ImportRecord

src/pages/
├── import-page.tsx         # Method selection + mode toggle
├── import-ai-page.tsx      # AI prompt + paste textarea
├── import-file-page.tsx    # CSV/MD file upload or paste
└── import-preview-page.tsx # Color-coded diff, conflicts, apply

tests/services/
├── import-parser.test.ts
├── import-diff.test.ts
└── import-applier.test.ts
```

Modified files:
- `src/App.tsx` — add 4 import routes

---

## Chunk 1: Service Layer

### Task 1: Import types + MD/CSV parser

**Files:**
- Create: `src/services/import-parser.ts`
- Create: `tests/services/import-parser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/import-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseMDTable,
  parseCSV,
  parseTypeLabel,
  type ImportAssetRow,
} from '@/services/import-parser';

describe('parseTypeLabel', () => {
  it('maps Russian labels to AssetType', () => {
    expect(parseTypeLabel('акция')).toBe('stock');
    expect(parseTypeLabel('Облигация')).toBe('bond');
    expect(parseTypeLabel('фонд')).toBe('fund');
    expect(parseTypeLabel('ETF')).toBe('fund');
    expect(parseTypeLabel('вклад')).toBe('deposit');
    expect(parseTypeLabel('недвижимость')).toBe('realestate');
    expect(parseTypeLabel('прочее')).toBe('other');
  });

  it('maps English labels', () => {
    expect(parseTypeLabel('stock')).toBe('stock');
    expect(parseTypeLabel('bond')).toBe('bond');
  });

  it('defaults to other for unknown types', () => {
    expect(parseTypeLabel('xyz')).toBe('other');
    expect(parseTypeLabel('')).toBe('other');
  });
});

describe('parseMDTable', () => {
  it('parses standard Markdown table', () => {
    const text = `
| Тикер | Название | Тип | Кол-во | Ср.цена | Посл.выплата | Частота |
|-------|----------|-----|--------|---------|--------------|---------|
| SBER | Сбербанк | акция | 800 | 298.60 | 34.84 | 1 |
| LKOH | Лукойл | акция | 10 | 6750 | 498 | 1 |
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      ticker: 'SBER',
      name: 'Сбербанк',
      type: 'stock',
      quantity: 800,
      averagePrice: 298.60,
      lastPaymentAmount: 34.84,
      frequencyPerYear: 1,
    });
    expect(rows[1].ticker).toBe('LKOH');
    expect(rows[1].quantity).toBe(10);
  });

  it('handles Russian comma decimals', () => {
    const text = `
| Тикер | Название | Тип | Кол-во | Ср.цена | Посл.выплата | Частота |
|-------|----------|-----|--------|---------|--------------|---------|
| SBER | Сбербанк | акция | 800 | 298,60 | 34,84 | 1 |
`;
    const rows = parseMDTable(text);
    expect(rows[0].averagePrice).toBe(298.60);
    expect(rows[0].lastPaymentAmount).toBe(34.84);
  });

  it('handles missing optional fields', () => {
    const text = `
| Название | Тип | Кол-во |
|----------|-----|--------|
| Квартира | недвижимость | 1 |
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBeUndefined();
    expect(rows[0].averagePrice).toBeUndefined();
    expect(rows[0].type).toBe('realestate');
  });

  it('handles alternative header names from AI', () => {
    const text = `
| Ticker | Name | Type | Quantity | Avg Price | Last Payment | Frequency |
|--------|------|------|----------|-----------|--------------|-----------|
| SBER | Sberbank | stock | 800 | 298.60 | 34.84 | 1 |
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBe('SBER');
  });

  it('extracts table from surrounding text', () => {
    const text = `
Here is the converted table:

| Тикер | Название | Тип | Кол-во | Ср.цена | Посл.выплата | Частота |
|-------|----------|-----|--------|---------|--------------|---------|
| SBER | Сбербанк | акция | 800 | 298.60 | 34.84 | 1 |

Let me know if you need anything else!
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(1);
  });

  it('returns empty array for invalid input', () => {
    expect(parseMDTable('')).toEqual([]);
    expect(parseMDTable('no table here')).toEqual([]);
  });

  it('skips rows with missing required fields (name, quantity)', () => {
    const text = `
| Тикер | Название | Тип | Кол-во |
|-------|----------|-----|--------|
| SBER | | акция | 800 |
| LKOH | Лукойл | акция | |
| GAZP | Газпром | акция | 100 |
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBe('GAZP');
  });
});

describe('parseCSV', () => {
  it('parses CSV with headers', () => {
    const text = `Тикер,Название,Тип,Кол-во,Ср.цена,Посл.выплата,Частота
SBER,Сбербанк,акция,800,298.60,34.84,1
LKOH,Лукойл,акция,10,6750,498,1`;
    const rows = parseCSV(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].ticker).toBe('SBER');
    expect(rows[0].quantity).toBe(800);
  });

  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests → FAIL**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/import-parser.test.ts`

- [ ] **Step 3: Implement parser**

Create `src/services/import-parser.ts`:

```typescript
import type { AssetType } from '@/models/types';

export interface ImportAssetRow {
  ticker?: string;
  name: string;
  type: AssetType;
  quantity: number;
  averagePrice?: number;
  lastPaymentAmount?: number;
  frequencyPerYear?: number;
}

const TYPE_MAP: Record<string, AssetType> = {
  акция: 'stock', акции: 'stock', stock: 'stock',
  облигация: 'bond', облигации: 'bond', bond: 'bond',
  фонд: 'fund', etf: 'fund', бпиф: 'fund', fund: 'fund',
  недвижимость: 'realestate', realestate: 'realestate',
  вклад: 'deposit', deposit: 'deposit',
  прочее: 'other', other: 'other',
};

export function parseTypeLabel(label: string): AssetType {
  return TYPE_MAP[label.trim().toLowerCase()] ?? 'other';
}

// ============ Shared helpers ============

interface ColumnMap {
  ticker?: number;
  name?: number;
  type?: number;
  quantity?: number;
  averagePrice?: number;
  lastPaymentAmount?: number;
  frequencyPerYear?: number;
}

const HEADER_PATTERNS: [keyof ColumnMap, RegExp][] = [
  ['ticker', /тикер|ticker|secid/i],
  ['name', /назван|name|наименование/i],
  ['type', /тип|type/i],
  ['quantity', /кол[- ]?во|количество|qty|quantity|шт/i],
  ['averagePrice', /ср\.?\s*цена|средн.*цена|avg.*price|цена|price/i],
  ['lastPaymentAmount', /посл\.?\s*выплат|last.*payment|дивиденд|купон|выплата|payment/i],
  ['frequencyPerYear', /частот|frequency|freq|раз.*год/i],
];

function mapHeaders(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (let i = 0; i < headers.length; i++) {
    for (const [field, pattern] of HEADER_PATTERNS) {
      if (pattern.test(headers[i]) && map[field] === undefined) {
        map[field] = i;
        break;
      }
    }
  }
  return map;
}

function parseNumber(s: string): number | undefined {
  if (!s || !s.trim()) return undefined;
  const cleaned = s.trim().replace(/\s/g, '').replace(',', '.');
  const num = Number(cleaned);
  return isNaN(num) || num <= 0 ? undefined : num;
}

function cellsToRow(cells: string[], colMap: ColumnMap): ImportAssetRow | null {
  const name = colMap.name !== undefined ? cells[colMap.name]?.trim() : undefined;
  if (!name) return null;

  const quantity = colMap.quantity !== undefined ? parseNumber(cells[colMap.quantity]) : undefined;
  if (!quantity) return null;

  return {
    ticker: colMap.ticker !== undefined ? cells[colMap.ticker]?.trim() || undefined : undefined,
    name,
    type: colMap.type !== undefined ? parseTypeLabel(cells[colMap.type]) : 'other',
    quantity,
    averagePrice: colMap.averagePrice !== undefined ? parseNumber(cells[colMap.averagePrice]) : undefined,
    lastPaymentAmount: colMap.lastPaymentAmount !== undefined ? parseNumber(cells[colMap.lastPaymentAmount]) : undefined,
    frequencyPerYear: colMap.frequencyPerYear !== undefined ? parseNumber(cells[colMap.frequencyPerYear]) : undefined,
  };
}

// ============ MD Table Parser ============

function splitTableRow(line: string): string[] {
  const cells = line.split('|').map((c) => c.trim());
  if (cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparatorLine(line: string): boolean {
  return /^\s*\|?\s*[-:\s|]+\s*\|?\s*$/.test(line);
}

export function parseMDTable(text: string): ImportAssetRow[] {
  const lines = text.trim().split('\n');
  const tableLines = lines.filter((l) => l.includes('|'));
  if (tableLines.length < 2) return [];

  const headerLine = tableLines[0];
  if (isSeparatorLine(headerLine)) return [];

  const headers = splitTableRow(headerLine);
  const colMap = mapHeaders(headers);
  if (colMap.name === undefined) return [];

  const rows: ImportAssetRow[] = [];
  for (let i = 1; i < tableLines.length; i++) {
    if (isSeparatorLine(tableLines[i])) continue;
    const cells = splitTableRow(tableLines[i]);
    const row = cellsToRow(cells, colMap);
    if (row) rows.push(row);
  }
  return rows;
}

// ============ CSV Parser ============

export function parseCSV(text: string): ImportAssetRow[] {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((c) => c.trim());
  const colMap = mapHeaders(headers);
  if (colMap.name === undefined) return [];

  const rows: ImportAssetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim());
    const row = cellsToRow(cells, colMap);
    if (row) rows.push(row);
  }
  return rows;
}
```

- [ ] **Step 4: Run tests → PASS**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/import-parser.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/services/import-parser.ts tests/services/import-parser.test.ts
git commit -m "feat: add MD/CSV import parser with flexible header matching"
```

---

### Task 2: Diff engine

**Files:**
- Create: `src/services/import-diff.ts`
- Create: `tests/services/import-diff.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/import-diff.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { computeImportDiff } from '@/services/import-diff';
import type { ImportAssetRow } from '@/services/import-parser';

describe('computeImportDiff', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('marks all rows as added when DB is empty', async () => {
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800, averagePrice: 298.60 },
      { ticker: 'LKOH', name: 'Лукойл', type: 'stock', quantity: 10 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.summary.added).toBe(2);
    expect(diff.items.every((i) => i.status === 'added')).toBe(true);
  });

  it('detects quantity change in update mode', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 500, dataSource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('changed');
    expect(diff.items[0].changes.some((c) => c.field === 'quantity')).toBe(true);
  });

  it('marks unchanged assets', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 800, dataSource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('unchanged');
  });

  it('flags conflict when existing has manual dataSource', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 500, dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('conflict');
    expect(diff.summary.conflicts).toBe(1);
  });

  it('in add mode, marks existing tickers as unchanged', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 500, dataSource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
      { ticker: 'LKOH', name: 'Лукойл', type: 'stock', quantity: 10 },
    ];
    const diff = await computeImportDiff(rows, 'add');
    expect(diff.items[0].status).toBe('unchanged');
    expect(diff.items[1].status).toBe('added');
  });

  it('detects payment schedule changes', async () => {
    const assetId = (await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 800, dataSource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    })) as number;
    await db.paymentSchedules.add({
      assetId, frequencyPerYear: 1, lastPaymentAmount: 25.0, dataSource: 'import',
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800, lastPaymentAmount: 34.84 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('changed');
    expect(diff.items[0].changes.some((c) => c.field === 'lastPaymentAmount')).toBe(true);
  });

  it('treats rows without ticker as always added', async () => {
    await db.assets.add({
      type: 'realestate', name: 'Квартира', quantity: 1,
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });
    const rows: ImportAssetRow[] = [
      { name: 'Квартира', type: 'realestate', quantity: 1 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    expect(diff.items[0].status).toBe('added');
  });
});
```

- [ ] **Step 2: Run tests → FAIL**

- [ ] **Step 3: Implement diff engine**

Create `src/services/import-diff.ts`:

```typescript
import { db } from '@/db/database';
import type { Asset, PaymentSchedule } from '@/models/types';
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
  const existingSchedules = await db.paymentSchedules.toArray();
  const byTicker = new Map<string, Asset>();
  const scheduleByAssetId = new Map<number, PaymentSchedule>();
  for (const asset of existingAssets) {
    if (asset.ticker) byTicker.set(asset.ticker, asset);
  }
  for (const s of existingSchedules) {
    scheduleByAssetId.set(s.assetId, s);
  }

  const items: DiffItem[] = [];

  for (const row of rows) {
    const existing = row.ticker ? byTicker.get(row.ticker) : undefined;

    if (!existing) {
      items.push({ status: 'added', imported: row, changes: [] });
    } else if (mode === 'add') {
      items.push({ status: 'unchanged', imported: row, existingAsset: existing, changes: [] });
    } else {
      const schedule = existing.id ? scheduleByAssetId.get(existing.id) : undefined;
      const changes = compareFields(row, existing, schedule);
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
  schedule?: PaymentSchedule,
): DiffChange[] {
  const changes: DiffChange[] = [];

  if (row.quantity !== existing.quantity) {
    changes.push({ field: 'quantity', oldValue: existing.quantity, newValue: row.quantity });
  }
  if (row.averagePrice != null && row.averagePrice !== existing.averagePrice) {
    changes.push({ field: 'averagePrice', oldValue: existing.averagePrice, newValue: row.averagePrice });
  }
  if (row.name !== existing.name) {
    changes.push({ field: 'name', oldValue: existing.name, newValue: row.name });
  }
  if (row.lastPaymentAmount != null && schedule && row.lastPaymentAmount !== schedule.lastPaymentAmount) {
    changes.push({ field: 'lastPaymentAmount', oldValue: schedule.lastPaymentAmount, newValue: row.lastPaymentAmount });
  }
  if (row.frequencyPerYear != null && schedule && row.frequencyPerYear !== schedule.frequencyPerYear) {
    changes.push({ field: 'frequencyPerYear', oldValue: schedule.frequencyPerYear, newValue: row.frequencyPerYear });
  }

  return changes;
}
```

- [ ] **Step 4: Run tests → PASS**

- [ ] **Step 5: Commit**

```bash
git add src/services/import-diff.ts tests/services/import-diff.test.ts
git commit -m "feat: add import diff engine with conflict detection"
```

---

### Task 3: Import applier

**Files:**
- Create: `src/services/import-applier.ts`
- Create: `tests/services/import-applier.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/import-applier.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { computeImportDiff } from '@/services/import-diff';
import { applyImportDiff } from '@/services/import-applier';
import type { ImportAssetRow } from '@/services/import-parser';

describe('applyImportDiff', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates assets and schedules for added items', async () => {
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800,
        averagePrice: 298.60, lastPaymentAmount: 34.84, frequencyPerYear: 1 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    const record = await applyImportDiff(diff, 'ai_import', new Map());

    expect(record.itemsAdded).toBe(1);

    const assets = await db.assets.toArray();
    expect(assets).toHaveLength(1);
    expect(assets[0].ticker).toBe('SBER');
    expect(assets[0].quantity).toBe(800);
    expect(assets[0].dataSource).toBe('import');

    const schedules = await db.paymentSchedules.toArray();
    expect(schedules).toHaveLength(1);
    expect(schedules[0].lastPaymentAmount).toBe(34.84);
    expect(schedules[0].dataSource).toBe('import');
  });

  it('updates existing assets for changed items', async () => {
    const assetId = (await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 500, dataSource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    })) as number;

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    const record = await applyImportDiff(diff, 'markdown', new Map());

    expect(record.itemsChanged).toBe(1);

    const asset = await db.assets.get(assetId);
    expect(asset!.quantity).toBe(800);
    expect(asset!.dataSource).toBe('import');
  });

  it('respects conflict resolution: import wins', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 500, dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    const resolutions = new Map([[0, 'import' as const]]);
    const record = await applyImportDiff(diff, 'csv', resolutions);

    expect(record.itemsChanged).toBe(1);
    const assets = await db.assets.toArray();
    expect(assets[0].quantity).toBe(800);
  });

  it('respects conflict resolution: keep existing', async () => {
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 500, dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'stock', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, 'update');
    const resolutions = new Map([[0, 'keep' as const]]);
    const record = await applyImportDiff(diff, 'csv', resolutions);

    expect(record.itemsUnchanged).toBe(1);
    const assets = await db.assets.toArray();
    expect(assets[0].quantity).toBe(500);
  });

  it('creates ImportRecord', async () => {
    const diff = await computeImportDiff([], 'update');
    await applyImportDiff(diff, 'ai_import', new Map());

    const records = await db.importRecords.toArray();
    expect(records).toHaveLength(1);
    expect(records[0].source).toBe('ai_import');
    expect(records[0].mode).toBe('update');
  });
});
```

- [ ] **Step 2: Run tests → FAIL**

- [ ] **Step 3: Implement applier**

Create `src/services/import-applier.ts`:

```typescript
import { db } from '@/db/database';
import type { ImportRecord } from '@/models/types';
import type { ImportDiff } from './import-diff';

export async function applyImportDiff(
  diff: ImportDiff,
  source: ImportRecord['source'],
  resolutions: Map<number, 'import' | 'keep'>,
): Promise<ImportRecord> {
  let itemsAdded = 0;
  let itemsChanged = 0;
  let itemsUnchanged = 0;

  await db.transaction('rw', db.assets, db.paymentSchedules, async () => {
    for (let i = 0; i < diff.items.length; i++) {
      const item = diff.items[i];

      switch (item.status) {
        case 'added': {
          const now = new Date();
          const assetId = (await db.assets.add({
            type: item.imported.type,
            ticker: item.imported.ticker,
            name: item.imported.name,
            quantity: item.imported.quantity,
            averagePrice: item.imported.averagePrice,
            currentPrice: item.imported.averagePrice,
            dataSource: 'import',
            createdAt: now,
            updatedAt: now,
          })) as number;

          if (item.imported.lastPaymentAmount) {
            await db.paymentSchedules.add({
              assetId,
              frequencyPerYear: item.imported.frequencyPerYear ?? 1,
              lastPaymentAmount: item.imported.lastPaymentAmount,
              dataSource: 'import',
            });
          }
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

async function updateAsset(assetId: number, row: import('./import-parser').ImportAssetRow): Promise<void> {
  await db.assets.update(assetId, {
    quantity: row.quantity,
    averagePrice: row.averagePrice,
    name: row.name,
    dataSource: 'import',
    updatedAt: new Date(),
  });

  if (row.lastPaymentAmount) {
    const existing = await db.paymentSchedules.where('assetId').equals(assetId).first();
    const scheduleData = {
      frequencyPerYear: row.frequencyPerYear ?? existing?.frequencyPerYear ?? 1,
      lastPaymentAmount: row.lastPaymentAmount,
      dataSource: 'import' as const,
    };

    if (existing) {
      await db.paymentSchedules.update(existing.id!, scheduleData);
    } else {
      await db.paymentSchedules.add({ assetId, ...scheduleData });
    }
  }
}
```

- [ ] **Step 4: Run all tests → PASS**

Run: `cd ~/passive-income-tracker && npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add src/services/import-applier.ts tests/services/import-applier.test.ts
git commit -m "feat: add import applier with conflict resolution"
```

---

## Chunk 2: UI

### Task 4: Import page + routing

**Files:**
- Create: `src/pages/import-page.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create import page**

Create `src/pages/import-page.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { useMoexSync } from '@/hooks/use-moex-sync';
import type { ImportMode } from '@/services/import-diff';

export function ImportPage() {
  const [mode, setMode] = useState<ImportMode>('update');
  const navigate = useNavigate();
  const { syncing, sync } = useMoexSync();

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Импорт данных">
      <div className="flex gap-2 mb-4">
        {(['update', 'add'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === m
                ? 'bg-[#4ecca3] text-black'
                : 'bg-[#1a1a2e] text-gray-400'
            }`}
          >
            {m === 'update' ? '⟳ Обновить' : '+ Добавить'}
          </button>
        ))}
      </div>

      <p className="text-gray-500 text-xs mb-6">
        {mode === 'update'
          ? 'Обновит существующие позиции по тикеру и добавит новые.'
          : 'Добавит только новые тикеры. Существующие позиции не изменит.'}
      </p>

      <div className="space-y-3">
        <MethodButton
          icon="🤖"
          label="Через AI-помощник"
          desc="Промт для ChatGPT/Claude → вставьте таблицу"
          onClick={() => navigate('/import/ai', { state: { mode } })}
        />
        <MethodButton
          icon="📄"
          label="CSV / Markdown"
          desc="Загрузите файл или вставьте текст"
          onClick={() => navigate('/import/file', { state: { mode } })}
        />
        <MethodButton
          icon="⟳"
          label="Обновить с MOEX"
          desc={syncing ? 'Обновление...' : 'Цены, дивиденды, купоны'}
          onClick={() => sync()}
          disabled={syncing}
        />
        <MethodButton
          icon="✏️"
          label="Добавить вручную"
          desc="Заполнить форму для одного актива"
          onClick={() => navigate('/add-asset')}
        />
      </div>
    </AppShell>
  );
}

function MethodButton({ icon, label, desc, onClick, disabled }: {
  icon: string; label: string; desc: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 bg-[#1a1a2e] rounded-xl p-4 text-left
        hover:bg-[#252545] transition-colors disabled:opacity-50"
    >
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-sm text-white font-medium">{label}</div>
        <div className="text-[11px] text-gray-500">{desc}</div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Add routes**

In `src/App.tsx`, add imports and routes:

```tsx
import { ImportPage } from '@/pages/import-page';
import { ImportAIPage } from '@/pages/import-ai-page';
import { ImportFilePage } from '@/pages/import-file-page';
import { ImportPreviewPage } from '@/pages/import-preview-page';
```

Add routes inside `<Routes>`:

```tsx
<Route path="/import" element={<ImportPage />} />
<Route path="/import/ai" element={<ImportAIPage />} />
<Route path="/import/file" element={<ImportFilePage />} />
<Route path="/import/preview" element={<ImportPreviewPage />} />
```

Note: `ImportAIPage`, `ImportFilePage`, `ImportPreviewPage` don't exist yet — create stub files that export empty components so the build doesn't break:

```tsx
// src/pages/import-ai-page.tsx (stub)
export function ImportAIPage() { return <div>AI Import</div>; }

// src/pages/import-file-page.tsx (stub)
export function ImportFilePage() { return <div>File Import</div>; }

// src/pages/import-preview-page.tsx (stub)
export function ImportPreviewPage() { return <div>Preview</div>; }
```

- [ ] **Step 3: Run all tests → PASS**

- [ ] **Step 4: Commit**

```bash
git add src/pages/import-page.tsx src/pages/import-ai-page.tsx \
  src/pages/import-file-page.tsx src/pages/import-preview-page.tsx src/App.tsx
git commit -m "feat: add import page with method selection and routing"
```

---

### Task 5: AI-import + file import pages

**Files:**
- Replace stub: `src/pages/import-ai-page.tsx`
- Replace stub: `src/pages/import-file-page.tsx`

- [ ] **Step 1: Implement AI-import page**

Replace `src/pages/import-ai-page.tsx`:

```tsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { parseMDTable } from '@/services/import-parser';
import type { ImportMode } from '@/services/import-diff';

const AI_PROMPT = `Преобразуй данные из отчёта брокера в Markdown-таблицу:

| Тикер | Название | Тип | Кол-во | Ср.цена | Посл.выплата | Частота |
|-------|----------|-----|--------|---------|--------------|---------|

Правила:
- Тип: акция, облигация, фонд, вклад, недвижимость, прочее
- Частота: число выплат в год (1, 2, 4, 12)
- Посл.выплата: последняя выплата на 1 единицу (₽)
- Ср.цена: средняя цена покупки (₽)
- Если данные неизвестны, оставь ячейку пустой`;

export function ImportAIPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = ((location.state as Record<string, unknown>)?.mode ?? 'update') as ImportMode;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleParse = () => {
    const rows = parseMDTable(text);
    if (rows.length === 0) {
      setError('Не удалось распознать таблицу. Проверьте формат Markdown.');
      return;
    }
    navigate('/import/preview', { state: { mode, rows, source: 'ai_import' } });
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="AI-импорт">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 text-xs">Промт для AI</span>
            <button onClick={handleCopy} className="text-[#4ecca3] text-xs">
              {copied ? '✓ Скопировано' : '📋 Копировать'}
            </button>
          </div>
          <pre className="bg-[#1a1a2e] p-3 rounded-lg text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed">
            {AI_PROMPT}
          </pre>
        </div>

        <div>
          <span className="text-gray-400 text-xs block mb-1">Результат от AI</span>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); }}
            placeholder="Вставьте сюда Markdown-таблицу от ChatGPT, Claude и др..."
            className="w-full h-48 bg-[#1a1a2e] text-white text-sm p-3 rounded-lg
              border border-transparent focus:border-[#4ecca3] outline-none resize-none"
          />
        </div>

        {error && <div className="text-red-400 text-xs">{error}</div>}

        <Button
          onClick={handleParse}
          disabled={!text.trim()}
          className="w-full bg-[#4ecca3] text-black font-semibold hover:bg-[#3dbb92]"
        >
          Распознать и импортировать
        </Button>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Implement file import page**

Replace `src/pages/import-file-page.tsx`:

```tsx
import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { parseMDTable, parseCSV } from '@/services/import-parser';
import type { ImportMode } from '@/services/import-diff';

export function ImportFilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = ((location.state as Record<string, unknown>)?.mode ?? 'update') as ImportMode;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    setError(null);
  };

  const handleParse = () => {
    const isCSV = text.includes(',') && !text.includes('|');
    const rows = isCSV ? parseCSV(text) : parseMDTable(text);
    if (rows.length === 0) {
      setError('Не удалось распознать данные. Проверьте формат.');
      return;
    }
    const source = isCSV ? 'csv' : 'markdown';
    navigate('/import/preview', { state: { mode, rows, source } });
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  return (
    <AppShell leftAction={backButton} title="Импорт файла">
      <div className="space-y-4">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.md,.txt"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-gray-700 rounded-xl
              text-gray-500 text-sm hover:border-[#4ecca3] hover:text-[#4ecca3] transition-colors"
          >
            📂 Выбрать файл (.csv, .md, .txt)
          </button>
        </div>

        <div className="text-center text-gray-600 text-xs">или вставьте текст</div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder="Вставьте CSV или Markdown-таблицу..."
          className="w-full h-48 bg-[#1a1a2e] text-white text-sm p-3 rounded-lg
            border border-transparent focus:border-[#4ecca3] outline-none resize-none"
        />

        {error && <div className="text-red-400 text-xs">{error}</div>}

        <Button
          onClick={handleParse}
          disabled={!text.trim()}
          className="w-full bg-[#4ecca3] text-black font-semibold hover:bg-[#3dbb92]"
        >
          Импортировать
        </Button>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 3: Run all tests → PASS**

- [ ] **Step 4: Commit**

```bash
git add src/pages/import-ai-page.tsx src/pages/import-file-page.tsx
git commit -m "feat: add AI-import and file import pages"
```

---

### Task 6: Preview diff page

**Files:**
- Replace stub: `src/pages/import-preview-page.tsx`

- [ ] **Step 1: Implement preview page**

Replace `src/pages/import-preview-page.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { computeImportDiff, type ImportDiff, type ImportMode, type DiffItem } from '@/services/import-diff';
import { applyImportDiff } from '@/services/import-applier';
import type { ImportAssetRow } from '@/services/import-parser';
import type { ImportRecord } from '@/models/types';

const STATUS_STYLES = {
  added: { bg: 'bg-[#4ecca322]', border: 'border-[#4ecca3]', label: 'Новый', text: 'text-[#4ecca3]' },
  changed: { bg: 'bg-[#e9c46a22]', border: 'border-[#e9c46a]', label: 'Обновлён', text: 'text-[#e9c46a]' },
  unchanged: { bg: 'bg-[#88888811]', border: 'border-gray-800', label: 'Без изменений', text: 'text-gray-500' },
  conflict: { bg: 'bg-[#e9456022]', border: 'border-[#e94560]', label: 'Конфликт', text: 'text-[#e94560]' },
};

export function ImportPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    mode: ImportMode;
    rows: ImportAssetRow[];
    source: string;
  } | null;

  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [resolutions, setResolutions] = useState<Map<number, 'import' | 'keep'>>(new Map());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!state) return;
    computeImportDiff(state.rows, state.mode).then(setDiff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) {
    return (
      <AppShell title="Ошибка">
        <div className="text-gray-500 text-sm text-center py-12">Нет данных для предпросмотра.</div>
      </AppShell>
    );
  }

  const handleApply = async () => {
    if (!diff) return;
    setApplying(true);
    await applyImportDiff(diff, state.source as ImportRecord['source'], resolutions);
    navigate('/');
  };

  const toggleResolution = (index: number) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(index, next.get(index) === 'import' ? 'keep' : 'import');
      return next;
    });
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-gray-400 text-lg" aria-label="Назад">‹</button>
  );

  if (!diff) {
    return <AppShell leftAction={backButton} title="Загрузка..."><div /></AppShell>;
  }

  const actionableCount = diff.summary.added + diff.summary.changed +
    [...resolutions.values()].filter((v) => v === 'import').length;

  return (
    <AppShell leftAction={backButton} title="Предпросмотр">
      <div className="flex flex-wrap gap-3 text-xs mb-4">
        {diff.summary.added > 0 && (
          <span className="text-[#4ecca3]">+{diff.summary.added} новых</span>
        )}
        {diff.summary.changed > 0 && (
          <span className="text-[#e9c46a]">~{diff.summary.changed} обновлено</span>
        )}
        {diff.summary.unchanged > 0 && (
          <span className="text-gray-500">={diff.summary.unchanged} без изменений</span>
        )}
        {diff.summary.conflicts > 0 && (
          <span className="text-[#e94560]">⚠{diff.summary.conflicts} конфликтов</span>
        )}
      </div>

      <div className="space-y-2 mb-6">
        {diff.items.map((item, i) => (
          <DiffItemRow
            key={i}
            item={item}
            resolution={resolutions.get(i)}
            onToggle={item.status === 'conflict' ? () => toggleResolution(i) : undefined}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="flex-1 border-gray-700 text-gray-400"
        >
          Отмена
        </Button>
        <Button
          onClick={handleApply}
          disabled={applying || actionableCount === 0}
          className="flex-1 bg-[#4ecca3] text-black font-semibold hover:bg-[#3dbb92]"
        >
          {applying ? 'Применяю...' : `Применить (${actionableCount})`}
        </Button>
      </div>
    </AppShell>
  );
}

function DiffItemRow({ item, resolution, onToggle }: {
  item: DiffItem;
  resolution?: 'import' | 'keep';
  onToggle?: () => void;
}) {
  const style = STATUS_STYLES[item.status];
  const displayName = item.imported.ticker
    ? `${item.imported.ticker} · ${item.imported.name}`
    : item.imported.name;

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-white text-sm font-medium">{displayName}</span>
        <span className={`text-[10px] ${style.text}`}>{style.label}</span>
      </div>

      <div className="text-gray-400 text-[11px]">
        {item.imported.quantity} шт
        {item.imported.averagePrice != null && ` · ₽${item.imported.averagePrice}`}
        {item.imported.lastPaymentAmount != null && ` · выплата ₽${item.imported.lastPaymentAmount}`}
      </div>

      {item.changes.length > 0 && (
        <div className="mt-1 text-[10px] text-gray-500">
          {item.changes.map((c) => (
            <span key={c.field} className="mr-2">
              {c.field}: {String(c.oldValue ?? '—')} → {String(c.newValue ?? '—')}
            </span>
          ))}
        </div>
      )}

      {item.status === 'conflict' && onToggle && (
        <button
          onClick={onToggle}
          className="mt-2 text-[11px] px-2 py-1 rounded bg-[#1a1a2e]"
        >
          {resolution === 'import'
            ? '✓ Использовать импорт'
            : '⊘ Оставить текущее'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run all tests → PASS**

Run: `cd ~/passive-income-tracker && npx vitest run`

- [ ] **Step 3: Verify visually**

Run: `cd ~/passive-income-tracker && npx vite --open`

Check:
1. ☰ → Импорт данных → import page loads
2. Toggle update/add mode works
3. AI-import: prompt visible, copy works, paste table → preview
4. File import: paste text → preview
5. Preview shows color-coded diff, apply works, returns to main page

- [ ] **Step 4: Commit**

```bash
git add src/pages/import-preview-page.tsx
git commit -m "feat: add import preview page with color-coded diff and conflict resolution"
```

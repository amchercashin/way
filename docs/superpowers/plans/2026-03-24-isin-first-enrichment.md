# ISIN-First Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich import rows with MOEX API data (type, ticker, name, emitter) before preview so unrecognized securities get correct classification.

**Architecture:** New `resolveSecurityFull()` in moex-api.ts fetches extended columns from MOEX ISS search. New `enrichFromMoex()` in moex-enrich.ts fills empty fields on ImportAssetRow[] before preview. Integration in import-flow.tsx between parse and goToPreview.

**Tech Stack:** TypeScript, MOEX ISS API, Vitest, React

**Spec:** `docs/superpowers/specs/2026-03-24-isin-first-enrichment-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/services/moex-api.ts` | Modify | + `MoexSecurityFull` interface, + `resolveSecurityFull()` |
| `src/services/moex-enrich.ts` | Create | `enrichFromMoex()`, `mapMoexMarketToType()`, `needsEnrichment()` |
| `src/components/data/import-flow.tsx` | Modify | Call `enrichFromMoex()` before preview, add loading state |
| `tests/services/moex-api.test.ts` | Modify | + tests for `resolveSecurityFull()` |
| `tests/services/moex-enrich.test.ts` | Create | Tests for enrichment logic |

---

### Task 1: `resolveSecurityFull()` — tests

**Files:**
- Modify: `tests/services/moex-api.test.ts`
- Modify: `src/services/moex-api.ts` (export only)

- [ ] **Step 1: Write failing tests for `resolveSecurityFull`**

Add to `tests/services/moex-api.test.ts`:

```typescript
import {
  // ... existing imports ...
  resolveSecurityFull,
} from '@/services/moex-api';

describe('resolveSecurityFull', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves ISIN to full security info', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: {
        columns: ['secid', 'shortname', 'name', 'isin', 'primary_boardid', 'group', 'type', 'emitent_title', 'is_traded'],
        data: [
          ['GAZP', 'Газпром', 'ПАО "Газпром"', 'RU0007661625', 'TQBR', 'stock_shares', 'common_share', 'ПАО "Газпром"', 1],
        ],
      },
    }));
    const result = await resolveSecurityFull('RU0007661625');
    expect(result).toEqual({
      secid: 'GAZP',
      primaryBoardId: 'TQBR',
      market: 'shares',
      shortName: 'Газпром',
      fullName: 'ПАО "Газпром"',
      isin: 'RU0007661625',
      secType: 'common_share',
      emitter: 'ПАО "Газпром"',
    });
  });

  it('resolves fund on TQTF board', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: {
        columns: ['secid', 'shortname', 'name', 'isin', 'primary_boardid', 'group', 'type', 'emitent_title', 'is_traded'],
        data: [
          ['TMOS', 'Тинькофф iMOEX', 'БПИФ "Тинькофф Индекс МосБиржи"', 'RU000A101X76', 'TQTF', 'stock_shares', 'exchange_ppif', 'Тинькофф Капитал', 1],
        ],
      },
    }));
    const result = await resolveSecurityFull('RU000A101X76');
    expect(result).toEqual({
      secid: 'TMOS',
      primaryBoardId: 'TQTF',
      market: 'shares',
      shortName: 'Тинькофф iMOEX',
      fullName: 'БПИФ "Тинькофф Индекс МосБиржи"',
      isin: 'RU000A101X76',
      secType: 'exchange_ppif',
      emitter: 'Тинькофф Капитал',
    });
  });

  it('returns null for unknown ISIN', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: { columns: ['secid', 'shortname', 'name', 'isin', 'primary_boardid', 'group', 'type', 'emitent_title', 'is_traded'], data: [] },
    }));
    expect(await resolveSecurityFull('RU000XXXXXXX')).toBeNull();
  });

  it('returns null for unrecognized board', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: {
        columns: ['secid', 'shortname', 'name', 'isin', 'primary_boardid', 'group', 'type', 'emitent_title', 'is_traded'],
        data: [
          ['XYZZ', 'Unknown', 'Unknown Corp', 'RU000XYZZ', 'ZZZZ', 'unknown_group', 'unknown_type', 'Emitter', 1],
        ],
      },
    }));
    expect(await resolveSecurityFull('RU000XYZZ')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    expect(await resolveSecurityFull('GAZP')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/moex-api.test.ts`
Expected: FAIL — `resolveSecurityFull` is not exported

- [ ] **Step 3: Commit test file**

```bash
git add tests/services/moex-api.test.ts
git commit -m "test: add failing tests for resolveSecurityFull"
```

---

### Task 2: `resolveSecurityFull()` — implementation

**Files:**
- Modify: `src/services/moex-api.ts` (lines ~14–18 for interface, ~253 for new function)

- [ ] **Step 1: Add `MoexSecurityFull` interface after `SecurityInfo`**

In `src/services/moex-api.ts`, after the `SecurityInfo` interface (line 18):

```typescript
export interface MoexSecurityFull {
  secid: string;
  primaryBoardId: string;
  market: 'shares' | 'bonds';
  shortName?: string;
  fullName?: string;
  isin?: string;
  secType?: string;
  emitter?: string;
}
```

- [ ] **Step 2: Add `resolveSecurityFull()` after `resolveSecurityInfo()`**

In `src/services/moex-api.ts`, after line 253 (end of `resolveSecurityInfo`):

```typescript
export async function resolveSecurityFull(
  query: string,
): Promise<MoexSecurityFull | null> {
  const data = await fetchISS('/securities.json', {
    q: query,
    'securities.columns': 'secid,shortname,name,isin,primary_boardid,group,type,emitent_title,is_traded',
  });
  if (!data?.securities) return null;

  const rows = parseISSBlock(data.securities);

  const exactMatch = rows.find(
    (r) => r.secid === query && r.is_traded === 1,
  );
  const match = exactMatch ?? rows.find((r) => r.is_traded === 1);
  if (!match) return null;

  const secid = match.secid as string;
  const boardId = match.primary_boardid as string;
  const group = match.group as string;
  const market = resolveMarket(boardId, group);
  if (!market) return null;

  return {
    secid,
    primaryBoardId: boardId,
    market,
    shortName: (match.shortname as string) || undefined,
    fullName: (match.name as string) || undefined,
    isin: (match.isin as string) || undefined,
    secType: (match.type as string) || undefined,
    emitter: (match.emitent_title as string) || undefined,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/services/moex-api.test.ts`
Expected: ALL PASS (existing + new)

- [ ] **Step 4: Commit**

```bash
git add src/services/moex-api.ts
git commit -m "feat: add resolveSecurityFull with extended MOEX data"
```

---

### Task 3: `enrichFromMoex()` — tests

**Files:**
- Create: `tests/services/moex-enrich.test.ts`

- [ ] **Step 1: Write tests for enrichment logic**

Create `tests/services/moex-enrich.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { enrichFromMoex, mapMoexMarketToType } from '@/services/moex-enrich';
import type { ImportAssetRow } from '@/services/import-parser';

// Mock resolveSecurityFull
vi.mock('@/services/moex-api', () => ({
  resolveSecurityFull: vi.fn(),
}));
import { resolveSecurityFull } from '@/services/moex-api';
const mockResolve = vi.mocked(resolveSecurityFull);

afterEach(() => vi.restoreAllMocks());

describe('mapMoexMarketToType', () => {
  it('maps bonds to Облигации', () => {
    expect(mapMoexMarketToType('bonds', 'TQCB')).toBe('Облигации');
  });

  it('maps shares on TQTF to Фонды', () => {
    expect(mapMoexMarketToType('shares', 'TQTF')).toBe('Фонды');
  });

  it('maps shares on TQIF to Фонды', () => {
    expect(mapMoexMarketToType('shares', 'TQIF')).toBe('Фонды');
  });

  it('maps shares on TQPI to Фонды', () => {
    expect(mapMoexMarketToType('shares', 'TQPI')).toBe('Фонды');
  });

  it('maps shares on TQBR to Акции', () => {
    expect(mapMoexMarketToType('shares', 'TQBR')).toBe('Акции');
  });
});

describe('enrichFromMoex', () => {
  it('fills type and ticker for Прочее row with ISIN', async () => {
    mockResolve.mockResolvedValueOnce({
      secid: 'RU000A10CFM8', primaryBoardId: 'TQIF', market: 'shares',
      shortName: 'ЗПИФ Тест', emitter: 'УК Тест',
    });

    const rows: ImportAssetRow[] = [{
      isin: 'RU000A10CFM8', name: 'RU000A10CFM8', type: 'Прочее',
      quantity: 389,
    }];

    const result = await enrichFromMoex(rows);
    expect(result[0].type).toBe('Фонды');
    expect(result[0].ticker).toBe('RU000A10CFM8');
    expect(result[0].name).toBe('ЗПИФ Тест');
    expect(result[0].emitter).toBe('УК Тест');
  });

  it('does NOT overwrite existing type/ticker/name', async () => {
    mockResolve.mockResolvedValueOnce({
      secid: 'GAZP', primaryBoardId: 'TQBR', market: 'shares',
      shortName: 'Газпром', emitter: 'ПАО Газпром',
    });

    const rows: ImportAssetRow[] = [{
      isin: 'RU0007661625', ticker: 'GAZP', name: 'ГАЗПРОМ ао',
      type: 'Акции', quantity: 100, emitter: 'Газпром ПАО',
    }];

    const result = await enrichFromMoex(rows);
    // Nothing should change — all fields already filled
    expect(result[0].type).toBe('Акции');
    expect(result[0].ticker).toBe('GAZP');
    expect(result[0].name).toBe('ГАЗПРОМ ао');
    expect(result[0].emitter).toBe('Газпром ПАО');
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('skips rows without ISIN', async () => {
    const rows: ImportAssetRow[] = [{
      name: 'Недвижимость', type: 'Прочее', quantity: 1,
    }];

    const result = await enrichFromMoex(rows);
    expect(result[0].type).toBe('Прочее');
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('handles MOEX returning null gracefully', async () => {
    mockResolve.mockResolvedValueOnce(null);

    const rows: ImportAssetRow[] = [{
      isin: 'RU000XXXXXXX', name: 'RU000XXXXXXX', type: 'Прочее',
      quantity: 10,
    }];

    const result = await enrichFromMoex(rows);
    expect(result[0].type).toBe('Прочее');
    expect(result[0].name).toBe('RU000XXXXXXX');
  });

  it('fills ticker when ticker equals ISIN (fund case)', async () => {
    mockResolve.mockResolvedValueOnce({
      secid: 'TMOS', primaryBoardId: 'TQTF', market: 'shares',
      shortName: 'Тинькофф iMOEX',
    });

    const rows: ImportAssetRow[] = [{
      isin: 'RU000A101X76', ticker: 'RU000A101X76', name: 'Тинькофф iMOEX',
      type: 'Фонды', quantity: 50,
    }];

    const result = await enrichFromMoex(rows);
    // ticker was ISIN — should be replaced with secid
    expect(result[0].ticker).toBe('TMOS');
  });

  it('handles network error gracefully', async () => {
    mockResolve.mockRejectedValueOnce(new Error('timeout'));

    const rows: ImportAssetRow[] = [{
      isin: 'RU000A10CFM8', name: 'RU000A10CFM8', type: 'Прочее',
      quantity: 389,
    }];

    const result = await enrichFromMoex(rows);
    // Should remain unchanged
    expect(result[0].type).toBe('Прочее');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/moex-enrich.test.ts`
Expected: FAIL — module `@/services/moex-enrich` not found

- [ ] **Step 3: Commit test file**

```bash
git add tests/services/moex-enrich.test.ts
git commit -m "test: add failing tests for enrichFromMoex"
```

---

### Task 4: `enrichFromMoex()` — implementation

**Files:**
- Create: `src/services/moex-enrich.ts`

- [ ] **Step 1: Create `src/services/moex-enrich.ts`**

```typescript
import { resolveSecurityFull } from './moex-api';
import type { ImportAssetRow } from './import-parser';

const FUND_BOARDS = new Set(['TQTF', 'TQIF', 'TQPI']);

export function mapMoexMarketToType(
  market: 'shares' | 'bonds',
  boardId: string,
): string {
  if (market === 'bonds') return 'Облигации';
  if (FUND_BOARDS.has(boardId)) return 'Фонды';
  return 'Акции';
}

function needsEnrichment(row: ImportAssetRow): boolean {
  if (!row.isin) return false;
  if (row.type === 'Прочее') return true;
  if (!row.ticker) return true;
  if (row.ticker === row.isin) return true;
  if (row.name === row.isin) return true;
  return false;
}

export async function enrichFromMoex(
  rows: ImportAssetRow[],
): Promise<ImportAssetRow[]> {
  const result = rows.map((r) => ({ ...r }));

  for (const row of result) {
    if (!needsEnrichment(row)) continue;

    let info;
    try {
      info = await resolveSecurityFull(row.isin!);
    } catch {
      continue;
    }
    if (!info) continue;

    if (row.type === 'Прочее') {
      row.type = mapMoexMarketToType(info.market, info.primaryBoardId);
    }
    if (!row.ticker || row.ticker === row.isin) {
      row.ticker = info.secid;
    }
    if (row.name === row.isin && info.shortName) {
      row.name = info.shortName;
    }
    if (!row.emitter && info.emitter) {
      row.emitter = info.emitter;
    }
  }

  return result;
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/services/moex-enrich.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/moex-enrich.ts
git commit -m "feat: add enrichFromMoex service for ISIN-based import enrichment"
```

---

### Task 5: Integration in `import-flow.tsx`

**Files:**
- Modify: `src/components/data/import-flow.tsx`

- [ ] **Step 1: Add import and loading state**

In `src/components/data/import-flow.tsx`, add import after existing imports:

```typescript
import { enrichFromMoex } from '@/services/moex-enrich';
```

Add state variable after `const [copied, setCopied] = useState(false);`:

```typescript
const [enriching, setEnriching] = useState(false);
```

Add `enriching` to the `reset` callback:

```typescript
setEnriching(false);
```

- [ ] **Step 2: Integrate enrichment in `handleSberUpload()`**

Replace `await goToPreview(rows);` (line 133) with:

```typescript
setEnriching(true);
try {
  const enriched = await enrichFromMoex(rows);
  await goToPreview(enriched);
} catch {
  await goToPreview(rows);
} finally {
  setEnriching(false);
}
```

- [ ] **Step 3: Integrate enrichment in `handleAiParse()`**

Replace `await goToPreview(rows);` (line 152) with:

```typescript
setEnriching(true);
try {
  const enriched = await enrichFromMoex(rows);
  await goToPreview(enriched);
} catch {
  await goToPreview(rows);
} finally {
  setEnriching(false);
}
```

- [ ] **Step 4: Add loading indicator in JSX**

The enrichment loading indicator must be placed **inside** each step block (not between them), so it's visible regardless of which import path triggered enrichment.

Inside `{step === 'method' && (` block, after the `MethodButton` list, add:

```tsx
{enriching && (
  <div className="flex items-center justify-center gap-2 py-8 text-[var(--way-ash)] text-[length:var(--way-text-body)]">
    <span className="inline-block animate-spin">⟳</span>
    Определяю бумаги на MOEX...
  </div>
)}
```

Inside `{step === 'ai' && (` block, after the "Распознать" button, add the same indicator:

```tsx
{enriching && (
  <div className="flex items-center justify-center gap-2 py-4 text-[var(--way-ash)] text-[length:var(--way-text-body)]">
    <span className="inline-block animate-spin">⟳</span>
    Определяю бумаги на MOEX...
  </div>
)}
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: SUCCESS (no type errors)

- [ ] **Step 6: Commit**

```bash
git add src/components/data/import-flow.tsx
git commit -m "feat: integrate MOEX enrichment into import flow with loading state"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: ALL PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 3: Visual test with real data**

Start dev server (`npm run dev`), import `test-data/S0R9B_23032026.HTML`:
- `RU000A10CFM8` should show correct type (not "Прочее") in preview
- Existing securities (GAZP, SBER, etc.) should be unchanged
- Loading indicator should appear briefly during enrichment

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address any issues found in visual verification"
```

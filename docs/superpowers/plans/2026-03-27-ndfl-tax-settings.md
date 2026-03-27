# NDFL Tax Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-category NDFL tax rates in Settings, applied to all income displays across the app.

**Architecture:** NDFL rates stored as key-value pairs in the existing `settings` IndexedDB table (`ndfl-{category}` → rate%). A reactive hook `useNdflRates` feeds into `usePortfolioStats` which applies the tax multiplier per-asset during income calculation. A new NDFL block with segmented controls per category is placed at the top of the Settings page. The `defaultPeriod` setting is removed entirely.

**Tech Stack:** React 19, Dexie (IndexedDB), Vitest + fake-indexeddb, Tailwind v4 with `--hi-*` design tokens

**Spec:** `docs/superpowers/specs/2026-03-27-ndfl-tax-settings-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/services/app-settings.ts` | Add `getNdflRates()`, `updateNdflRate()`, remove `AppSettings`/`getAppSettings` |
| Modify | `tests/services/app-settings.test.ts` | Tests for NDFL rate functions, remove `defaultPeriod` tests |
| Create | `src/hooks/use-ndfl-rates.ts` | Reactive hook returning `Map<string, number>` |
| Modify | `src/hooks/use-portfolio-stats.ts` | Consume NDFL rates, apply tax per-asset |
| Modify | `src/pages/main-page.tsx` | Remove `getAppSettings` import, hardcode `'month'` |
| Create | `src/components/settings/ndfl-rate-selector.tsx` | Per-category row with segmented control |
| Create | `src/components/settings/ndfl-settings.tsx` | NDFL block listing all categories |
| Modify | `src/pages/settings-page.tsx` | Mount `NdflSettings` at top, remove `SettingRow`/`defaultPeriod` |

---

### Task 1: NDFL Rate Storage Functions + Tests

**Files:**
- Modify: `src/services/app-settings.ts`
- Modify: `tests/services/app-settings.test.ts`

- [ ] **Step 1: Write failing tests for NDFL rate functions**

Add a new `describe('ndfl rates')` block to `tests/services/app-settings.test.ts`:

```typescript
describe('ndfl rates', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('returns empty map when no rates are set', async () => {
    const rates = await getNdflRates();
    expect(rates.size).toBe(0);
  });

  it('stores and retrieves a rate for a category', async () => {
    await updateNdflRate('Акции', 13);
    const rates = await getNdflRates();
    expect(rates.get('Акции')).toBe(13);
  });

  it('handles multiple categories independently', async () => {
    await updateNdflRate('Акции', 13);
    await updateNdflRate('Облигации', 15);
    await updateNdflRate('Вклады', 0);
    const rates = await getNdflRates();
    expect(rates.get('Акции')).toBe(13);
    expect(rates.get('Облигации')).toBe(15);
    expect(rates.get('Вклады')).toBe(0);
  });

  it('overwrites previous rate for same category', async () => {
    await updateNdflRate('Акции', 13);
    await updateNdflRate('Акции', 15);
    const rates = await getNdflRates();
    expect(rates.get('Акции')).toBe(15);
  });

  it('ignores non-ndfl settings keys', async () => {
    await updateAppSetting('defaultPeriod', 'year');
    await updateNdflRate('Акции', 13);
    const rates = await getNdflRates();
    expect(rates.size).toBe(1);
    expect(rates.has('Акции')).toBe(true);
  });

  it('handles custom fractional rates', async () => {
    await updateNdflRate('Недвижимость', 6.5);
    const rates = await getNdflRates();
    expect(rates.get('Недвижимость')).toBe(6.5);
  });
});
```

Add `getNdflRates, updateNdflRate` to the import from `@/services/app-settings`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/app-settings.test.ts`
Expected: FAIL — `getNdflRates` and `updateNdflRate` are not exported.

- [ ] **Step 3: Implement NDFL rate functions**

Add to the bottom of `src/services/app-settings.ts`:

```typescript
const NDFL_PREFIX = 'ndfl-';

export async function getNdflRates(): Promise<Map<string, number>> {
  const rows: { key: string; value: string }[] = await db.table('settings').toArray();
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.key.startsWith(NDFL_PREFIX)) {
      const category = row.key.slice(NDFL_PREFIX.length);
      const rate = Number(row.value);
      if (isFinite(rate)) map.set(category, rate);
    }
  }
  return map;
}

export async function updateNdflRate(category: string, rate: number): Promise<void> {
  await db.table('settings').put({ key: `${NDFL_PREFIX}${category}`, value: String(rate) });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/app-settings.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/app-settings.ts tests/services/app-settings.test.ts
git commit -m "feat: add NDFL rate storage functions with tests"
```

---

### Task 2: `useNdflRates` Hook

**Files:**
- Create: `src/hooks/use-ndfl-rates.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-ndfl-rates.ts`:

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';

const NDFL_PREFIX = 'ndfl-';
const EMPTY_MAP = new Map<string, number>();

export function useNdflRates(): Map<string, number> {
  const rates = useLiveQuery(async () => {
    const rows: { key: string; value: string }[] = await db.table('settings').toArray();
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.key.startsWith(NDFL_PREFIX)) {
        const category = row.key.slice(NDFL_PREFIX.length);
        const rate = Number(row.value);
        if (isFinite(rate)) map.set(category, rate);
      }
    }
    return map;
  }, []);

  return rates ?? EMPTY_MAP;
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-ndfl-rates.ts
git commit -m "feat: add useNdflRates reactive hook"
```

---

### Task 3: Apply NDFL in `usePortfolioStats`

**Files:**
- Modify: `src/hooks/use-portfolio-stats.ts`

- [ ] **Step 1: Import and consume `useNdflRates`**

Add import at the top of `src/hooks/use-portfolio-stats.ts`:

```typescript
import { useNdflRates } from './use-ndfl-rates';
```

Inside the `usePortfolioStats` function, call the hook before `useMemo`:

```typescript
const ndflRates = useNdflRates();
```

Add `ndflRates` to the `useMemo` dependency array (change line 84):

```typescript
}, [assets, holdings, allHistory, ndflRates]);
```

- [ ] **Step 2: Apply tax multiplier per-asset**

Inside the `for (const asset of assets)` loop, after the line `const assetIncomePerMonth = calcAssetIncomePerMonth(totalQuantity, annualIncome);` (line 52), apply the NDFL rate:

Replace:
```typescript
      const annualIncome = resolveAnnualIncome(asset);
      const assetIncomePerMonth = calcAssetIncomePerMonth(totalQuantity, annualIncome);
      totalIncomePerMonth += assetIncomePerMonth;
```

With:
```typescript
      const annualIncome = resolveAnnualIncome(asset);
      const ndflRate = ndflRates.get(asset.type) ?? 0;
      const taxMultiplier = 1 - ndflRate / 100;
      const assetIncomePerMonth = calcAssetIncomePerMonth(totalQuantity, annualIncome) * taxMultiplier;
      totalIncomePerMonth += assetIncomePerMonth;
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All existing tests PASS (no test uses NDFL rates, so behavior with default 0% is identical).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-portfolio-stats.ts
git commit -m "feat: apply NDFL tax rates in portfolio income calculation"
```

---

### Task 4: Remove `defaultPeriod` Setting

**Files:**
- Modify: `src/services/app-settings.ts`
- Modify: `src/pages/main-page.tsx`
- Modify: `src/pages/settings-page.tsx`
- Modify: `tests/services/app-settings.test.ts`

- [ ] **Step 1: Remove `AppSettings` interface and `getAppSettings` from `app-settings.ts`**

Replace the entire contents of `src/services/app-settings.ts` with:

```typescript
import { db } from '@/db/database';

const NDFL_PREFIX = 'ndfl-';

export async function updateAppSetting(key: string, value: string): Promise<void> {
  await db.table('settings').put({ key, value });
}

export async function clearAllData(): Promise<void> {
  await db.delete();
  await db.open();
}

export async function getNdflRates(): Promise<Map<string, number>> {
  const rows: { key: string; value: string }[] = await db.table('settings').toArray();
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.key.startsWith(NDFL_PREFIX)) {
      const category = row.key.slice(NDFL_PREFIX.length);
      const rate = Number(row.value);
      if (isFinite(rate)) map.set(category, rate);
    }
  }
  return map;
}

export async function updateNdflRate(category: string, rate: number): Promise<void> {
  await db.table('settings').put({ key: `${NDFL_PREFIX}${category}`, value: String(rate) });
}
```

- [ ] **Step 2: Update `main-page.tsx` — remove `getAppSettings` usage**

In `src/pages/main-page.tsx`:

Remove the import line:
```typescript
import { getAppSettings } from '@/services/app-settings';
```

Remove the `useEffect` that reads settings (lines 19-21):
```typescript
  useEffect(() => {
    getAppSettings().then((s) => setMode(s.defaultPeriod));
  }, []);
```

The `useState<'month' | 'year'>('month')` already defaults to `'month'`, so no further change needed.

Also remove `useEffect` from the import if it's no longer used (check — `useRef` still needs React import). The import becomes:

```typescript
import { useState, useRef } from 'react';
```

- [ ] **Step 3: Update `settings-page.tsx` — remove defaultPeriod UI**

In `src/pages/settings-page.tsx`:

Remove `getAppSettings`, `type AppSettings` from the import:
```typescript
import { clearAllData } from '@/services/app-settings';
```

Remove state and effects related to settings:
- Remove `const [settings, setSettings] = useState<AppSettings | null>(null);`
- Remove `useEffect(() => { getAppSettings().then(setSettings); }, []);`
- Remove `const toggle = async (key: string, value: string) => { ... };`

Remove the early return guard (line 63):
```typescript
if (!settings) return <AppShell leftAction={backButton} title="Настройки"><div /></AppShell>;
```

Remove the `SettingRow` usage (lines 68-72):
```html
<SettingRow
  label="Период по умолчанию"
  value={settings.defaultPeriod === 'month' ? 'Месяц' : 'Год'}
  onToggle={() => toggle('defaultPeriod', settings.defaultPeriod === 'month' ? 'year' : 'month')}
/>
```

Remove the `SettingRow` component definition (lines 123-134) at the bottom.

Remove `useEffect` from React imports if no longer needed. The remaining imports:
```typescript
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { clearAllData } from '@/services/app-settings';
import { exportAllData, importAllData } from '@/services/backup';
```

- [ ] **Step 4: Update tests — remove `defaultPeriod` tests, keep NDFL tests**

Replace `tests/services/app-settings.test.ts` entirely:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { updateAppSetting, getNdflRates, updateNdflRate } from '@/services/app-settings';

describe('app-settings', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('persists and reads a setting', async () => {
    await updateAppSetting('someKey', 'someValue');
    const rows = await db.table('settings').toArray();
    expect(rows).toContainEqual({ key: 'someKey', value: 'someValue' });
  });

  describe('ndfl rates', () => {
    it('returns empty map when no rates are set', async () => {
      const rates = await getNdflRates();
      expect(rates.size).toBe(0);
    });

    it('stores and retrieves a rate for a category', async () => {
      await updateNdflRate('Акции', 13);
      const rates = await getNdflRates();
      expect(rates.get('Акции')).toBe(13);
    });

    it('handles multiple categories independently', async () => {
      await updateNdflRate('Акции', 13);
      await updateNdflRate('Облигации', 15);
      await updateNdflRate('Вклады', 0);
      const rates = await getNdflRates();
      expect(rates.get('Акции')).toBe(13);
      expect(rates.get('Облигации')).toBe(15);
      expect(rates.get('Вклады')).toBe(0);
    });

    it('overwrites previous rate for same category', async () => {
      await updateNdflRate('Акции', 13);
      await updateNdflRate('Акции', 15);
      const rates = await getNdflRates();
      expect(rates.get('Акции')).toBe(15);
    });

    it('ignores non-ndfl settings keys', async () => {
      await updateAppSetting('defaultPeriod', 'year');
      await updateNdflRate('Акции', 13);
      const rates = await getNdflRates();
      expect(rates.size).toBe(1);
      expect(rates.has('Акции')).toBe(true);
    });

    it('handles custom fractional rates', async () => {
      await updateNdflRate('Недвижимость', 6.5);
      const rates = await getNdflRates();
      expect(rates.get('Недвижимость')).toBe(6.5);
    });
  });
});
```

- [ ] **Step 5: Run tests and type check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/app-settings.ts src/pages/main-page.tsx src/pages/settings-page.tsx tests/services/app-settings.test.ts
git commit -m "refactor: remove defaultPeriod setting, clean up app-settings"
```

---

### Task 5: `NdflRateSelector` Component

**Files:**
- Create: `src/components/settings/ndfl-rate-selector.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/settings/ndfl-rate-selector.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';

const PRESETS = [0, 13, 15] as const;

interface NdflRateSelectorProps {
  category: string;
  color: string;
  rate: number;
  onChange: (rate: number) => void;
}

export function NdflRateSelector({ category, color, rate, onChange }: NdflRateSelectorProps) {
  const isCustom = !PRESETS.includes(rate as typeof PRESETS[number]);
  const [editing, setEditing] = useState(false);
  const [customValue, setCustomValue] = useState(isCustom ? String(rate) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handlePreset = (preset: number) => {
    setEditing(false);
    setCustomValue('');
    onChange(preset);
  };

  const handleCustomClick = () => {
    setEditing(true);
    setCustomValue(isCustom ? String(rate) : '');
  };

  const commitCustom = () => {
    const parsed = parseFloat(customValue);
    if (isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      onChange(parsed);
    }
    if (!customValue) {
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitCustom();
      inputRef.current?.blur();
    }
  };

  const segmentClass = (active: boolean) =>
    `px-2 py-1 font-mono text-[length:var(--hi-text-micro)] transition-colors ${
      active
        ? 'bg-[rgba(200,180,140,0.08)] text-[var(--hi-gold)]'
        : 'text-[var(--hi-ash)]'
    }`;

  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[var(--hi-text)] text-[length:var(--hi-text-body)] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        {category}
      </span>
      <div className="flex border border-[rgba(200,180,140,0.12)] rounded-md overflow-hidden">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePreset(preset)}
            className={segmentClass(!isCustom && rate === preset && !editing)}
          >
            {preset}%
          </button>
        ))}
        {editing || isCustom ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editing ? customValue : `${rate}%`}
            onChange={(e) => setCustomValue(e.target.value.replace(/[^0-9.]/g, ''))}
            onFocus={() => {
              setEditing(true);
              setCustomValue(isCustom ? String(rate) : '');
            }}
            onBlur={commitCustom}
            onKeyDown={handleKeyDown}
            className="w-10 px-1 py-1 font-mono text-[length:var(--hi-text-micro)] text-[var(--hi-gold)] bg-[rgba(200,180,140,0.08)] border-l border-[rgba(200,180,140,0.08)] text-center outline-none"
            style={{ fontSize: 'var(--hi-text-micro)' }}
          />
        ) : (
          <button
            onClick={handleCustomClick}
            className={segmentClass(false)}
          >
            …
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/ndfl-rate-selector.tsx
git commit -m "feat: add NdflRateSelector segmented control component"
```

---

### Task 6: `NdflSettings` Block + Settings Page Integration

**Files:**
- Create: `src/components/settings/ndfl-settings.tsx`
- Modify: `src/pages/settings-page.tsx`

- [ ] **Step 1: Create `NdflSettings` component**

Create `src/components/settings/ndfl-settings.tsx`:

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useNdflRates } from '@/hooks/use-ndfl-rates';
import { updateNdflRate } from '@/services/app-settings';
import { getTypeColor } from '@/models/account';
import { NdflRateSelector } from './ndfl-rate-selector';

export function NdflSettings() {
  const categories = useLiveQuery(async () => {
    const assets = await db.assets.toArray();
    const types = new Set(assets.map((a) => a.type));
    return [...types].sort();
  }, []);

  const ndflRates = useNdflRates();

  if (!categories || categories.length === 0) return null;

  return (
    <div>
      <div className="text-[var(--hi-ash)] text-[length:var(--hi-text-caption)] font-mono uppercase tracking-[0.15em] mb-3">
        НДФЛ
      </div>
      <div className="bg-[var(--hi-stone)] rounded-xl px-4 border border-[rgba(200,180,140,0.06)]">
        {categories.map((type, i) => (
          <div key={type} className={i > 0 ? 'border-t border-[rgba(200,180,140,0.06)]' : ''}>
            <NdflRateSelector
              category={type}
              color={getTypeColor(type)}
              rate={ndflRates.get(type) ?? 0}
              onChange={(rate) => updateNdflRate(type, rate)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount in settings page**

In `src/pages/settings-page.tsx`, add the import:

```typescript
import { NdflSettings } from '@/components/settings/ndfl-settings';
```

Add `<NdflSettings />` as the first child inside `<div className="space-y-6">`:

```tsx
<div className="space-y-6">
  <NdflSettings />

  <div>
    <div className="text-[var(--hi-ash)] text-[length:var(--hi-text-body)] mb-2">Экспорт</div>
    {/* ... rest unchanged ... */}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Visual verification**

Run: `npm run dev`

Open the app in Chrome. Navigate to Settings (☰ → Настройки). Verify:
1. NDFL block appears at the top with all categories from data
2. Each category shows color dot + name + segmented control
3. All rates default to 0%
4. Clicking 13% highlights it and updates the rate
5. Clicking "…" opens a text input for custom rate
6. Going back to main page — income changes when rates are non-zero

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/ndfl-settings.tsx src/components/settings/ndfl-rate-selector.tsx src/pages/settings-page.tsx
git commit -m "feat: add NDFL settings block to settings page"
```

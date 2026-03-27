# НДФЛ Tax Settings

Per-category NDFL tax rates in Settings, applied to all income displays across the app.

## Problem

Income is shown gross (before tax). Users want to see realistic after-tax income to plan their finances.

## Solution

Add an NDFL block to the Settings page where each asset category gets a configurable tax rate. All income figures across the app are displayed after applying the configured rates.

## Settings UI

**Location:** Top of the Settings page, first block.

**Layout:** Section labeled "НДФЛ" containing a card with one row per category. Each row has:
- Left: category color dot + category name
- Right: segmented control `0% | 13% | 15% | …`

**Categories:** Dynamic — pulled from existing assets in the database. If a new category appears in data, it shows up in the NDFL block automatically.

**Default:** 0% for all categories (no tax deduction).

**Custom rate ("…" button):** Clicking replaces the `…` segment with a numeric input field. User types a percentage (e.g., `6`). The input stays visible while the custom rate is active. Selecting 0%, 13%, or 15% reverts from custom back to a preset.

**Removed:** "Период по умолчанию" setting is removed from the page. Default period is always `month`; the toggle on the main page is sufficient.

## Data Storage

NDFL rates are stored in the existing `settings` key-value table in IndexedDB.

**Key format:** `ndfl-{categoryName}` (e.g., `ndfl-Акции`, `ndfl-Облигации`)
**Value:** numeric string representing the percentage (e.g., `"13"`, `"6"`)
**Absent key** = 0% (no tax).

No database migration needed — the settings table already exists and accepts arbitrary keys.

**Backup/restore:** Already covered — `backup.ts` exports and imports the entire `settings` table, so NDFL rates are automatically included.

## Tax Application

Tax is applied in `usePortfolioStats` during income calculation, at the per-asset level.

**Formula:** `afterTaxIncome = grossIncome × (1 - rate / 100)`

The rate is looked up by `asset.type` (category name). The tax multiplier affects:
- `assetIncomePerMonth` — per-asset monthly income
- Category aggregates (`categoryMap` totals)
- Portfolio totals (`totalIncomePerMonth`, `totalIncomePerYear`)
- Yield percent — recalculated from after-tax annual income

**What is NOT affected:**
- `totalValue` (portfolio value) — unchanged
- `paymentPerUnit` — stays gross (the source data is not modified)
- Payment history amounts — raw historical data stays as-is

## Hook for Reading NDFL Rates

New hook `useNdflRates()` in `src/hooks/use-ndfl-rates.ts`:
- Returns `Map<string, number>` — category name → rate (0–100)
- Uses `useLiveQuery` on the settings table, filtering keys starting with `ndfl-`
- Reactive — UI updates immediately when rates change in settings

`usePortfolioStats` consumes `useNdflRates()` to apply tax during calculation.

## Affected Pages

All pages that display income already use `usePortfolioStats` output, so they get after-tax values automatically:

| Page | What changes |
|------|-------------|
| Main (hero income) | Total income reduced by tax |
| Main (category cards) | Per-category income reduced |
| Category page | Per-asset income reduced |
| Asset detail page | Asset income reduced |

No changes needed in display components — they render whatever `usePortfolioStats` returns.

## Settings Page Changes

1. Remove `SettingRow` for "Период по умолчанию"
2. Remove `defaultPeriod` from `AppSettings` interface
3. Hardcode `'month'` as default in `main-page.tsx` (already the case)
4. Add `NdflSettings` component:
   - Reads categories from `db.assets` (distinct `type` values)
   - Reads current rates from settings table
   - Renders segmented control per category
   - On change: calls `updateAppSetting('ndfl-{type}', rate)`
5. Clean up: remove `getAppSettings()` / `AppSettings` interface if `defaultPeriod` was the only field (it was)

## Component Design

### `NdflRateSelector` (per-category row)
- Props: `category: string`, `color: string`, `rate: number`, `onChange: (rate: number) => void`
- Segmented control with 4 segments: `0%`, `13%`, `15%`, `…`
- When `…` is clicked: fourth segment becomes `<input>` with current custom value
- When a preset is clicked: reverts to preset mode
- Active segment highlighted with `bg-[rgba(200,180,140,0.08)]` + gold text

### `NdflSettings` (block)
- Reads distinct categories from assets
- Reads NDFL rates from settings
- Maps categories to `NdflRateSelector` rows
- Wrapped in a card (`bg-[var(--hi-stone)]` with rounded corners)

## Edge Cases

- **No assets yet:** NDFL block is empty or hidden (no categories to configure).
- **Category deleted (all assets removed):** Its NDFL setting remains in DB but is invisible. Harmless — no assets reference it.
- **Custom rate validation:** Clamp to 0–100. Non-numeric input ignored.
- **Rate = 100%:** Valid — shows zero income. User's choice.

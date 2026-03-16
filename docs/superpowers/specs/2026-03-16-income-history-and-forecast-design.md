# Income History & Forecast Model

## Problem

Current income calculation takes `lastPaymentAmount × frequencyPerYear` — a simple extrapolation that breaks for:
- Assets that stopped paying (Gazprom: last dividend in 2022, app still shows income)
- Assets paying irregularly or multiple times per year
- Extraordinary one-time payments (3x dividends covering several years)

No payment history is stored, so there's no data for charts, CAGR, or trend analysis.

## Solution: Two-Layer Income Model

Two metrics per asset:
1. **Fact** — sum of actual payments received in the last 12 months ÷ 12
2. **Forecast** — user-defined projection, optionally assisted by calculation methods

**Main number** = forecast if explicitly set, otherwise fact. Default is fact.

Each asset stores which metric is active (`activeMetric`). Aggregated views (portfolio, category) sum each asset's main number — no mixed-state indicators.

## Data Model

### PaymentHistory (existing table, now actively used)

```typescript
interface PaymentHistory {
  id?: number;
  assetId: number;
  amount: number;          // per unit (per share, per bond)
  date: Date;
  type: 'dividend' | 'coupon' | 'rent' | 'interest' | 'distribution' | 'other';
  dataSource: 'moex' | 'import' | 'manual';
}
```

All amounts are **per unit** (per share, per bond). This convention applies to MOEX, import, and manual entries alike.

Dexie compound index: `[assetId+date]` for efficient range queries (replaces current separate indexes `assetId, date`).

### PaymentSchedule — new fields

```typescript
// Added to existing PaymentSchedule
forecastMethod: 'none' | 'manual' | 'decay';  // default: 'none'
forecastAmount: number | null;                  // per unit, default: null
activeMetric: 'fact' | 'forecast';             // default: 'fact'
```

Existing fields (`lastPaymentAmount`, `frequencyPerYear`, `nextExpected*`) remain unchanged.

### Dexie Migration

Schema version +1. New fields with defaults. Change `paymentHistory` index from `'++id, assetId, date'` to `'++id, [assetId+date]'` (Dexie compound index syntax).

## Calculations

### Fact (12-month trailing)

```
factPerMonth = sum(paymentHistory where date > now - 12 months) × quantity / 12
```

### Forecast

```
forecastPerMonth = forecastAmount × frequencyPerYear × quantity / 12
```

`forecastAmount` is set by user (direct input) or by a helper method (decay average).

### Decay Average (helper, not stored)

Takes the 12-month window ending at the last payment date, sums all payments in that window, divides by (12 + months from last payment to today):

```
window_start = lastPaymentDate - 12 months
window_end = lastPaymentDate
payments_in_window = sum(paymentHistory where date in [window_start, window_end])
months_elapsed = monthsDiff(lastPaymentDate, today)
decayAverage = payments_in_window / (12 + months_elapsed)
```

This value decays over time — it never reaches zero but continuously decreases if no new payments arrive.

If no payment history exists for the asset, decay average is unavailable (returns `null`) and the helper button is hidden.

### Main Number

```
if activeMetric === 'forecast' && forecastAmount != null:
  mainNumber = forecastPerMonth
else:
  mainNumber = factPerMonth
```

### CAGR

Calculated from calendar-year totals. A "full year" = a calendar year where at least one payment exists AND the asset was held for the entire year (or the year has ended).

```
years = all calendar years with paymentHistory entries (e.g., [2021, 2022, 2023, 2025])
first_full_year = earliest year with payments
last_full_year = latest completed year with payments (not current year unless it's over)
income_first = sum of payments in first_full_year
income_last = sum of payments in last_full_year
span = last_full_year - first_full_year
CAGR = (income_last / income_first)^(1/span) - 1
```

Requires at least 2 distinct calendar years with payments. If fewer, CAGR = null (not shown).

## UI: Asset Detail Page

### Stat Block "Доход/мес"

Normal state:
- Shows main number value
- Two letter indicators at bottom: **ф** (fact) and **п** (forecast)
- Active indicator highlighted in `#4ecca3`, inactive in `#333`
- Tap → expands panel below

### Expanded Panel

Drops down from the stat block:

```
┌─────────────────────┐
│   Факт 12 мес       │  ← tap to select as active
│      ₽ 0            │
├─────────────────────┤
│   Прогноз  ✓        │  ← tap to select as active
│      ₽ 425          │  ← tap number to edit (dashed underline hint)
├─────────────────────┤
│ ⟳ Подставить        │  ← helper button, shows calculated value
│   среднее: ₽ 943    │
│                     │
│ Последние годовые   │  ← description in small gray text
│ ÷ всё прошедшее     │
│ время.              │
└─────────────────────┘
```

Interactions:
1. Tap "Факт"/"Прогноз" card → switches `activeMetric`, updates stat block and portfolio
2. Tap forecast number (dashed underline) → inline editing
3. Tap "⟳ Подставить среднее: ₽X" → sets `forecastAmount` to decay average, `forecastMethod` to `'decay'`
4. After any helper, user can tap number again to adjust
5. Tap stat block again or outside → collapses panel

### Other Fields

"Количество", "Последняя выплата", "Частота (раз/год)" — unchanged.

### Payment History Chart

- **New component** replacing the current `IncomeChart` (which shows category breakdown bars)
- Vertical bar chart built with lightweight SVG (no charting library — project has none, keep it minimal)
- X-axis: calendar years, short labels ('21, '22, '23...)
- Y-axis: total payments in ₽ per unit × quantity (abbreviated: 10K, 1.2M)
- Above chart: "CAGR +12.3%" badge (or hidden if < 2 years of data)
- Data source: `paymentHistory` table, aggregated by calendar year

## UI: Aggregated Pages

### Main Page (hero-income)

- "Доход/мес" = sum of all assets' main numbers
- No ф/п indicator, no expandable panel
- Chart: all portfolio payments by year, CAGR above

### Category Page

- "Доход/мес" = sum of main numbers for assets in category
- No ф/п indicator
- Chart: category payments by year, CAGR above

### Asset Row (in category list)

- Shows asset's main number
- No ф/п indicator (only on detail page)

### Yield & Value

Recalculated from main number at every level. If asset uses forecast → yield based on forecast.

## MOEX Sync Changes

### Payment History Population

**Stocks/Funds:** `fetchDividends()` currently parses raw dividend rows internally (`parseDividendHistory()`) but only returns a summary (`DividendInfo`). Change: return the full array of `{date, amount}` rows alongside the summary. On sync, write all rows to `paymentHistory` with `dataSource: 'moex'`.

**Bonds:** Current `fetchBondData()` returns only current coupon value. MOEX provides coupon history via `/securities/{secid}/bondization.json`. Add `fetchCouponHistory(secid)` to `moex-api.ts` to retrieve past coupon payments. On sync, write to `paymentHistory` with `type: 'coupon'`.

**Deduplication:** By compound key `(assetId, date)` — skip existing records on re-sync.

### Backward Compatibility

- `PaymentSchedule` retains all existing fields
- New fields added with safe defaults: `forecastMethod: 'none'`, `forecastAmount: null`, `activeMetric: 'fact'`
- Assets without `paymentHistory` but with schedule → fact = ₽0/month (no history = no fact)

### Backup/Restore

New `PaymentSchedule` fields will be included in backup export automatically. On restore of an old backup (missing new fields), apply defaults: `forecastMethod: 'none'`, `forecastAmount: null`, `activeMetric: 'fact'`.

### Performance

Fact calculation requires querying `paymentHistory` with date range per asset. For aggregated pages (main, category), batch-load all `paymentHistory` for the trailing 12 months in a single query, then group by `assetId` in memory. Avoid per-asset queries in loops.

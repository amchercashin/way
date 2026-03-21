# Chart Redesign — Asset Detail Page Only

## Summary

Redesign the payment history chart to exist only on the asset detail page. Remove charts from the main page and category page. The chart shows per-unit payment history by year with interactive detail panel, smart number formatting, and responsive layout.

## Scope

### In scope
- Redesign `PaymentHistoryChart` component for asset detail page
- Remove chart usage from `main-page.tsx` and `category-page.tsx`
- Add tap/click detail panel below chart
- Add compact number formatting (K suffix)
- Flex-based responsive bar sizing with horizontal scroll
- Current (incomplete) year visual treatment
- No-history single-bar fallback

### Out of scope
- Chart library adoption (stays custom-built)
- New data sources or API changes
- Changes to payment history data model
- Changes to CAGR calculation logic (stays full calendar years)

## Design Decisions

### 1. Chart placement

**Only on asset detail page** (`asset-detail-page.tsx`).

Remove `PaymentHistoryChart` from:
- `main-page.tsx` (portfolio-wide chart)
- `category-page.tsx` (category-level chart)

Remove `useAllPaymentHistory` hook if it becomes unused after removal.

### 2. Chart header

```
Выплата на единицу, ₽                    CAGR +18.2%
```

- Left: title "Выплата на единицу, ₽" — universal label for all asset types
- Right: CAGR value (only shown when ≥ 2 full calendar years of data exist)
- Font: mono, 9px uppercase tracking for title, 10px for CAGR
- CAGR color: `--way-gold` (#c8b48c)

### 3. Bar sizing — flex with max-width

Bars use `flex: 1` with `max-width: 64px` and `min-width: 36px`:

- **Few bars (1–4):** bars expand to fill available width, up to 64px each
- **Many bars (8+):** bars hit max-width and behave like fixed-width, horizontal scroll activates
- **Transition is smooth** — no breakpoint, one layout rule

Container: `gap: 5px`, horizontal `overflow-x: auto`, `scroll-snap-type: x mandatory`, `scroll-snap-align: start` on each bar column.

Initial scroll position: **right edge** (most recent years visible).

No scroll hint text.

### 4. Bar rendering

Each bar column is a flex column containing:
1. **Value label** (top) — compact formatted number
2. **Bar** (middle) — colored rectangle, height proportional to max value
3. **Year label** (bottom) — `'21`, `'22`, etc.

Bar styling:
- `border-radius: 3px 3px 0 0` (rounded top only)
- Background: `rgba(200,180,140, opacity)` where opacity gradients from 0.15 (oldest) to 0.85 (newest full year)
- Animation: `way-bar-grow` (scaleY 0→1, 0.8s ease-out, staggered 100ms per bar)
- Cursor: pointer

### 5. Value labels — compact K format

Labels appear above each bar. Formatting rules:

| Value range | Format | Example |
|---|---|---|
| < 1,000 | Integer, no suffix | `52`, `120`, `995` |
| ≥ 1,000 | Divide by 1000, round to 1 decimal, drop trailing `.0` | `1K`, `1.2K`, `3.4K`, `85K`, `142K` |

Edge cases: `1000` → `1K`, `1050` → `1.1K` (rounded), `1949` → `1.9K`, `2000` → `2K`.

Implementation: a `formatCompact(value: number): string` utility function.

Label styling:
- Font: mono, 8px
- Color: `#b0a898` (normal years), `#4a4540` (current incomplete year)

### 6. Current incomplete year

The current calendar year (if present in data) gets distinct treatment:

- **Bar:** dashed border (`1px dashed rgba(200,180,140,0.3)`), semi-transparent fill (`rgba(200,180,140,0.05)`)
- **Year label:** gold color (`--way-gold`), suffix tilde: `'26~`
- **Value label:** muted color (`#4a4540`)
- **Detection:** `year === new Date().getFullYear()`

### 7. Detail panel — tap/click interaction

On tap or click on any bar column:
- **Panel appears below the chart** with `fade + translateY(-4px)` animation (0.2s ease)
- **Tapped bar gets highlight:** `outline: 1px solid rgba(200,180,140,0.5); outline-offset: 1px`
- **Tapping same bar again or tapping outside** closes the panel
- **Tapping different bar** switches the panel content

Panel content — **full year with history:**
```
2025                          120 ₽ / ед.
14 мар                              18 ₽
12 июн                              34 ₽
18 сен                              34 ₽
11 дек                              34 ₽
```

Panel content — **current incomplete year:**
```
2026 · неполный              33 ₽ / ед.
20 мар                              33 ₽
Год не завершён — итого за 2026 обновится
```

Panel content — **no-history (calculated) asset:**
```
2026                        1 800 ₽ / ед.
Расчётно: 150 ₽ × 12 мес
```

Panel styling:
- Background: `#252220`
- Border: `1px solid rgba(200,180,140,0.1)`
- Border-radius: 8px
- Padding: 10px 12px
- Year: 11px, `--way-gold`, font-weight 500
- Total: 10px, `#b0a898`
- Rows: 9px, dates in `#4a4540`, amounts in `#b0a898`
- Notes: 8px, `#3a3530`, italic

### 8. No-history fallback

For assets with no payment history (manual paymentPerUnit only):

- **Single bar** showing calculated annual income: `paymentPerUnit × frequencyPerYear`
- Bar centered in chart area, uses flex sizing (will expand up to max-width)
- **No CAGR** displayed (need ≥ 2 full years)
- **Detail panel** shows calculation breakdown: "Расчётно: X ₽ × N мес/кв/год"

### 9. CAGR calculation

**No changes** to existing `calcCAGR` logic:
- Groups payments by calendar year
- Excludes current (incomplete) year
- Requires ≥ 2 full years
- Formula: `(last/first)^(1/span) - 1`

The chart passes per-unit values (not total portfolio values) to the CAGR calc since the chart now shows per-unit payments.

### 10. Data flow changes

**Current:** `PaymentHistoryChart` receives `history: PaymentRecord[]` and `quantity: number`, multiplies amount × quantity internally.

**New:** Since the chart shows **per-unit** values, the component should receive history as-is and NOT multiply by quantity. The `quantity` prop is removed.

New interface:
```typescript
interface PaymentHistoryChartProps {
  history: PaymentRecord[];        // per-unit payment history
  paymentPerUnit?: number;         // for no-history fallback
  frequencyPerYear?: number;       // for no-history fallback
}
```

When `history` is empty but `paymentPerUnit` and `frequencyPerYear` are provided, render the single-bar fallback.

## Files to modify

| File | Action | Description |
|---|---|---|
| `src/components/shared/payment-history-chart.tsx` | **Rewrite** | New flex layout, scroll, detail panel, compact labels, no-history fallback |
| `src/pages/main-page.tsx` | **Edit** | Remove PaymentHistoryChart, `portfolioHistory` memo, `allHistory`/`useAllPaymentHistory` import (only used for chart) |
| `src/pages/category-page.tsx` | **Edit** | Remove PaymentHistoryChart and `categoryHistory` from memo. Keep `allHistory` and `historyByAsset` — used for `calcFactPaymentPerUnit` |
| `src/pages/asset-detail-page.tsx` | **Edit** | Update props passed to chart (remove quantity, add paymentPerUnit/frequency) |
| `src/lib/utils.ts` (or new) | **Edit** | Add `formatCompact()` utility |
| `src/hooks/use-payment-history.ts` | **No change** | `useAllPaymentHistory` is still used by `use-portfolio-stats.ts` — keep it |
| `src/index.css` | **No change** | Existing keyframes and tokens sufficient |
| `tests/services/income-calculator.test.ts` | **No change** | CAGR logic unchanged |

## New test coverage

- `formatCompact`: 52→"52", 999→"999", 1000→"1K", 1050→"1.1K", 1200→"1.2K", 1949→"1.9K", 85000→"85K", 142000→"142K"
- Chart component: no-history fallback renders single bar
- Detail panel: renders payment list for selected year

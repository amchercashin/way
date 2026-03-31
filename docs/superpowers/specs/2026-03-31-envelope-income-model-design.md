# Envelope Income Model — Design Spec

**Date:** 2026-03-31
**Approach:** A (minimal change — window logic only)

## Summary

Replace the current income calculation model ("take last N=frequency payments, sum as annual") with an envelope model ("sum all payments within a rolling 12-month window"). This is mathematically equivalent to dividing each payment by 12 and spreading it into 12 monthly "envelopes" — monthly income = sum of active envelopes.

## Motivation

The current model is optimistic for edge cases: it uses an 18-month staleness window, ignores payment dates when selecting the last N, and can count payments whose real-world spending effect has passed. The envelope model better reflects how one would actually live off investment income — money from each payment lasts 12 months, then it's gone.

In steady state (regular payments, stable amounts), both models produce identical numbers.

## Core Change: `calcAnnualIncomePerUnit`

**File:** `src/services/income-calculator.ts`

### Before

```typescript
calcAnnualIncomePerUnit(
  history: PaymentRecord[],
  frequencyPerYear: number,
  now: Date = new Date(),
): AnnualIncomeResult
```

Logic: sort by date desc → reject if newest > 18 months → take last `min(freq, count)` → sum.

### After

```typescript
calcAnnualIncomePerUnit(
  history: PaymentRecord[],
  now: Date = new Date(),
): AnnualIncomeResult
```

Logic: compute `twelveMonthsAgo = now - 12 months` → filter payments where `date >= twelveMonthsAgo` → sort desc → sum.

- `frequencyPerYear` parameter removed
- 18-month staleness check removed (replaced by 12-month window)
- `annualIncome` = sum of payments in window
- `usedPayments` = all payments in window, sorted newest-first

## Caller Updates

Three call sites drop the `frequencyPerYear` argument:

| File | Line | Change |
|---|---|---|
| `src/hooks/use-portfolio-stats.ts` | 39 | Remove `asset.frequencyPerYear` arg |
| `src/pages/asset-detail-page.tsx` | 42 | Remove `asset.frequencyPerYear` arg |
| `src/pages/category-page.tsx` | 76 | Remove `asset.frequencyPerYear` arg |

## What Does NOT Change

- **`frequencyPerYear` in data model** — stays in `Asset` type and DB. Still used by `expected-payment.tsx` (next payment estimate) and MOEX sync (dividend fetch count).
- **Manual override** — `paymentPerUnitSource === 'manual'` bypasses `calcAnnualIncomePerUnit` entirely, as before.
- **NDFL tax** — applied to the result downstream, unchanged.
- **`calcCAGR`** — uses its own calendar-year logic, unaffected.
- **`calcAssetIncomePerYear`, `calcAssetIncomePerMonth`, `calcPortfolioIncome`, `calcYieldPercent`** — unchanged (they consume `annualIncome` output).
- **UI components** — no layout/display changes. Numbers change only for edge cases.

## Tests

**Rewrite:** `calcAnnualIncomePerUnit` test suite (~10 cases). Remove `frequencyPerYear` from all calls.

**New test cases:**
- Payment exactly 12 months ago — included (boundary)
- Payment 12 months + 1 day ago — excluded
- 5 payments within 12 months (any frequency) — all counted
- Empty window (all payments older than 12 months) — income = 0
- Mixed: some payments in window, some outside — only in-window counted

**Unchanged:** `calcAssetIncomePerYear`, `calcAssetIncomePerMonth`, `calcPortfolioIncome`, `calcYieldPercent`, `calcCAGR` test suites.

## Future Extensibility

The `now` parameter enables forward projection: shift `now` to a future month to compute projected income. If forecasted payments (e.g., announced but unpaid dividends) are added to history with future dates, the 12-month window will pick them up automatically when `now` reaches their range.

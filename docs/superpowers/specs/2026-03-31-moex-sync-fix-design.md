# MOEX Sync Fix — Design Spec

**Date:** 2026-03-31

## Problem

1. `triggerSync()` in `sync-context.tsx:26` passes `pricesOnly: true` — dividends are NEVER fetched during global sync (auto or manual). Dividends only sync via `syncAsset()` from asset detail page.
2. `fetchDividends` / `fetchCouponHistory` silently return `null` on API errors — user gets no feedback.
3. Green "moex" badge in payments section shows success even when dividend sync failed.

## Fix: Three Changes

### 1. Remove `pricesOnly` from global sync

**File:** `src/contexts/sync-context.tsx`

Line 26 — change:
```typescript
const result = await syncAllAssets({ pricesOnly: true });
```
to:
```typescript
const result = await syncAllAssets();
```

This makes the global sync (auto-launch + manual trigger) fetch dividends along with prices.

### 2. Surface dividend fetch failures as warnings

**File:** `src/services/moex-sync.ts`

**`SyncResult`** — add `warnings: string[]` field alongside existing `errors: string[]`.

**`enrichStock`** (line 274): if `fetchDividends(secid)` returns null AND there are no existing payments for this asset — add warning like `"ROSN: дивиденды не загружены"`. If there ARE existing payments (just no new ones), this is normal — no warning.

**`enrichBond`** (line 332): same for `fetchCouponHistory` — if returns empty AND no existing coupons — add warning.

**`syncAllAssets`**: pass warnings through in the result.

**File:** `src/contexts/sync-context.tsx`

Add `warning: string | null` state. After sync, if `result.warnings.length > 0` — set warning. Expose via context.

### 3. Amber badge on sync failure in payments section

**Files:** `src/components/payments/type-section.tsx`, `src/components/payments/asset-payments.tsx`

Both components have `handleSync` that calls `syncAssetPayments`. Add local state `syncFailed: boolean`:

- `handleSync` success → `setSyncFailed(false)`
- `handleSync` error/exception → `setSyncFailed(true)`

Badge logic change (both files have identical badge markup):

```
Current:  allMoex → green "moex"  |  hasManual → yellow "ручной"
New:      syncFailed → amber "moex ⚠"  |  allMoex → green "moex"  |  hasManual → yellow "ручной"
```

Amber color: `bg-[#5a4a2d] text-[#d4a846]` (matches project's warm palette).

`syncFailed` is session-only state — resets on page refresh. This is correct: the badge reflects "your last sync attempt failed", not "data is stale".

### What Does NOT Change

- `syncAssetPayments` function signature and behavior
- `syncSingleAsset` (detail page sync) — already does full sync including dividends
- Main page `⟳` button and error text
- Payment row source badges (per-payment "moex"/"ручной")
- Payment history storage and deduplication logic

## Edge Cases

- **MOEX API temporarily down:** global sync fetches prices (batched, faster) then dividends (individual, slower). If prices succeed but dividends timeout — prices are saved, dividends show warnings. Next sync when API is back fills in dividends.
- **New asset with no payment history:** if dividend fetch fails on first sync, warning is shown. User sees empty payment list + amber badge.
- **Asset with existing payments + failed refresh:** no warning (existing data is still valid, just not updated). The green badge stays.

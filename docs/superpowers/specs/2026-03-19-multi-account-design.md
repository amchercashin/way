# Multi-Account Redesign — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Scope:** Data model, "Данные" page, import rework, asset detail page changes

## Problem

All assets live in a single flat list with no concept of brokerage accounts. Users with multiple accounts (e.g., three accounts at Sber) cannot see or manage their portfolio structure. No way to distinguish which assets belong to which account.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Account model | Unified — everything is an "account" | Real estate, crypto, brokerage — all treated the same. One model, one UI. |
| Account identity | Just a name (string) | No broker entity, no account type field. Name auto-derived from import or user-entered. |
| Asset↔Account relationship | Asset unique globally, Holdings table for per-account positions | Prices/dividends are properties of the security, not the account. No duplication. |
| Asset type | Free-form string, not enum | Combobox with suggestions: Акции, Облигации, Фонды, Вклады, Недвижимость, Крипта + existing types. User can enter custom. |
| Source tracking | `quantitySource` on Holding; `paymentPerUnitSource`, `frequencySource` on Asset | Quantity varies per account; payment/frequency are asset-level. |
| Import model | Full snapshot — report replaces everything in account | With preview table showing diff before applying. |
| Migration | Clean slate — delete old data | No data migration. User re-imports or re-enters after upgrade. |
| Editing location | All editing on "Данные" page only | Asset detail page is read-only for holdings. Tap navigates to Данные with highlight. |
| Payment/frequency editing | Stays on asset detail page for now | Dedicated "Выплаты" page designed separately later. |

## Data Model

### Account

```
Account
├── id: number (auto-increment)
├── name: string              — "Сбер / 40R9B", "Недвижимость", "Крипта"
├── createdAt: Date
└── updatedAt: Date
```

No type field. The system doesn't know or care what kind of account it is.

### Asset (modified)

Asset retains all existing fields (including MOEX-related fields like `moexSecid`, `moexBoardId`, etc. used by moex-sync). Only the changes listed below apply:

**Removed:** `quantity`, `quantitySource`, `importedQuantity`, `averagePrice` — moved to Holding.

**Changed:** `type` from enum (`'stock' | 'bond' | ...`) to free-form string (`"Акции"`, `"Облигации"`, custom).

Asset is unique globally. For securities — matched by ticker. For non-market assets (real estate, crypto) — unique by id, no ticker.

### Holding (new)

```
Holding
├── id: number (auto-increment)
├── accountId: number         — FK → Account
├── assetId: number           — FK → Asset
├── quantity: number
├── quantitySource: 'import' | 'manual'
├── importedQuantity?: number — for "revert to imported" functionality
├── averagePrice?: number
├── createdAt: Date
└── updatedAt: Date
```

Pair `(accountId, assetId)` is unique — one asset appears at most once per account.

### PaymentHistory (unchanged)

Stays linked to Asset. Dividends/coupons are properties of the security.

### Dexie Schema (v5)

```
accounts: ++id
assets: ++id, type, ticker, isin
holdings: ++id, accountId, assetId, &[accountId+assetId]
paymentHistory: ++id, [assetId+date]
importRecords: ++id, date
settings:
```

Migration: clear all existing assets, paymentHistory, importRecords. Create new tables.

## Write Paths

### Manual asset creation (on Данные page)

1. User taps "+ Добавить актив" in a specific account
2. Form: name, type (combobox), ticker (optional), quantity, averagePrice
3. System checks if Asset with this ticker already exists
   - Yes → create Holding linking to existing Asset
   - No → create Asset + Holding atomically
4. Holding.quantitySource = 'manual'

### Import (Sber broker report)

**New account from import:**
1. User taps "+ Добавить счёт" → "Из импорта"
2. Uploads Sber HTML report
3. Parser extracts account name (e.g., "Сбер / 40R9B") — editable
4. Preview table shown (see Import Preview below)
5. On confirm: Account created, Assets created/matched by ticker, Holdings created
6. All Holdings: quantitySource = 'import'

**Import into existing account:**
1. User taps "Импорт" button in account header
2. Uploads report
3. Account name NOT changed
4. Preview table shown — full snapshot diff
5. On confirm: Holdings added/updated/removed to match report exactly

### Manual editing (on Данные page)

1. User taps any cell in the table → inline edit
2. Editing quantity or averagePrice → updates Holding, quantitySource → 'manual'
3. Editing name, type, currentPrice → updates Asset
4. Editing account name → updates Account

### Deletion

- Delete a row (Holding): removes holding. If this was the last holding for the asset → delete Asset + PaymentHistory
- Delete an account: removes Account + all its Holdings. Orphaned Assets (no holdings left) are also deleted.

## Import Preview

Full-screen table shown before applying import. Import = full snapshot replacement.

**Summary chips:** `+N новых`, `N изменено`, `−N удалён`, `N ок`

**Table columns:** Тикер (with name below), Кол-во, Цена пок., Стоимость

**Inline diff in cells:** old value struck through, new value next to it in status color.

**Row colors by status:**
- Green left border + tinted background: new
- Yellow left border + tinted background: changed
- Red left border + tinted background: removed (struck through)
- Collapsed: "N без изменений" expandable row

**Actions:** Отмена / Применить

No conflict warnings — import always overwrites.

**Asset-level fields during import:** Import updates both Holding fields (quantity, averagePrice) and Asset fields (currentPrice, name, type, dataSource) for matched tickers. Asset.dataSource is set to `'import'` on import. Since Asset is shared across accounts, an import into one account may update currentPrice visible from other accounts. This is correct behavior — the price is a property of the security.

### Account name from Sber report

Parser extracts agreement number from the report (e.g., "40R9B" from the HTML header). Auto-generated name format: "Сбер / {agreement_number}". User can edit before confirming.

## Page: Данные (replaces Import)

### Structure

Route: `/data` (replaces `/import` and all sub-routes)

Menu entry: "Данные" under "Управление" section (was "Импорт данных")

### Layout

Vertical list of account cards. Each card:

**Account header:**
- Collapse/expand chevron (▾/▸)
- Account name (color: way-text, inline-editable)
- Account status badge (derived: "импорт" if all holdings imported, "ручной" if any manual)
- Total account value (sum of all holdings' values)
- "Импорт" button
- "⋯" menu (rename, delete)

**Account body (expanded):**
- Grouped by asset type
- Type sub-header: type name + sum of values for that type
- Table per type: columns Тикер, Кол-во, Цена пок., Стоимость
  - All cells inline-editable on tap
  - Delete button per row (swipe or long-press)
- "+ Добавить актив" button at bottom of each account

**Bottom of page:**
- "+ Добавить счёт" button (dashed border)

### Adding an account

Tap "+ Добавить счёт" → choice:
- "Пустой" → enter name, empty account appears
- "Из импорта" → upload flow → account created with data

### Default frequency for known types

When creating an asset manually with a known type:
- Акции → frequencyPerYear = 1
- Облигации → frequencyPerYear = 2
- Фонды → frequencyPerYear = 12
- Unknown/custom → user must specify

## Page: Asset Detail (modified)

### Changes

The page becomes **read-only for holdings data**.

**Quantity display:**
- Total quantity (sum across all holdings)
- Compact breakdown by account: "Сбер / 40R9B: 150 / Сбер / ИИС: 50"
- Tap on account row → navigate to `/data`, auto-scroll to that account + asset row, row highlights with a pulse animation

**Value display:**
- Total value (sum across all holdings)

**Average purchase price:**
- Weighted average across holdings, or per-account breakdown

**Still editable on this page:**
- paymentPerUnit (with fact/manual badge and reset)
- frequencyPerYear (with moex/manual badge and reset)

**No changes:**
- PaymentHistoryChart
- Expected payment dates
- MOEX sync

## Page: Main (Мой доход)

### Changes

Minimal changes:
- CategoryCards now group by free-form `type` string instead of enum
- **Category colors:** Known types (Акции, Облигации, Фонды, Недвижимость, Крипта) keep predefined colors from a lookup map. Custom types get a color derived from a hash of the type name.
- Income calculations aggregate across all holdings for each asset
- Formula unchanged: `paymentPerUnit × frequencyPerYear × totalQuantity / 12`
  where `totalQuantity = sum of holdings.quantity for that asset`

## Routes

### Removed
- `/import` — replaced by `/data`
- `/import/sber`
- `/import/ai`
- `/import/file`
- `/import/preview`

### Added
- `/data` — new "Данные" page

### Modified
- `/category/:type` — type parameter is now a URL-encoded string instead of enum
- `/add-asset` — removed (creation happens on Данные page)

## Implementation Phases

### Phase 1: Data model + migration
- New Dexie schema v5: Account, Holding tables
- Clear old data
- Update Asset type from enum to string
- Update TypeScript types
- Update all hooks to work with new model
- Update income calculations to aggregate from Holdings

### Phase 2: Данные page
- New `/data` route and page component
- Account cards with expand/collapse
- Tables grouped by type with inline editing
- Add/delete account and asset flows
- Import integration (Sber report into account)
- Import preview with diff table

### Phase 3: Asset detail + main page adaptation
- Asset detail: show holdings breakdown, navigate to Данные on tap
- Main page: adapt to string-based types
- Category page: adapt to string-based types
- Remove old import routes

## Backup/Restore

The backup format changes with the new schema (new tables: accounts, holdings; removed fields from assets). Old backups from v4 are **not compatible** — no import of old format. Backup/restore must be updated to export/import the new schema: accounts, assets, holdings, paymentHistory, importRecords, settings.

## Out of Scope

- Dedicated "Выплаты" page for payment/frequency management
- Broker entity (separate from account)
- Account type field (broker vs custom)
- Data migration from v4 (clean slate)
- Import of v4-format backups

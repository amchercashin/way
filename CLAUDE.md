# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # TypeScript check + production build
npm run test       # Vitest (all tests)
npx vitest run tests/services/income-calculator.test.ts  # Single test file
```

## Architecture

Local-first PWA for tracking passive income from stocks, bonds, deposits, real estate, and funds. No backend — all data stored in IndexedDB via Dexie. External reads only: MOEX ISS API for prices/dividends.

**Stack:** React 19 + React Router v7 (SPA) + Dexie (IndexedDB) + Tailwind v4 + shadcn/ui + Vitest

### Data flow

```
MOEX API / Import files → services/ (pure parsing) → Dexie DB → useLiveQuery hooks → React components
                                                        ↑
                                                   User edits (inline)
```

- **`src/models/types.ts`** — all domain types. `Asset` is the central entity with source-tracking fields (`paymentPerUnitSource`, `frequencySource`, `quantitySource`) distinguishing calculated/imported values from manual overrides.
- **`src/db/database.ts`** — Dexie schema with versioned migrations. V4 merged PaymentSchedule into Asset; understand the upgrade function before adding fields.
- **`src/services/`** — pure functions: `income-calculator.ts` (income math), `moex-api.ts` (API parsing), `moex-sync.ts` (orchestration), `import-*.ts` (CSV/HTML/markdown parsing + diffing), `backup.ts` (JSON export/import).
- **`src/hooks/`** — reactive data layer via `useLiveQuery`. `usePortfolioStats()` is the heaviest computation (income, yield, portfolio share per asset/category).
- **`src/pages/`** — one file per route. Asset detail page uses inline editing with source badges (ф = fact/moex, р = manual) and reset buttons.
- **`src/components/ui/`** — shadcn-generated components. Do not edit by hand; use `npx shadcn@latest add <component>`.

### Source-aware income model

Every income-related field on `Asset` tracks its origin:
- `paymentPerUnitSource`: `'fact'` (calculated from payment history) or `'manual'` (user override)
- `frequencySource`: `'moex'` or `'manual'`
- `quantitySource`: `'import'` or `'manual'`

Manual values override calculated ones. Reset buttons revert to the calculated/imported value.

## Conventions

- **Russian UI text** — all user-facing strings are in Russian; preserve this when modifying UI.
- **Dark mode only** — hardcoded dark theme (`#0d1117` background), no light mode toggle.
- **Path alias** — `@/*` maps to `src/*`.
- **Tests** — in `tests/` mirroring `src/` structure. Use `fake-indexeddb` for DB tests. Pure function tests dominate; no component tests.
- **Dexie transactions** — asset mutations (`addAsset`, `updateAsset`, `deleteAsset`) are wrapped in Dexie transactions in `use-assets.ts`.

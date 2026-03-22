# Fluid Typography System — Design Spec

## Problem
All font sizes are hardcoded pixels (8px–44px). No responsive scaling. Text too small on phones, especially iPhone.

## Solution
7 semantic CSS-variable tokens with `clamp()` in `index.css`. Replace all hardcoded `text-[Xpx]` with token references.

## Type Scale

| Token | clamp() | 320px | 390px | 430px | Usage |
|-------|---------|-------|-------|-------|-------|
| `--way-text-display` | `clamp(36px, 11vw, 52px)` | 36 | 43 | 47 | Hero income sum |
| `--way-text-nav` | `clamp(20px, 5.5vw, 24px)` | 20 | 21 | 24 | Nav icons ☰ ‹ ⟳ |
| `--way-text-title` | `clamp(16px, 4.5vw, 20px)` | 16 | 18 | 20 | Page titles |
| `--way-text-heading` | `clamp(14px, 3.8vw, 16px)` | 14 | 15 | 16 | Values, tickers, category names, stat values |
| `--way-text-body` | `clamp(12px, 3.4vw, 14px)` | 12 | 13 | 14 | Income amounts, actions, secondary data |
| `--way-text-caption` | `clamp(11px, 3.2vw, 13px)` | 11 | 12 | 13 | Labels, badges, meta-info |
| `--way-text-micro` | `clamp(10px, 2.7vw, 11px)` | 10 | 11 | 11 | Chart annotations, sync time (decorative) |

## Element → Token Mapping

### Main Page (`main-page.tsx`, `hero-income.tsx`, `category-card.tsx`)
| Element | Current | Token |
|---------|---------|-------|
| ☰ menu button | text-lg (18px) | nav |
| ⟳ refresh button | text-base (16px) | nav |
| Hero label "расчётный..." | text-[9px] | caption |
| Hero income sum | text-[44px] | display |
| Subtitle "доходность..." | text-[10px] | caption |
| Toggle МЕС/ГОД | text-[10px] | caption |
| Sync time MOEX | text-[10px] | micro |
| Category name | text-[13px] | heading |
| Asset count | text-[9px] | caption |
| Category income | text-[12px] | body |
| Portfolio share | text-[9px] | caption |

### Category Page (`category-page.tsx`, `asset-row.tsx`)
| Element | Current | Token |
|---------|---------|-------|
| ‹ back button | text-lg (18px) | nav |
| Page title (via AppShell) | text-sm (14px) | title |
| Stat label | text-[8px] | caption |
| Stat value | text-[14px] | heading |
| Stat source badge | text-[8px] | caption |
| Ticker/name | text-[13px] | heading |
| Asset name (secondary) | text-[11px] | body |
| Income per month | text-[12px] | body |
| Badge fact/manual | text-[8px] | caption |
| Meta: qty · price | text-[9px] | caption |
| Frequency badge | text-[9px] | caption |
| Annual income | text-[9px] | caption |

### Asset Detail Page (`asset-detail-page.tsx`, `asset-field.tsx`, `expected-payment.tsx`)
| Element | Current | Token |
|---------|---------|-------|
| Back button | text-lg (18px) | nav |
| Page title | text-sm (14px) | title |
| Field label | text-[10px] | caption |
| Field value | text-[14px] | heading |
| Source badge | text-[8px] | caption |
| Subtitle link | text-[9px] | caption |
| Quantity label | text-[10px] | caption |
| Quantity value | text-[14px] | heading |
| Holdings breakdown | text-[11px] | body |
| Expected payment header | text-[10px] | caption |
| Row label | text-[9px] | caption |
| Row value | text-[13px] | body |

### Payment History Chart (`payment-history-chart.tsx`)
| Element | Current | Token |
|---------|---------|-------|
| Chart header | text-[9px] | caption |
| CAGR | text-[10px] | micro |
| Value labels (numbers) | text-[8px] | micro |
| Year labels | text-[9px] | micro |
| Panel header | text-[11px] | caption |
| Panel value | text-[10px] | caption |
| Panel details | text-[9px] | caption |
| Panel subtitle | text-[8px] | micro |

### Payments Page (`payments-page.tsx`, `type-section.tsx`, `asset-payments.tsx`, `payment-row.tsx`)
| Element | Current | Token |
|---------|---------|-------|
| Collapse arrow (type) | text-xs (12px) | body |
| Type name | text-[15px] | heading |
| Type meta (count) | text-[11px] | body |
| Collapse arrow (asset) | text-[10px] | caption |
| Asset name | text-[13px] | heading |
| Payment count | text-[11px] | body |
| Payment row text | text-[13px] | body |
| Payment date | text-[13px] | body |
| Payment amount | text-[13px] | body |
| Source badge | text-[10px] | caption |
| Action buttons | text-xs (12px) | body |
| "+ выплата" | text-[11px] | body |

### Data Page (`data-page.tsx`, `account-section.tsx`)
| Element | Current | Token |
|---------|---------|-------|
| Add account button | text-sm (14px) | body |
| Collapse icon | text-xs (12px) | caption |
| Account name | text-[15px] | heading |
| Status badge | text-[10px] | caption |
| Total value | text-[13px] | body |
| Import/menu buttons | text-[11px] | body |
| Type header | text-[11px] | body |
| Table header | text-[11px] | body |
| Ticker | text-[13px] | heading |
| Asset name | text-[11px] | body |
| Quantity/price | text-[13px] | heading |
| Delete/add buttons | text-xs (12px) | body |

### Shared Components
| Element | Current | Token |
|---------|---------|-------|
| AppShell nav buttons | text-lg (18px) | nav |
| AppShell page title | text-sm (14px) | title |
| Drawer menu title | text-lg (18px) | title |
| Drawer section header | text-[8px] | caption |
| Drawer menu item | text-sm (14px) | heading |

## Touch Targets
- Nav buttons (☰ ‹ ⟳): min-w-[44px] min-h-[44px]
- Toggle buttons (МЕС/ГОД): min-h-[36px] with adequate padding
- All interactive elements: minimum 24×24px clickable area (WCAG AA)

## Design Principles
- 12px absolute floor for readable text; 10-11px only for decorative (chart annotations, sync time)
- All tokens defined in `index.css` under existing `@theme` block alongside `--way-*` color tokens
- Rollback: revert `index.css` token definitions to restore original sizes
- Per-token adjustment: change one line in `index.css` to affect all elements using that token

## Implementation Notes
- Tokens go in `src/index.css` as CSS custom properties
- Components reference via `text-[var(--way-text-TOKEN)]`
- No Tailwind config needed (v4 reads CSS variables)
- Existing `text-base` on inputs (16px for iOS zoom prevention) must NOT be changed

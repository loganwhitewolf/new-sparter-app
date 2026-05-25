---
plan: 29-02
phase: 29-dashboard-intelligence
status: complete
completed_at: 2026-05-19
---

# Plan 29-02 Summary: getCategoryDeviations DAL + DeviationBadge

## What Was Built

### Public API Surface

**`lib/dal/dashboard.ts`** — new exports:

| Export | Type | Description |
|--------|------|-------------|
| `DeviationData` | type | `{ deviation: number \| null, isNew: boolean, belowNoiseThreshold: boolean }` |
| `DeviationDateRanges` | type | `{ reference: DateRange, baseline: DateRange }` |
| `CategoryDeviationsInput` | type | `{ type: 'in' \| 'out' \| 'all', categoryId?: number }` |
| `getDeviationDateRanges(now?)` | function | Returns fixed reference = last-month + baseline = 3 months prior (D-02, D-03) |
| `buildDeviationDataset(input)` | function | Pure builder — maps referenceRows + baselineRows → `Map<number, DeviationData>` |
| `getCategoryDeviations(input)` | cache function | Full DAL: runs two Drizzle queries, calls buildDeviationDataset, returns deviation map |

**`components/dashboard/deviation-badge.tsx`** — new export:

| Export | Description |
|--------|-------------|
| `DeviationBadge` | Presentational component — renders deviation % with color polarity |

### categoryId Mode vs No categoryId

- `getCategoryDeviations({ type })` → groups by `category.id` → category-level deviations
- `getCategoryDeviations({ type, categoryId })` → groups by `subCategory.id` → subcategory-level deviations for that category

### DeviationBadge Polarity Matrix

| Input | categoryType | Rendered color |
|-------|-------------|----------------|
| `deviation = null` | any | renders nothing (`null`) |
| `deviation = 'new'` | any | `text-muted-foreground` → "Nuovo" |
| `deviation = 0` | any | `text-muted-foreground` → "0%" |
| `deviation > 0` | `out` | `text-destructive` (red — overspend) |
| `deviation > 0` | `in` | `text-emerald-600` (green — more income) |
| `deviation < 0` | `out` | `text-emerald-600` (green — underspend) |
| `deviation < 0` | `in` | `text-destructive` (red — less income) |

### Plan 01 Scaffold Now GREEN

`tests/deviation-badge.test.tsx` — all 5 test cases pass (D-06, D-09):
- null → empty string ✓
- 'new' → Nuovo ✓
- +45% out → text-destructive ✓
- +45% in → text-emerald-600 ✓
- -12% with polarity inversion ✓

### Access Control

`getCategoryDeviations` calls `verifySession()` as first line. Both reference and baseline queries scope via `dateScopedTransactions(userId, …)` — no cross-user data leakage (T-29-03).

## Commits

- `ae4ea90` feat(29-02): add getCategoryDeviations DAL function and builder helpers
- `43bbb92` feat(29-02): add DeviationBadge component — turn Plan 01 scaffold GREEN

## Tests

| Suite | Pass | Fail |
|-------|------|------|
| `dashboard-dal.test.ts` (21 tests, incl. D-02/D-03/D-05 blocks) | 21 | 0 |
| `deviation-badge.test.tsx` (5 tests, D-06/D-09) | 5 | 0 |

## Self-Check: PASSED

- ✓ `getCategoryDeviations`, `buildDeviationDataset`, `getDeviationDateRanges`, `DeviationData`, `CategoryDeviationsInput` all exported
- ✓ Reference Period is always fixed `last-month` (D-02)
- ✓ Baseline = 3 months prior to reference (D-03)
- ✓ `belowNoiseThreshold: true` and `deviation: null` when reference < €15 (D-05)
- ✓ No native arithmetic on monetary amounts
- ✓ `verifySession()` first line in DAL function

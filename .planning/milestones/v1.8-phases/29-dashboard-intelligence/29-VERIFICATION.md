---
phase: 29-dashboard-intelligence
verified: 2026-05-20T11:00:00Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open /dashboard/categories in a running dev server; verify the Deviazione / Importo sort toggle appears, defaults to deviation-sort, and clicking Importo switches to amount-sort while preserving preset and type query params in the URL."
    expected: "Sort toggle renders two buttons labeled 'Deviazione' and 'Importo'. Default state shows 'Deviazione' as active. Clicking 'Importo' changes ?sort=amount in the URL. Preset and type params are preserved."
    why_human: "Sort link rendering and URL behavior require a running browser/server; cannot be verified purely by static grep or SSR unit tests."
  - test: "Open /dashboard/categories in dev; observe that each category row shows a DeviationBadge (e.g. '+12%' in red for out-categories). Categories with very small amounts (< €15 reference) should show no badge."
    expected: "Colored percentage badge appears next to each category row. Noise-threshold rows show no badge."
    why_human: "Requires actual user-owned transaction data; the DB query and component rendering must be exercised end-to-end."
  - test: "Open /dashboard/categories/[id] for any category in dev; verify each subcategory row shows a DeviationBadge with correct color polarity."
    expected: "Subcategory rows have a deviation badge. For 'out' categories: positive % is red, negative % is green. For 'in' categories: polarity is inverted."
    why_human: "Requires live data and browser rendering."
  - test: "Open /dashboard/overview in dev; verify two stacked charts appear — EntrateUsciteChart (Entrate / Uscite bars) above BilancioBarsChart (per-month green/red Bilancio bars). MonthlyTrendChart (old 5-series chart) must not appear."
    expected: "'Entrate e uscite per mese' section with a bar chart showing two colored bars per month. 'Bilancio mensile' section below with per-month bars colored green (positive) or red (negative)."
    why_human: "Chart rendering and color logic require a browser with real data; SSR test only checks label presence in static markup."
---

# Phase 29: Dashboard Intelligence Verification Report

**Phase Goal:** Make the dashboard actionable at a glance: deviation view (vs 3-month baseline of the last completed calendar month) on category pages, plus the MonthlyTrendChart split into clearer Entrate/Uscite bars and a per-month colored Bilancio bar chart.
**Verified:** 2026-05-20T11:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `dashboardPresetToDateRange('last-month', new Date(2026, 4, 15))` returns `from=2026-04-01` and `to=2026-04-30T23:59:59.999` (D-01 fix) | ✓ VERIFIED | `lib/utils/date.ts` lines 60-65: `from: new Date(now.getFullYear(), now.getMonth() - 1, 1)`, `to: endOfMonth(now.getFullYear(), now.getMonth() - 1)`. Test in `tests/dashboard-dal.test.ts` passing. |
| 2 | `computeDeviation('120', '100')` returns 20 | ✓ VERIFIED | `lib/utils/dashboard.ts` lines 6-15: uses `ref.minus(base).div(base.abs()).times(100)`. `tests/dashboard-utils.test.ts` passes all computeDeviation cases. |
| 3 | `computeDeviation('100', '0')` returns `'new'` | ✓ VERIFIED | Same function: `if (base.isZero()) return 'new'`. Test passes. |
| 4 | `computeDeviation('0', '0')` returns `null` | ✓ VERIFIED | Same function: `if (base.isZero() && ref.isZero()) return null`. Test passes. |
| 5 | `buildDeviationMap` filters out reference rows with `abs(amount) < 15` | ✓ VERIFIED | `lib/utils/dashboard.ts` lines 38-42: `if (refAmount.lt(threshold)) { result.set(ref.id, null); continue }`. Test passes. |
| 6 | `getCategoryDeviations` returns Reference Period totals from the fixed `last-month` range (D-02) regardless of caller-supplied preset | ✓ VERIFIED | `lib/dal/dashboard.ts` line 912: `const { reference, baseline } = getDeviationDateRanges()` — hardcoded; ignores caller preset. `getDeviationDateRanges` uses `month - 1` for reference, independent of `dashboardPresetToDateRange`. |
| 7 | Baseline window is the 3 calendar months immediately preceding the Reference Period (D-03) | ✓ VERIFIED | `lib/dal/dashboard.ts` lines 270-278: reference = `[month-1]`, baseline = `[month-4, month-1)` → 3 months. `tests/dashboard-dal.test.ts` D-02/D-03 block passes. |
| 8 | `DeviationBadge` renders correct colors with correct polarity for out/in category types (D-06, D-09) | ✓ VERIFIED | `components/dashboard/deviation-badge.tsx`: `isGood = categoryType === 'out' ? !isPositive : isPositive`. `tests/deviation-badge.test.tsx` passes all 5 cases. |
| 9 | Overview page renders two separate charts stacked vertically: `EntrateUsciteChart` above `BilancioBarsChart` (D-10) | ✓ VERIFIED | `app/(app)/dashboard/overview/page.tsx` lines 26-38: two `<section>` elements with `EntrateUsciteChart` then `BilancioBarsChart`. |
| 10 | `EntrateUsciteChart` renders Entrate and Uscite bars only — no Non categorizzato, Ignorato, or Bilancio series (D-11) | ✓ VERIFIED | `components/dashboard/entrate-uscite-chart.tsx`: only `totalIn`/`totalOut` bars; no ComposedChart, no other series. `tests/dashboard-charts.test.tsx` asserts absence of other labels. |
| 11 | `BilancioBarsChart` renders one `<Cell>` per month colored green for positive balance and red for negative (D-12) | ✓ VERIFIED | `components/dashboard/bilancio-bars-chart.tsx` lines 58-63: `<Cell fill={point.balance >= 0 ? 'var(--total-in)' : 'var(--color-destructive)'}/>`. Test passes. |
| 12 | `MonthlyTrendChart` is deleted from the codebase (D-10) | ✓ VERIFIED | `components/dashboard/monthly-trend-chart.tsx` does not exist. No references found in `app/`, `components/`, or `tests/`. |
| 13 | Both category pages call `getCategoryDeviations` and pass results to their list components (D-06, D-08) | ✓ VERIFIED | `categories/page.tsx` line 100: `getCategoryDeviations({ type: filters.type })`. `[id]/page.tsx` line 84: `getCategoryDeviations({ type: filters.type, categoryId })`. Both pass `deviations` prop to list components. |
| 14 | `/dashboard/categories` defaults to `sort=deviation`; `lib/routes.ts` builders accept optional `sort` param; tab nav preserves `sort` (D-07) | ✓ VERIFIED | `categories/page.tsx` line 16: `const CATEGORIES_DEFAULT_SORT: DashboardSort = 'deviation'`. `lib/routes.ts` lines 35-36: `if (filters.sort && filters.sort !== defaultSort) params.set('sort', filters.sort)`. `dashboard-tab-nav.tsx` lines 29-32: preserves `sort` param. |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/utils/date.ts` | Fixed last-month preset (D-01) | ✓ VERIFIED | Lines 63-64 use `month - 1` for both `from` and `to` |
| `lib/utils/dashboard.ts` | `computeDeviation`, `buildDeviationMap`, `DeviationResult` | ✓ VERIFIED | All three exported, Decimal.js used throughout |
| `tests/dashboard-utils.test.ts` | Unit tests for deviation utilities | ✓ VERIFIED | 9 tests, all passing |
| `tests/deviation-badge.test.tsx` | Tests for DeviationBadge component | ✓ VERIFIED | 5 tests, all passing |
| `tests/dashboard-charts.test.tsx` | Tests for EntrateUsciteChart + BilancioBarsChart | ✓ VERIFIED | 5 tests, all passing |
| `lib/dal/dashboard.ts` | `getCategoryDeviations`, `buildDeviationDataset`, `getDeviationDateRanges`, `DeviationData`, `CategoryDeviationsInput`, `DeviationDateRanges` | ✓ VERIFIED | All exported; `getCategoryDeviations` wraps with `cache()` and calls `verifySession()` |
| `components/dashboard/deviation-badge.tsx` | `DeviationBadge` with correct polarity | ✓ VERIFIED | 48 lines, substantive; correct color logic |
| `components/dashboard/entrate-uscite-chart.tsx` | `EntrateUsciteChart` with 2 series only | ✓ VERIFIED | 55 lines; `totalIn` + `totalOut` bars only |
| `components/dashboard/bilancio-bars-chart.tsx` | `BilancioBarsChart` with per-month colored `<Cell>` | ✓ VERIFIED | 69 lines; `<Cell>` with sign-based fill |
| `app/(app)/dashboard/overview/page.tsx` | Both charts stacked, MonthlyTrendChart removed | ✓ VERIFIED | EntrateUsciteChart + BilancioBarsChart imported and rendered |
| `app/(app)/dashboard/categories/page.tsx` | Calls `getCategoryDeviations`, default sort=deviation | ✓ VERIFIED | Lines 100, 16 |
| `app/(app)/dashboard/categories/[id]/page.tsx` | Calls `getCategoryDeviations` with categoryId | ✓ VERIFIED | Line 84 |
| `components/dashboard/category-ranking-list.tsx` | `DeviationBadge` rendered, sort algorithm | ✓ VERIFIED | Lines 5, 77-79, 150-155 |
| `components/dashboard/category-subcategory-breakdown.tsx` | `DeviationBadge` per subcategory row | ✓ VERIFIED | Lines 2, 66-76 |
| `lib/routes.ts` | `buildDashboardCategoriesHref` accepts `sort` param | ✓ VERIFIED | Lines 17, 35-37 |
| `lib/validations/dashboard.ts` | `DashboardSortSchema`, `DashboardSort`, `parseDashboardFilters` with `defaultSort` | ✓ VERIFIED | Lines 6-7, 19, 26 |
| `components/dashboard/dashboard-tab-nav.tsx` | `sort` preserved in tab nav | ✓ VERIFIED | Lines 29-32 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/dal/dashboard.ts (getCategoryDeviations)` | `lib/utils/date.ts (dashboardPresetToDateRange('last-month'))` | `getDeviationDateRanges()` — hardcoded Reference Period | ✓ WIRED | `getDeviationDateRanges` uses `month - 1` directly, not via preset; D-02 satisfied |
| `lib/dal/dashboard.ts (getCategoryDeviations)` | `lib/utils/dashboard.ts (buildDeviationMap)` | `buildDeviationDataset` calls `buildDeviationMap` | ✓ WIRED | DAL line 288 |
| `lib/dal/dashboard.ts` | `lib/dal/auth.ts (verifySession)` | `verifySession()` first line in `getCategoryDeviations` | ✓ WIRED | DAL line 911 |
| `app/(app)/dashboard/overview/page.tsx` | `components/dashboard/entrate-uscite-chart.tsx` | `import { EntrateUsciteChart }` + rendered in JSX | ✓ WIRED | Lines 5, 30 |
| `app/(app)/dashboard/overview/page.tsx` | `components/dashboard/bilancio-bars-chart.tsx` | `import { BilancioBarsChart }` + rendered in JSX | ✓ WIRED | Lines 6, 37 |
| `components/dashboard/bilancio-bars-chart.tsx` | recharts `Cell` | `<Cell fill={…} />` per bar | ✓ WIRED | Line 59 |
| `app/(app)/dashboard/categories/page.tsx` | `lib/dal/dashboard.ts (getCategoryDeviations)` | `await getCategoryDeviations({ type })` | ✓ WIRED | Line 100 |
| `app/(app)/dashboard/categories/[id]/page.tsx` | `lib/dal/dashboard.ts (getCategoryDeviations)` | `await getCategoryDeviations({ type, categoryId })` | ✓ WIRED | Line 84 |
| `components/dashboard/category-ranking-list.tsx` | `components/dashboard/deviation-badge.tsx` | `<DeviationBadge … />` | ✓ WIRED | Lines 5, 151 |
| `components/dashboard/category-subcategory-breakdown.tsx` | `components/dashboard/deviation-badge.tsx` | `<DeviationBadge … />` | ✓ WIRED | Lines 2, 67 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `getCategoryDeviations` (DAL) | `referenceRows`, `baselineRows` | Two parallel Drizzle queries with `dateScopedTransactions(userId, …)` joins | Yes — real DB queries scoped by userId, date ranges from `getDeviationDateRanges()` | ✓ FLOWING |
| `CategoryRankingList` | `deviations` prop | `getCategoryDeviations({ type })` passed from parent server component | Yes — Map populated from DAL | ✓ FLOWING |
| `CategorySubcategoryBreakdown` | `deviations` prop | `getCategoryDeviations({ type, categoryId })` passed from parent server component | Yes — Map populated from DAL | ✓ FLOWING |
| `EntrateUsciteChart` | `data` prop | `getAggregatedTransactionsData(filters.preset)` — existing DAL function | Yes — existing DB query, unmodified | ✓ FLOWING |
| `BilancioBarsChart` | `data` prop (derives `balance`) | Same `getAggregatedTransactionsData` | Yes — `toDecimal(totalIn).minus(toDecimal(totalOut))` in useMemo | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 40 phase-29 tests pass | `yarn vitest run tests/dashboard-utils.test.ts tests/dashboard-dal.test.ts tests/deviation-badge.test.tsx tests/dashboard-charts.test.tsx --reporter=verbose` | 4 test files passed, 40/40 tests green | ✓ PASS |
| 43 plan-04 tests pass | `yarn vitest run tests/category-ranking-list.test.tsx tests/category-detail-components.test.tsx tests/dashboard-filters.test.ts --reporter=verbose` | 3 test files passed, 43/43 tests green | ✓ PASS |
| MonthlyTrendChart fully removed | `grep -rn "MonthlyTrendChart\|monthly-trend-chart" app/ components/ tests/` | 0 matches | ✓ PASS |
| No native arithmetic on monetary amounts in new code | Manual inspection of `computeDeviation`, `buildDeviationMap`, `BilancioBarsChart` | All amounts use `toDecimal()`, `.minus()`, `.div()`, `.times()`, `.abs()` | ✓ PASS |
| `sort` query param preserved in tab nav | `grep -n "sort" components/dashboard/dashboard-tab-nav.tsx` | Lines 20, 29-32 preserve sort | ✓ PASS |

### Requirements Coverage

The D-0x IDs referenced in the PLAN frontmatter (`D-01` through `D-12`) are **phase-local decision identifiers** defined in `29-CONTEXT.md`. They do not appear in `.planning/REQUIREMENTS.md` (which tracks global milestone requirements like R0xx, IMP-xx, etc.). This is the established pattern for this codebase — dashboard intelligence decisions are scoped to this phase's context document. No global REQUIREMENTS.md entries are orphaned by this phase.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| D-01 | Plan 01 | Fix last-month date preset | ✓ SATISFIED | `lib/utils/date.ts` lines 60-65; `tests/dashboard-dal.test.ts` passes including January edge case |
| D-02 | Plans 01, 02 | Reference Period = fixed last-month | ✓ SATISFIED | `getDeviationDateRanges()` hardcodes `month-1`; `getCategoryDeviations` uses it regardless of caller preset |
| D-03 | Plans 01, 02 | Baseline = 3-month window preceding reference | ✓ SATISFIED | `getDeviationDateRanges` baseline = `[month-4, month-1)` i.e. 3 months; `buildDeviationMap` averages over distinct months present |
| D-04 | Plans 01, 02 | Deviation = signed percentage formula | ✓ SATISFIED | `ref.minus(base).div(base.abs()).times(100)` in `computeDeviation` |
| D-05 | Plans 01, 02 | Noise threshold €15 — exclude micro-spends | ✓ SATISFIED | `DEVIATION_NOISE_THRESHOLD = '15.00'`; `buildDeviationMap` and `buildDeviationDataset` both apply |
| D-06 | Plans 02, 04 | Categories page gains deviation column | ✓ SATISFIED | `CategoryRankingList` renders `DeviationBadge`; page calls `getCategoryDeviations` |
| D-07 | Plan 04 | Sort toggle on categories page, default=deviation | ✓ SATISFIED | `SortToggle` component; `CATEGORIES_DEFAULT_SORT = 'deviation'`; sort algorithm in `CategoryRankingList` |
| D-08 | Plan 04 | Category detail page gains subcategory deviation | ✓ SATISFIED | `[id]/page.tsx` calls `getCategoryDeviations({ categoryId })`; `CategorySubcategoryBreakdown` renders badges |
| D-09 | Plans 02, 04 | Percentage display only (`+45%`, `-12%`) | ✓ SATISFIED | `DeviationBadge` renders `{sign}{deviation}%`; no euro delta |
| D-10 | Plan 03 | MonthlyTrendChart split into two charts | ✓ SATISFIED | Old component deleted; two new components created and wired |
| D-11 | Plan 03 | Chart A: Entrate + Uscite bars only | ✓ SATISFIED | `EntrateUsciteChart` has only `totalIn`/`totalOut` bars |
| D-12 | Plan 03 | Chart B: per-month colored Bilancio bars | ✓ SATISFIED | `BilancioBarsChart` uses `<Cell>` with green/red per balance sign |

### Anti-Patterns Found

No blockers or warnings detected:

- No TODO/FIXME/PLACEHOLDER comments in modified files.
- No stub return patterns (`return null`, `return []`, `return {}`) that indicate hollow components — `deviation-badge.tsx`'s `return null` for `deviation === null` is intentional correct behavior per the spec.
- All monetary arithmetic in `dashboard.ts`, `dashboard.ts` (DAL), `bilancio-bars-chart.tsx` uses Decimal.js exclusively.
- No hardcoded empty data passed as props at call sites.

### Human Verification Required

#### 1. Sort toggle visual and URL behavior

**Test:** Run `yarn dev`, open `/dashboard/categories`, and observe the sort toggle.
**Expected:** "Deviazione" button is active by default. Clicking "Importo" adds `?sort=amount` to the URL while preserving other params. Categories reorder to amount-descending. Switching back removes `?sort=amount`.
**Why human:** Link-based URL routing and active-state rendering require a browser.

#### 2. DeviationBadge visibility on categories page

**Test:** Run `yarn dev`, open `/dashboard/categories` with real transaction data present.
**Expected:** Each category row shows a colored percentage badge (red for overspend/out, green for underspend/out, inverted for in). Categories with very small amounts (< €15 reference) show no badge. Categories with no prior history show "Nuovo".
**Why human:** Requires actual seeded/imported transaction data and a running DB connection.

#### 3. DeviationBadge on subcategory rows (category detail page)

**Test:** Run `yarn dev`, open `/dashboard/categories/[id]` for a category with subcategories.
**Expected:** Each subcategory row shows a deviation badge with correct color polarity based on category type.
**Why human:** Requires live data and browser rendering with the `categoryId` scoping of the deviation query.

#### 4. EntrateUsciteChart + BilancioBarsChart visual rendering

**Test:** Run `yarn dev`, open `/dashboard/overview`.
**Expected:** Two stacked chart sections visible: "Entrate e uscite per mese" (two grouped bars per month in teal/orange) above "Bilancio mensile" (per-month bars in green or red). No toggle buttons, no "Non categorizzato" or "Ignorato" series anywhere in the overview.
**Why human:** Recharts visual output and CSS variable resolution (`--total-in`, `--color-destructive`) require a browser.

### Gaps Summary

No automated gaps found. All 14 must-have truths are VERIFIED against the actual codebase. The 4 human verification items require a running dev server with real database data. These are standard visual/behavioral checks that cannot be validated programmatically given the chart rendering and live-data dependency.

---

_Verified: 2026-05-20T11:00:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 80-dashboard-accrual-lens
reviewed: 2026-07-29T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - app/(app)/dashboard/categories/[id]/page.tsx
  - app/(app)/dashboard/categories/page.tsx
  - app/(app)/dashboard/overview/page.tsx
  - app/(app)/dashboard/tags/page.tsx
  - components/dashboard/dashboard-tab-nav.tsx
  - components/dashboard/lens-persistence.ts
  - components/dashboard/lens-switch.tsx
  - components/dashboard/overview/overview-header.tsx
  - components/dashboard/overview/resolve-year.ts
  - lib/dal/dashboard-filters.ts
  - lib/dal/dashboard.ts
  - lib/dal/months-with-data.ts
  - lib/dal/overview.ts
  - lib/utils/search-params.ts
  - tests/amortization-lens-regression-overview.test.ts
  - tests/amortization-lens-regression.test.ts
  - tests/dashboard-filters.test.ts
  - tests/dashboard.spec.ts
  - tests/helpers/reimbursement-test-db.ts
  - tests/lens-persistence.test.ts
  - tests/months-with-data-dal.test.ts
  - tests/overview-dal.test.ts
  - tests/resolve-year.test.ts
  - tests/table-search-params.test.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 80: Code Review Report

**Reviewed:** 2026-07-29
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the ADR 0019 §10 dashboard cash/accrual lens seam: the `LedgerRowSource` plumbing in
`lib/dal/dashboard-filters.ts`, the lens-aware DAL functions in `lib/dal/dashboard.ts` /
`lib/dal/overview.ts` / `lib/dal/months-with-data.ts`, the `?lens=` URL param parsing, the
client-side `LensSwitch`/persistence layer, and the three dashboard pages that wire it together.

No instance of the ADR's explicit anti-pattern (calling `effectiveAmount()`/`isNotSecondary()` on a
ledger row) was found — every aggregation reads `ledgerRowSource.amount` directly and relies on the
view's own `WHERE NOT EXISTS` fragment, matching the locked architecture. The cash-lens default
path (`ledgerRowSource` omitted → `ledgerEntryCash`) is preserved everywhere.

However, two correctness gaps survive in the code that IS reviewed here, both traceable to the
lens param being threaded into a function's *signature* without being threaded into all of that
function's *internal query logic*:

1. `getOverview`'s year-to-date upper-bound query (`lib/dal/overview.ts`) still hardcodes
   `FROM transaction`, so under `competenza` the KPI totals silently truncate before any
   instalment-only month that falls after the year's last real transaction — even though the
   sibling `getOverviewChart`/`getMonthOverMonthCategoryChanges` calls on the very same page show
   that later month correctly. This is the one aggregation left un-migrated to the lens-aware
   pattern that Phase 80 documents everywhere else (`getYearsWithData`, `getMonthsWithData`).
2. The dashboard's category flow drops `?lens=` on same-tab navigation: the sort toggle
   (`categories/page.tsx`), the back link (`categories/[id]/page.tsx`), and the category-ranking
   row links all route through `buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref`
   (`lib/routes.ts`), which rebuild the query string from an explicit filter object that has no
   `lens` field — unlike `DashboardTabNav`/`DashboardFilters`, which clone `searchParams` and so
   preserve it. The lens silently reverts to Cassa on these clicks.

Both gaps are compounded by test blind spots noted below (WR-01, WR-02) that make it look like
this behavior is covered when it is not.

## Critical Issues

### CR-01: `getOverview`'s YTD-bound query ignores the lens, truncating competenza totals

**File:** `lib/dal/overview.ts:137-150`
**Issue:**
`getOverview(year, ledgerRowSource)` accepts a `ledgerRowSource` and threads it into
`getOverviewAmountTotals`/`getUncategorizedCount` (lines 152-157), but the query that determines
the YTD upper bound (`currentTo`/`previousTo`) is computed *before* that, from the `transaction`
table unconditionally:

```ts
const lastMonthResult = await db.execute(sql`
  SELECT MAX(TO_CHAR(occurred_at, 'YYYY-MM')) AS last_ym
  FROM transaction
  WHERE user_id = ${userId}
    AND TO_CHAR(occurred_at, 'YYYY') = ${String(year)}
`)
```

Under `competenza`, an amortization plan's later instalments can legitimately fall in months after
the last *real* `transaction` row of the year (this is exactly what
`tests/amortization-lens-regression-overview.test.ts` proves for `getOverviewChart` — a 3-month
plan whose 3rd instalment always lands in a future month). Because `lastMonthResult` only looks at
`transaction`, `lastMonthIdx` — and therefore `currentTo`/`previousTo`, which bound the actual sums
passed to `getOverviewAmountTotals` — stops at the last cash-transaction month and silently
excludes any later instalment-only month within the same year. The KPI cards (totalIn/totalOut/
balance/savingsRate/uncategorizedCount) then under-report relative to the bar chart and movers
panel on the very same page, which read the unbounded/lens-aware `getOverviewChart` and
`getMonthOverMonthCategoryChanges`. This also directly violates the invariant the page's own
comment claims: "the SAME resolved ledgerRowSource threads into every widget on this page ... never
re-derived per call site (T-80-08)" — `getOverview` re-derives its bound from a lens-blind source.

**Fix:** make the bound query lens-aware, mirroring the pattern already used in
`lib/dal/months-with-data.ts` / `getYearsWithData`:

```ts
const lastMonthResult =
  ledgerRowSource === ledgerEntryAccrual
    ? await db.execute(sql`
        SELECT MAX(TO_CHAR(occurred_at, 'YYYY-MM')) AS last_ym
        FROM (
          SELECT occurred_at FROM transaction WHERE user_id = ${userId}
          UNION ALL
          SELECT occurred_at FROM amortization_instalment WHERE user_id = ${userId}
        ) combined
        WHERE TO_CHAR(occurred_at, 'YYYY') = ${String(year)}
      `)
    : await db.execute(sql`
        SELECT MAX(TO_CHAR(occurred_at, 'YYYY-MM')) AS last_ym
        FROM transaction
        WHERE user_id = ${userId}
          AND TO_CHAR(occurred_at, 'YYYY') = ${String(year)}
      `)
```

(Import `ledgerEntryAccrual` from `@/lib/db/schema`, or compare by lens value passed down instead of
by reference, whichever matches the module's existing style.)

### CR-02: `?lens=` is dropped on same-tab category navigation, silently reverting to Cassa

**File:** `app/(app)/dashboard/categories/page.tsx:66-101` (SortToggle), `app/(app)/dashboard/categories/[id]/page.tsx:151-155` (backHref), and `lib/routes.ts:34-53,97-119` (`buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref`)
**Issue:**
`SortToggle` in `categories/page.tsx` builds its two links purely from `filters` (preset/type/sort)
— it is never even passed `lens` as a prop:

```ts
function SortToggle({ filters }: { filters: CategoryDashboardFilters }) {
  ...
  const href = buildDashboardCategoriesHref({
    preset: filters.preset,
    type: filters.type,
    sort: option.value,
    defaultPreset: CATEGORIES_DEFAULT_PRESET,
    defaultSort: CATEGORIES_DEFAULT_SORT,
  })
```

Likewise `categories/[id]/page.tsx`'s `backHref`:

```ts
const backHref = buildDashboardCategoriesHref({
  preset: filters.preset,
  type: filters.type,
  defaultPreset: CATEGORY_DETAIL_DEFAULT_PRESET,
})
```

And `components/dashboard/category-ranking-list.tsx`'s per-row links:

```ts
const href = buildDashboardCategoryDetailHref(category.id, { preset, type, defaultPreset })
```

`buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref` (`lib/routes.ts`) construct a
*brand-new* `URLSearchParams` from the filter object passed in — they never read the incoming
`lens` at all, unlike `DashboardTabNav.buildDashboardTabHref` (which explicitly forwards `lens`,
per its own test) and `DashboardFilters` (which clones `searchParams.toString()`, preserving
whatever is already in the URL). The net effect: a user who flips to Competenza on
`/dashboard/categories?lens=competenza`, then clicks "Importo"/"Deviazione" to re-sort, or clicks
into a category, or clicks "← Torna alle categorie", lands on a URL with no `?lens=` — which
`parseLensParam` correctly (but unhelpfully) defaults to `'cassa'`. The lens silently resets
mid-session, contradicting D-01/D-05's global-lens intent and the sessionStorage restore layer
(which only fires on a *bare* mount with no `?lens` in the URL at all — these clicks aren't bare
mounts, they're normal link navigations that always carry an explicit, wrong `lens`-less URL).

**Fix:** thread `lens` through the same way `preset`/`type`/`sort` already are — either add a
`lens` field to `DashboardCategoryFilters` in `lib/routes.ts` and set it whenever non-default, or
(simpler, matching `DashboardFilters`'s own pattern) have these three call sites clone
`searchParams` and only overwrite the keys they actually change:

```ts
// SortToggle / backHref / CategoryRankingList — merge with current lens instead of rebuilding from scratch
const params = new URLSearchParams()
if (filters.preset !== CATEGORIES_DEFAULT_PRESET) params.set('preset', filters.preset)
if (filters.type === 'in') params.set('type', filters.type)
if (option.value !== CATEGORIES_DEFAULT_SORT) params.set('sort', option.value)
if (lens === 'competenza') params.set('lens', lens)
```

## Warnings

### WR-01: `getOverview`'s lens/ledgerRowSource parameter has zero test coverage

**File:** `tests/overview-dal.test.ts:130-176`
**Issue:** Every test in the `describe('getOverview', ...)` block calls `getOverview(2026)` with no
second argument, so the newly added `ledgerRowSource` parameter (and, critically, the lens-blind
`lastMonthResult` bound query flagged in CR-01) is never exercised — not with a mock, not with the
real-Postgres harness. `tests/amortization-lens-regression-overview.test.ts` covers
`getOverviewChart`/`getMonthOverMonthCategoryChanges` for the same "future instalment month" case
but never calls `overview.ts`'s `getOverview`, so the exact scenario that trips CR-01 (a plan
started mid-year whose instalments spill past the year's last real transaction) is untested for
the KPI-totals code path.
**Fix:** add a real-Postgres regression case mirroring
`amortization-lens-regression-overview.test.ts`'s fixture, asserting `getOverview(year,
ledgerEntryAccrual).totalOut` includes the later instalment month's amount.

### WR-02: The e2e lens-persistence test cannot detect CR-02's regression

**File:** `tests/dashboard.spec.ts:204-230`
**Issue:** `'LENS switch renders and is functional on /dashboard/categories and
/dashboard/categories/[id]'` clicks "Competenza" on `/dashboard/categories`, asserts the URL, then
navigates to the category-detail page and — instead of first asserting the URL already carries
`?lens=competenza` after that navigation — immediately re-locates and re-clicks the "Competenza"
button and re-asserts. Clicking the button always sets `?lens=competenza` regardless of what the
URL was immediately after navigation, so this test would pass identically whether or not the
category-detail link preserved the lens param — it cannot fail on CR-02.
**Fix:** insert an assertion between the navigation and the re-click, e.g.
`await expect(page).toHaveURL(/\?.*lens=competenza/)` immediately after `firstCategoryLink.click()`
(and again after any SortToggle click), before touching the button again.

### WR-03: Unused `drizzle-orm` imports in two DAL modules

**File:** `lib/dal/dashboard.ts:4-15`, `lib/dal/overview.ts:3`
**Issue:** Both files import `gte`, `inArray`, and `lte` from `drizzle-orm`, but neither file calls
any of the three directly — date-scoping and status-filtering now live exclusively in the shared
`dateScopedTransactions`/`expenseStatusIncludedInDashboardTotals` helpers
(`lib/dal/dashboard-filters.ts`), which the callers import instead. These three names are dead
imports left over from the Phase 77 extraction.
**Fix:**
```ts
// lib/dal/dashboard.ts
import { and, countDistinct, desc, eq, isNull, ne, or, sql } from 'drizzle-orm'
// lib/dal/overview.ts
import { and, eq, sql } from 'drizzle-orm'
```

## Info

### IN-01: `getMonthlyTrendByNature` has no live UI caller

**File:** `lib/dal/dashboard.ts:1466-1525`
**Issue:** `getMonthlyTrendByNature` was updated to accept `ledgerRowSource` for this phase, but a
repo-wide search shows its only callers are the regression-test harness
(`tests/helpers/reimbursement-test-db.ts`) and the phase's own regression tests — no page or
component under `app/`/`components/` imports it. It may be intentionally suite-only (kept alive to
protect a shared aggregation pattern), but if there is no near-term plan to surface it in the UI,
worth a one-line comment saying so to avoid a future "is this dead code?" investigation.
**Fix:** either wire it into a chart component or add a short comment noting it's a
regression-suite-only surface.

### IN-02: Two DAL modules export a same-named `getOverview` with incompatible signatures

**File:** `lib/dal/dashboard.ts:958` vs `lib/dal/overview.ts:129`
**Issue:** `lib/dal/dashboard.ts` exports `getOverview(preset: DashboardPreset)` (no lens support,
confirmed unused by any page after `/dashboard` now redirects to `/dashboard/overview`) while
`lib/dal/overview.ts` exports a different `getOverview(year: number, ledgerRowSource?)` that IS the
one every dashboard page uses. Same export name, incompatible signature, different modules — an
easy `import { getOverview } from '@/lib/dal/dashboard'` typo/autocomplete slip in future work would
silently compile (both are exported async functions) but call the wrong, lens-blind implementation.
**Fix:** rename the legacy `dashboard.ts` export (e.g. `getOverviewForPreset`) or remove it if truly
dead, to eliminate the name collision.

---

_Reviewed: 2026-07-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

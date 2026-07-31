---
phase: 83-categories-list
reviewed: 2026-07-31T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - app/(app)/dashboard/categories/[id]/page.tsx
  - app/(app)/dashboard/categories/page.tsx
  - components/dashboard/category-coverage-nudge.tsx
  - components/dashboard/category-list-controls.tsx
  - components/dashboard/category-ranking-list.tsx
  - components/dashboard/category-sparkline.tsx
  - components/dashboard/category-year-ranking-skeleton.tsx
  - components/dashboard/category-year-select.tsx
  - components/dashboard/dashboard-tab-nav.tsx
  - lib/dal/dashboard.ts
  - lib/routes.ts
  - lib/services/category-direction-copy.ts
  - lib/validations/dashboard.ts
  - tests/categories-list-component.test.tsx
  - tests/categories-nudge.test.tsx
  - tests/categories-ranking-dal.test.ts
  - tests/category-allocation-negative-domain.test.tsx
  - tests/category-detail-link.test.ts
  - tests/category-direction-copy.test.ts
  - tests/category-ranking-list.test.tsx
  - tests/category-sparkline.test.tsx
  - tests/dashboard-filters.test.ts
  - tests/dashboard-year-contract.test.ts
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
status: issues_found
---

# Phase 83: Code Review Report

**Reviewed:** 2026-07-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

This is a re-review overwriting `83-REVIEW.md`. The three findings from the first review cycle
(CR-01 sign-erasing `abs()` on the allocation direction, WR-02 sparkline estimated-bar collapsing
to 0% height, WR-01 preset-mode href builders dropping `type: 'allocation'`) were verified against
the current code and are all genuinely fixed:

- `getCategoryYearRanking` (`lib/dal/dashboard.ts:1340-1343`) now branches the SQL amount
  expression on `directionCode === 'allocation'` and keeps the raw signed `sum(...)` for that
  direction, confirmed end-to-end by `tests/categories-ranking-dal.test.ts`'s
  "preserves the signed monthly sum..." case and `tests/category-allocation-negative-domain.test.tsx`'s
  real-Postgres → DAL → rendered-markup tracer (asserts the border marker fires exactly once, on
  the real negative month, never on the zero or positive months).
- `CategorySparkline`'s `resolveEstimatedReference` (`components/dashboard/category-sparkline.tsx:77-93`)
  now falls back to the series' own observed magnitude, then to a fixed positive constant, when
  `estimatedHeightHint` is null — confirmed by `tests/category-sparkline.test.tsx`'s "estimated bars
  never collapse to a flat 0% height..." case (11/11 estimated bars assert `height:100%`).
- `buildYearModeSearch`/`buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref`'s
  preset-mode branch (`lib/routes.ts:83-89`, `:163-169`) now mirrors the year-mode
  `filters.type && filters.type !== 'out'` check, confirmed by two new cases in
  `tests/dashboard-filters.test.ts` ("preserves allocation type for list/detail hrefs in preset
  mode (WR-01)").

Fresh review of the rest of the phase surfaced one new correctness bug that the previous review
cycle did not catch: clicking through an `allocation` ("Accantonamenti") row — reachable for the
first time this phase (CLIST-04) — lands on a category detail page that was never updated to
understand that direction, silently mis-filtering the data and mis-routing the back link. One
further logic gap (a sort-toggle active-state desync after a year change) and three Info-level
items (two carried forward, unfixed, from the previous cycle; one new) round out the findings.

## Critical Issues

### CR-01: Clicking an `allocation` ("Accantonamenti") category row leads to a detail page that silently coerces the direction to `out`, showing empty data and a wrong back link

**File:** `app/(app)/dashboard/categories/[id]/page.tsx:22-30, 58-69, 163`; also
`components/dashboard/category-ranking-list.tsx:82`; `lib/validations/dashboard.ts:5`

**Issue:**

Phase 83 makes `allocation` a fully clickable, first-class direction in the Categories list —
`DirectionFilter` renders it as one of three always-enabled links (`category-list-controls.tsx:17-21`),
and `CategoryRankingList` builds a `Link` to the detail page for **every** row regardless of
direction:

```ts
const href = buildDashboardCategoryDetailHref(category.id, { year, type: direction, lens })
```

So a real user with allocation ("Accantonamenti") transactions will, for the first time this
phase, be able to click into one. The URL correctly carries `?year=...&type=allocation` (proven by
`tests/category-detail-link.test.ts`'s href round-trip). But the detail page
(`app/(app)/dashboard/categories/[id]/page.tsx`) was not updated to understand this value:

```ts
const categoryTypeOptions = [
  { value: 'out' as const, label: 'Uscite' },
  { value: 'in' as const, label: 'Entrate' },
]

type CategoryDetailFilters = ParsedDashboardFilters & {
  preset: typeof CATEGORY_DETAIL_DEFAULT_PRESET | ParsedDashboardFilters['preset']
  type: 'in' | 'out'
}

function parseCategoryDetailFilters(params): CategoryDetailFilters {
  const filters = parseDashboardFilters(params, { defaultPreset: CATEGORY_DETAIL_DEFAULT_PRESET })
  return { ...filters, type: filters.type === 'in' ? 'in' : 'out' }
}
```

`parseDashboardFilters` itself validates against `DashboardTypeSchema = z.enum(['out', 'in', 'all'])`
(`lib/validations/dashboard.ts:5`), which has no `'allocation'` member, so the incoming
`?type=allocation` fails validation and `filters.type` silently becomes `'out'`. Three concrete,
observable consequences follow:

1. **Data disappears.** `getCategoryDetail`'s trend/subcategory/top-transaction queries filter on
   `eq(direction.includedInTotals, true)` (`lib/dal/dashboard.ts:1626`, `:1670`, `:1728`), which the
   `allocation` direction never satisfies (seeded `includedInTotals: false`). The category itself
   resolves (`categoryRows` matches by id only), so `data.category !== null` and the page does
   **not** redirect back to the list — instead it renders the real category name with a
   permanently empty trend chart, zero total, zero movements and zero subcategories, with no
   explanation to the user that anything is direction-scoped. A user who just saw a non-zero
   "Accantonamenti" total on the list page will see it vanish on the very next click.
2. **The filter toggle lies.** `categoryTypeOptions` only offers Uscite/Entrate; with `filters.type`
   coerced to `'out'`, the toolbar renders "Uscite" as the active selection even though the user
   arrived via the Accantonamenti filter.
3. **The back link changes direction.** `const backHref = buildDashboardCategoriesHref({ year, type: filters.type, lens })` (line 163) uses the same coerced `filters.type`, so "← Torna alle
   categorie" returns the user to the **Uscite** list, not the Accantonamenti list they came from —
   silently switching the user's active filter as a side effect of a detail-page visit.

This is a direct, provable regression introduced by this phase's own new code (making `allocation`
rows clickable) interacting with an unmodified consumer (the Phase-82-era detail page). It is not
covered by any existing test — `tests/category-detail-link.test.ts` only proves the *href* carries
`type=allocation` correctly; nothing proves what the detail page does when it receives that value.

**Fix:** Pick one of:
- Disable/guard the row `Link` for `direction === 'allocation'` until the Phase 84 detail-page work
  lands (e.g. render a non-interactive row or a "dettaglio in arrivo" affordance instead of a
  `Link`), so no URL that the detail page cannot handle is ever produced; or
- Widen `CategoryDetailFilters['type']` and `categoryTypeOptions` to accept `'allocation'`, and
  update `getCategoryDetail`'s direction predicate (or add a dedicated allocation-aware query path)
  so real data renders. At minimum, whichever approach is deferred, stop coercing `filters.type`
  before it reaches `backHref` — the back link should preserve whatever direction actually brought
  the user here, independent of whether the trend/subcategory data itself is shown.

Either way, add a test that asserts what currently has zero coverage: what `parseCategoryDetailFilters`/`backHref` produce for an incoming `?type=allocation`.

## Warnings

### WR-01: `SortToggle`'s active-state indicator can desync from the actual `sort` query value after switching year via `CategoryYearSelect`

**File:** `components/dashboard/category-year-select.tsx:23-27`; `components/dashboard/category-list-controls.tsx:85-124`

**Issue:** `CategoryYearSelect.update()` only ever sets `year` on the existing search params and
leaves every other param (`sort`, `type`) untouched:

```ts
function update(next: string) {
  const params = new URLSearchParams(searchParams.toString())
  params.set('year', next)
  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
}
```

If a user selects `sort=projection` while viewing a year with `projectionSortAvailable === true`,
then switches to a different year via this selector where the new year's pace-eligible Covered
Month count drops below `MIN_COVERED_MONTHS_FOR_PACE`, the URL still carries `?sort=projection`,
but `SortToggle` now renders "Proiezione" as the disabled `<span>` branch
(`category-list-controls.tsx:90-101`) — which carries no active/pressed indication at all — while
"Totale" renders as an enabled `Link` with `isActive = sort === 'amount'` evaluating to `false`
(since `sort` is still `'projection'` in the URL). The net effect: neither toolbar option shows as
selected, even though a sort mode is actively applied. (The displayed row order is not affected in
practice, because `compareByProjection` falls back to each row's own `amount` when `projection` is
null — but the UI's own state indicator is wrong.)

**Fix:** Either have `CategoryYearSelect.update()` strip an incompatible `sort=projection` param
when it can determine the new year is pace-ineligible (requires passing `projectionSortAvailable`
context down, or recomputing it client-side), or have the page-level `parseCategoryYearSort` clamp
`sort` back to `'amount'` server-side whenever `projectionSortAvailable` is false, so the URL and
the rendered toolbar state can never disagree.

## Info

### IN-01: `formatAmount`/`amountFormatter` still duplicated instead of reusing the shared cached formatter (carried forward, unfixed)

**File:** `components/dashboard/category-ranking-list.tsx:34-42`
**Issue:** Unchanged since the previous review cycle: this component still defines its own
module-level `Intl.NumberFormat` and `formatAmount` wrapper instead of importing the shared,
cached formatter from `lib/utils/format-amount.ts`, which exists precisely to avoid this
duplication (already repeated in `components/dashboard/tag-ranking-list.tsx`).
**Fix:** Import and reuse `lib/utils/format-amount.ts`'s exported helper instead of redeclaring
`amountFormatter`/`formatAmount` locally.

### IN-02: `?year=0` (or a negative year) still isn't treated as garbage input on the detail page's back-link builder (carried forward, unfixed)

**File:** `app/(app)/dashboard/categories/[id]/page.tsx:159-161`
**Issue:** Unchanged since the previous review cycle:

```ts
const rawYear = Array.isArray(query.year) ? query.year[0] : query.year
const requestedYear = rawYear ? Number(rawYear) : undefined
const year = Number.isFinite(requestedYear) ? requestedYear : undefined
```

The adjacent comment states garbage input like `?year=abc` "degrades to `undefined`", but
`rawYear ? ... : undefined` only treats the empty string as falsy — the string `"0"` (from
`?year=0`) is truthy in JS, so `Number("0") = 0` passes `Number.isFinite` and `year` ends up `0`
(same for `?year=-5`). This produces a back-link of `/dashboard/categories?year=0`, which
`resolveYear` on the list page will never match against `years`, silently falling back there
instead — a confusing, if harmless, round trip that contradicts the comment's own documented
contract.
**Fix:** Guard explicitly, e.g. `const requestedYear = rawYear !== undefined ? Number(rawYear) : undefined` plus a sanity bound (`requestedYear > 0`).

### IN-03: `buildCategoryYearRankingData` reads wall-clock time internally instead of accepting an injectable `today`, unlike its sibling `isPartialMonth`

**File:** `lib/dal/dashboard.ts:814`
**Issue:** `isPartialMonth` (`lib/services/pace-and-projection.ts:83`) is explicitly designed as
`isPartialMonth(yearMonth, today = new Date())` so callers/tests can inject a fixed date. Its
caller here, `buildCategoryYearRankingData`, does the opposite — it calls `const today = new
Date()` internally with no way for a caller to override it, even though the function is exported
specifically to be independently unit-tested. Every month-state boundary case
(current/estimated/covered/uncovered) in this function is therefore implicitly coupled to the
real system clock; the current real-Postgres test suite works around this by asserting
`currentMonthIndex >= 3` against the actual date rather than being able to pin an arbitrary date
(see `tests/categories-ranking-dal.test.ts`'s "classifies the current calendar month..." test,
which depends on "this environment's fixed date is 2026-07-31").
**Fix:** Accept an optional `today` parameter on `buildCategoryYearRankingData` (defaulting to
`new Date()`) and thread it through to every `isPartialMonth`/future-month comparison, mirroring
the pattern already established one layer down.

---

_Reviewed: 2026-07-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

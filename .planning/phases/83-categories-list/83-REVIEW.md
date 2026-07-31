---
phase: 83-categories-list
reviewed: 2026-07-31T00:00:00Z
depth: standard
files_reviewed: 21
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
  - tests/category-detail-link.test.ts
  - tests/category-direction-copy.test.ts
  - tests/category-ranking-list.test.tsx
  - tests/category-sparkline.test.tsx
  - tests/dashboard-filters.test.ts
  - tests/dashboard-year-contract.test.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 83: Code Review Report

**Reviewed:** 2026-07-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

The Categories list (year-axis rewrite) is well-factored: money math correctly routes through
Decimal.js everywhere it re-enters aggregation or comparison (`compareByProjection`,
`buildCategoryYearRankingData`, `computePaceAndProjection`, `buildYearSeries`), the new
`getCategoryYearRanking` DAL function is properly scoped to the authenticated session via
`verifySession()` with parameterized Drizzle predicates, and the D-07 "total = exact sum of the
displayed sparkline" invariant is enforced structurally (`buildYearSeries` reduces the same array
it returns) and proven by a real-Postgres regression test. The "no projection node when null"
contract (D-15) is also implemented correctly — the 5th grid column is conditionally omitted, never
an em-dash/placeholder.

One genuine correctness bug was found: the DAL's `abs(sum(...))` for the new `allocation`
direction silently discards the sign the sparkline's own "negative-domain backstop" (D-09) was
built and unit-tested to display, so that documented feature can never actually fire with real
data. Two further defects were found in supporting code (a route-builder branch that drops the new
`allocation` type value, and a sparkline height calculation that collapses to a flat 0% bar for
future months whenever a category's projection is null) — both real bugs, though narrower in
blast radius. Two minor Info-level notes round out the findings.

## Critical Issues

### CR-01: `allocation` direction's DB-level `abs(sum(...))` erases the sign the sparkline's D-09 negative-domain feature depends on — the feature can never fire with real data

**File:** `lib/dal/dashboard.ts:1347` (`getCategoryYearRanking`'s row query), consumed by
`buildCategoryYearRankingData` (same file, ~L864-892) and rendered by
`components/dashboard/category-sparkline.tsx:114-128`

**Issue:**

`getCategoryYearRanking`'s per-(category, month) amount is computed as:

```ts
amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
```

`abs()` is applied to the **already-summed** monthly total, so any sign information for that
month is destroyed before it ever leaves SQL. `buildCategoryYearRankingData` then copies this
already-non-negative string straight into `sparkline[i].amount` with no further sign handling
(`bucket.amount = amount`, or `bucket.amount = toDecimal(bucket.amount).plus(amount).toFixed(2)` on
merge — both operate on an already-non-negative value).

This matters specifically for Phase 83's new `allocation` direction. `category-sparkline.tsx`
carries an entire feature explicitly built for this:

```ts
// D-09: the allocation direction admits net-divestment months (negative amounts) — the
// clamp that used to flatten them to zero is removed. ...
...
const isNegative = (state === 'covered' || state === 'current') && rawAmount < 0
```

`tests/category-sparkline.test.tsx` even asserts this marker renders when a negative amount is
passed as a prop. But that test feeds the component a synthetic `'-45.50'` directly — it never
goes through `getCategoryYearRanking`. With real data, `rawAmount` (`parseAmount(point.amount)`)
can **never** be negative, because the DAL already collapsed the sign via `abs(sum(...))` before
the value reached the component. A net-divestment month for an `allocation` category (net
withdrawal from savings/investment exceeding that month's deposits) will render identically to an
equal-magnitude net-deposit month — the border marker this code was written to show never appears
for a real user. This directly contradicts the UI-SPEC decision this code cites (D-09) and
silently misrepresents a user's savings/investment activity for the one direction this phase newly
exposes.

**Fix:** Stop discarding the sign in the DAL for the `allocation` direction. Either:
- drop the `abs()` from `getCategoryYearRanking`'s query entirely (it is a NEW function — nothing
  else depends on its `abs()`ed value the way `getCategoryRanking`'s pre-existing callers might),
  and apply `.abs()` explicitly (via `toDecimal(...).abs()`) only where a non-negative value is
  actually required — the row's own "Totale" (`item.amount`) and the percentage-bar computation —
  while leaving the per-month sparkline points signed; or
- keep `abs()` for `in`/`out` (where it is a no-op given those directions' already-uniform sign)
  but branch the SQL expression on `directionCode === 'allocation'` to select the raw signed
  `sum(...)` instead.

Either way, add a real-Postgres regression test (mirroring
`tests/categories-ranking-dal.test.ts`'s existing style) that seeds an `allocation` category with a
net-negative month and asserts `sparkline[i].amount` is negative for that month — the current test
suite has no such case and would not have caught this.

## Warnings

### WR-01: `buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref`'s preset-mode branch silently drops `type: 'allocation'`

**File:** `lib/routes.ts:87-89` and `lib/routes.ts:167-169`

**Issue:** `DashboardCategoryFilters.type` was widened this phase to `'in' | 'out' | 'allocation'`
(to support CLIST-04's new direction), and the year-mode branch (`buildYearModeSearch`) was
updated correctly to emit any non-default type:

```ts
if (filters.type && filters.type !== 'out') {
  params.set('type', filters.type)
}
```

but the **preset-mode** branch in both `buildDashboardCategoriesHref` and
`buildDashboardCategoryDetailHref` was left unchanged and only special-cases `'in'`:

```ts
if (filters.type === 'in') {
  params.set('type', filters.type)
}
```

Calling either function with `{ type: 'allocation' }` and no `year` (a structurally valid call per
the widened type — the compiler will not catch this) silently omits `?type=allocation` from the
emitted href, producing a URL that resolves back to `'out'` instead. Every call site added in this
phase happens to always pass `year` (so it takes the correct `buildYearModeSearch` path), so this
is not reachable today — but it is a real latent defect in shared routing code, directly caused by
this phase's type widening, with zero test coverage of the `allocation` case in preset mode
(`tests/dashboard-filters.test.ts` never exercises it).

**Fix:** Mirror the year-mode check for consistency and correctness:

```ts
if (filters.type && filters.type !== 'out') {
  params.set('type', filters.type)
}
```

(Verify this doesn't change existing preset-mode behavior for `'in'`, which it shouldn't — `'in'`
already only differs from the previous default `'out'`.)

### WR-02: `CategorySparkline`'s 'estimated' bars collapse to a flat 0%-height bar when `estimatedHeightHint` is null, contradicting the function's own documented contract

**File:** `components/dashboard/category-sparkline.tsx:100-104` (reference-magnitude computation)
and `:65` (`resolveBarFillStyle`'s doc comment)

**Issue:** `resolveBarFillStyle`'s header comment states the invariant this code is supposed to
guarantee:

> `'estimated' and 'uncovered' never render a flat/zero-height bar: 'estimated' is normalized like
> any other bar ...`

But the reference magnitude used to normalize an `'estimated'` bar's height is:

```ts
const reference = state === 'estimated' ? Number(estimatedHeightHint ?? '0') : parseAmount(point.amount)
```

`estimatedHeightHint` is `category.pace`, typed `string | null`
(`CategoryYearRankingItem.pace`). It is `null` whenever `computePaceAndProjection` returns
`'insufficient'` — i.e. whenever the year has fewer than `MIN_COVERED_MONTHS_FOR_PACE` (2)
pace-eligible Covered Months. This is an entirely realistic, first-class scenario the DAL itself
handles explicitly (see `tests/categories-ranking-dal.test.ts`'s "leaves projection/pace both null
with exactly 1 Covered Month" case) — e.g. a user who imported only January's statement, viewing
the current year in, say, April: January is `covered`, Feb/Mar `uncovered`, April `current`, and
May–December are all `estimated` with `pace === null`.

In that scenario, `Number(null ?? '0')` evaluates to `0` for every `estimated` point, so
`referenceMagnitudes[index] = 0` for all of them. Unless every other (covered/current) month also
happens to be zero, `heightPercent = (0 / max) * 100 = 0` for every estimated bar — a literal flat,
zero-height bar, exactly the outcome the function's own comment says must never happen. The
striped `backgroundImage` is still set, but at 0% height it has no visible area, so a future month
with insufficient-pace data renders indistinguishable from "nothing here" instead of the intended
muted/striped placeholder.

**Fix:** Fall back to a non-degenerate reference when the hint is unavailable, e.g. reuse the
series' own observed max magnitude instead of `0`:

```ts
const fallbackReference = Math.max(
  0,
  ...points.map((p) => Math.abs(parseAmount(p.amount)))
)
const reference =
  state === 'estimated'
    ? (estimatedHeightHint != null ? Number(estimatedHeightHint) : fallbackReference)
    : parseAmount(point.amount)
```

or equivalent — the exact fallback value is a design call, but `0` is provably wrong given the
function's own stated contract.

## Info

### IN-01: `formatAmount`/`amountFormatter` duplicated instead of reusing the shared cached formatter

**File:** `components/dashboard/category-ranking-list.tsx:34-42`
**Issue:** This component defines its own module-level `Intl.NumberFormat` and a `formatAmount`
wrapper, byte-for-byte the same pattern already duplicated in
`components/dashboard/tag-ranking-list.tsx`, instead of using the shared, cached formatter in
`lib/utils/format-amount.ts` (which exists precisely to avoid re-constructing
`Intl.NumberFormat` instances per module and to centralize the "display-only, never re-enters
persistence" contract documented there). This is a pre-existing pattern this phase propagated
rather than introduced, but it's worth flagging since it's new code in this diff.
**Fix:** Import and reuse `lib/utils/format-amount.ts`'s exported formatter helper instead of
redeclaring `amountFormatter`/`formatAmount` locally.

### IN-02: `?year=0` (or a negative year) is treated as a valid year instead of degrading like other garbage input

**File:** `app/(app)/dashboard/categories/[id]/page.tsx:159-161`
**Issue:**

```ts
const rawYear = Array.isArray(query.year) ? query.year[0] : query.year
const requestedYear = rawYear ? Number(rawYear) : undefined
const year = Number.isFinite(requestedYear) ? requestedYear : undefined
```

The comment directly above this code states: "Garbage input (e.g. `?year=abc`) degrades to
`undefined`, falling through to the year-mode-skipped, preset-based backHref branch below." That
holds for non-numeric input, but `rawYear ? ... : undefined` only treats an **empty string** as
falsy — the string `"0"` (from `?year=0`) is truthy in JS, so `Number("0") = 0` passes
`Number.isFinite` and `year` ends up `0`. The same holds for `?year=-5`. This produces a
back-link of `/dashboard/categories?year=0`, which is not "garbage degrading to undefined" as the
comment promises, and downstream (`resolveYear` on the list page) `0` will never match `years`, so
it silently falls back there instead — a confusing, if harmless, round trip.
**Fix:** Guard explicitly, e.g. `const requestedYear = rawYear !== undefined ? Number(rawYear) : undefined` combined with a sanity bound (`requestedYear > 0`), so the passthrough behavior matches its own documented contract.

---

_Reviewed: 2026-07-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

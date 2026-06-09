---
phase: 45-overview-movers
reviewed: 2026-06-09T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - app/(app)/dashboard/overview/page.tsx
  - components/dashboard/overview/overview-chart.tsx
  - components/dashboard/overview/overview-movers-format.ts
  - components/dashboard/overview/overview-movers-panel.tsx
  - components/dashboard/overview/overview-movers-section.tsx
  - lib/actions/overview.ts
  - tests/overview-movers.test.tsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Seven files reviewed covering the overview movers feature: page server component, chart client component, movers format utilities, panel and section client components, server action, and unit tests. The architecture is sound — single shared-state parent, useTransition for non-blocking fetch, server-side pre-fetch of the default month. Most issues are in the DAL layer and a test coverage gap.

One critical bug: the `isNew` detection in `getMonthOverMonthCategoryChanges` uses a fragile string equality check that can fail silently when the database returns a different string representation for zero (e.g. `"0"` instead of `"0.00"`). Three warnings: stale movers data on fetch error, an unused prop passing dead weight through the component tree, and an orphaned JSDoc block in the formatting module. Three info items: the `void userId` idiom, a missing test for `formatMoverAmount`, and a SQL schema assumption in the DAL query.

---

## Critical Issues

### CR-01: `isNew` detection uses fragile string equality against a hard-coded constant

**File:** `lib/dal/overview.ts:258`

**Issue:** The `isNew` flag is computed as:

```ts
const isNew = prevAmount === ZERO_AMOUNT && toDecimal(curr.amount).gt(0)
```

`ZERO_AMOUNT` is `'0.00'`. `prevAmount` is either the value returned by `String(r.amount)` from the Drizzle row (which comes from `coalesce(abs(sum(...)), 0)::text`) or the fallback `?? ZERO_AMOUNT` when the category is absent from the prev map.

The `?? ZERO_AMOUNT` path is safe. The problem is the database path. `coalesce(..., 0)::text` in PostgreSQL casts the integer `0` to the text `"0"`, not `"0.00"`. If a category row existed last month but all its transactions were filtered out by `expenseStatusIncludedInDashboardTotals()` or `notExcludedFromTotals()`, it will appear in `prevRows` with an `amount` of `"0"`. After `String(r.amount)` that becomes `"0"`, not `"0.00"`. The `=== ZERO_AMOUNT` check then evaluates to `false`, so the category is silently treated as an existing (not new) spend even though there was genuinely zero previous activity. The movers panel will display these entries without the "spesa nuova" label when they should be flagged as new.

Additionally the delta for the `prevMap` miss path (`?? ZERO_AMOUNT`) is correct only because the DAL already filters out categories not in `currRows` using `eq(category.type, 'out')` — but when a category _does_ appear in prevRows with a `"0"` amount string the inequality causes wrong `isNew` classification.

**Fix:** Compare numerically with Decimal rather than using string equality:

```ts
const isNew = toDecimal(prevAmount).isZero() && toDecimal(curr.amount).gt(0)
```

This is safe regardless of whether `prevAmount` is `"0"`, `"0.00"`, `"0.0"`, or the fallback constant.

---

## Warnings

### WR-01: Stale movers displayed silently on `fetchMovers` error

**File:** `components/dashboard/overview/overview-movers-section.tsx:33`

**Issue:** When `fetchMovers` returns `{ error: non-null, movers: [] }`, the section silently keeps the previously displayed movers unchanged:

```ts
if (!result.error) {
  setMovers(result.movers)
}
```

The user has clicked a different month bar and now sees the highlight for month N but movers data from month N-1 (or whatever was pre-fetched). This is a silent data inconsistency: the panel heading says "Spese di [new month]" but the rows reflect the old month's categories. There is no indication to the user that the fetch failed and no recovery path.

**Fix:** On error, either reset movers to an empty array (triggering the empty-state message) or surface an inline error. The simplest correct fix:

```ts
startTransition(async () => {
  const result = await fetchMovers(year, monthIndex)
  if (result.error) {
    setMovers([])   // show empty-state rather than stale data
  } else {
    setMovers(result.movers)
  }
})
```

If an explicit error message is preferred, add a separate `error` state and render it in the panel.

---

### WR-02: `data: OverviewChartPoint[]` prop accepted but never used in `OverviewMoversPanel`

**File:** `components/dashboard/overview/overview-movers-panel.tsx:28`

**Issue:** The `Props` type declares `data: OverviewChartPoint[]` and the component signature destructures it as an implicit parameter (it is listed in `Props` at line 28 but not destructured in the function signature at line 38 — the call site in `overview-movers-section.tsx:51` passes it). The import `type { OverviewChartPoint }` at line 4 exists solely because of this prop. The prop is passed from `OverviewMoversSection` but never read inside `OverviewMoversPanel`. This creates dead weight and misleads readers into expecting it to influence rendering.

**Fix:** Remove the `data` field from `Props` and drop the corresponding `data={data}` at the `OverviewMoversPanel` call site in `overview-movers-section.tsx:51`. Also remove the now-unused `OverviewChartPoint` import from `overview-movers-panel.tsx`.

---

### WR-03: Orphaned JSDoc block mis-attached to the wrong function

**File:** `components/dashboard/overview/overview-movers-format.ts:31–38`

**Issue:** Lines 31–38 contain the JSDoc for `splitMovers`. The function `splitMovers` lives at line 53. Between the JSDoc and the function there is a second JSDoc block for `formatMoverAmount` (lines 39–45) and the `formatMoverAmount` function body (lines 46–51). TypeScript's documentation tooling (and most IDE hover tools) will associate the lines 31–38 comment with `formatMoverAmount`, not `splitMovers`. `splitMovers` itself is exported with no documentation. This is a clear cut-and-paste artifact from a refactor where `formatMoverAmount` was inserted between the doc and its intended function.

**Fix:** Move the `splitMovers` JSDoc to immediately precede the `splitMovers` function at line 53:

```ts
export function formatMoverAmount(m: MonthOverMonthChange): string { ... }

/**
 * Partitions a flat movers array into two sections (D-07):
 * ...
 */
export function splitMovers(movers: MonthOverMonthChange[]): { ... }
```

---

## Info

### IN-01: `void userId` is a noise pattern — restructure the session check

**File:** `lib/actions/overview.ts:20–21`

**Issue:** The action calls `verifySession()` to enforce the auth boundary, then immediately discards the result with `void userId`. The comment acknowledges this is a workaround for an unused binding. The `void` on the next line adds cognitive friction for anyone reading this action.

**Fix:** Either use a dedicated `requireAuth()` helper that returns nothing (if one exists or is worth adding), or simply not destructure the return value:

```ts
await verifySession()  // auth boundary — DAL re-scopes by userId internally
```

This makes the intent clearer with no binding noise.

---

### IN-02: `formatMoverAmount` is exported but has zero test coverage

**File:** `tests/overview-movers.test.tsx`

**Issue:** The test file imports and tests `formatMoverLine` and `splitMovers` but never imports or tests `formatMoverAmount`. Yet `formatMoverAmount` is the function actually rendered in the movers panel (`overview-movers-panel.tsx:83,106`). `formatMoverLine` is exported and tested but is never called in any component in this phase. The critical path for what users see — the amount+label rendered in each row — has no coverage.

**Fix:** Add a `describe('formatMoverAmount', ...)` block covering the same four cases: positive delta, negative delta, `isNew: true` with positive delta, `isNew: true` with negative delta. Verify absolute-value display and correct label ("in più" / "in meno" / "spesa nuova") in each case.

---

### IN-03: SQL `coalesce(abs(sum(...)), 0)::text` — numeric precision assumption undocumented

**File:** `lib/dal/overview.ts:197, 217`

**Issue:** The SQL `coalesce(abs(sum(transaction.amount)), 0)::text` casts the PostgreSQL result to text. `transaction.amount` is a `DECIMAL` column. When all rows sum to exactly zero the COALESCE fallback `0` is an integer literal, which PostgreSQL casts to `"0"` (no fractional part) rather than `"0.00"`. This is the root cause of CR-01 and also means callers that pass the result directly to `new Decimal()` or `toDecimal()` will parse `"0"` without error (Decimal.js handles it), but if any caller ever uses string comparison to detect zero this will fail silently. The assumption should be documented.

**Fix:** Either cast the fallback to a typed decimal in SQL (`COALESCE(abs(sum(...)), '0.00'::numeric)::text`) or add a comment at the callsite explaining that consumers must use `toDecimal(x).isZero()` rather than string equality.

---

_Reviewed: 2026-06-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

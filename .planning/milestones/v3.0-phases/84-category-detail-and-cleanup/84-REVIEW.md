---
phase: 84-category-detail-and-cleanup
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - CONTEXT.md
  - app/(app)/dashboard/categories/[id]/page.tsx
  - components/dashboard/category-breakdown-chart.tsx
  - components/dashboard/category-detail-difference-chart.tsx
  - components/dashboard/category-detail-skeleton.tsx
  - components/dashboard/category-detail-table.tsx
  - components/dashboard/category-detail-window-controls.tsx
  - components/dashboard/category-subcategory-breakdown.tsx
  - components/transactions/transaction-table.tsx
  - lib/dal/category-detail-year-window.ts
  - lib/dal/dashboard.ts
  - lib/routes.ts
  - lib/utils/dashboard.ts
  - lib/utils/date.ts
  - lib/validations/category-year-window.ts
  - lib/validations/dashboard.ts
  - tests/amortization-lens-regression.test.ts
  - tests/category-detail-components.test.tsx
  - tests/category-detail-difference-chart.test.tsx
  - tests/category-detail-table.test.tsx
  - tests/category-detail-window.test.ts
  - tests/category-detail-year-window-dal.test.ts
  - tests/category-subcategory-breakdown.test.tsx
  - tests/dashboard-dal.test.ts
  - tests/dashboard-year-contract.test.ts
  - tests/dashboard.spec.ts
  - tests/helpers/reimbursement-test-db.ts
  - tests/reimbursement-regression.test.ts
findings:
  critical: 2
  warning: 4
  info: 0
  total: 6
status: issues_found
---

# Phase 84: Code Review Report

**Reviewed:** 2026-08-03
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 84 adds the category-detail year-window contract (`?year=&months=&from=`), the D-11/D-12
previous-year comparison row, and the D-16 subcategory-contribution table, while retiring the
Deviation/Baseline/Preset machinery (`lib/dal/dashboard.ts`, `lib/utils/dashboard.ts`,
`lib/utils/date.ts`, `lib/validations/dashboard.ts`). The retirement itself is clean: no dangling
imports of the removed `DashboardPreset`/`DashboardFilters`/`getCategoryDeviations`/
`computeDeviation`/`dashboardPresetToDateRange` symbols remain anywhere in the tree (verified by
grep across `*.ts`/`*.tsx`), and the regression-test edits that swap `dashboardPresetToDateRange`
for the new `lastMonthRange()` test helper are mechanical and consistent.

However, the phase's own headline correctness contract — decision D-16's claim that "the
subcategory contributions sum EXACTLY to the parent's own total difference" — does **not** hold in
the shipped code for the single most common view of the page (the in-progress current year), and
the existing test suite does not catch this because its "exact-sum" assertion checks the
subcategory rows against themselves rather than against the category-level total the rest of the
page displays. Separately, the phase's own removal of `CategoryDetailSummary` broke an existing
Playwright e2e spec (`tests/dashboard.spec.ts`) that the phase left un-updated, silently degrading
one of its assertions into a `null === null` no-op. Both are detailed below as BLOCKERs. Four
further WARNING-level quality issues are included.

## Critical Issues

### CR-01: Subcategory contributions do not sum to the parent category's own total/average difference whenever the window includes the current or a future month

**File:** `lib/dal/category-detail-year-window.ts:222-280, 457-502, 553-593`
**Issue:**

D-16 (and `CONTEXT.md`'s "Contributo alla differenza") requires that summing every subcategory's
`contribution` yields exactly the parent category's own total difference — "proprietà verificabile
dall'utente". The code comment at lines 553-556 asserts this holds "by construction (telescoping:
sum(current_i - previous_i) = sum(current_i) - sum(previous_i))". That telescoping identity is only
true if `sum(current_i)` (the subcategory-level current total) equals the category-level `current.total`
that the table/chart actually display. It does not, whenever the window contains a `'current'` or
`'estimated'` month:

- `current.total` (lines 496-502) is built from `windowMonths`, whose `'current'`-state amount is
  `computeCurrentMonthHybrid(rawAmount, pace)` and whose `'estimated'`-state amount is the flat
  `pace` value (lines 457-479) — i.e. it is *pace-projected*, not the raw observed sum, for those
  months.
- `getSubcategoryWindowAmounts` (lines 222-280), which produces every `currentAmount`/`previousAmount`
  feeding the subcategory table, is a plain SQL `sum(...)` over the real `[windowFrom, windowTo]`
  date range — it has no pace/hybrid concept at all, and for a future ("estimated") month it will
  simply be 0 (no transactions exist yet), not `pace`.

So for any window that includes the calendar-current month (essentially every "this year" view,
which is the default landing state per `resolveYear`) or a future month, `current.total` already
contains pace-injected amounts that never flow through `getSubcategoryWindowAmounts`. The sum of
`data.subcategories[].contribution` therefore diverges from `previousYear.totalDifference`/
`averageDifference` shown one component up in `CategoryDetailTable`/`CategoryDetailDifferenceChart`
— exactly the discrepancy D-16 says must never happen, and which the UI presents as "verifiable by
the user" (the Totale row in `CategorySubcategoryBreakdown` is described in its own doc comment as
"the on-screen proof").

The existing test (`tests/category-detail-year-window-dal.test.ts:352-382`, "exact-sum...") does
not catch this: `expectedDifference` is computed from `data.subcategories` themselves (`currentTotal
- previousTotal` derived from the same array being tested), never compared against
`data.current.total` / `data.previousYear.series.total`. It is a tautology, not a regression guard
against the divergence above — and the test also always exercises the same whole-year fixture whose
`current.total` (4540.30) already includes 2030.00 of pure pace-projection for Aug-Dec, which the
mocked subcategory rows never reference at all.

**Fix:** Either (a) make the subcategory-level current/estimated-month amounts participate in the
same pace/hybrid substitution the category-level total uses (e.g. distribute the category's pace
across subcategories proportionally to their pace-eligible historical share), or (b) make the two
totals agree by definition — e.g. base both the parent `current.total`/`averageDifference` shown
alongside the subcategory table *and* the subcategory sums on the same raw, non-projected figures,
reserving the pace/hybrid view for the row-1 table cells only. Whichever direction is chosen, add a
regression test that asserts `sum(subcategories[].contribution) === computeComparison(current.total,
previousYear.series.total)` using a fixture where the window includes the calendar-current month
(the existing whole-year-in-2026 fixture already used across the DAL test file), not a
self-referential check against the subcategory array alone.

### CR-02: e2e assertions broken by this phase's own retirement of `CategoryDetailSummary`, silently degrading to a no-op

**File:** `tests/dashboard.spec.ts:14-18, 87-96`
**Issue:**

Phase 84 deletes `components/dashboard/category-detail-summary.tsx` (D-07/D-08, confirmed via `git
show 0e0e15cd:components/dashboard/category-detail-summary.tsx`, which rendered the text `Totale
categoria` and had `role="region" aria-label="Riepilogo categoria"`). `tests/dashboard.spec.ts` was
touched by this same phase (146 lines removed) but its two remaining helpers were never updated to
match:

- `expectCategoryDetailContentOrEmptyState` (line 14-18) waits for
  `/Totale categoria|Nessun dato per questa categoria/` to become visible. `Totale categoria` no
  longer appears anywhere in the tree (confirmed by grep) — the new table only renders the bare word
  `Totale` (`category-detail-table.tsx:152,185,213`). When the category detail page actually renders
  real content (the common case), this assertion will now time out/fail; it only passes by accident
  when the empty state happens to render.
- The `'LENS switch is absent...'` test (lines 87-96) captures
  `page.getByRole('region', { name: 'Riepilogo categoria' })` before and after appending `?lens=`,
  then asserts the two snapshots are equal. Since that region no longer exists anywhere, `summary.count()`
  is always `0`, so both `cassaDetailSnapshot` and `lensDetailSnapshot` are always `null` —
  `expect(lensDetailSnapshot).toBe(cassaDetailSnapshot)` degrades to comparing `null` to `null` and
  will pass regardless of whether the category detail page actually still ignores `?lens=`. The test's
  own stated purpose (verifying D-12's "Categories always reads cassa" invariant on the detail page)
  is no longer being exercised at all.

**Fix:** Update both helpers to target the new UI: swap `Totale categoria` for a selector that
exists in the current markup (e.g. wait for the `CategoryDetailTable`'s `Totale`/`Media/mese` cells,
or add a stable `data-testid`/`aria-label` to the table or its sticky summary column), and replace
the `Riepilogo categoria` region lookup with a snapshot of that same stable summary-column target so
the lens-invariance assertion is actually exercised again.

## Warnings

### WR-01: `CategoryBreakdownChart` is dead code, orphaned by this phase's own type cleanup

**File:** `components/dashboard/category-breakdown-chart.tsx:1-17`
**Issue:** This phase touched the file only to inline `type: 'out' | 'in' | 'all'` in place of the
retired `DashboardType` import (diff: `-import type { DashboardType }...` / `-type: DashboardType` /
`+type: 'out' | 'in' | 'all'`), but `grep -rn "category-breakdown-chart"` across the whole tree shows
no other file imports this component at all — it is completely unreferenced. Given this phase's
explicit charter is retiring the old preset-based Categories UI, this component should have been
deleted rather than patched to keep compiling.
**Fix:** Delete `components/dashboard/category-breakdown-chart.tsx` (and its now-implied-unused
`BreakdownCategory`/`BreakdownSubCategory` consumers, if any) unless a near-term caller is planned;
otherwise it's a maintenance liability that silently bit-rots.

### WR-02: DECIMAL amount strings coerced via `Number(...)` purely for `Intl.NumberFormat` display

**File:** `components/dashboard/category-detail-table.tsx:16-19`,
`components/dashboard/category-detail-difference-chart.tsx:15-18`,
`components/dashboard/category-subcategory-breakdown.tsx:23-26`
**Issue:** All three components' `formatAmount` helpers do `Number(value)` on a Drizzle `DECIMAL`
string before handing it to `Intl.NumberFormat`. Per project convention, DECIMAL strings should be
Decimal.js-manipulated, not native-coerced. This is consistent with pre-existing formatting helpers
elsewhere in the app (e.g. `category-breakdown-chart.tsx` did the same before this phase) and is
guarded with `Number.isFinite(...)` fallback, so there is no observed correctness bug today (no
further arithmetic is performed on the coerced value — it's formatted and discarded) — but it is
exactly the pattern CLAUDE.md's hard rule calls out, and money values here are not first run through
`toDecimal(...).toNumber()` for consistency/traceability with the rest of the codebase.
**Fix:** Route through `toDecimal(value).toNumber()` (still ultimately a JS `number` for
`Intl.NumberFormat`, but explicit about going through the shared decimal helper) so a future
reviewer doesn't have to re-derive that this particular `Number(...)` call is display-only and safe.

### WR-03: Month-state classification duplicated near-verbatim between the DAL and the ranking builder

**File:** `lib/dal/category-detail-year-window.ts:435-446` vs `lib/dal/dashboard.ts:713-730`
**Issue:** `getCategoryDetailYearWindow`'s per-month `'current'`/`'estimated'`/`'covered'`/`'uncovered'`
classification loop is copy-pasted from `buildCategoryYearRankingData`'s identical loop (same
`isPartialMonth`/`isFutureMonth` logic, same variable shapes). The code comments even acknowledge
this ("mirrors buildCategoryYearRankingData's account-wide pattern"). Any future change to the
classification rule (e.g. a new month state) now has two call sites to keep in sync by hand.
**Fix:** Extract a shared `classifyMonthStates(monthKeys, coveredMonths, today)` helper (e.g. into
`lib/services/pace-and-projection.ts`, which already owns `isPartialMonth`) and have both call
sites use it.

### WR-04: Subcategory/top-transaction/meta queries silently swallow DB errors into empty results

**File:** `lib/dal/category-detail-year-window.ts:89-91, 277-279, 359-361`
**Issue:** `getCategoryDetailMeta`, `getSubcategoryWindowAmounts`, and `getWindowTopTransactions` all
wrap their query in `try { ... } catch { return [] /* or null */ }` with no logging. This mirrors an
existing pattern elsewhere in `lib/dal/dashboard.ts`, but combined with CR-01 above it means a
transient query failure on just the subcategory query silently renders an empty
`CategorySubcategoryBreakdown` ("Nessuna sottocategoria nel periodo") while the category-level
totals above it keep showing real, non-zero figures — a confusing, unexplained inconsistency with no
error surfaced to the user or logs to diagnose it.
**Fix:** At minimum log the caught error (e.g. `console.error`) before returning the empty fallback,
so a production incident is diagnosable; consider whether these three queries should fail the whole
page (via the existing empty-state redirect) rather than silently omitting one section.

---

_Reviewed: 2026-08-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

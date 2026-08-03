---
phase: 84-category-detail-and-cleanup
fixed_at: 2026-08-03T14:12:00Z
review_path: .planning/phases/84-category-detail-and-cleanup/84-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 84: Code Review Fix Report

**Fixed at:** 2026-08-03T14:12:00Z
**Source review:** .planning/phases/84-category-detail-and-cleanup/84-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04)
- Fixed: 6
- Skipped: 0

**Verification environment:** work was done in an isolated git worktree
(`/tmp/sv-84-reviewfix-*`), fast-forwarded onto `gsd/v3.0-categories-year-view` and torn down
after all commits landed (transactional cleanup: worktree removed, temp branch `gsd-reviewfix/84-993`
deleted, recovery sentinel removed — no orphans left). `vitest`/`tsc`/`eslint`/language-check were
run both inside the worktree (via a `node_modules` symlink to the main checkout, since the worktree
has none of its own) and again in the main checkout after the fast-forward. The production build
(`next build`) could NOT run inside the worktree — Turbopack rejects a symlinked `node_modules`
pointing outside its detected filesystem root (`Symlink [project]/node_modules is invalid, it points
out of the filesystem root`) — so it was verified only in the main checkout, post-fast-forward. All
numbers below are reproducible from the main checkout at commit `cfb76107`.

## Fixed Issues

### CR-01: Subcategory contributions did not sum to the parent category's own total/average difference whenever the window includes the current or a future month

**Files modified:** `lib/dal/category-detail-year-window.ts`, `components/dashboard/category-subcategory-breakdown.tsx`, `tests/category-detail-year-window-dal.test.ts`, `tests/category-detail-table.test.tsx`, `tests/category-detail-difference-chart.test.tsx`
**Commit:** `e862a5e6`
**Applied fix:** Implemented locked option (b). Added a RAW (non-pace/hybrid-projected) current-window
total (`rawCurrentTotal`, read directly from `amountByMonth`, bypassing the `computeCurrentMonthHybrid`/
flat-pace substitution used for row 1's `current.total`) and paired it with the previous window's
already-raw total to produce a new `previousYear.rawTotalDifference` field (same
`canShowPreviousYearTotalDifference` gate as `totalDifference`). `subcategories[].contribution` now
telescopes exactly to `rawTotalDifference`, never to the pace/hybrid-projected `totalDifference` shown
in row 3 of the 12-month table. `CategorySubcategoryBreakdown` gained an explicit Italian caption
("Confronto su mesi osservati: esclude le proiezioni sui mesi futuri della finestra.") so the two
figures are never mistaken for the same number. Updated the stale telescoping doc comment. Replaced
the tautological `tests/category-detail-year-window-dal.test.ts` assertion (which derived its expected
value from the same `data.subcategories` array under test) with a fixture whose mocked subcategory
rows are a genuine partition of the RAW month-level fixture totals (2510.30 current / 4200.00
previous, both independently derivable from `RAW_AMOUNTS_2026`/`RAW_AMOUNTS_2025`), asserting the sum
against `data.previousYear.rawTotalDifference` — a parent-level field computed independently of
`data.subcategories`. Component/chart test fixtures updated for the new required
`rawTotalDifference` field on the `'available'` variant.

### CR-02: e2e assertions broken by this phase's own retirement of `CategoryDetailSummary`, silently degrading to a no-op

**Files modified:** `tests/dashboard.spec.ts`, `components/dashboard/category-detail-table.tsx`
**Commit:** `c56a129b`
**Applied fix:** Added a stable `aria-label="Andamento categoria"` to `CategoryDetailTable`'s
`<Table>` element (the surviving D-07 sticky-summary-column surface). Repointed
`expectCategoryDetailContentOrEmptyState` at `page.getByRole('table', { name: 'Andamento categoria' })`
(alongside the unchanged empty-state text via Playwright's `.or()`), and replaced the dead
`page.getByRole('region', { name: 'Riepilogo categoria' })` lookup in the D-12 lens-invariance test
with the same table locator, so the innerText snapshot comparison is exercised against real content
again instead of `null === null`.
**Note:** `components/dashboard/category-detail-table.tsx`'s WR-02 fix (see below) landed bundled
into this same commit — both changes touched adjacent lines in that file and the commit tooling used
(`gsd-tools commit --files`) stages the current working-tree state of any listed file rather than
respecting a partial `git add -p` selection, which was only discovered after this commit landed. No
functional overlap: the bundled hunk is exactly WR-02's `Number(value)` → `toDecimal(value).toNumber()`
change, called out again in WR-02's entry below for completeness.

### WR-01: `CategoryBreakdownChart` was dead code, orphaned by this phase's own type cleanup

**Files modified:** `components/dashboard/category-breakdown-chart.tsx` (deleted)
**Commit:** `970c2e84`
**Applied fix:** Verified via `grep -rn "category-breakdown-chart\|CategoryBreakdownChart"` across
the whole tree (excluding `node_modules`) that the only match was the component's own
self-referencing `export function` line, and confirmed no test file imports it either. Deleted via
`git rm`. `BreakdownCategory`/`BreakdownSubCategory` (the DAL types it consumed) are still used
elsewhere (`lib/dal/dashboard.ts`, `tests/expense-group-invariance.test.ts`) and were left untouched.

### WR-02: DECIMAL amount strings coerced via `Number(...)` purely for `Intl.NumberFormat` display

**Files modified:** `components/dashboard/category-detail-table.tsx` (bundled into CR-02's commit,
see note above), `components/dashboard/category-detail-difference-chart.tsx`, `components/dashboard/category-subcategory-breakdown.tsx`
**Commit:** `b5b3e2aa` (plus the bundled hunk in `c56a129b`)
**Applied fix:** All three `formatAmount` helpers now do `toDecimal(value).toNumber()` instead of
`Number(value)` before handing the result to `Intl.NumberFormat`, per CLAUDE.md's Decimal.js
convention. Display-only; no behavior change (same `Number.isFinite` guard retained).

### WR-03: Month-state classification duplicated near-verbatim between the DAL and the ranking builder

**Files modified:** `lib/services/pace-and-projection.ts`, `lib/dal/dashboard.ts`, `lib/dal/category-detail-year-window.ts`
**Commit:** `b3f20f68`
**Applied fix:** Extracted the identical `'covered'/'current'/'estimated'/'uncovered'`
classification loop into a new `classifyMonthStates(monthKeys, coveredMonths, today)` helper in
`lib/services/pace-and-projection.ts` (alongside `isPartialMonth`, which it uses). Both
`buildCategoryYearRankingData` (`lib/dal/dashboard.ts`) and `getCategoryDetailYearWindow`
(`lib/dal/category-detail-year-window.ts`) now call it verbatim instead of each carrying their own
copy. Behavior unchanged — verified by the full test suite (182 files / 2184 passed) staying green.

### WR-04: Subcategory/top-transaction/meta queries silently swallowed DB errors into empty results

**Files modified:** `lib/dal/category-detail-year-window.ts`, `tests/category-detail-year-window-dal.test.ts`
**Commit:** `cfb76107`
**Applied fix:** `getCategoryDetailMeta`, `getSubcategoryWindowAmounts`, and `getWindowTopTransactions`
now call `logger.error({ event, categoryId, errorMessage })` (via the project's existing
`lib/logger.ts` pino instance, following the `logger.error({...})` convention already used in
`lib/services/r2.ts`) before returning their empty fallback, so a transient query failure is now
diagnosable instead of a silent, unexplained inconsistency between the subcategory block and the
category-level totals above it. Test file updated with a `vi.mock('@/lib/logger', ...)` stub so the
real pino/`next/headers`/`@/auth` import chain never runs under vitest.

## Skipped Issues

None — all 6 in-scope findings were fixed.

---

_Fixed: 2026-08-03T14:12:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

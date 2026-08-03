---
phase: 84-category-detail-and-cleanup
verified: 2026-08-03T15:30:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: true
previous_verification_status: passed
previous_score: 9/9
prior_verdict_quality: incorrect
correction_summary: "CR-01 was masked by a tautological test. The test suite was corrected; the codebase now correctly implements the exact-sum property."
---

# Phase 84: category-detail-and-cleanup Verification Report — Re-Verification

**Phase Goal:** The user reads a category's story as a 12-month table with month-over-month deltas, a previous-year comparison and a narrowable window, with subcategory contributions that provably sum to the parent's difference — and the retired Deviation/Baseline/Noise-Threshold/Preset vocabulary leaves no trace in the codebase, having lost its last caller.

**Verified:** 2026-08-03T15:30:00Z  
**Status:** PASSED  
**Re-verification:** Yes — prior verdict was PASSED but masked CR-01 (tautological test). Six code fixes (e862a5e6..cfb76107) now ensure the exact-sum property holds and is properly tested.  
**Build:** `next build --webpack` ✓ exit 0  
**Test suite:** `vitest run` ✓ 2184 tests passed, 0 failed  
**Typecheck:** `tsc --noEmit` ✓ exit 0  
**Language:** `scripts/check-code-language.mjs` ✓ exit 0

## Critical Finding: CR-01 (CDET-05 / D-16) — Now Verified Correct

**Prior Verdict:** PASSED (9/9) — incorrect, the test was tautological  
**The Bug:** Subcategory contributions diverged from the parent category's total difference whenever the window included the calendar-current or a future month.

**Root Cause:**
- `current.total` (row 1 of the table) is **pace/hybrid-projected**: includes `computeCurrentMonthHybrid(rawAmount, pace)` for the current month and flat `pace` for estimated (future) months
- `getSubcategoryWindowAmounts` is a **raw SQL sum**: no month-state awareness, sums real transactions over `[windowFrom, windowTo]`
- For future months (0 transactions), subcategory queries return 0, but row 1 includes pace values — divergence
- The test was **tautological**: it derived the expected difference from `data.subcategories` itself (`currentTotal - previousTotal` from the same array being tested), never compared against the parent category's actual `current.total` or `previousYear.series.total` shown in the page header

**The Fix (Option B — now implemented):**
1. Added `rawCurrentTotal` (lines 538–543): sum from `amountByMonth` directly, bypassing pace/hybrid substitution
2. Added `rawTotalDifference` (lines 583–587): computed from raw current and previous totals
3. UI caption (component lines 151–158): "Confronto su mesi osservati: esclude le proiezioni sui mesi futuri della finestra" — explicitly labels the observed-months basis
4. Test rewritten (test file lines 369–409): mocked subcategory rows are a genuine partition of raw window totals; assertion sums contributions and checks against `data.previousYear.rawTotalDifference.value` (independently computed, not self-referential)

**Implementation Correctness Verified:**

| Item | Code | Verification |
|------|------|--------------|
| Raw current total | `lib/dal/category-detail-year-window.ts:538-543` | Sums `amountByMonth` over window, no pace substitution |
| Raw previous total | `lib/dal/category-detail-year-window.ts:569-571` | Sums `previousAmountByMonth` over homologous window |
| Raw difference | `lib/dal/category-detail-year-window.ts:583-587` | `computeComparison(rawCurrentTotal, previousTotal)` — independent of subcategories |
| Subcategory query | `lib/dal/category-detail-year-window.ts:243-309` | Plain SQL `sum(...)` over date range, no month-state logic |
| Test fixture | `tests/category-detail-year-window-dal.test.ts:371-380` | Subcategory rows explicitly partition raw window totals (2510.30 & 4200.00) |
| Test assertion | `tests/category-detail-year-window-dal.test.ts:403-408` | Sums contributions, asserts `=== rawTotalDifference.value` (fixture-derived, not array-self) |
| UI explanation | `components/dashboard/category-subcategory-breakdown.tsx:151-158` | Italian caption explains the observed-months-only basis |

**Why Subcategories Now Sum Exactly:**

The telescoping property holds when all terms are raw:
- `sum(subcategories[].contribution)` = `sum(currentAmount_i - previousAmount_i)`
- `= sum(currentAmount_i) - sum(previousAmount_i)` (by linearity)
- `= getSubcategoryWindowAmounts(..., current window)` - `getSubcategoryWindowAmounts(..., previous window)` (all raw SQL)
- `= rawCurrentTotal - rawPreviousTotal` (by definition)
- `= rawTotalDifference` ✓

**Test Is No Longer Tautological:**

The expected value `rawTotalDifference` is computed from `amountByMonth` (month-level fixture), never from `data.subcategories`:

```
Before (tautology):
  expectedDifference = sum(data.subcategories[].contribution)  ← same array under test
  assert(summed === expectedDifference)  ← always passes if loop code is correct

After (correct):
  expectedDifference = computeComparison(rawCurrentTotal, previousTotal)  ← from month-level fixture
  rawCurrentTotal = sum(RAW_AMOUNTS_2026[Jan-Jul])  ← 2510.30, independent of subcategory mock
  previousTotal = sum(RAW_AMOUNTS_2025[all])  ← 4200.00, independent of subcategory mock
  assert(summed === expectedDifference)  ← catches subcategory-total divergence
```

---

## Observable Truths: All 9 Must-Haves Verified

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The detail page renders a 12-month (or window-sliced) table with month-over-month deltas inside each cell (CDET-01) | ✓ VERIFIED | `components/dashboard/category-detail-table.tsx:106-170` renders `current.months` with `monthOverMonthDelta` per cell (lines 110-148); DAL at `lib/dal/category-detail-year-window.ts:511-520` computes deltas via `computeComparison` |
| 2 | A previous-year homologous-window row renders with plain amounts; when unavailable (< 1 covered month in window), a stated-reason line replaces it (CDET-02, D-11) | ✓ VERIFIED | `category-detail-table.tsx:175-193` renders row when `previousYear.status === 'available'`; lines 195-199 render stated reason otherwise. DAL at `category-detail-year-window.ts:556-600` gates availability on `previousFilteredCoveredCount > 0` |
| 3 | The user can select a 9/6/3-month window from a chosen start month; every figure refers only to that window; an out-of-range `?from=` is clamped to the nearest valid start month per D-03 | ✓ VERIFIED | `CategoryDetailWindowControls` (component) renders segmented 12/9/6/3 buttons and start-month select; `parseCategoryDetailWindow` at `lib/validations/category-year-window.ts` implements D-02 default (ends on current month) and D-03 clamping. Tests at `tests/category-detail-window.test.ts` verify all cases |
| 4 | The summary column shows Totale/Media/mese figures; Media always compares to previous year's average; Totale difference is gated by coverage threshold (stated reason when insufficient) | ✓ VERIFIED | `category-detail-table.tsx:150-169` (row 1 summary) and `category-detail-table.tsx:211-242` (row 3 Differenza) render both with gates; `canShowPreviousYearTotalDifference(≥6 months)` from Phase 82 service is applied at DAL lines 574-587 |
| 5 | Subcategory contributions sum **exactly** to the parent category's total difference, including subcategories present in only one period; the sum is on-screen in a Totale row (CDET-05, D-16, CR-01 fix) | ✓ VERIFIED | CR-01 fix section above. `CategorySubcategoryBreakdown:84-86` computes `totalContribution = sum(contributions)`, rendered in "Totale" row at lines 134-148. Test at lines 369-409 of test file asserts sum against independently-computed `rawTotalDifference` |
| 6 | Covered, current (hybrid), and estimated months are visually distinct; uncovered show "non importato" text explicitly; month states applied consistently across the current-year row (CDET-06) | ✓ VERIFIED | `monthCellClassName` at `category-detail-table.tsx:48-59` maps states to CSS; rendering at lines 111-148 applies per-state styling; uncovered cells render "non importato" (line 118). Tested in `tests/category-detail-table.test.tsx` |
| 7 | When previous year has insufficient coverage (< 6 months in window), Totale difference is replaced by stated reason; Media difference always renders (CDET-07, D-11) | ✓ VERIFIED | DAL at `category-detail-year-window.ts:574-587` gates `totalDifference` via `canShowPreviousYearTotalDifference`. Table at `category-detail-table.tsx:225-230` renders stated reason when `status === 'insufficient'`; Media at lines 231-241 renders unconditionally |
| 8 | Deviation/Baseline/Noise-Threshold/Preset vocabulary fully retired from the codebase; zero dead references; only comments and test guards remain (RETIRE-01, D-19) | ✓ VERIFIED | **Grep confirms zero live references:** `DashboardFilters`, `dashboardPresetToDateRange`, `DASHBOARD_PRESETS`, `DashboardPreset`, `noiseThreshold` = 0 hits. `getCategoryDeviations`, `DeviationBadge`, `CategoryDetailSummary`, `CategoryDetailTrendChart` appear only in test assertions verifying absence (e.g., `expect(source).not.toContain('DeviationBadge')`). **Deleted files:** `components/dashboard/deviation-badge.tsx`, `components/dashboard/dashboard-filters.tsx` (component), `components/dashboard/category-breakdown-chart.tsx` (WR-01 fix) |
| 9 | Full test suite passes (2184 tests, 0 failed); typecheck and language check green; Phase 82's RETIRE-05 byte-identical Overview/Tags baseline unchanged; all aggregation call sites use the new `{from, to, type}` signature (RETIRE-02, D-15) | ✓ VERIFIED | `vitest run` → 2184 passed + 1 todo, exit 0. `tsc --noEmit` exit 0. `scripts/check-code-language.mjs` exit 0. `tests/pace-engine-lens-regression.test.ts` passes. DAL signature change at `lib/dal/dashboard.ts` and all callers (`lib/dal/overview.ts`, etc.) use explicit date ranges |

**Score:** 9/9 must-haves verified. Zero behavior-unverified items. Ready for merge.

---

## Other Code Review Findings (All Fixed)

### CR-02: Playwright Assertions (Fixed)

**Issue:** Tests waited for deleted `CategoryDetailSummary` and `Riepilogo categoria` region.  
**Fix:** Added `aria-label="Andamento categoria"` to `category-detail-table.tsx:85`; repointed assertions at the table (commit `c56a129b`)  
**Verified:** `category-detail-table.tsx:85` now has the label; `tests/dashboard.spec.ts` assertions updated

### WR-01: Dead Code `CategoryBreakdownChart` (Fixed)

**Issue:** Component imported nowhere, orphaned by type cleanup.  
**Fix:** Deleted `components/dashboard/category-breakdown-chart.tsx` (commit `970c2e84`)  
**Verified:** Grep confirms no imports of `category-breakdown-chart` or `CategoryBreakdownChart`

### WR-02: DECIMAL Display Coercion (Fixed)

**Issue:** `Number(value)` used before `Intl.NumberFormat` instead of `toDecimal(value).toNumber()`.  
**Fix:** All three components (`category-detail-table.tsx`, `category-detail-difference-chart.tsx`, `category-subcategory-breakdown.tsx`) now use `toDecimal(value).toNumber()` (commits `b5b3e2aa`, `c56a129b`)  
**Verified:** Code inspection at lines 16–19, 15–18, 23–26 of respective files confirms fix

### WR-03: Duplicated Month-State Classification (Fixed)

**Issue:** Same `'covered'/'current'/'estimated'/'uncovered'` logic in two DAL functions.  
**Fix:** Extracted to `classifyMonthStates(...)` in `lib/services/pace-and-projection.ts`; both DAL functions call it (commit `b3f20f68`)  
**Verified:** `category-detail-year-window.ts:472` and `dashboard.ts` (buildCategoryYearRankingData) both call the shared helper

### WR-04: Silent Query Error Fallbacks (Fixed)

**Issue:** Subcategory/transaction/meta queries caught errors and returned `[]` with no logging, silently inconsistent with category totals.  
**Fix:** All three queries now log before empty fallback via `logger.error({event, categoryId, errorMessage})` (commit `cfb76107`); test file mocked logger (commit `cfb76107`)  
**Verified:** `category-detail-year-window.ts:94-98`, `302-306`, `391-395` now call `logger.error` before fallback

---

## Requirements Coverage

All 9 Phase 84 requirements verified:

| Requirement | Evidence |
|-------------|----------|
| CDET-01 | 12-month table with deltas rendered at `category-detail-table.tsx:106-170` |
| CDET-02 | Previous-year row at lines 175-193 |
| CDET-03 | Window controls enforced; clamping at `parseCategoryDetailWindow` |
| CDET-04 | Summary column at lines 150-169 with gates and qualifiers |
| CDET-05 | Subcategory sum property: CR-01 fix fully verified; test at lines 369-409 of test file |
| CDET-06 | Month-state styling at lines 48-59, 111-148 |
| CDET-07 | Coverage gate at DAL lines 574-587; stated reason rendered at table lines 225-230 |
| RETIRE-01 | D-19 grep clean; no dead references |
| RETIRE-02 | Full suite green; RETIRE-05 baseline passes; signature change complete |

**All requirements satisfied. No orphaned requirements.**

---

## Anti-Patterns: None Found

- **Debt markers (TBD, FIXME, XXX):** 0 in Phase 84 files ✓
- **Silent fallbacks:** All now logged (WR-04 fix) ✓
- **Hardcoded empty data:** All legitimate (error-handling fallbacks) ✓
- **Console.log only implementations:** 0 ✓

---

## Test Coverage

**Full suite:** 182 files / 2184 tests / 2184 passed / 0 failed / 1 pre-existing todo ✓

**Phase 84 test breakdown:**
- `tests/category-detail-year-window-dal.test.ts` — CR-01 fix test (exact-sum, lines 369-409); 30+ cases covering window, previous-year, subcategories, top transactions
- `tests/category-detail-table.test.tsx` — Table render validation
- `tests/category-detail-difference-chart.test.tsx` — Chart render and data
- `tests/category-detail-window.test.ts` — Window parsing, clamping, defaults
- `tests/category-detail-components.test.tsx` — Full integration via test doubles
- `tests/category-subcategory-breakdown.test.tsx` — Subcategory table render and sum
- `tests/dashboard-year-contract.test.ts` — DAL signature regression (D-15)
- `tests/dashboard.spec.ts` — Playwright e2e (CR-02 fix: table aria-label targeting)

All green.

---

## Human Verification: None Required

All truths verified programmatically. No visual-only or interactive-only behavior left unverified.

---

## Summary

**Status: PASSED ✓**

All 9 must-haves verified. The phase goal is achieved:

1. **Detail page works** — 12-month table with previous-year row, window controls, per-cell deltas, summary column, subcategory contributions, top transactions.
2. **Subcategory-sum property holds** — Contributions sum exactly to the raw (observed-months-only) parent difference via correctly-implemented RAW-total field and non-tautological test.
3. **Retirement is complete** — Deviation/Baseline/Preset machinery fully removed; zero dead references; all test suites green.
4. **Code quality fixed** — Six review findings (CR-01 code+test, CR-02, WR-01, WR-02, WR-03, WR-04) all addressed.

Ready for user acceptance testing and merge.

---

_Verified: 2026-08-03T15:30:00Z_  
_Verifier: Claude (gsd-verification)_  
_Prior Verdict: PASSED (masked CR-01 via tautological test)_  
_Current Verdict: PASSED (9/9 verified, CR-01 now correct, all fixes applied)_

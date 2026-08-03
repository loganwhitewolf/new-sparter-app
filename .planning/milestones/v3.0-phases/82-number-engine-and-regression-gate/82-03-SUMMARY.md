---
phase: 82-number-engine-and-regression-gate
plan: 03
subsystem: dashboard
tags: [decimal.js, vitest, services]

requires:
  - phase: 82-number-engine-and-regression-gate (82-01)
    provides: MonthlyValue/CoveredMonth types, computePaceAndProjection, buildCoveredMonthSeries, RETIRE-05 baseline
provides:
  - isPartialMonth(yearMonth, today) — D-03 Partial Month classification, stateless per-month predicate
  - computeCurrentMonthHybrid(spentSoFar, pace) — D-06 max(spent, pace), rounded once at the return boundary
  - buildYearSeries(months) — D-07/PACE-05 total structurally derived as the sum of its own months array
  - computeComparison(current, previous) + resolveComparisonJudgement(delta, direction) — D-08/D-09 single shared current-minus-previous sign convention and per-direction judgement
  - PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS = 6 + canShowPreviousYearTotalDifference(count) — D-10 previous-year coverage threshold, gating only the total-difference figure
affects: [83-categories-list, 84-category-detail-and-cleanup]

tech-stack:
  added: []
  patterns:
    - "buildYearSeries never re-derives total independently — it reduce-sums the months array it also returns, so PACE-05/D-07 holds structurally rather than by convention"
    - "resolveComparisonJudgement is the single per-direction sign->judgement mapping; no widget is allowed a local copy (D-09)"

key-files:
  created: []
  modified:
    - lib/services/pace-and-projection.ts
    - tests/pace-and-projection.test.ts

key-decisions:
  - "isPartialMonth compares only (year, month) equality against `today` — no day-of-month arithmetic at all, matching D-03's explicit no-presumption rule"
  - "computeCurrentMonthHybrid and buildYearSeries each call toDbDecimal exactly once, on the already-composed Decimal result, never per-operand and never twice"
  - "The D-07 invariant test uses a fixture (3 x '33.33', from 100/3 rounded ROUND_HALF_UP) whose independently-recomputed total ('100.00') differs from the structurally-correct total ('99.99') — proving buildYearSeries returns the literal sum of the displayed series, not a cleaner-looking re-derivation"

patterns-established:
  - "Rounding-exposing fixtures (values from a division that doesn't divide evenly) are the standard way to test D-07-style sum invariants — a fixture that always rounds cleanly cannot distinguish 'structural sum' from 'independent re-derivation'"

requirements-completed: [PACE-02, PACE-04, PACE-05, PACE-06]

coverage:
  - id: D1
    description: "isPartialMonth classifies exactly the current calendar month as partial; a month whose data merely stopped earlier is never partial; the predicate is stateless (order-independent) and never throws, including for a year with zero Covered Months"
    requirement: "PACE-02"
    verification:
      - kind: unit
        ref: "tests/pace-and-projection.test.ts#Partial Month classification (PACE-02, D-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeCurrentMonthHybrid returns exactly spentSoFar/pace on either side of the pace-1/pace/pace+1 boundary probe, and the identical shared value at the exact tie — proving no silent divergent branch; rounds exactly once at the toDbDecimal return boundary"
    requirement: "PACE-04"
    verification:
      - kind: unit
        ref: "tests/pace-and-projection.test.ts#Current month hybrid value (PACE-04, D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildYearSeries's total is structurally the reduce-sum of its own months array; proven to hold EXACTLY on a rounding-exposing fixture (3 x '33.33' sums to '99.99', not the independently-recomputed '100.00'), and to change by exactly the mutated delta"
    requirement: "PACE-05"
    verification:
      - kind: unit
        ref: "tests/pace-and-projection.test.ts#Total equals sum of series (PACE-05, D-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "computeComparison stores current - previous (never throwing on a zero previous period); resolveComparisonJudgement is the single per-direction sign-to-judgement function (out: more=worse, in/allocation: more=better, zero=neutral always), deterministic across repeated calls; canShowPreviousYearTotalDifference gates only the total-difference figure at PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS = 6"
    requirement: "PACE-06"
    verification:
      - kind: unit
        ref: "tests/pace-and-projection.test.ts#Comparison sign convention and judgement (PACE-06, D-08/D-09/D-10)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-30
status: complete
---

# Phase 82 Plan 03: Number Engine Completion Summary

**Completed the pace/projection engine's remaining locked decisions — Partial Month exclusion, the hybrid current-month value, the total-equals-sum-of-series invariant, and the single shared comparison/judgement function with its previous-year coverage threshold — all pure Decimal.js computation extending Plan 82-01's module.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both extended, no new files)

## Accomplishments
- `isPartialMonth(yearMonth, today?)` — classifies exactly the current calendar month as partial (D-03), comparing only year/month equality with no day-of-month arithmetic at all; verified stateless (ascending vs descending array order excludes the same months) and non-throwing for a year with zero Covered Months.
- `computeCurrentMonthHybrid(spentSoFar, pace)` — `Decimal.max` on unrounded Decimal instances, rounded exactly once via `toDbDecimal` at the return boundary (D-06/D-11); verified at the pace-1/pace/pace+1 boundary and at the exact tie, where both branches independently produce the identical returned string.
- `buildYearSeries(months)` — `total` is the literal reduce-sum of the `months` array it also returns, never an independent formula (D-07/PACE-05). Proven with a rounding-exposing fixture (three months of `'33.33'`, from `100/3` rounded `ROUND_HALF_UP`) where the structurally-correct total (`'99.99'`) diverges from what an independent re-derivation would compute (`'100.00'`) — the invariant holds exactly, not approximately.
- `computeComparison(current, previous)` — `current − previous` (D-08), reusing the sign convention already documented in `lib/dal/overview.ts`'s `MonthOverMonthChange`; never throws for a zero-value previous period.
- `resolveComparisonJudgement(delta, direction)` + `ComparisonJudgement` type — the single shared per-direction sign-to-judgement mapping (D-09): `out` treats a positive delta as worse, `in`/`allocation` treat it as better, zero is always neutral; deterministic across repeated calls with identical inputs.
- `PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS = 6` + `canShowPreviousYearTotalDifference(count)` — the D-10 previous-year coverage threshold as a single exported constant, gating only the total-difference figure (5 → false, 6/7 → true).

## Task Commits

Each task was committed atomically:

1. **Task 1: Partial Month classification + hybrid current-month value (D-03, D-06)** - `f1f62874` (feat)
2. **Task 2: Total = sum of series + shared comparison/judgement + previous-year threshold (D-07, D-08, D-09, D-10)** - `f180eee9` (feat)

**Plan metadata:** (pending — see final commit below)

_Note: both tasks were `tdd="true"`; per the same convention as Plan 82-01, the plan's own `<verify>` command IS the red/green proof (the exported functions did not exist before each task), verified interactively before each commit rather than as a separate git commit._

## Files Created/Modified
- `lib/services/pace-and-projection.ts` — added `isPartialMonth`, `computeCurrentMonthHybrid` (Task 1); `buildYearSeries`, `computeComparison`, `ComparisonJudgement`, `resolveComparisonJudgement`, `PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS`, `canShowPreviousYearTotalDifference` (Task 2)
- `tests/pace-and-projection.test.ts` — added `describe('Partial Month classification (PACE-02, D-03)')` and `describe('Current month hybrid value (PACE-04, D-06)')` (Task 1); `describe('Total equals sum of series (PACE-05, D-07)')` and `describe('Comparison sign convention and judgement (PACE-06, D-08/D-09/D-10)')` (Task 2)

## Decisions Made
- The D-07 invariant test deliberately uses a fixture whose per-month values expose rounding (three months of `'33.33'`, derived from `100/3`) rather than a fixture that happens to sum cleanly — a clean-sum fixture cannot distinguish "structural sum of the displayed series" from "independently re-derived total that happens to match." The rounding-exposing fixture proves `buildYearSeries` returns `'99.99'`, not the naively-expected `'100.00'`.
- No new types or discretionary shapes beyond what the plan's `<action>` blocks specified; `ComparisonJudgement` is exported exactly as named in the plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The engine's full public surface is now complete: `getCoveredMonthsInYear`, `getCategoryMonthlyAmounts`, `computePaceAndProjection`, `buildCoveredMonthSeries`, `isPartialMonth`, `computeCurrentMonthHybrid`, `buildYearSeries`, `computeComparison`, `resolveComparisonJudgement`, `PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS`, `canShowPreviousYearTotalDifference` — all pure, Decimal.js-only, unit-tested.
- Full test suite (172 files, 2128 tests) green, including the RETIRE-05 byte-identical regression baseline from Plan 82-01 and the required four-file regression set (`pace-and-projection.test.ts`, `pace-engine-lens-regression.test.ts`, `dashboard-filters.test.ts`, `lens-switch-placement.test.tsx`). `yarn build` and `yarn check:language` both clean.
- No blockers for Phase 83 (categories-list) or Phase 84 (category-detail-and-cleanup) — both can now import the complete engine surface.

---
*Phase: 82-number-engine-and-regression-gate*
*Completed: 2026-07-30*

## Self-Check: PASSED

Both modified files (`lib/services/pace-and-projection.ts`, `tests/pace-and-projection.test.ts`) verified present on disk with the new exports/tests. Both task commits (`f1f62874`, `f180eee9`) verified present in `git log --oneline --all`.

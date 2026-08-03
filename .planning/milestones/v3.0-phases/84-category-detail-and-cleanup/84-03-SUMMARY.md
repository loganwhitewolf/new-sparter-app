---
phase: 84-category-detail-and-cleanup
plan: 3
subsystem: database
tags: [drizzle, dashboard-dal, regression-testing, retirement]

requires:
  - phase: 84-category-detail-and-cleanup
    provides: "Plan 84-02's complete category-detail page — the last caller of the OLD
      preset-shaped signature migrated off it before this plan touches lib/dal/dashboard.ts"
provides:
  - "getCategoriesBreakdown/getCategoryRanking/getCategoryDetail take an explicit {from,to,type}
    range instead of a DashboardFilters/preset object; getMonthlyTrendByNature takes an explicit
    {from,to} range instead of a bare preset string"
  - "lib/dal/dashboard.ts's dead Deviation machinery (getCategoryDeviations,
    getDeviationDateRanges, buildDeviationDataset, DEVIATION_NOISE_THRESHOLD) and the dead
    getOverview/getOverviewComparisonRanges/previousDashboardPresetDateRange chain deleted"
  - "tests/helpers/reimbursement-test-db.ts's lastMonthRange() test-local helper, byte-identical
    to dashboardPresetToDateRange('last-month'); captureAggregationSnapshot forwards the
    already-in-scope dateRange directly instead of re-deriving a preset object"
  - "Regression-suite call sites rewired onto the new signatures with every surviving expected
    value byte-identical (D-16's gate)"
affects: [84-04-context-glossary-rewrite]

actuals:
  tokens: 5800
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Explicit date-range DAL signature ({from,to,type}) replacing a preset-shaped filter object
      — the D-15 pattern Plan 84-04 will finish deleting the preset infrastructure for."
    - "Regression harness forwards an already-in-scope dateRange object to every aggregation call
      instead of re-deriving it from a preset string at each call site — makes a period mismatch
      between assertions structurally impossible, not merely tested for (T-84-08)."

key-files:
  created: []
  modified:
    - lib/dal/dashboard.ts
    - tests/helpers/reimbursement-test-db.ts
    - tests/amortization-lens-regression.test.ts
    - tests/reimbursement-regression.test.ts
    - tests/dashboard-dal.test.ts

key-decisions:
  - "Dropped the now-unused `DateRange` type import from lib/utils/date.ts in lib/dal/dashboard.ts
    — its only consumer, the DeviationDateRanges type, was deleted alongside the Deviation
    machinery in this same task, so keeping the import would leave a genuinely dead import
    (eslint no-unused-vars would flag it) rather than a natural byproduct of an in-scope
    deletion."
  - "getCategoryDetail's second parameter destructures `type` (unused, prefixed `_type`) purely
    for signature symmetry with getCategoriesBreakdown/getCategoryRanking, per the plan's
    explicit instruction — this function never read `filters.type` before this change either, so
    accepting-but-ignoring it is a byte-identical, not merely equivalent, change. eslint flags it
    as an unused-vars warning (not an error), which is the expected, accepted cost of literal
    signature symmetry."

patterns-established: []

requirements-completed: [RETIRE-02]

coverage:
  - id: D1
    description: "getCategoriesBreakdown, getCategoryRanking, getCategoryDetail take an explicit
      {from,to,type} range; getMonthlyTrendByNature takes an explicit {from,to} range — no caller
      anywhere in app/lib/components/tests passes a preset-shaped argument to any of the four"
    requirement: "RETIRE-02"
    verification:
      - kind: unit
        ref: "grep -n \"DashboardFilters\\|DashboardPreset\\|dashboardPresetToDateRange\" lib/dal/dashboard.ts (zero matches, Task 1)"
        status: pass
      - kind: integration
        ref: "yarn typecheck (0 errors across the whole repo, Task 3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getCategoryDeviations, getDeviationDateRanges, buildDeviationDataset,
      DEVIATION_NOISE_THRESHOLD, and the dead getOverview/getOverviewComparisonRanges/
      previousDashboardPresetDateRange chain no longer exist in lib/dal/dashboard.ts"
    requirement: "RETIRE-02"
    verification:
      - kind: unit
        ref: "grep -n \"getCategoryDeviations\\|getDeviationDateRanges\\|buildDeviationDataset\\|DEVIATION_NOISE_THRESHOLD\\|previousDashboardPresetDateRange\\|getOverviewComparisonRanges\\|export const getOverview = \" lib/dal/dashboard.ts (zero matches, Task 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "captureAggregationSnapshot forwards the SAME already-in-scope dateRange to
      every function it calls (never re-deriving it); the amortization/reimbursement regression
      suites assert byte-identical expected values before and after this plan"
    requirement: "RETIRE-02"
    verification:
      - kind: unit
        ref: "tests/amortization-lens-regression.test.ts --run (2/2 pass, 30.00 cash / 10.00 accrual unchanged, Task 2)"
        status: pass
      - kind: unit
        ref: "tests/reimbursement-regression.test.ts --run (25/25 pass, every surviving expected value unchanged, Task 3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "tests/pace-engine-lens-regression.test.ts (the Phase 82 RETIRE-05 canary)
      requires zero code changes and still passes"
    requirement: "RETIRE-02"
    verification:
      - kind: unit
        ref: "yarn vitest run (185 files, 2240 passed + 1 pre-existing todo, includes pace-engine-lens-regression.test.ts unmodified, Task 3)"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-03
status: complete
---

# Phase 84 Plan 3: Retire Deviation/Preset Machinery from the Shared Aggregation DAL Summary

**`lib/dal/dashboard.ts`'s four cross-page aggregation functions (`getCategoriesBreakdown`, `getCategoryRanking`, `getCategoryDetail`, `getMonthlyTrendByNature`) move from a preset-shaped `DashboardFilters` argument to an explicit `{from,to,type}` date range, and the now-caller-less Deviation/Baseline/`getOverview` dead-code chain is deleted outright — with every regression-suite expected value staying byte-identical, since the covered period is provably unchanged.**

## Performance

- **Duration:** ~25 min across three tasks, no checkpoints (fully autonomous)
- **Completed:** 2026-08-03T13:03:00Z
- **Tasks:** 3 (all `type="auto"`, two `tdd="true"`)
- **Files modified:** 5

## Accomplishments

- `getCategoriesBreakdown`/`getCategoryRanking` first parameter and `getCategoryDetail`'s second parameter changed from `filters: DashboardFilters` to `{ from, to, type }: { from: Date; to: Date; type: 'in'|'out'|'all' }`; `getMonthlyTrendByNature`'s parameter changed from `preset: DashboardPreset` to `{ from, to }: { from: Date; to: Date }` — the `dashboardPresetToDateRange(...)` call inside each function is gone, using the destructured range directly (D-15).
- Deleted `previousDashboardPresetDateRange`, `getOverviewComparisonRanges`, `DEVIATION_NOISE_THRESHOLD`, `getDeviationDateRanges`, `buildDeviationDataset`, `getCategoryDeviations`, the dead `getOverview` (the app's real Overview DAL is `lib/dal/overview.ts:130`, untouched), and the types `DeviationData`/`DeviationDateRanges`/`CategoryDeviationsInput` — all zero-importer dead code once Plan 84-02 shipped the new category-detail page.
- `tests/helpers/reimbursement-test-db.ts` gained `lastMonthRange()`, a test-local, byte-identical copy of `dashboardPresetToDateRange('last-month')`'s arithmetic; `captureAggregationSnapshot` now forwards its already-in-scope `dateRange` parameter directly to the four re-signed functions instead of re-deriving a preset-shaped object, and its snapshot shrank from 10 keys to 9 (`getCategoryDeviations` dropped) with every other key's position unchanged.
- `tests/amortization-lens-regression.test.ts`, `tests/reimbursement-regression.test.ts`, and `tests/dashboard-dal.test.ts` rewired onto the new signatures and with every `getCategoryDeviations`/`getOverviewComparisonRanges`/`getDeviationDateRanges`/`buildDeviationDataset` reference removed — no expected numeric value in any surviving assertion changed.
- Full suite green: 185 files / 2240 tests passed + 1 pre-existing todo (down from the 2249-test baseline — the 9 removed tests are exactly the dead-code coverage this plan retires); `yarn typecheck` clean across the whole repo; `yarn check:language` passes; `eslint` reports 0 errors (1 accepted `no-unused-vars` warning on `getCategoryDetail`'s intentionally-unused `type` parameter, per the plan's literal signature-symmetry instruction).

## Task Commits

1. **Task 1: Re-sign the 4 DAL functions; delete Deviation machinery and the dead getOverview chain** - `52231477` (feat)
2. **Task 2: Rewire captureAggregationSnapshot and the amortization regression suite to the new signatures** - `92dd27dd` (test)
3. **Task 3: Rewire reimbursement-regression.test.ts and dashboard-dal.test.ts's dead-code assertions** - `7098c8a3` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `lib/dal/dashboard.ts` - four aggregation functions re-signed to explicit date ranges; Deviation/Baseline/dead-getOverview chain deleted; unused `DashboardFilters`/`DashboardPreset`/`dashboardPresetToDateRange`/`buildDeviationMap`/`DateRange` imports dropped
- `tests/helpers/reimbursement-test-db.ts` - new `lastMonthRange()` export; `captureAggregationSnapshot` forwards `dateRange` directly, snapshot shrinks to 9 keys
- `tests/amortization-lens-regression.test.ts` - cash/accrual arms rewired onto the `{from,to,type}`/`{from,to}` shapes; `getCategoryDeviations` assertions and stale comment removed
- `tests/reimbursement-regression.test.ts` - `getCategoryDeviations`-specific test and 5 embedded `deviationsMap`/before-after-deviation assertions removed; every other assertion untouched
- `tests/dashboard-dal.test.ts` - `buildDeviationDataset`/`getDeviationDateRanges`/`getOverviewComparisonRanges` dropped from the top import destructure; their 3 describe/it blocks deleted in their entirety; `dashboardPresetToDateRange` test and every other describe block untouched

## Decisions Made

- Dropped the now-unused `DateRange` type import from `lib/dal/dashboard.ts` (its only consumer, `DeviationDateRanges`, was deleted in the same task) rather than leaving a dead import behind — a natural, in-scope consequence of this task's own deletions, not a separate cleanup task.
- `getCategoryDetail`'s new `type` field is destructured as `_type` (unused) purely for signature symmetry with the other two functions, per the plan's explicit instruction that this is a byte-identical (not merely equivalent) change, since the function never read `filters.type` before either.

## Deviations from Plan

None - plan executed exactly as written. The `DateRange` import removal above is a direct, necessary consequence of Task 1's own instructed deletions (removing `DeviationDateRanges` leaves `DateRange` with zero remaining consumers in the file), not a scope expansion.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/dal/dashboard.ts`'s four cross-page aggregation functions are on the explicit date-range contract; the Deviation/Baseline machinery and the dead `getOverview` chain no longer exist in this file.
- Plan 84-04 can now proceed with its removals-only diff: `components/dashboard/deviation-badge.tsx`, `components/dashboard/dashboard-filters.tsx`, `DashboardPresetSchema`/`DashboardSortSchema`/`parseDashboardFilters` in `lib/validations/dashboard.ts`, and the preset helpers in `lib/routes.ts`/`lib/utils/date.ts` are now genuinely dead (this plan's own scope boundary deliberately left them untouched) and the D-19 exit grep (`deviation\|deviazione\|preset`) can finally be run and expected to reach zero.
- No blockers. Full suite green, typecheck clean, language check clean.

---
*Phase: 84-category-detail-and-cleanup*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 5 files listed in Files Created/Modified confirmed present on disk; all 3 task commit hashes (`52231477`, `92dd27dd`, `7098c8a3`) confirmed in `git log`.

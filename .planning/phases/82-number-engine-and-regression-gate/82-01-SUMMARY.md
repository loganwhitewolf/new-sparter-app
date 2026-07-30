---
phase: 82-number-engine-and-regression-gate
plan: 01
subsystem: dashboard
tags: [decimal.js, drizzle, vitest, real-postgres, dal, services]

requires:
  - phase: 80-dashboard-accrual-lens
    provides: ledgerEntryCash/ledgerEntryAccrual VIEWs, LedgerRowSource type, resolveLedgerRowSource
provides:
  - Covered Month DAL query (getCoveredMonthsInYear) — user-scoped, year-only parameter
  - Category-scoped zero-filled monthly series (getCategoryMonthlyAmounts)
  - Pace/projection engine (computePaceAndProjection, buildCoveredMonthSeries) with a
    type-level-unreadable insufficient-coverage outcome
  - RETIRE-05 byte-identical Overview/Tags regression baseline, re-runnable unchanged by
    Phase 83's direction.hidden predicate flip
affects: [83-categories-list, 84-category-detail-and-cleanup]

tech-stack:
  added: []
  patterns:
    - "Engine DAL functions read the raw transaction table for coverage (lens-independent, D-12) but the ledgerRowSource seam for category amounts (D-12-scoped defaults to cassa)"
    - "Discriminated union with no numeric field on the degenerate branch, enforced at the type level rather than by convention (D-05)"
    - "Pure composition functions (buildCoveredMonthSeries) kept separate from async DAL queries so D-01/D-02 logic is unit-testable without a DB"

key-files:
  created:
    - lib/dal/covered-months.ts
    - lib/services/pace-and-projection.ts
    - tests/pace-and-projection.test.ts
    - tests/pace-engine-lens-regression.test.ts
  modified: []

key-decisions:
  - "MonthlyValue amounts fed to computePaceAndProjection/buildCoveredMonthSeries are magnitudes (abs), matching getCategoryRanking's abs(sum(...)) convention — not signed transaction amounts"
  - "Task 1's tracer test manually constructs MonthlyValue[] from the seeded transaction amounts (getCategoryMonthlyAmounts does not exist until Task 2)"
  - "Second-user userId-scoping test reuses the first taxonomy's essentialNatureId via seedSecondEssentialCategory rather than calling seedMinimalTaxonomy twice, since direction/nature are global lookup tables with a unique(code) constraint"

patterns-established:
  - "getCategoryMonthlyAmounts' query chain is deliberately simpler than getCategoryRanking's (no nature/direction join) since a single categoryId already implies one fixed direction"

requirements-completed: [PACE-01, PACE-03, RETIRE-05]

coverage:
  - id: D1
    description: "getCoveredMonthsInYear(year) excludes zero-transaction months from the denominator entirely (D-01), is year-only scoped with no window argument (D-04), returns [] never throws/null on a zero-transaction year, and is proven user-scoped against a real-Postgres fixture with a gap month and a second user"
    requirement: "PACE-01"
    verification:
      - kind: integration
        ref: "tests/pace-engine-lens-regression.test.ts#Covered Months engine — real Postgres (PACE-01, D-01/D-04/D-05/D-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "computePaceAndProjection returns the 'insufficient' variant for <2 Covered Months with no pace/projection field readable at the type level (D-05), and 'complete' with correctly Decimal-rounded pace/projection for >=2"
    requirement: "PACE-03"
    verification:
      - kind: integration
        ref: "tests/pace-engine-lens-regression.test.ts#Covered Months engine — real Postgres (PACE-01, D-01/D-04/D-05/D-11) > returns exactly the 3 seeded Covered Months ascending and computes pace/projection from them"
        status: pass
      - kind: integration
        ref: "tests/pace-engine-lens-regression.test.ts#Covered Months engine — real Postgres (PACE-01, D-01/D-04/D-05/D-11) > returns [] for a zero-transaction year, never throwing, and computePaceAndProjection([]) is insufficient"
        status: pass
    human_judgment: false
  - id: D3
    description: "getCategoryMonthlyAmounts returns a 12-entry zero-filled series; buildCoveredMonthSeries drops an uncovered month entirely (D-01) and keeps a covered-but-zero-movement month (D-02); pace on the seasonal-category fixture matches CONTEXT.md's worked example (31.67, not 190.00)"
    requirement: "PACE-01"
    verification:
      - kind: unit
        ref: "tests/pace-and-projection.test.ts#buildCoveredMonthSeries — seasonal category (PACE-01, D-01/D-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "RETIRE-05 regression baseline: Overview's getOverviewAmountTotals.totalOut and Tags' getTagTotals per-tag total assert against hardcoded, hand-computed Decimal values (never re-derived from the function under test) for a one-transaction fixture"
    requirement: "RETIRE-05"
    verification:
      - kind: integration
        ref: "tests/pace-engine-lens-regression.test.ts#Overview and Tags totals — byte-identical regression (RETIRE-05, D-15/D-16)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-07-30
status: complete
---

# Phase 82 Plan 01: Number Engine Foundation + RETIRE-05 Baseline Summary

**Covered Month DAL query, pace/projection engine with a type-unreadable insufficient-coverage outcome, and the RETIRE-05 byte-identical Overview/Tags regression baseline — all proven against real Postgres before any other Phase 82 code lands.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files modified:** 4 (all new)

## Accomplishments
- `getCoveredMonthsInYear(year)` — reads the raw `transaction` table (never a lens view, D-12), scoped to the authenticated user, year-only parameter (D-04), returns `[]` on error/no data (D-01), proven against a 3-month fixture, a zero-transaction year, and a second user's fixture (userId scoping).
- `computePaceAndProjection` — discriminated `PaceResult` union whose `'insufficient'` branch carries no `pace`/`projection` field at all, making D-05's "no fragile number" contract a TypeScript error rather than a convention; `'complete'` branch rounds once at the `toDbDecimal()` return boundary using decimal.js's default `ROUND_HALF_UP`.
- `getCategoryMonthlyAmounts(categoryId, year, ledgerRowSource?)` — 12-entry zero-filled `MonthlyValue[]` per category, simpler join chain than `getCategoryRanking` (no nature/direction join).
- `buildCoveredMonthSeries` — pure composition proving D-01 (an uncovered month is dropped entirely) and D-02 (a covered month with zero category movement survives as `'0.00'` and counts), validated against CONTEXT.md's worked seasonal-category example (€380 / 12 Covered Months = €31.67).
- RETIRE-05 baseline in `tests/pace-engine-lens-regression.test.ts` — hardcoded, hand-computed Overview/Tags totals for a one-transaction fixture, reusing `captureAggregationSnapshot()`; the harness re-uses the existing real-Postgres infrastructure unchanged, so it is re-runnable by Phase 83 after its `direction.hidden` predicate flip (D-16).

## Task Commits

Each task was committed atomically:

1. **Task 1: Covered Months query -> pace existence check -> real-Postgres proof, plus the RETIRE-05 baseline** - `48e64095` (feat)
2. **Task 2: Category-scoped monthly totals + the D-02 seasonal-category composition** - `0158bc09` (feat)

**Plan metadata:** (pending — see final commit below)

_Note: both tasks were `tdd="true"`; the plan's own `<verify>` command IS the red/green proof (the covered files did not exist before this plan, so there is no separate pre-existing RED commit to point to beyond "file did not exist, tests failed to import, then passed once implemented" — verified interactively before each commit, not as a separate git commit)._

## Files Created/Modified
- `lib/dal/covered-months.ts` - `getCoveredMonthsInYear` (Task 1) + `getCategoryMonthlyAmounts` (Task 2)
- `lib/services/pace-and-projection.ts` - `MIN_COVERED_MONTHS_FOR_PACE`, `MonthlyValue`, `PaceResult`, `computePaceAndProjection` (Task 1) + `buildCoveredMonthSeries` (Task 2)
- `tests/pace-and-projection.test.ts` - unit coverage for `buildCoveredMonthSeries`'s D-01/D-02 seasonal-category behavior (Task 2)
- `tests/pace-engine-lens-regression.test.ts` - real-Postgres tracer proof (Task 1's Covered Months engine describe block) + RETIRE-05 byte-identical baseline (Task 1)

## Decisions Made
- MonthlyValue amounts are magnitudes (`abs`), not signed transaction amounts — matches `getCategoryRanking`'s existing `abs(sum(...))` convention. The plan's `<behavior>` block quotes the seeded transactions' signed amounts (`-400.00` etc.) but the MonthlyValue series fed to `computePaceAndProjection` uses the corresponding positive magnitudes so pace/projection come out positive as specified.
- Task 1's tracer test builds `MonthlyValue[]` by hand from the seeded transaction amounts rather than calling `getCategoryMonthlyAmounts` (which is Task 2's deliverable and did not exist yet at Task 1 commit time) — matches the plan's own phrasing ("the corresponding MonthlyValue[]").
- The userId-scoping test (Task 1's third `it()`) reuses the first user's `essentialNatureId` via `seedSecondEssentialCategory` for the second user instead of calling `seedMinimalTaxonomy` a second time — `direction`/`nature` are global lookup tables with a `unique(code)` constraint, so a second `seedMinimalTaxonomy` call in the same test fails with a duplicate-key violation. This is the same pattern already used in `tests/reimbursement-residual.test.ts`'s cross-user IDOR test.

## Deviations from Plan

None - plan executed exactly as written. The two adjustments above (MonthlyValue sign convention, second-user taxonomy seeding) are implementation details filled in under "Claude's Discretion" (test mechanics, exact fixture construction), not deviations from a locked instruction.

## Issues Encountered
- Initial run of the userId-scoping test failed with `duplicate key value violates unique constraint "direction_code_unique"` from calling `seedMinimalTaxonomy` twice in one test. Root cause: `direction`/`nature` are global (not user-scoped) lookup tables truncated per-test but not per-user. Fixed by reusing the existing `reimbursement-residual.test.ts` pattern (`seedSecondEssentialCategory` + the first taxonomy's `essentialNatureId`) rather than re-seeding the whole taxonomy for the second user.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The engine's public contract (`CoveredMonth`, `MonthlyValue`, `PaceResult`, `getCoveredMonthsInYear`, `getCategoryMonthlyAmounts`, `computePaceAndProjection`, `buildCoveredMonthSeries`) is stable and ready for Plan 82-02/82-03 and Phases 83/84 to import.
- The RETIRE-05 baseline is captured and green **before** any further engine or Categories UI work, satisfying the phase's ordering constraint. It must stay unmodified (except for a genuine intentional Overview/Tags totals change) through Phase 83's `direction.hidden` predicate flip.
- No blockers for Plan 82-02 (lens confinement / `tag` param removal) or Plan 82-03 (remaining engine surface: hybrid current month, total=sum-of-series, sign convention).

---
*Phase: 82-number-engine-and-regression-gate*
*Completed: 2026-07-30*

## Self-Check: PASSED

All created files (`lib/dal/covered-months.ts`, `lib/services/pace-and-projection.ts`,
`tests/pace-and-projection.test.ts`, `tests/pace-engine-lens-regression.test.ts`, this SUMMARY)
verified present on disk. Both task commits (`48e64095`, `0158bc09`) verified present in
`git log --oneline --all`.

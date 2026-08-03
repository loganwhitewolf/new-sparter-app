---
phase: 83-categories-list
plan: 01
subsystem: database
tags: [drizzle, postgres, decimal.js, vitest, dashboard]

# Dependency graph
requires:
  - phase: 82-number-engine-and-regression-gate
    provides: getCoveredMonthsInYear, buildYearSeries, computePaceAndProjection, computeCurrentMonthHybrid, isPartialMonth, buildCoveredMonthSeries, MIN_COVERED_MONTHS_FOR_PACE (lib/services/pace-and-projection.ts, lib/dal/covered-months.ts)
provides:
  - "getCategoryYearRanking(year, directionCode) — year+direction-scoped category ranking DAL function, additive alongside getCategoryRanking"
  - "CategoryYearRankingItem / CategoryYearSparklinePoint types — the contract Plan 83-04 (Categories list page) and Phase 84 (detail page) both consume"
  - "D-09 predicate flip proven reachable: direction.hidden=false replaces includedInTotals, surfacing the allocation direction for the first time"
  - "12-month sparkline with explicit covered/current/estimated/uncovered state, D-06 current-month hybrid, D-07 total-equals-sum invariant, D-15 insufficient-coverage null projection/pace"
affects: [83-04-categories-list-page, 84-category-detail-and-cleanup]

# Actuals (#2632)
actuals:
  tokens: 9400
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive DAL function alongside a protected existing one (getCategoryRanking untouched) instead of reshaping in place, to avoid breaking v2.8/v2.9 regression suites"
    - "Shared, once-computed per-month state classification map (never recomputed per category) composed with a per-category pace/projection pass"

key-files:
  created:
    - tests/categories-ranking-dal.test.ts
  modified:
    - lib/dal/dashboard.ts

key-decisions:
  - "getCategoryYearRanking is a NEW, additive function — getCategoryRanking/buildCategoryRankingData are never touched, protected by tests/reimbursement-regression.test.ts and captureAggregationSnapshot"
  - "amount is always buildYearSeries(displayed sparkline).total (D-07) — recomputed AFTER the current-month hybrid substitution, never independently derived"
  - "projection/pace are null below MIN_COVERED_MONTHS_FOR_PACE (2) pace-eligible Covered Months (D-15), never coerced"

patterns-established:
  - "Month-state classification computed once per year (shared Map across every category row), not per-category — avoids O(categories x months) redundant isPartialMonth/date-math calls and guarantees every category agrees on which month is 'current'"

requirements-completed: [CLIST-01, CLIST-02, CLIST-04, CLIST-06]

coverage:
  - id: D1
    description: "getCategoryYearRanking(year, directionCode) returns a year-scoped, direction-flipped ranking with D-07-compliant totals, 12-entry zero-filled sparklines, and userId isolation"
    requirement: CLIST-01
    verification:
      - kind: unit
        ref: "tests/categories-ranking-dal.test.ts#getCategoryYearRanking — year+direction predicate flip, D-07 total invariant (CLIST-01, CLIST-04, D-09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-09 predicate flip (direction.hidden=false replaces includedInTotals) surfaces the allocation direction for the first time"
    requirement: CLIST-04
    verification:
      - kind: unit
        ref: "tests/categories-ranking-dal.test.ts#surfaces the allocation direction for the first time (D-09: hidden=false replaces includedInTotals)"
        status: pass
    human_judgment: false
  - id: D3
    description: "12-month sparkline distinguishes covered/current/estimated/uncovered state; current month uses computeCurrentMonthHybrid; estimated months never carry a fabricated amount"
    requirement: CLIST-02
    verification:
      - kind: unit
        ref: "tests/categories-ranking-dal.test.ts#classifies the current calendar month as current (hybrid amount) and future months as estimated (D-06, D-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "projection/pace are both null below MIN_COVERED_MONTHS_FOR_PACE (2) pace-eligible Covered Months, proven for 0- and 1-covered-month years; non-null and computePaceAndProjection-exact above the threshold"
    requirement: CLIST-06
    verification:
      - kind: unit
        ref: "tests/categories-ranking-dal.test.ts#leaves projection/pace both null with exactly 1 Covered Month (D-15)"
        status: pass
      - kind: unit
        ref: "tests/categories-ranking-dal.test.ts#returns [] with zero Covered Months, never throwing"
        status: pass
      - kind: unit
        ref: "tests/categories-ranking-dal.test.ts#computes projection/pace from >= 2 pace-eligible Covered Months in a past year, with every month covered/uncovered (never current/estimated)"
        status: pass
    human_judgment: false
  - id: D5
    description: "tests/pace-engine-lens-regression.test.ts (RETIRE-05, D-10) re-run unmodified and green after this plan's predicate-flip and hybrid-composition changes land"
    verification:
      - kind: unit
        ref: "tests/pace-engine-lens-regression.test.ts (full suite, byte-identical to committed version)"
        status: pass
    human_judgment: false

duration: 48min (Task 1 by a prior session, killed by an API session limit mid-Task-2; this continuation verified/fixed/finished Task 2 and produced this Summary)
completed: 2026-07-31
status: complete
---

# Phase 83 Plan 01: Category Year Ranking DAL Summary

**getCategoryYearRanking DAL function — year+direction category ranking with the D-09
allocation-direction predicate flip, a 12-month sparkline carrying explicit
covered/current/estimated/uncovered state, the D-06 current-month hybrid, and D-15
insufficient-coverage null projection/pace — proven against real Postgres, RETIRE-05 unchanged.**

## Performance

- **Duration:** Task 1 executed and committed by a prior agent session (killed by an API session
  limit, not by any problem with the work); this continuation verified that partial/uncommitted
  Task 2 work, fixed one test-fixture bug found during verification, ran the full verification
  suite, and committed Task 2 — roughly 48 minutes from Task 1's commit to Task 2's commit
  (including the session gap).
- **Started:** 2026-07-31T12:28:25Z (Task 1 commit)
- **Completed:** 2026-07-31T13:16:58Z (Task 2 commit)
- **Tasks:** 2/2
- **Files modified:** 2 (`lib/dal/dashboard.ts`, `tests/categories-ranking-dal.test.ts`)

## Accomplishments

- `getCategoryYearRanking(year, directionCode)` — new, additive DAL function returning a
  year-scoped, direction-flipped category ranking; `getCategoryRanking`/`buildCategoryRankingData`
  are provably untouched (protected v2.8/v2.9 regression baselines).
- D-09 predicate flip proven reachable end-to-end: `eq(direction.hidden, false)` replaces
  `includedInTotals`, surfacing the allocation direction (Accantonamenti) for the first time.
- Every category's 12-entry sparkline carries an explicit per-month `state`
  (`covered`/`current`/`estimated`/`uncovered`), computed once and shared identically across every
  category row for the year.
- The current month's displayed amount is `computeCurrentMonthHybrid(spentSoFar, pace)` — never
  below the observed fact — whenever the year has >= 2 pace-eligible Covered Months; otherwise it
  stays the raw observed amount. `amount` (the item-level total) is always
  `buildYearSeries(displayed sparkline).total`, recomputed after the hybrid substitution (D-07).
- `projection`/`pace` are both `null` below `MIN_COVERED_MONTHS_FOR_PACE` (2) pace-eligible
  Covered Months (D-15) — proven for 0- and 1-covered-month years — and exactly
  `computePaceAndProjection`'s own output above the threshold.
- `tests/pace-engine-lens-regression.test.ts` (RETIRE-05, D-10) re-run unmodified and green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Year+direction category ranking end-to-end — predicate flip, zero-filled series,
   D-07 total invariant (real Postgres)** — `c286ef52` (feat) — committed by the prior (killed)
   agent session.
2. **Task 2: Month-state classification, current-month hybrid, projection composition, D-15
   insufficient handling, RETIRE-05 re-run** — `5a6ce096` (feat) — committed by this continuation
   session, after verifying/fixing the prior session's uncommitted work.

**Plan metadata:** committed by this continuation, see State Updates below.

## Files Created/Modified

- `lib/dal/dashboard.ts` — additive: `CategoryYearSparklinePoint`, `CategoryYearRankingItem`,
  `buildCategoryYearRankingData`, `getCategoryYearRanking`; existing `getCategoryRanking` /
  `buildCategoryRankingData` untouched.
- `tests/categories-ranking-dal.test.ts` — new file, real-Postgres proof for both tasks
  (predicate flip/D-07/D-09/userId-isolation in Task 1's describe block; month-state
  classification/current-hybrid/D-15 in Task 2's describe block).

## Decisions Made

- Followed the plan's locked additive (not reshape-in-place) architecture — `getCategoryRanking`
  stays untouched, `getCategoryYearRanking` is a parallel function.
- No new architectural decisions were made during this continuation; Task 2's implementation
  matched the plan's `<action>` block exactly (shared once-computed month-state map, per-category
  pace/projection composed from the raw pre-hybrid series, hybrid substitution applied only to the
  `state === 'current'` point, `amount` recomputed post-substitution).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a timezone-driven month-boundary bug in the current-month test fixture**
- **Found during:** Task 2 verification (this continuation session) — the "classifies the current
  calendar month as current... " test failed its pace/projection assertion on first run.
- **Issue:** The test seeded the current-month transaction at
  `new Date(currentYear, currentMonthIndex, 1)` (local midnight on the 1st). Under this machine's
  CEST (UTC+2) timezone, local midnight on day 1 stores as `22:00 UTC` the *previous* day —
  crossing the month boundary in Postgres's UTC-based `to_char` aggregation. The €50.00
  transaction meant to prove the current-month hybrid instead landed in the prior month's raw
  total, producing a pace of `316.67` instead of the expected `300.00`. This was a test-fixture
  bug, not a bug in `buildCategoryYearRankingData`/`getCategoryYearRanking` — debugged by writing
  a throwaway diagnostic test that dumped the raw `transaction` table rows and confirmed the
  `-50.00` row's `occurred_at` was `2026-06-30 22:00:00+00` instead of the intended July date.
- **Fix:** Changed the seed's `occurredAt` from local midnight to local noon
  (`new Date(currentYear, currentMonthIndex, 1, 12, 0, 0)`), which stays within the same UTC
  calendar day/month for any realistic timezone offset. Added an inline comment explaining why.
- **Files modified:** `tests/categories-ranking-dal.test.ts`
- **Verification:** Re-ran `node_modules/.bin/vitest run tests/categories-ranking-dal.test.ts
  tests/pace-engine-lens-regression.test.ts --reporter=verbose` — all 14 tests pass, including the
  previously-failing case (pace `300.00`, projection `3600.00`, current-month hybrid amount
  `300.00`, all "estimated" months at `0.00`, D-07 re-sum matches the displayed total).
- **Committed in:** `5a6ce096` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test-fixture bug, no production code affected).
**Impact on plan:** No scope creep. `lib/dal/dashboard.ts`'s implementation matched the plan's
`<action>` block on first read and required no changes; only the new test fixture needed a fix.

## Issues Encountered

- The prior agent session was killed mid-Task-2 by an API session limit, leaving
  `lib/dal/dashboard.ts` and `tests/categories-ranking-dal.test.ts` modified but uncommitted. This
  continuation read the diff in full against Task 2's `<behavior>`/`<action>` spec before trusting
  any of it, then ran the real-Postgres test suite to verify correctness rather than assuming the
  prior session's unfinished narration ("Now let's add Task 2's test describe block...") meant the
  work was complete — it was in fact functionally complete (all four required test cases already
  written) but had a single fixture bug, caught only by actually running the suite.
- `yarn build` and `yarn check:language` both re-verified clean after the fix, per the plan's
  `<verification>` block.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `getCategoryYearRanking`, `CategoryYearRankingItem`, `CategoryYearSparklinePoint` are ready for
  Plan 83-04 (Categories list page) to consume directly.
- Phase 84 (category detail page) can rely on the same `buildYearSeries` D-07 structural total
  once it migrates off the old preset-based `getCategoryDetail`/`getCategoryDeviations` machinery
  — CLIST-07's cross-page total-equality guarantee is structural, not yet cross-page-asserted (as
  the plan's Flagged Assumptions section noted going in).
- CLIST-06's UI-visibility rule for "exactly 1 raw Covered Month" (D-14's literal copy/visibility
  wording) is still NOT decided at the DAL layer — this function exposes no `coveredMonthCount`
  field of its own by design (flagged in the plan itself); Plan 83-04 must call
  `getCoveredMonthsInYear(year)` directly for that raw count.
- No blockers for the next plan in this phase.

---
*Phase: 83-categories-list*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: lib/dal/dashboard.ts
- FOUND: tests/categories-ranking-dal.test.ts
- FOUND: .planning/phases/83-categories-list/83-01-SUMMARY.md
- FOUND: commit c286ef52
- FOUND: commit 5a6ce096

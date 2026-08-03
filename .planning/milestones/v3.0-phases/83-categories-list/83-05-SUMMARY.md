---
phase: 83-categories-list
plan: 05
subsystem: dashboard
tags: [drizzle, postgres, decimal.js, react, vitest]

# Dependency graph
requires:
  - phase: 83-categories-list (plans 01-04)
    provides: getCategoryYearRanking, CategorySparkline, DashboardCategoryFilters href builders
provides:
  - "getCategoryYearRanking preserves the signed sum for the allocation direction (CR-01 closed)"
  - "CategorySparkline's estimated-bar height never collapses to 0% when pace is unavailable (WR-02 closed)"
  - "buildDashboardCategoriesHref/buildDashboardCategoryDetailHref preset-mode branch treats allocation consistently with year mode (WR-01 closed)"
affects: [84-category-detail-and-cleanup]

# Actuals (#2632)
actuals:
  tokens: 3488
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "DAL amount columns branch on directionCode when a direction's sign must survive to the UI, instead of unconditional abs()"
    - "Component-level reference-magnitude fallback (ESTIMATED_HEIGHT_FALLBACK) to satisfy a 'never flat/zero' rendering contract when an upstream hint is null"

key-files:
  created:
    - tests/category-allocation-negative-domain.test.tsx
  modified:
    - lib/dal/dashboard.ts
    - tests/categories-ranking-dal.test.ts
    - components/dashboard/category-sparkline.tsx
    - tests/category-sparkline.test.tsx
    - lib/routes.ts
    - tests/dashboard-filters.test.ts

key-decisions:
  - "getCategoryYearRanking branches its amountSql on directionCode === 'allocation' (signed sum) vs default (abs(sum)), rather than removing abs() globally — keeps in/out byte-identical per the plan's reversibility rationale."
  - "resolveEstimatedReference falls back to the series' own observed covered/current magnitude first, then a fixed ESTIMATED_HEIGHT_FALLBACK=1 constant only when that is also zero — never overrides a real pace hint."

patterns-established: []

requirements-completed: [CLIST-04]

coverage:
  - id: D1
    description: "getCategoryYearRanking preserves sign for the allocation direction; a net-divestment month is negative at the DAL boundary, an exact-zero month never triggers the sparkline's negative-domain marker"
    requirement: CLIST-04
    verification:
      - kind: integration
        ref: "tests/categories-ranking-dal.test.ts#preserves the signed monthly sum for the allocation direction — a net-divestment month stays negative, an exact-zero month never triggers the marker (CR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CategorySparkline renders the negative-domain border marker exactly once for real Postgres-sourced data (DAL -> component, not a synthetic prop)"
    requirement: CLIST-04
    verification:
      - kind: integration
        ref: "tests/category-allocation-negative-domain.test.tsx#renders exactly one border-top marker for the May net-divestment month, never for January (positive) or June (exact zero)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Estimated (future) sparkline bars never collapse to a flat 0% height when pace is unavailable and every other observed amount is also zero"
    verification:
      - kind: unit
        ref: "tests/category-sparkline.test.tsx#estimated bars never collapse to a flat 0% height when estimatedHeightHint is null and every other amount is also zero (WR-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildDashboardCategoriesHref/buildDashboardCategoryDetailHref preset-mode branch emits ?type=allocation instead of silently dropping it"
    verification:
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#preserves allocation type for list hrefs in preset mode (WR-01)"
        status: pass
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#preserves allocation type for detail hrefs in preset mode (WR-01)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-31
status: complete
---

# Phase 83 Plan 05: Categories Gap Closure Summary

**Allocation direction's SQL-level `abs()` no longer erases divestment signs; estimated sparkline bars never collapse to 0% when pace is null; preset-mode route builders stop silently dropping `type=allocation`.**

## Performance

- **Duration:** ~3 min (wall-clock across the three task commits)
- **Started:** 2026-07-31T19:54:00Z (approx, restart of a prior mid-Task-1 attempt)
- **Completed:** 2026-07-31T19:57:17Z
- **Tasks:** 3
- **Files modified:** 6 modified, 1 created

## Accomplishments

- **CR-01 (blocker) closed:** `getCategoryYearRanking`'s per-month `amount` column now branches on `directionCode` — `'allocation'` keeps the raw signed `sum(...)`, `'in'`/`'out'` keep the pre-existing `abs(sum(...))` untouched. A real-Postgres test (Jan +200.00, May -450.00, June exact-zero) proves the DAL boundary directly, and a second real-Postgres-backed test renders `CategorySparkline` with the DAL's actual output via `renderToStaticMarkup`, proving the negative-domain border marker fires exactly once — end-to-end, no synthetic prop.
- **WR-02 (warning) closed:** `CategorySparkline` gained `resolveEstimatedReference` + `ESTIMATED_HEIGHT_FALLBACK`. When `estimatedHeightHint` is null, estimated bars now normalize against the series' own observed covered/current magnitude, or a fixed positive constant if that's also zero — never a flat 0% bar. The existing hint-present behavior (150.00 reference, 100% height) is byte-identical.
- **WR-01 (latent defect) closed:** `buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref`'s preset-mode branch now mirrors `buildYearModeSearch`'s `filters.type && filters.type !== 'out'` check instead of special-casing only `'in'`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Allocation direction preserves sign end-to-end (CR-01)** - `1dd09dc1` (feat)
2. **Task 2: Estimated sparkline bars never collapse to 0% height (WR-02)** - `6079ebef` (fix)
3. **Task 3: Preset-mode route builders stop dropping allocation type (WR-01)** - `5fe6f588` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/dal/dashboard.ts` - `getCategoryYearRanking`'s amount column branches on `directionCode`; `getCategoryRanking` untouched (diff confined to lines >= 1333)
- `tests/categories-ranking-dal.test.ts` - new CR-01 negative-domain + exact-zero-boundary test case
- `tests/category-allocation-negative-domain.test.tsx` - new end-to-end tracer test (real Postgres -> DAL -> rendered component)
- `components/dashboard/category-sparkline.tsx` - `resolveEstimatedReference` helper + `ESTIMATED_HEIGHT_FALLBACK` constant
- `tests/category-sparkline.test.tsx` - new WR-02 fallback test case
- `lib/routes.ts` - preset-mode branches in both href builders mirror year-mode's type check
- `tests/dashboard-filters.test.ts` - two new allocation preset-mode test cases

## Decisions Made

- `amountSql` branches on `directionCode` inside `getCategoryYearRanking` rather than removing `abs()` from the query entirely — keeps `in`/`out` output byte-identical with zero risk to their existing (already-uniform-sign) behavior, per the plan's `reversibility` note.
- `ESTIMATED_HEIGHT_FALLBACK`'s exact value (1) is inconsequential — documented inline: whenever it fires it is the sole positive reference magnitude among `referenceMagnitudes`, so it always normalizes to 100% of itself.

## Deviations from Plan

None - plan executed exactly as written. All three tasks followed the plan's `<action>` blocks verbatim; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

A prior executor attempt for this exact plan died mid-Task-1 due to an API session limit, producing no commits. The orchestrator had already reverted its only partial (uncommitted) edit before this run started. This run executed Task 1 from scratch with no assumptions about prior progress.

## Known Stubs

None.

## Threat Flags

None - both new tasks touch only already-shipped, already-scoped surface (see the plan's own threat register T-83-08/T-83-09, disposition `accept`); no new endpoint, auth path, or schema change introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 83's `gaps_found` verification blockers (CR-01, WR-02) and the WR-01 latent defect are all closed. `CLIST-04` is now fully satisfied (not just reachable — the allocation direction's negative-domain rendering is proven end-to-end with real data).
- `yarn build`, `yarn check:language`, and the full test suite (180 files, 2197 tests, 1 todo) are green, including the protected `tests/pace-engine-lens-regression.test.ts` (RETIRE-05) and `tests/reimbursement-regression.test.ts` (v2.8/v2.9 baselines) regression gates.
- IN-01 and IN-02 (Info-level anti-patterns from 83-REVIEW.md) remain explicitly deferred per the plan's own rationale (IN-01 pairs with an identical pre-existing duplicate in `tag-ranking-list.tsx`, out of scope; IN-02 belongs to the category detail page's Phase 84 rewrite).
- Phase 83 is ready for re-verification / closure.

---
*Phase: 83-categories-list*
*Completed: 2026-07-31*

## Self-Check: PASSED

All created/modified files and task commits verified present on disk and in git history:
- `tests/category-allocation-negative-domain.test.tsx` - FOUND
- `.planning/phases/83-categories-list/83-05-SUMMARY.md` - FOUND
- `1dd09dc1` (Task 1) - FOUND
- `6079ebef` (Task 2) - FOUND
- `5fe6f588` (Task 3) - FOUND

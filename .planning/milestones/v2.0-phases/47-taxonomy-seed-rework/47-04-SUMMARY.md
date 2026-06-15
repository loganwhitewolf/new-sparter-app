---
phase: 47-taxonomy-seed-rework
plan: 04
subsystem: database
tags: [seed-extras, backfill, natureId, deployed-db, merge-migration]

# Dependency graph
requires:
  - phase: 47-03
    provides: v2 seed-data baseline + sign-agnostic pattern targets
provides:
  - seed-extras step 1 no-op (D-06)
  - STEPS 6-12 v2 deployed-DB transforms (insert, merge, rename, deactivate, nature_id backfill)
  - STEPS registry smoke test
affects: [47-05, 48]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Merge migration 4-step loop: expense → pattern dedupe → migrate → deactivate"
    - "nature_id backfill via (SELECT id FROM nature WHERE code = ...) (D-12)"
    - "Guarded runner so tests import STEP_NAMES without DATABASE_URL"

key-files:
  created:
    - tests/seed-extras-steps.test.ts
  modified:
    - scripts/seed-extras.ts

key-decisions:
  - "Steps 3-5 SET nature raw SQL replaced with deferred-to-backfill logs (A2 build-survival)"
  - "Full v2 STEPS 6-12 in single seed-extras commit (monolithic file; test in separate commit)"

patterns-established:
  - "v2 seed-extras ordering: insert → merge → rename → deactivate → backfill nature_id → override backfill"
  - "STEP_NAMES export + executedDirectly guard for testable registry without DB connection"

requirements-completed: [TAX-02, TAX-03]

# Metrics
duration: 18min
completed: 2026-06-11
---

# Phase 47 Plan 04: seed-extras v2 STEPS Summary

**Step 1 no-op plus seven additive v2 seed-extras steps for deployed DB remap and code-based nature_id backfill — ready for Phase 48 operator apply**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-11T12:16:00Z
- **Completed:** 2026-06-11T12:34:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced `setSubcategoryNature` with log-only no-op (D-06); removed all `SET nature =` from step 1
- Appended STEPS 6-12: insert, OUT/IN-ALLOCATION-TRANSFER merges, rename guards, deactivate pruned, `v2-backfill-nature-id`, `v2-backfill-override-nature-id`
- Backfill uses `nature.code` subquery — no hardcoded nature_id integers (D-12)
- A2 build-survival: steps 3-5 nature SET removed; deferred to backfill step
- `tests/seed-extras-steps.test.ts` 2/2 GREEN; `yarn tsc --noEmit` clean; no `db:seed-extras` run (D-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: No-op step 1 + append insert/merge/rename STEPS 6-9** - `5e7a1cc` (feat) — includes STEPS 10-12 in same file (monolithic seed-extras)
2. **Task 2: Append deactivate + nature_id backfill STEPS + registry test** - `2fe4e73` (test)

## Files Created/Modified

- `scripts/seed-extras.ts` — no-op step 1; helpers `migrateSubcategoryMerge`, rename guards; STEPS 6-12; `STEP_NAMES` export; guarded runner
- `tests/seed-extras-steps.test.ts` — registry smoke test for v2 step names and ordering

## Decisions Made

- Combined STEPS 10-12 (deactivate + backfill) in the feat commit because all v2 logic lives in one module; test isolated in second commit
- Assicurazioni wrapper subs `casa`/`salute` migrated via slug-resolved merge after OUT pairs (same idiom as step 3)
- `prelievo-contante` → `contante`: rename if target absent, else merge (extends step 4 idempotently)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] A2 build-survival for steps 3-5 SET nature**
- **Found during:** Task 2 (grep steps 3-5 for `SET nature =`)
- **Issue:** Historical steps still executed raw `UPDATE sub_category SET nature = …` on removed column — would fail on Phase 48 fresh-chain
- **Fix:** Replaced with log-only deferral to `v2-backfill-nature-id`; bodies otherwise unchanged per D-09
- **Files modified:** `scripts/seed-extras.ts`
- **Committed in:** `5e7a1cc`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required for runtime correctness post-Phase 46; no scope creep.

## Issues Encountered

None

## User Setup Required

None — DB apply deferred to Phase 48 (D-05).

## Next Phase Readiness

- Plan 47-05 can enable R-FN-03 todos + full test/build gate
- Phase 48 operator can run `yarn db:seed-extras` after migration + nature rows exist

## Self-Check: PASSED

- FOUND: `.planning/phases/47-taxonomy-seed-rework/47-04-SUMMARY.md`
- FOUND: commit `5e7a1cc`
- FOUND: commit `2fe4e73`

---
*Phase: 47-taxonomy-seed-rework*
*Completed: 2026-06-11*

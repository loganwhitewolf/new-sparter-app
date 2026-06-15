---
phase: 47-taxonomy-seed-rework
plan: 03
subsystem: database
tags: [seed, patterns, sign-agnostic, excludeFromTotals, natureId]

# Dependency graph
requires:
  - phase: 47-02
    provides: v2 subCategories with natureId + 23 active categories baseline
provides:
  - sign-agnostic categorizationPatterns retargeted to v2 subCategory slugs
  - seed.ts natureId pass-through comment + v2 TRANSFER excludeFromTotals slugs
affects: [47-04, 47-05, 48]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sign-agnostic categorizationPatterns without amountSign (D-10)"
    - "Bonifico IN+OUT deduped to single trasferimento-tra-conti pattern"
    - "excludeFromTotals post-insert for v2 TRANSFER subs (D-13)"

key-files:
  created: []
  modified:
    - scripts/seed-data.ts
    - scripts/seed.ts

key-decisions:
  - "altri-abbonamenti pattern retargeted to app-e-software (nearest v2 catch-all)"
  - "negozio-di-quartiere pattern retargeted to spesa-quotidiana (store-type split dropped)"
  - "treno pattern retargeted to mezzi-pubblici (treno sub pruned from OUT)"

patterns-established:
  - "Pattern literals: { pattern, subCategorySlug, confidence, priority, description } only — no amountSign"
  - "TRANSFER excludeFromTotals triple: trasferimento-tra-conti, addebito-carta-di-credito, contante"

requirements-completed: [TAX-01, TAX-02]

# Metrics
duration: 8min
completed: 2026-06-11
---

# Phase 47 Plan 03: Sign-Agnostic Patterns + seed.ts Wiring Summary

**28 sign-agnostic categorizationPatterns retargeted to v2 slugs; seed.ts passes natureId and sets excludeFromTotals on v2 TRANSFER subs**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-11T10:24:00Z
- **Completed:** 2026-06-11T10:32:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Removed `AmountSign` type and all `amountSign` fields from `categorizationPatterns` (D-10)
- Retargeted 28 pattern rows to v2 subCategory slugs per RESEARCH merge map; deduped bonifico IN+OUT → single `trasferimento-tra-conti` pattern
- Updated `seed.ts` excludeFromTotals to v2 TRANSFER slug triple; documented natureId pass-through on subCategory insert (D-11, D-13)
- Static missing-slug guard passes; `yarn test tests/seed-taxonomy.test.ts` 6/6 GREEN; `yarn tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Retarget categorizationPatterns to v2 slugs (sign-agnostic)** - `1022c1b` (feat)
2. **Task 2: Wire seed.ts natureId pass-through and v2 excludeFromTotals slugs** - `2bc5c14` (feat)

## Files Created/Modified

- `scripts/seed-data.ts` — sign-agnostic `categorizationPatterns` (28 rows) with v2 slug retargets; bonifico deduped
- `scripts/seed.ts` — natureId pass-through comment; excludeFromTotals updated to `trasferimento-tra-conti`, `addebito-carta-di-credito`, `contante`

## Decisions Made

- `altri-abbonamenti` → `app-e-software` (research allowed deactivate or nearest catch-all; kept pattern with app-e-software)
- `negozio-di-quartiere` → `spesa-quotidiana` (store-type split dropped in v2)
- `treno` → `mezzi-pubblici` (treno sub pruned; rail keywords still match via mezzi-pubblici)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 can append seed-extras STEPS 6+ (remap/backfill on deployed DB)
- Fresh install baseline now has correct pattern targets + natureId + excludeFromTotals wiring; DB apply still deferred (D-05)

## Self-Check: PASSED

- FOUND: `.planning/phases/47-taxonomy-seed-rework/47-03-SUMMARY.md`
- FOUND: commit `1022c1b`
- FOUND: commit `2bc5c14`

---
*Phase: 47-taxonomy-seed-rework*
*Completed: 2026-06-11*

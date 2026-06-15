---
phase: 47-taxonomy-seed-rework
plan: 02
subsystem: database
tags: [seed-data, taxonomy, natureId, wholesale-replace, vitest]

# Dependency graph
requires:
  - phase: 47-01
    provides: v2 slug manifest fixture and RED contract tests (Wave 0 gate)
provides:
  - v2 wholesale categories baseline (23 active system categories)
  - v2 subCategories with natureId 1-8 on all 87 manifest subs
  - GREEN seed-taxonomy contract tests for TAX-01/TAX-02 baseline
affects: [47-03, 47-04, 47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wholesale replace categories/subCategories literals in seed-data.ts (D-07)"
    - "Explicit natureId integer FK on every system subcategory literal (D-11)"

key-files:
  created: []
  modified:
    - scripts/seed-data.ts

key-decisions:
  - "Omit dissolved v1 wrapper categories from baseline array (not isActive:false) — fresh install uses 23 active rows only"
  - "Net-new category IDs: pensioni-e-sussidi=6, servizi-professionali=16, animali=17; cultura-e-tempo-libero reuses id 22; entrate-straordinarie reuses id 26"
  - "87 subcategories authored (manifest count), not gated on ~65 round number"

patterns-established:
  - "subCategories literal shape includes natureId matching natures[] ids 1-8"
  - "Transfer subs (trasferimento-tra-conti, addebito-carta-di-credito, contante) use natureId 6"

requirements-completed: [TAX-01, TAX-02]

# Metrics
duration: 6min
completed: 2026-06-11
---

# Phase 47 Plan 02: Wholesale seed-data v2 Categories + SubCategories Summary

**23 active v2 categories and 87 natureId-tagged subcategories replace v1 literals in seed-data.ts; Wave 0 contract tests GREEN**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-11T10:24:00Z
- **Completed:** 2026-06-11T10:29:14Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced `categories` array with 23 active v2 system categories per `V2_CATEGORY_SLUGS` (D-07)
- Replaced `subCategories` array with 87 manifest entries, each with explicit `natureId` 1-8 (D-11, D-13)
- Dissolved wrapper slugs absent from active set; dropped subs pruned (TAX-02 baseline)
- `yarn test tests/seed-taxonomy.test.ts` — 6/6 GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace categories array with v2 23-category baseline** - `5c9b977` (feat)
2. **Task 2: Replace subCategories array with v2 manifest + natureId on every sub** - `7926064` (feat)

## Files Created/Modified

- `scripts/seed-data.ts` — wholesale v2 `categories` (23 active) + `subCategories` (87 with natureId); directions/natures/platforms/categorizationPatterns untouched (D-04)

## Decisions Made

- Fresh baseline omits dissolved v1 categories entirely rather than keeping them as `isActive: false` — tests only assert active slug set; extras steps in Plan 04 handle deployed DB deactivation
- Reused surviving v1 numeric IDs per research A3; gap IDs 6/16/17 for net-new OUT/IN cats; id 22 for merged cultura-e-tempo-libero; id 26 repurposed for entrate-straordinarie
- Sub count follows manifest (87), consistent with Plan 01 decision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 can retarget `categorizationPatterns` slugs and wire `seed.ts` natureId pass-through + transfer `excludeFromTotals`
- directions/natures blocks unchanged as required (D-04)
- seed-extras STEPS 6+ (Plan 04) still needed for deployed DB remap (TAX-03 remainder)

## Self-Check: PASSED

- FOUND: scripts/seed-data.ts
- FOUND: .planning/phases/47-taxonomy-seed-rework/47-02-SUMMARY.md
- FOUND: 5c9b977
- FOUND: 7926064

---
*Phase: 47-taxonomy-seed-rework*
*Completed: 2026-06-11*

---
phase: 47-taxonomy-seed-rework
plan: 01
subsystem: testing
tags: [vitest, seed, taxonomy, tdd-scaffold, wave-0]

# Dependency graph
requires: []
provides:
  - v2 taxonomy slug manifest fixture (D-01 single source for test assertions)
  - RED seed-taxonomy contract tests as Wave 0 Nyquist gate
affects: [47-02, 47-03, 47-04, 47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manifest fixture sourced verbatim from nature-remapping-WORKING.md"
    - "Wave 0 RED contract tests gate seed-data v2 wholesale replace"

key-files:
  created:
    - tests/fixtures/v2-taxonomy-manifest.ts
    - tests/seed-taxonomy.test.ts
  modified: []

key-decisions:
  - "V2_SUBCATEGORY_MANIFEST includes 87 final subs (derived count, not gated on ~65)"
  - "DROPPED_SUBCATEGORY_SLUGS lists 28 pruned slugs from working doc D-03"

patterns-established:
  - "Import seed-data + manifest fixture for taxonomy contract tests"
  - "activeCategories/activeSubcategories filter isActive !== false"

requirements-completed: [TAX-01]

# Metrics
duration: 5min
completed: 2026-06-11
---

# Phase 47 Plan 01: Vitest RED Scaffold per Contratto Tassonomia v2

**Fixture manifest esplicito (23 cat / 87 sub) e 6 test Vitest RED che gateano il wholesale replace di seed-data in Plan 02**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-11T10:20:00Z
- **Completed:** 2026-06-11T10:24:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Creato `tests/fixtures/v2-taxonomy-manifest.ts` con slug v2 certificati da `nature-remapping-WORKING.md` (D-01)
- Creato `tests/seed-taxonomy.test.ts` con 6 assertion TAX-01/TAX-02 baseline
- Verificato stato RED: tutti e 6 i test falliscono contro baseline v1 (27 cat, natureId assente)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author v2 taxonomy slug manifest fixture from working doc** - `36e358b` (test)
2. **Task 2: Add RED seed-taxonomy contract tests (Wave 0)** - `8746b8e` (test)

## Files Created/Modified

- `tests/fixtures/v2-taxonomy-manifest.ts` - Manifest esplicito V2_CATEGORY_SLUGS (23), V2_SUBCATEGORY_MANIFEST (87), DISSOLVED (9), DROPPED (28), NATURE_ID_BY_CODE
- `tests/seed-taxonomy.test.ts` - Contratto Vitest RED per TAX-01/02/03

## Decisions Made

- Conteggio subcategorie derivato dal working doc: 87 entry nel manifest (16 IN + 59 OUT + 9 ALLOCATION + 3 TRANSFER), non gated sul round number ~65
- Nessuna modifica a `scripts/seed-data.ts` — conforme a D-04/D-07 (wholesale replace in Plan 02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 gate operativo: `yarn test tests/seed-taxonomy.test.ts` fallisce RED (atteso)
- Plan 02 può sostituire wholesale `categories`/`subCategories` in seed-data per rendere i test GREEN
- Manifest fixture è single source per assertion slug/nature in piani successivi

## Self-Check: PASSED

- FOUND: tests/fixtures/v2-taxonomy-manifest.ts
- FOUND: tests/seed-taxonomy.test.ts
- FOUND: 36e358b
- FOUND: 8746b8e

---
*Phase: 47-taxonomy-seed-rework*
*Completed: 2026-06-11*

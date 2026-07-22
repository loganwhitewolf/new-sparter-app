---
phase: 67-tags-foundation-and-assignment
plan: 02
subsystem: database
tags: [drizzle, seed-extras, categorization, regex, vacanze, tag-06]

# Dependency graph
requires:
  - phase: 67-01
    provides: tag + transaction_tag schema/migration (independent of this plan's work)
provides:
  - vacanze-audit-deactivate-subcategories seed-extras STEP (D-11/D-12/D-13)
  - Travel-only 'trasporto' regex pattern in seed-patterns-data.ts (D-14 regex half)
affects: [68-tags-dashboard-and-navigation, categorization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive seed-extras STEP with a two-phase idempotent audit (reset expenses, then deactivate subcategories) — reset always precedes deactivate, both re-run safely as 0-row no-ops"
    - "Regex pattern test imports the REAL exported systemCategorizationPatterns array (not a hand-copied stand-in) to exercise the actual shipped pattern"

key-files:
  created: []
  modified:
    - scripts/seed-extras.ts
    - scripts/seed-patterns-data.ts
    - tests/seed-extras-steps.test.ts
    - tests/categorization-match.test.ts

key-decisions:
  - "D-11/D-12/D-13 implemented as a single seed-extras STEP (vacanzeAudit): resolves the two subcategory ids by slug (never filtering on isActive, so re-runs still find them), resets linked expenses to da-categorizzare (subCategoryId=null, status='1') BEFORE deactivating the subcategories, and both UPDATEs run unconditionally so the empty-edge case (0 linked expenses) still deactivates cleanly."
  - "D-14 regex half only: added a travel-only 'trasporto' pattern (flight/ferry/rental-car keywords) that deliberately excludes treno/autobus/tram/metro/pendolare, keeping mezzi-pubblici/taxi-e-ride-sharing as daily-commute owners. The AI-categorizer-rules half of D-14 is explicitly deferred (Tier-3 AI categorization does not exist in lib/services/categorization.ts yet) — not fabricated."
  - "yarn db:seed-extras was run against the real (Supabase-hosted) DATABASE_URL target per project hard rules: 6 expenses were reset to da-categorizzare and 2 subcategories (attivita-e-intrattenimento, cibo-e-bevande) were deactivated."
  - "yarn db:seed-patterns (full replace of system regex patterns) was intentionally NOT run in this plan — the plan's own success criteria phrase this as 'would pick it up on next run', and seed-patterns.ts performs a full DELETE+re-INSERT of ALL system patterns (broader blast radius than this plan's scope). Flagged as an Operator Next Step."

patterns-established:
  - "Vacanze-audit pattern: any future 'move traffic out of a category' migration should follow the same reset-before-deactivate, id-resolved-by-slug, isActive-agnostic-lookup shape for a safe idempotent re-run."

requirements-completed: [TAG-06]

coverage:
  - id: D1
    description: "vacanze-audit-deactivate-subcategories STEP resets linked expenses to da-categorizzare then deactivates attivita-e-intrattenimento/cibo-e-bevande, registered last in STEPS"
    requirement: "TAG-06"
    verification:
      - kind: unit
        ref: "tests/seed-extras-steps.test.ts#seed-extras STEPS registry"
        status: pass
      - kind: manual_procedural
        ref: "yarn db:seed-extras run against real DATABASE_URL target — 6 expenses reset, 2 subcategories deactivated"
        status: pass
    human_judgment: false
  - id: D2
    description: "Travel-only 'trasporto' regex pattern added to seed-patterns-data.ts; matches flight/ferry/rental-car, excludes daily-commute keywords"
    requirement: "TAG-06"
    verification:
      - kind: unit
        ref: "tests/categorization-match.test.ts#trasporto pattern (D-14, travel-only)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-20
status: complete
---

# Phase 67 Plan 02: Vacanze category audit (TAG-06) Summary

**Additive seed-extras STEP deactivates the two overlapping Vacanze subcategories after resetting linked expenses to uncategorized, plus a new travel-only 'trasporto' regex pattern that excludes daily commute.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `vacanzeAudit` seed-extras STEP (`vacanze-audit-deactivate-subcategories`) added, registered last: resolves `attivita-e-intrattenimento`/`cibo-e-bevande` by slug (scoped to `categoryId: 4`), resets any linked expense to `subCategoryId: null, status: '1'` ("da categorizzare") BEFORE deactivating both subcategories, and safely no-ops on re-run.
- Ran `yarn db:seed-extras` against the real target — **6 expenses reset**, **2 subcategories deactivated** (`attivita-e-intrattenimento`, `cibo-e-bevande`).
- New travel-only `trasporto` regex pattern in `seed-patterns-data.ts`: matches flight (ryanair/easyjet/volo/lufthansa/klm/air france/wizzair), ferry (traghetto/ferry), and car-rental (autonoleggio/hertz/avis/europcar/sixt) keywords; deliberately excludes `treno`/`autobus`/`tram`/`metro`/`pendolare` so daily commute stays with `mezzi-pubblici`/`taxi-e-ride-sharing`.
- D-14's AI-categorizer-rules half is explicitly documented as deferred — no Tier-3 AI categorization exists yet in this codebase (`lib/services/categorization.ts` only implements Tier 1 regex + Tier 2 history).
- Both test files extended and green: `tests/seed-extras-steps.test.ts` (append-only registry assertions updated + 2 new tests), `tests/categorization-match.test.ts` (new `describe('trasporto pattern (D-14, travel-only)')` block, TDD RED→GREEN).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add vacanzeAudit seed-extras STEP (D-11, D-12, D-13)** - `a054d30` (feat)
2. **Task 2 RED: failing test for trasporto pattern** - `4dbb621` (test)
3. **Task 2 GREEN: implement trasporto pattern** - `d242383` (feat)

**Plan metadata:** committed with STATE/ROADMAP update (see below).

_Note: Task 2 was TDD (`tdd="true"`) — test-first RED commit, then GREEN implementation commit._

## Files Created/Modified
- `scripts/seed-extras.ts` - new `vacanzeAudit(database)` function + `vacanze-audit-deactivate-subcategories` STEP registration (last in STEPS array)
- `scripts/seed-patterns-data.ts` - new `subCategorySlug: "trasporto"` pattern entry (travel-only)
- `tests/seed-extras-steps.test.ts` - updated append-only invariant assertion (ensure-trade-republic-csv-global-format no longer necessarily last); added 2 new assertions pinning the new step as last and present
- `tests/categorization-match.test.ts` - new `describe` block with 5 tests against the real exported `systemCategorizationPatterns` trasporto entry

## Decisions Made
- Reset-before-deactivate ordering enforced by statement order within `vacanzeAudit` (not just STEPS array order) — verified by source inspection and the empty-edge/ordering must-haves in the plan.
- The subcategory-id lookup select does not filter on `isActive`, making both UPDATEs safe 0-row no-ops on re-run (idempotent per T-67-05).
- `yarn db:seed-patterns` (full replace of all system patterns) intentionally not run — out of this plan's scope; flagged as an Operator Next Step below.

## Deviations from Plan

None — plan executed exactly as written, including the TDD RED/GREEN sequence for Task 2 and running `yarn db:seed-extras` against the real target as directed by the project hard rules.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `yarn db:seed-extras` was already run against the real DATABASE_URL target as part of this plan's execution (see Accomplishments).

## Operator Next Steps

- `yarn db:seed-patterns` has NOT yet been run against the live target. Run it (full replace of system regex patterns, `userId = null`; user-created patterns are preserved) to make the new `trasporto` pattern live for future imports.
- The 6 expenses reset to "da categorizzare" by this plan's `yarn db:seed-extras` run are now visible to the user under Spese/Transazioni as uncategorized and require manual re-categorization (by design, per D-12 — no auto-remap).

## Next Phase Readiness
- TAG-06 fully delivered and independent of the tag schema/DAL work (67-01, 67-03+) — no blocking dependency for Phase 68.
- Vacanze/Viaggi category now holds only intrinsically-travel subcategories going forward for new imports once `yarn db:seed-patterns` is run.

---
*Phase: 67-tags-foundation-and-assignment*
*Completed: 2026-07-20*

## Self-Check: PASSED

All created/modified files found on disk; all task commit hashes (a054d30, 4dbb621, d242383) found in git history.

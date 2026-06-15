---
phase: 46-direction-nature-schema
plan: "03"
subsystem: database
tags: [seed, lookup-table, nature, direction, build-survival]

requires:
  - phase: 46-01
    provides: "direction and nature pgTables in schema.ts; category.type and amountSign columns removed"

provides:
  - "directions array (4 rows: in/out/allocation/transfer) exported from scripts/seed-data.ts"
  - "natures array (8 rows: income/income_extraordinary/essential/discretionary/debt/transfer/savings/investment) exported from scripts/seed-data.ts"
  - "scripts/seed.ts inserts directions before natures (FK order) via onConflictDoNothing"
  - "scripts/seed.ts repaired: category.type mapped-out at insert site; categorizationPattern.amountSign removed"
  - "scripts/seed-extras.ts repaired: pattern-dedupe predicate is sign-agnostic (no amountSign/amount_sign)"

affects:
  - "46-02 (union build gate: seed scripts now compile clean against new schema)"
  - "48 (migrate + seed will physically insert direction/nature rows)"
  - "49 (aggregation rewrite reads direction.included_in_totals)"

tech-stack:
  added: []
  patterns:
    - "baseline-lookup-seed: new lookup tables (direction, nature) get plain exported arrays in seed-data.ts, inserted in FK order via onConflictDoNothing in seed.ts"
    - "seed-build-survival: removed-column writes cleaned up at insert site (map-out pattern for category.type)"

key-files:
  created: []
  modified:
    - "scripts/seed-data.ts"
    - "scripts/seed.ts"
    - "scripts/seed-extras.ts"

key-decisions:
  - "category.type mapped-out at insert site (not removed from seed-data.ts literal) to keep seed-data.ts as a stable reference; map applied inline in seed.ts"
  - "setval calls added for direction_id_seq and nature_id_seq (matching platform_id_seq idiom) to keep sequences consistent with explicit-id inserts"
  - "savings label/color sourced from NATURE_LABELS/NATURE_COLORS[extraordinary] (Straordinario/#fbbf24); investment from NATURE_LABELS/NATURE_COLORS[financial] (Finanziario/#a78bfa) per nature-remapping-WORKING.md rename"
  - "seed-extras.ts edit is D-05 build-survival repair only — no new STEP added (D-09 honored)"

patterns-established:
  - "FK-ordered baseline seed: directions inserted before natures; setval called after each explicit-id batch"

requirements-completed: [DATA-01, DATA-02]

duration: 20min
completed: "2026-06-11"
---

# Phase 46 Plan 03: direction-nature-schema Seed Summary

**direction (4) and nature (8) baseline lookup rows authored in seed-data.ts; seed.ts wired in FK order with setval; removed-column writes cleaned from both seed scripts (build-survival for 46-01 schema, D-05)**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-11T09:10:00Z
- **Completed:** 2026-06-11T09:30:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `export const directions` (4 rows) and `export const natures` (8 rows) to `scripts/seed-data.ts` with locked attribute matrix and directionId FK mapping
- Wired `scripts/seed.ts` to import and insert directions before natures (FK order), using `onConflictDoNothing()` and `setval` for explicit-id sequences
- Repaired `scripts/seed.ts`: category.type mapped-out at insert site; categorizationPattern.amountSign removed (both columns removed by 46-01)
- Repaired `scripts/seed-extras.ts`: existing pattern-dedupe predicate made sign-agnostic (dropped amountSign tuple and amount_sign from SQL subquery); stale 3-column unique comment updated to 2-column

## Task Commits

Each task was committed atomically:

1. **Task 1: Define directions (4) + natures (8) baseline lookup arrays in seed-data.ts** - `a21ad93` (feat)
2. **Task 2: Wire seed.ts to insert directions/natures (FK order) and repair removed-column writes** - `6cb4f01` (feat)
3. **Task 3: Build-survival repair of the existing seed-extras.ts pattern-dedupe predicate** - `155937c` (fix)

## Files Created/Modified

- `scripts/seed-data.ts` — New `NetWorthEffect` type, `directions` (4 rows), `natures` (8 rows) appended at end of file
- `scripts/seed.ts` — New imports (direction, nature from schema; directions, natures from seed-data); insert steps in FK order with setval; category.type mapped-out; amountSign removed
- `scripts/seed-extras.ts` — Pattern-dedupe predicate at ~L335 made sign-agnostic; stale comment updated; inline Phase 46 comment added

## Decisions Made

- **category.type map-out strategy:** Map at insert site (`categories.map(({ type: _type, ...rest }) => rest)`) rather than editing the literal in seed-data.ts, to keep the data array byte-stable for any other consumers. The `_type` destructuring naming avoids unused-variable lint warnings.
- **setval calls:** Added for `direction_id_seq` and `nature_id_seq` after each batch insert. Mirrors the `platform_id_seq` idiom at seed.ts:90. Ensures sequences are consistent with the explicit `id` values, so auto-increment inserts by future phases will not collide.
- **natures[7] savings label/color:** Sourced from `NATURE_LABELS[extraordinary]` = "Straordinario" / `NATURE_COLORS[extraordinary]` = "#fbbf24" per the rename mapping in nature-remapping-WORKING.md.
- **natures[8] investment label/color:** Sourced from `NATURE_LABELS[financial]` = "Finanziario" / `NATURE_COLORS[financial]` = "#a78bfa" per the rename mapping.
- **Direction colors:** in → #34d399 (green); out → #f97316 (orange); allocation → #a78bfa (purple); transfer → #94a3b8 (slate). Not load-bearing for DATA-01.

## Deviations from Plan

None — plan executed exactly as written.

- D-09 honored: no new STEP added to `scripts/seed-extras.ts` STEPS array; only an existing predicate was repaired (D-05 build-survival edit)
- D-10 honored: `excludeFromTotals` UPDATE step retained in `scripts/seed.ts`
- D-06 honored: no `drizzle-kit generate`, no `drizzle-kit push`, no `scripts/migrate.ts`, no `yarn db:seed`, no `yarn db:seed-extras` run

## Issues Encountered

**Worktree schema state:** This worktree was branched from develop BEFORE the 46-01 commits (parallel wave execution). The local schema.ts still has `category.type` and `categorizationPattern.amountSign`. The edits were authored to compile correctly AFTER the merge with 46-01 (which removes those columns). The shared `yarn tsc --noEmit` / `yarn build` gate is owned by sibling plan 46-02 Task 3 on the merged union — not by this isolated worktree.

## Known Stubs

None — this plan produces static seed data and seed runner source only. No runtime data flows, no UI rendering, no API surface.

## Threat Flags

No new threat surface introduced. Seed-data authorship and seed-script repairs only; no SQL executed (D-06), no network or auth surface added.

## directions rows authored

| id | code | netWorthEffect | includedInTotals | shownSeparately | hidden | displayOrder | labelIt |
|----|------|----------------|------------------|-----------------|--------|--------------|---------|
| 1 | in | increase | true | false | false | 0 | Entrate |
| 2 | out | decrease | true | false | false | 1 | Uscite |
| 3 | allocation | neutral | false | true | false | 2 | Accantonamenti |
| 4 | transfer | neutral | false | false | true | 3 | Trasferimenti |

## natures rows authored

| id | code | directionId | labelIt | color |
|----|------|-------------|---------|-------|
| 1 | income | 1 (in) | Entrate ricorrenti | #34d399 |
| 2 | income_extraordinary | 1 (in) | Straordinaria | #a7f3d0 |
| 3 | essential | 2 (out) | Essenziale | #4ade80 |
| 4 | discretionary | 2 (out) | Discrezionale | #f97316 |
| 5 | debt | 2 (out) | Debiti | #f87171 |
| 6 | transfer | 4 (transfer) | Trasferimento | #94a3b8 |
| 7 | savings | 3 (allocation) | Straordinario | #fbbf24 |
| 8 | investment | 3 (allocation) | Finanziario | #a78bfa |

## Next Phase Readiness

- **46-02 (call-site repairs):** seed scripts no longer reference removed columns; the shared union build gate (46-02 Task 3) can verify clean typecheck once both 46-02 and 46-03 branches merge
- **Phase 47 (nature_id backfill on existing sub_category rows):** `seed-extras.ts` STEPS array is clean and ready for the Phase 47 backfill STEP (D-09: Phase 47 adds the NEW step)
- **Phase 48 (migrate + seed apply):** `scripts/seed.ts` is ready to physically insert direction and nature rows when Phase 48 runs migrate + seed

## Self-Check

- scripts/seed-data.ts exports directions: FOUND (line 1528)
- scripts/seed-data.ts exports natures: FOUND (line 1579)
- 4 direction codes: FOUND (in, out, allocation, transfer)
- 8 nature codes: FOUND (income, income_extraordinary, essential, discretionary, debt, transfer, savings, investment)
- scripts/seed.ts direction insert (line 75): FOUND
- scripts/seed.ts nature insert (line 80): FOUND
- scripts/seed.ts direction before nature: CONFIRMED (75 < 80)
- scripts/seed.ts no amountSign: CONFIRMED (only in comment)
- scripts/seed.ts excludeFromTotals retained: CONFIRMED (line 95)
- scripts/seed-extras.ts no amountSign/amount_sign: CONFIRMED (count=0)
- scripts/seed-extras.ts sign-agnostic comment: CONFIRMED
- No new STEP in STEPS array: CONFIRMED (5 steps, unchanged)
- Commits a21ad93, 6cb4f01, 155937c: FOUND

## Self-Check: PASSED

---
*Phase: 46-direction-nature-schema*
*Completed: 2026-06-11*

---
phase: 46-direction-nature-schema
plan: "01"
subsystem: database
tags: [schema, drizzle, lookup-table, nature, direction, postgres, migration]

requires: []

provides:
  - "direction pgTable with 8 analytical columns (code, label_it, net_worth_effect, included_in_totals, shown_separately, hidden, display_order, color) and direction_code_idx"
  - "nature pgTable with NOT NULL direction_id FK (onDelete: restrict) and nature_directionId_idx"
  - "subCategory.natureId nullable FK to nature (onDelete: set null) replacing flowNatureEnum column"
  - "userSubcategoryOverride.natureId nullable FK to nature (onDelete: set null) replacing flowNatureEnum column"
  - "directionRelations and natureRelations Drizzle relations"
  - "nature: one(nature) added to subCategoryRelations and userSubcategoryOverrideRelations"
  - "categoryTypeEnum, flowNatureEnum, amountSignEnum removed from schema.ts"
  - "category.type column and category_type_idx removed"
  - "categorizationPattern.amountSign column removed; unique constraint shrunk to (pattern, subCategoryId)"

affects:
  - "46-02 (call-site build-survival repairs)"
  - "46-03 (seed runner with direction+nature baseline rows)"
  - "47 (nature_id backfill on existing sub_category rows)"
  - "48 (drizzle-kit generate + migration apply)"
  - "49 (aggregation rewrite, excludeFromTotals removal)"

tech-stack:
  added: []
  patterns:
    - "lookup-not-enum: new lookup tables use varchar code columns instead of pgEnum to avoid painful Postgres enum migrations"
    - "FK onDelete: restrict for lookup parents (direction); set null for nullable child references (natureId); cascade for owned children"
    - "D-10 deviation: retain transitional columns with Phase-N removal comment"

key-files:
  created: []
  modified:
    - "lib/db/schema.ts"

key-decisions:
  - "direction.net_worth_effect is varchar (not pgEnum) — lookup-not-enum contract per ADR 0012"
  - "nature.direction_id is NOT NULL (onDelete: restrict) — forbids directionless nature; null sub_category.nature_id = uncategorized (D-02)"
  - "sub_category.nature_id / user_subcategory_override.nature_id are nullable FKs with onDelete: set null matching expenseClassificationHistory precedent"
  - "sub_category.exclude_from_totals RETAINED per D-10 deviation — removal deferred to Phase 49 when aggregation reads direction.included_in_totals"
  - "NO drizzle-kit generate, NO DB apply in this plan (D-06) — schema authorship only; migration is Phase 48"
  - "categorization_pattern unique constraint shrunk to (pattern, subCategoryId) — patterns become sign-agnostic per ADR 0012 superseding ADR 0008"

patterns-established:
  - "New lookup tables (direction, nature) placed after subCategory/userSubcategoryOverride block and before platform — FK targets resolve top-down"
  - "relations() for new lookup tables placed before platformRelations block"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06]

duration: 15min
completed: "2026-06-11"
---

# Phase 46 Plan 01: direction-nature-schema Summary

**`direction` and `nature` lookup tables added to schema.ts with NOT NULL FK chain, 3 deprecated enums removed, `category.type` + `amount_sign` dropped, and pattern unique constraint shrunk to `(pattern, subCategoryId)` — schema authorship complete, no migration generated (D-06)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-11T08:35:00Z
- **Completed:** 2026-06-11T08:50:38Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Added `direction` pgTable (4 static rows: in | out | allocation | transfer) with analytical boolean columns and `direction_code_idx`
- Added `nature` pgTable (8 rows per D-01) with NOT NULL `direction_id` FK (onDelete: restrict), `nature_directionId_idx`, and full `directionRelations`/`natureRelations` wiring
- Replaced `flow_nature` enum columns on `sub_category` and `user_subcategory_override` with nullable `nature_id` FK columns (onDelete: set null), including indexes and `relations()` updates
- Removed `categoryTypeEnum`, `flowNatureEnum`, `amountSignEnum` and all their column usages; shrunk `categorization_pattern` unique to `(pattern, subCategoryId)`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add direction + nature lookup tables and Drizzle relations** - `fbf76bb` (feat)
2. **Task 2: Replace flow_nature enum columns with nature_id FKs and wire relations** - `f24c97f` (feat)
3. **Task 3: Remove deprecated enums, category.type, amount_sign, shrink pattern unique constraint** - `7cf6800` (feat)

## Files Created/Modified

- `lib/db/schema.ts` — New `direction` and `nature` pgTables; new FK columns on `subCategory` and `userSubcategoryOverride`; deprecated enums and columns removed; unique constraint shrunk; relations updated

## Decisions Made

- `direction.net_worth_effect` stored as `varchar(16)` (values: increase|decrease|neutral), not a new pgEnum. Rationale: lookup-not-enum contract per ADR 0012 — avoids painful Postgres enum migrations when new values arrive.
- `nature.direction_id` is NOT NULL with `onDelete: "restrict"`. Rationale: forbids directionless nature rows; uncategorized is modeled as `nature_id = NULL` on the subcategory, not as a 9th nature row (D-02).
- `sub_category.nature_id` and `user_subcategory_override.nature_id` are nullable with `onDelete: "set null"`. Rationale: matches `expenseClassificationHistory.fromSubCategoryId` precedent; null = uncategorized state.
- `sub_category.exclude_from_totals` retained with inline `// Phase 49: removed once aggregation reads direction.included_in_totals` comment. Rationale: D-10 architect override to avoid two sources of truth during transition.

## Deviations from Plan

None — plan executed exactly as written. All column choices follow PATTERNS.md idioms. D-10 (`exclude_from_totals` retention) is a pre-declared deviation from the roadmap, not a new deviation from the plan.

## Issues Encountered

None.

## Known Stubs

None — this plan produces schema source only. No runtime data flows, no UI rendering.

## Threat Flags

No new threat surface introduced. Schema authorship only; no SQL executed, no network endpoints, no auth paths (see plan threat model: T-46-01/02/03 all addressed at source level).

## Next Phase Readiness

- **46-02 (build-survival call sites):** `lib/db/schema.ts` now has the target model. ~18 call sites that reference `category.type`, `subCategory.nature`, `amountSign` will fail typecheck — 46-02 repairs those for green build without semantic rewrite.
- **46-03 (seed runner):** `direction` and `nature` tables exist in schema; 46-03 adds baseline rows to `scripts/seed-data.ts` and wires `scripts/seed.ts`.
- **Phase 47 (nature_id backfill):** `sub_category.natureId` column exists; Phase 47 populates it on existing rows via `seed-extras.ts`.
- **Phase 48 (migration apply):** `drizzle-kit generate` + `scripts/migrate.ts` physically create the new tables, drop the old columns, and apply the unique constraint change.

## Self-Check: PASSED

- lib/db/schema.ts exists: FOUND
- 46-01-SUMMARY.md exists: FOUND
- Commit fbf76bb (Task 1): FOUND
- Commit f24c97f (Task 2): FOUND
- Commit 7cf6800 (Task 3): FOUND
- direction table present: OK
- nature table present: OK
- deprecated enums removed: OK
- excludeFromTotals retained: OK

---
*Phase: 46-direction-nature-schema*
*Completed: 2026-06-11*

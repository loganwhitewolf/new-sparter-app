---
phase: 03-expense-management
plan: "01"
subsystem: database
tags: [drizzle, postgres, schema, pgEnum, relations, expense, category]

requires:
  - phase: 02-authentication
    provides: user table (text PK) that expense.userId references
  - phase: 03-expense-management/03-00
    provides: lib/utils/decimal.ts, shadcn Table component, Playwright test stubs

provides:
  - lib/db/schema.ts — Drizzle schema extended with category, subCategory, expense tables
  - categoryTypeEnum pgEnum('category_type', ['in','out','system'])
  - expenseStatusEnum pgEnum('expense_status', ['1','2','3','4'])
  - All FK constraints and compound indexes for userId-scoped queries
  - Full relations: category→subCategories, subCategory→expenses, expense→user/subCategory

affects:
  - 03-02 (migration generation depends on this schema)
  - 03-03 (DAL queries use these tables and relations)
  - 03-04 (UI components and Server Actions consume expense/category tables)
  - drizzle/seed.ts (seeds category and subCategory tables defined here)

tech-stack:
  added: []
  patterns:
    - serial PK for lookup tables (category, subCategory); text PK for user-facing entities (expense) — consistent with user.id convention
    - pgEnum for status fields — DB-enforced value constraints
    - onDelete cascade for ownership FKs; onDelete set null for optional classification FKs

key-files:
  created: []
  modified:
    - lib/db/schema.ts — extended with categoryTypeEnum, expenseStatusEnum, category, subCategory, expense tables and all relations

key-decisions:
  - "expense.id uses text PK (consistent with user.id convention), not serial"
  - "expense.subCategoryId FK uses onDelete: set null — uncategorizing preserves the expense"
  - "expense.userId FK uses onDelete: cascade — user deleted removes all their expenses"
  - "expenseStatusEnum values are string literals ['1','2','3','4'] not integers — DB-level enum validation"
  - "subCategory uniqueness is composite (categoryId + slug) not global slug — allows same slug in different categories"

patterns-established:
  - "Lookup tables (category, subCategory) use serial integer PKs; user-facing entities (expense) use text PKs"
  - "All expense queries filter by userId — FK + compound indexes enforce this at DB level"

requirements-completed:
  - EXP-01
  - EXP-02
  - EXP-03

duration: 1min
completed: 2026-04-27
---

# Phase 3 Plan 01: Expense Schema Summary

**Drizzle schema extended with category/subCategory/expense tables, two pgEnums, four compound indexes, and full bidirectional relations.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-27T20:04:48Z
- **Completed:** 2026-04-27T20:06:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `categoryTypeEnum` and `expenseStatusEnum` pgEnums with DB-enforced value sets
- Defined `category` table (serial PK, slug unique, type enum, displayOrder, isActive) with 2 indexes
- Defined `subCategory` table (serial PK, categoryId FK cascade, composite slug+categoryId unique) with 1 index
- Defined `expense` table (text PK, userId FK cascade, subCategoryId FK set null, status default '1') with 4 compound indexes for userId-scoped queries
- Extended `userRelations` to include `expenses: many(expense)`
- Added `categoryRelations`, `subCategoryRelations`, `expenseRelations`
- TypeScript compilation passes with no errors

## Task Commits

1. **Task 1: Extend lib/db/schema.ts with category, subCategory, expense tables and relations** - `75ad4e3` (feat)

**Plan metadata:** (committed in final step)

## Files Created/Modified

- `lib/db/schema.ts` - Extended with 2 enums, 3 tables, 7 indexes, 3 new relation blocks, and extended userRelations

## Decisions Made

- `expense.id` uses `text('id').primaryKey()` (not serial) — consistent with `user.id` convention
- `expense.subCategoryId` FK uses `onDelete: 'set null'` — deleting a subcategory uncategorizes the expense rather than cascading delete
- `expenseStatusEnum` values are string literals `['1','2','3','4']` — DB enforces these as an enum type
- Composite unique on `subCategory(categoryId, slug)` allows same slug in different categories (e.g., "generale" can exist in both "Cibo" and "Trasporti")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema is complete and TypeScript-clean — Plan 02 (migration generation) can proceed immediately
- All FK constraints, indexes, and relations are in place as required by Plan 03 DAL queries
- No blockers

## Known Stubs

None. This plan adds only schema definitions — no UI components, no data flows, no placeholders.

## Threat Flags

No new trust boundaries introduced beyond those defined in the plan's threat model:

| Flag | File | Description |
|------|------|-------------|
| T-3-01-01 (handled) | lib/db/schema.ts | expense.userId FK defined as `references(() => user.id, { onDelete: 'cascade' })` — DB enforces ownership at schema level. DAL-layer WHERE clause enforcement deferred to Plan 03. |
| T-3-01-02 (handled) | lib/db/schema.ts | expenseStatusEnum pgEnum restricts status to ['1','2','3','4'] — DB rejects any other value. |

## Self-Check: PASSED

- lib/db/schema.ts: FOUND (modified, 196 lines)
- categoryTypeEnum: FOUND (line 23)
- expenseStatusEnum: FOUND (line 25)
- category table: FOUND (line 113)
- subCategory table: FOUND (line 125)
- expense table: FOUND (line 137)
- expenseRelations: FOUND (line 186)
- categoryRelations: FOUND (line 174)
- subCategoryRelations: FOUND (line 178)
- Commit 75ad4e3: FOUND

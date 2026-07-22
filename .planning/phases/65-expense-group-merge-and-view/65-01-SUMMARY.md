---
phase: 65-expense-group-merge-and-view
plan: 01
subsystem: database
tags: [drizzle, postgres, zod, schema, migration]

# Dependency graph
requires: []
provides:
  - "expenseGroup / expenseGroupMembership Drizzle schema tables + relations"
  - "0026_nervous_thena.sql migration (applied to dev DB)"
  - "MergeExpensesSchema / RenameExpenseGroupSchema Zod validators"
affects: [65-02, 65-03, 65-04, 65-05, 65-06, 66-expense-group-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone unique(expenseId) alongside pair unique(groupId, expenseId) to enforce a one-group-per-expense invariant at the DB level (precedent: transactionPair's per-transaction standalone uniques)"
    - "Grouping entity above an existing aggregate (expense) with zero persisted derived columns — totals always computed at read time in a later plan"

key-files:
  created: []
  modified:
    - lib/db/schema.ts
    - lib/validations/expense.ts
    - drizzle/migrations/0026_nervous_thena.sql (generated)
    - drizzle/migrations/meta/_journal.json (generated)
    - drizzle/migrations/meta/0026_snapshot.json (generated)

key-decisions:
  - "expenseGroup carries no totalAmount/transactionCount/first-last date columns — group totals are computed at read time in a later plan (D-01, ADR 0017)"
  - "expenseGroupMembership enforces at most one group per expense via a standalone unique(expenseId), not just the (groupId, expenseId) pair unique"
  - "MergeExpensesSchema has no category field at all — merge is pure regrouping; categorization of uncategorized selections happens via the pre-existing BulkCategorizeSchema/bulkCategorize action as a separate call (D-02)"

patterns-established:
  - "New grouping-entity schema additions live alongside their closest existing table block (expenseGroup/expenseGroupMembership placed after transactionPair, before categorizationPattern) with relations() added in the same relative order later in the file"

requirements-completed: [GRP-01, GRP-04]

coverage:
  - id: D1
    description: "expenseGroup and expenseGroupMembership tables + relations added to lib/db/schema.ts, with no persisted aggregate columns on expenseGroup and a standalone one-group-per-expense unique constraint on expenseGroupMembership"
    verification:
      - kind: unit
        ref: "yarn tsc --noEmit (schema.ts compiles; no expenseGroup/expenseGroupMembership related errors)"
        status: pass
      - kind: integration
        ref: "information_schema query against dev DB confirming expense_group_membership_expense_unique (expense_id alone) distinct from expense_group_membership_group_expense_unique (expense_id,group_id)"
        status: pass
    human_judgment: false
  - id: D2
    description: "0026_nervous_thena.sql migration generated and applied to the dev database; touches only the two new tables, no ALTER on expense/transaction"
    verification:
      - kind: integration
        ref: "grep of drizzle/migrations/0026_nervous_thena.sql confirming only CREATE TABLE/ALTER TABLE ADD CONSTRAINT/CREATE INDEX for expense_group and expense_group_membership; information_schema.tables query confirming both tables exist post-migrate"
        status: pass
    human_judgment: false
  - id: D3
    description: "MergeExpensesSchema (selectedExpenseIds min 2, no category field) and RenameExpenseGroupSchema exported and typed"
    verification:
      - kind: unit
        ref: "yarn tsc --noEmit (lib/validations/expense.ts compiles); grep -c firstSubCategoryId lib/validations/expense.ts == 0"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-18
status: complete
---

# Phase 65 Plan 1: expense-group-schema-and-validation Summary

**Additive expenseGroup/expenseGroupMembership Drizzle schema (no persisted aggregates, one-group-per-expense unique) plus MergeExpensesSchema/RenameExpenseGroupSchema Zod validators, migration 0026 applied to the dev database.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-18T17:16:18Z
- **Completed:** 2026-07-18T17:28Z
- **Tasks:** 3
- **Files modified:** 5 (2 hand-edited, 3 generated)

## Accomplishments
- `expenseGroup` and `expenseGroupMembership` tables added to `lib/db/schema.ts` with `relations()`, following the file's existing table/relations ordering convention
- Migration `0026_nervous_thena.sql` generated via `drizzle-kit generate` and applied via `scripts/migrate.ts` — verified additive-only (no `ALTER TABLE "expense"` / `"transaction"`)
- `MergeExpensesSchema` and `RenameExpenseGroupSchema` added to `lib/validations/expense.ts` with inferred types, mirroring existing bulk-action schema conventions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add expenseGroup + expenseGroupMembership schema tables and relations** - `e318daa` (feat)
2. **Task 2: [BLOCKING] Generate and apply the expense_group migration** - `0b55ce9` (feat)
3. **Task 3: Add MergeExpensesSchema and RenameExpenseGroupSchema validations** - `0a535a2` (feat)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `lib/db/schema.ts` - `expenseGroup`/`expenseGroupMembership` tables + `expenseGroupRelations`/`expenseGroupMembershipRelations`
- `lib/validations/expense.ts` - `MergeExpensesSchema`, `RenameExpenseGroupSchema`, and their inferred `MergeExpensesInput`/`RenameExpenseGroupInput` types
- `drizzle/migrations/0026_nervous_thena.sql` - generated migration (CREATE TABLE x2, FKs, indexes)
- `drizzle/migrations/meta/_journal.json`, `drizzle/migrations/meta/0026_snapshot.json` - drizzle-kit metadata

## Decisions Made
- None beyond what the plan already locked (ADR 0017 D-01/D-02/D-04) - followed plan as specified.

## Deviations from Plan

None — plan executed exactly as written. One environment note (not a deviation from the plan's instructions, but worth recording): the local Docker `postgres` container (`docker-compose.yml` / `yarn db:up`) was not running at the start of this task and was started per the plan's Task 2 instructions, but the project's active `DATABASE_URL` (used by default `yarn db:migrate`/`yarn db:generate`) actually points to a remote Supabase Postgres instance already at migration 0025 — that is the real dev database this phase's migration was applied to and verified against (via `information_schema` queries, since no local `psql` client is installed). The Docker container that was started is currently unused; left running, no cleanup action taken since starting it caused no side effects.

## Issues Encountered
- No local `psql` CLI available to run the plan's literal `docker compose exec -T postgres psql ...` verification commands. Substituted an equivalent `information_schema.columns`/`information_schema.table_constraints` query via a temporary Node script (using the `pg` package already in `node_modules`), confirming the same facts (column lists, and the standalone `expense_group_membership_expense_unique` constraint on `expense_id` alone) against the actual active database. Temp script was deleted after use, never committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `expenseGroup`/`expenseGroupMembership` tables and `MergeExpensesSchema`/`RenameExpenseGroupSchema` are live and importable — Plan 65-02 (DAL/service layer) can build `createExpenseGroup`/`renameExpenseGroup` and the `getExpenses`/`getExpenseGroupForDetail` composition queries against them immediately.
- No blockers. Note for future plans: verify the production/staging Supabase database (if distinct from the dev `DATABASE_URL` used here) also receives migration 0026 before it's exercised there.

## Self-Check: PASSED

All created/modified files found on disk; all task commit hashes (e318daa, 0b55ce9, 0a535a2) found in git log.

---
*Phase: 65-expense-group-merge-and-view*
*Completed: 2026-07-18*

---
phase: 66-expense-group-lifecycle
plan: 01
subsystem: api
tags: [drizzle, zod, expense-group, tdd, vitest]

# Dependency graph
requires:
  - phase: 65-expense-group-merge-and-view
    provides: expenseGroup/expenseGroupMembership schema, createExpenseGroup/renameExpenseGroup service functions and their DbOrTx/IDOR conventions
provides:
  - Four new Zod schemas for the three GRP-05/06/07 lifecycle inputs (CategorizeExpenseGroupSchema, AddExpensesToGroupSchema, RemoveExpenseFromGroupSchema, DissolveExpenseGroupSchema)
  - addExpensesToGroup(dbOrTx, input) — adds owned, ungrouped expenses to an existing owned group
  - removeExpenseFromGroup(dbOrTx, input) — removes one member, auto-dissolves at the 2-before/1-after boundary
  - dissolveExpenseGroup(dbOrTx, input) — deletes all memberships + the group row
affects: [66-02 (server actions that compose these into db.transaction), expense-group-lifecycle UI phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DbOrTx-accepting service functions never open their own db.transaction — caller owns the transaction boundary (established in Phase 65, reused here)"
    - "Count-before-delete inside the same DbOrTx call to close TOCTOU gaps on auto-dissolve decisions"

key-files:
  created: []
  modified:
    - lib/validations/expense.ts
    - lib/services/expense-group.ts
    - tests/expense-group-service.test.ts

key-decisions:
  - "removeExpenseFromGroup's auto-dissolve threshold is 'memberCount === 2 before delete' (not 'count after delete === 1') to keep the count and delete in one atomic sequence without a second post-delete count query"
  - "Shared-subcategory validation (D-05) deliberately NOT implemented in addExpensesToGroup — stays in the Plan 66-02 action layer, which already has the group's subCategoryId in scope"

patterns-established:
  - "Service functions performing group-ownership checks always select expenseGroup scoped by (id, userId) first, before any other read/write, mirroring the existing renameExpenseGroup precedent"

requirements-completed: [GRP-05, GRP-06, GRP-07]

coverage:
  - id: D1
    description: "Four new Zod schemas (CategorizeExpenseGroupSchema, AddExpensesToGroupSchema, RemoveExpenseFromGroupSchema, DissolveExpenseGroupSchema) with inferred types, type-checking clean"
    requirement: "GRP-05"
    verification:
      - kind: unit
        ref: "tsc --noEmit -p tsconfig.json (no lib/validations/expense.ts errors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "addExpensesToGroup adds owned/ungrouped expenses to an owned group; rejects not-owned group, partial expense ownership (IDOR), already-grouped expenses (precheck + 23505 race)"
    requirement: "GRP-06"
    verification:
      - kind: unit
        ref: "tests/expense-group-service.test.ts#addExpensesToGroup (5 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "removeExpenseFromGroup deletes one membership row; auto-dissolves the group when exactly 2 members existed before the delete; leaves the group intact at 3+ members; rejects not-owned/not-a-member"
    requirement: "GRP-07"
    verification:
      - kind: unit
        ref: "tests/expense-group-service.test.ts#removeExpenseFromGroup (4 cases including the auto-dissolve boundary)"
        status: pass
    human_judgment: false
  - id: D4
    description: "dissolveExpenseGroup deletes all memberships + the group row; rejects not-owned"
    requirement: "GRP-07"
    verification:
      - kind: unit
        ref: "tests/expense-group-service.test.ts#dissolveExpenseGroup (2 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "None of the three new functions ever write expense.subCategoryId/status or open their own db.transaction (structural D-09 guarantee, verified by source grep)"
    verification:
      - kind: unit
        ref: "grep -F '.update(expense)'/'.delete(expense)' lib/services/expense-group.ts -> no matches"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-19
status: complete
---

# Phase 66 Plan 01: Expense Group Lifecycle Service Functions Summary

**Zod schemas + three DbOrTx-accepting service functions (addExpensesToGroup, removeExpenseFromGroup with count-in-transaction auto-dissolve, dissolveExpenseGroup) implemented TDD-first, mirroring Phase 65's createExpenseGroup/renameExpenseGroup conventions**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-19T22:08:23+02:00 (first task commit)
- **Completed:** 2026-07-19T22:12:57+02:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added `CategorizeExpenseGroupSchema`, `AddExpensesToGroupSchema`, `RemoveExpenseFromGroupSchema`, `DissolveExpenseGroupSchema` (+ 4 inferred types) to `lib/validations/expense.ts`
- Implemented `addExpensesToGroup` (GRP-06) — group ownership check, expense IDOR check, already-grouped precheck, 23505 race translation, membership-only inserts
- Implemented `removeExpenseFromGroup` (GRP-07) — single-membership delete with in-transaction count-before-delete auto-dissolve at the 2-before/1-after boundary
- Implemented `dissolveExpenseGroup` (GRP-07) — deletes all memberships + the group row
- Extended `tests/expense-group-service.test.ts`'s `makeDbOrTx` mock factory with `expenseGroup`/count-query select branches and a `delete` dispatcher; all 17 tests pass (6 pre-existing + 11 new)

## Task Commits

Each task was committed atomically (TDD tasks split into separate RED/GREEN commits):

1. **Task 1: Add Zod schemas for the four new lifecycle inputs** - `82ea72d` (feat)
2. **Task 2: addExpensesToGroup service function** - `2a3f82e` (test, RED) → `ea46fca` (feat, GREEN)
3. **Task 3: removeExpenseFromGroup + dissolveExpenseGroup** - `62d2c42` (test, RED) → `d7d7ca0` (feat, GREEN)

**Plan metadata:** commit pending (final docs commit, see below)

## TDD Gate Compliance

Both `tdd="true"` tasks (2, 3) followed RED → GREEN:
- Task 2: `2a3f82e` (test — 5 new cases fail, `addExpensesToGroup is not a function`) → `ea46fca` (feat — all 11 tests pass)
- Task 3: `62d2c42` (test — 6 new cases fail) → `d7d7ca0` (feat — all 17 tests pass)

No REFACTOR commits were needed — both implementations matched the plan's specified shape on the first GREEN pass.

## Files Created/Modified
- `lib/validations/expense.ts` - Added 4 Zod schemas + inferred types for GRP-05/06/07 inputs
- `lib/services/expense-group.ts` - Added `addExpensesToGroup`, `removeExpenseFromGroup`, `dissolveExpenseGroup` (+ their `*Input` types); imported `count` from drizzle-orm
- `tests/expense-group-service.test.ts` - Extended `makeDbOrTx` mock (expenseGroup select branch, count-query detection via field shape, `delete` dispatcher); added 3 new `describe` blocks (11 new test cases total)

## Decisions Made
- Auto-dissolve threshold checked as "member count BEFORE delete equals 2" rather than re-querying after the delete — keeps the read-then-write sequence to a single count call inside the same DbOrTx invocation, closing the TOCTOU gap the RESEARCH.md pitfall called out (T-66-03), and avoids an unnecessary extra round-trip.
- The test mock's count-query detection dispatches on the shape of the `fields` object passed to `select()` (presence of a `count` key) rather than tracking call order, keeping the mock robust to statement reordering.

## Deviations from Plan

None - plan executed exactly as written. The plan's task descriptions already specified the mock extension shapes (`groupOwnedRows`, delete dispatcher, membership-count branch) at a level of detail that mapped directly onto the implementation with only naming choices left to the executor (e.g. `membershipRows`/`membershipCountRows` field names).

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 66-02 can now compose `addExpensesToGroup`, `removeExpenseFromGroup`, and `dissolveExpenseGroup` inside its own `db.transaction` calls from the server-action layer — all three accept `DbOrTx` and never open their own transaction.
- `removeExpenseFromGroup`'s auto-dissolve TOCTOU guarantee (T-66-03) depends on the caller wrapping the call in `db.transaction` — Plan 66-02 must honor this; flagged in the function's docstring.
- Shared-subcategory validation (D-05) for `addExpensesToGroup` is Plan 66-02's responsibility, not implemented here (documented above).

---
*Phase: 66-expense-group-lifecycle*
*Completed: 2026-07-19*

## Self-Check: PASSED

All created/modified files exist on disk; all 5 task commit hashes (82ea72d, 2a3f82e, ea46fca, 62d2c42, d7d7ca0) verified present in git log.

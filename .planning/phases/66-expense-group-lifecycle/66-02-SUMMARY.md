---
phase: 66-expense-group-lifecycle
plan: 02
subsystem: api
tags: [drizzle, zod, expense-group, server-actions, tdd, vitest]

# Dependency graph
requires:
  - phase: 66-expense-group-lifecycle
    plan: 01
    provides: CategorizeExpenseGroupSchema/AddExpensesToGroupSchema/RemoveExpenseFromGroupSchema/DissolveExpenseGroupSchema, addExpensesToGroup/removeExpenseFromGroup/dissolveExpenseGroup DbOrTx-accepting service functions
provides:
  - categorizeExpenseGroup(_prev, formData) — GRP-05 whole-group recategorize, dual-writes expense.subCategoryId/status + expenseGroup.subCategoryId in one db.transaction (D-09)
  - addExpensesToGroupAction(_prev, formData) — GRP-06 add owned/ungrouped/same-subcategory expenses to an existing group
  - removeExpenseFromGroupAction(_prev, formData) — GRP-07 remove one member (auto-dissolve delegated to Plan 66-01 service)
  - dissolveExpenseGroupAction(_prev, formData) — GRP-07 dissolve a group entirely
affects: [66-03 (invariance test), 66-04 (table/dialog UI), 66-05 (group detail UI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Group-level actions re-verify (groupId, userId) ownership INSIDE the db.transaction before touching any member row, mirroring bulkCategorize's IDOR comment (T-3-02)"
    - "addExpensesToGroupAction performs its own subcategory/ignored-status validation before delegating the membership insert to the Plan 66-01 service (D-05 stays at the action layer per that plan's decision)"

key-files:
  created: []
  modified:
    - lib/actions/expenses.ts
    - tests/expense-actions.test.ts

key-decisions:
  - "categorizeExpenseGroup writes inline (mirrors bulkCategorize's shape) rather than delegating to a service function, per the plan's explicit instruction — no other caller needs that logic separately"
  - "removeExpenseFromGroupAction/dissolveExpenseGroupAction wrap their Plan 66-01 service call in their own db.transaction so the service's TOCTOU-safe count-then-delete (T-66-03) always runs inside a real transaction boundary"

requirements-completed: [GRP-05, GRP-06, GRP-07]

coverage:
  - id: D1
    description: "categorizeExpenseGroup dual-writes expense.subCategoryId/status + expenseGroup.subCategoryId atomically, writes non-fatal per-member history, and is IDOR-scoped to (groupId, userId) before any row is touched"
    requirement: "GRP-05"
    verification:
      - kind: unit
        ref: "tests/expense-actions.test.ts#categorizeExpenseGroup (3 cases: happy path w/ 2 members, subcategory-invisible guard, not-owned guard)"
        status: pass
    human_judgment: false
  - id: D2
    description: "addExpensesToGroupAction rejects differently-categorized and ignored (status '4') additions before calling the addExpensesToGroup service; never creates a new group"
    requirement: "GRP-06"
    verification:
      - kind: unit
        ref: "tests/expense-actions.test.ts#addExpensesToGroupAction (5 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "removeExpenseFromGroupAction and dissolveExpenseGroupAction each run their Plan 66-01 service call inside exactly one db.transaction, revalidating only on success"
    requirement: "GRP-07"
    verification:
      - kind: unit
        ref: "tests/expense-actions.test.ts#removeExpenseFromGroupAction + #dissolveExpenseGroupAction (4 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "categorizeExpense (D-03 guard, lib/actions/expenses.ts) is byte-identical before/after this plan"
    verification:
      - kind: unit
        ref: "diff of awk-extracted categorizeExpense function body against commit 14ff5a9 (pre-plan) — IDENTICAL"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-19
status: complete
---

# Phase 66 Plan 02: Expense Group Lifecycle Server Actions Summary

**Four thin `"use server"` orchestration wrappers (categorizeExpenseGroup, addExpensesToGroupAction, removeExpenseFromGroupAction, dissolveExpenseGroupAction) composing the Plan 66-01 schemas/services into `db.transaction` calls, implemented TDD-first with full IDOR scoping**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-19T22:17:53+02:00 (first task commit)
- **Completed:** 2026-07-19T22:21:06+02:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Implemented `categorizeExpenseGroup` (GRP-05) — group-ownership check inside the transaction, dual-write of `expense.subCategoryId`/`status` (all members) and `expenseGroup.subCategoryId` in the same `db.transaction` (D-09), non-fatal per-member classification-history write (ADV-02 precedent)
- Implemented `addExpensesToGroupAction` (GRP-06) — WR-04 JSON guard, group-ownership check, IDOR-scoped expense-ownership check, ignored-status (WR-05-style) guard, shared-subcategory-with-group guard, delegates the membership insert to the Plan 66-01 `addExpensesToGroup` service
- Implemented `removeExpenseFromGroupAction` + `dissolveExpenseGroupAction` (GRP-07) — thin wrappers invoking the Plan 66-01 `removeExpenseFromGroup`/`dissolveExpenseGroup` services inside their own `db.transaction`, preserving the auto-dissolve TOCTOU guarantee (T-66-03)
- Extended `tests/expense-actions.test.ts` with 12 new test cases across 4 new `describe` blocks (22 → 31 total passing tests); added `expenseGroup` fields to the schema mock and `addExpensesToGroup`/`removeExpenseFromGroup`/`dissolveExpenseGroup` to the service mock
- Verified `categorizeExpense`'s D-03 guard is byte-identical to the pre-plan version (diff against commit 14ff5a9)

## Task Commits

Each task was executed TDD-first (RED test commit, then GREEN implementation commit):

1. **Task 1: categorizeExpenseGroup** — `9332e80` (test, RED) → `49d9eb8` (feat, GREEN)
2. **Task 2: addExpensesToGroupAction** — `2bc39ea` (test, RED) → `68357ce` (feat, GREEN)
3. **Task 3: removeExpenseFromGroupAction + dissolveExpenseGroupAction** — `73f0bb6` (test, RED) → `2aa412c` (feat, GREEN)

**Plan metadata:** commit pending (final docs commit, see below)

## TDD Gate Compliance

All three `tdd="true"` tasks followed RED → GREEN:
- Task 1: `9332e80` (test — 3 new cases fail, `categorizeExpenseGroup is not a function`) → `49d9eb8` (feat — all 22 tests pass)
- Task 2: `2bc39ea` (test — 5 new cases fail) → `68357ce` (feat — all 27 tests pass)
- Task 3: `73f0bb6` (test — 4 new cases fail) → `2aa412c` (feat — all 31 tests pass)

No REFACTOR commits were needed — each implementation matched the plan's specified shape on the first GREEN pass.

## Files Created/Modified
- `lib/actions/expenses.ts` — added `categorizeExpenseGroup`, `addExpensesToGroupAction`, `removeExpenseFromGroupAction`, `dissolveExpenseGroupAction`; extended the top-level Zod schema import block and the `@/lib/services/expense-group`/`@/lib/db/schema` import lines
- `tests/expense-actions.test.ts` — added `expenseGroup` fields to the `@/lib/db/schema` mock; added `addExpensesToGroup`/`removeExpenseFromGroup`/`dissolveExpenseGroup` to the hoisted mocks and the `@/lib/services/expense-group` mock; added 4 new `describe` blocks (12 new test cases)

## Decisions Made
- `categorizeExpenseGroup` writes inline (mirroring `bulkCategorize`'s shape) instead of delegating to a service function — the plan explicitly called for this since no other caller needs the whole-group recategorize logic separately.
- `removeExpenseFromGroupAction`/`dissolveExpenseGroupAction` each open their own `db.transaction` around the single Plan 66-01 service call, even though the service itself performs no other writes at the action layer — this guarantees the service's count-then-delete TOCTOU guarantee (T-66-03) always executes inside a transaction, regardless of how future callers might otherwise invoke the service directly with `db`.

## Deviations from Plan

None — plan executed exactly as written. Test mock shapes (`makeGroupTx`/`makeTx` call-order dispatch helpers) followed the same pattern already established by the `categorizeExpense` grouped-member guard and `mergeExpenses`' `mockTxSelectRows` helper in the existing test file.

## Issues Encountered
None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Plan 66-03 (invariance test) can now exercise all four new server actions directly.
- Plan 66-04 (table/dialog UI) and Plan 66-05 (group detail UI) have their complete backend surface: `categorizeExpenseGroup`, `addExpensesToGroupAction`, `removeExpenseFromGroupAction`, `dissolveExpenseGroupAction`, all calling `revalidateCategorizationSurfaces()` on success — same revalidation surface as `bulkCategorize`/`mergeExpenses`.
- `categorizeExpense`'s D-03 guard (member-level recategorization stays blocked while grouped) remains the only path blocked; `categorizeExpenseGroup` is now the sole path to move a grouped member's category.

---
*Phase: 66-expense-group-lifecycle*
*Completed: 2026-07-19*

## Self-Check: PASSED

All modified files exist on disk (`lib/actions/expenses.ts`, `tests/expense-actions.test.ts`); all 6 task commit hashes (9332e80, 49d9eb8, 2bc39ea, 68357ce, 73f0bb6, 2aa412c) verified present in git log.

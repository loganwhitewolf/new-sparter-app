---
phase: 62-transaction-edit-core
plan: 02
subsystem: expenses-dal
tags: [tdd, dal, classification-history, idor]
dependency-graph:
  requires: []
  provides: [updateExpense-atomic-history]
  affects: [lib/actions/expenses.ts, lib/dal/expenses.ts]
tech-stack:
  added: []
  patterns:
    - "db.transaction wrapping select+update+history write (mirrors categorizeExpense)"
    - "three-state optional field contract (undefined=omit, null=clear, value=assign)"
key-files:
  created:
    - tests/expense-edit.test.ts
  modified:
    - lib/dal/expenses.ts
decisions:
  - "subCategoryId three-state contract: undefined leaves category/status untouched, null clears (status '1', no history), positive number assigns (status '3', history written)"
  - "History write failure is non-fatal inside the transaction (matches categorizeExpense/bulkCategorize), consistent behavior across all manual-categorization entry points"
metrics:
  duration: 3min
  completed: 2026-07-05
status: complete
---

# Phase 62 Plan 2: updateExpense atomicity + classification history Summary

Rewrote `updateExpense` in `lib/dal/expenses.ts` to wrap its ownership-scoped read, update, and classification-history write in a single `db.transaction`, matching the status/history semantics of the existing `categorizeExpense` action — closing the last backend requirement (DET-04) of Phase 62.

## What Was Built

- **`tests/expense-edit.test.ts`** (new, 6 cases): atomicity (single `db.transaction` call), categorize transition (`subCategoryId` assign → status `'3'` + `writeClassificationHistory` call with `source: 'manual'`), uncategorize transition (explicit `null` → status `'1'`, no history write), omit no-op (undefined `subCategoryId` → neither `subCategoryId` nor `status` keys touched), derived-field immutability across all three call shapes, and IDOR ownership scoping (`and(eq(expense.id, ...), eq(expense.userId, ...))` on both the read and the write).
- **`lib/dal/expenses.ts`** — `updateExpense` rewritten: input type is now `{ id, userId, title, subCategoryId?: number | null, notes? }`. Wrapped in `db.transaction(async (tx) => ...)`: selects `{ subCategoryId, status }` before state, builds an allowlisted `updateSet` (title/notes/updatedAt always; subCategoryId/status only when the field is present — `null` clears, number assigns), runs the update, then writes classification history (non-fatal try/catch) only on the assign branch. `updateExpenseTitle`, `deleteExpense`, `deleteExpenses` untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking] Widened drizzle-orm and schema mocks beyond the plan's minimal shape**
- **Found during:** Task 1 (RED)
- **Issue:** The plan's minimal `vi.mock('drizzle-orm', ...)` and `vi.mock('@/lib/db/schema', ...)` shapes only covered `and`/`eq` and the four `expense` columns used by `updateExpense`. But `lib/dal/expenses.ts` computes several module-top-level `sql`-templated sort keys (`expenseTitleSortKey`, `expenseCategoryIncompleteBucket`, `expenseCategorySortKey`) at import time, referencing `sql`, `category`, `subCategory`, `userSubcategoryOverride`, etc. A minimal mock crashes the whole module import before any test can run.
- **Fix:** Used `vi.mock('drizzle-orm', async (importOriginal) => ({ ...actual, and: vi.fn(...), eq: vi.fn(...) }))` and the equivalent `importOriginal`-merge pattern for `@/lib/db/schema`, keeping the real implementations for everything except the two functions under test-inspection (`and`, `eq`) and the four `expense` columns needed for readable assertions.
- **Files modified:** tests/expense-edit.test.ts
- **Commit:** 073252d

No other deviations. Task 2 implementation matches the plan's step-by-step action block exactly (transaction wrapping, three-state contract, allowlisted `updateSet`, non-fatal history write, derived-field exclusion).

## TDD Gate Compliance

- RED gate: `073252d test(62-02): add failing tests for updateExpense atomicity and history` — all 6 tests failed against the pre-Task-2 `updateExpense` (behavioral RED: module resolved, but the assertions on transaction/status/history all mismatched since the old implementation called `db.update` directly with no transaction and no history write).
- GREEN gate: `83642f9 feat(62-02): make updateExpense atomic and history-aware` — all 6 tests pass.
- No REFACTOR commit — no cleanup was needed after GREEN.

## Verification

- `yarn vitest run tests/expense-edit.test.ts` — 6/6 passed.
- `yarn vitest run tests/expense-edit.test.ts tests/expense-deletion-service.test.ts` — 8/8 passed (no regression in the sibling expense-deletion suite, which follows the same mocking style).
- `grep` inside `updateExpense`'s function body (lines 344-401 in `lib/dal/expenses.ts`) for `totalAmount|transactionCount|firstTransactionAt|lastTransactionAt` — zero matches.
- `grep -n "db.transaction" lib/dal/expenses.ts` — confirms the single-transaction wrap.
- `grep -n "writeClassificationHistory" lib/dal/expenses.ts` — confirms import + call inside the assign branch.
- `yarn tsc --noEmit` — no new errors attributable to `lib/dal/expenses.ts` or `lib/actions/expenses.ts`. Pre-existing unrelated errors (29 total, confirmed present on the pre-change commit via `git stash`) live in `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, and `tests/transactions-dal.test.ts` — out of scope for this plan.

## Known Stubs

None.

## Threat Flags

None — the plan's `<threat_model>` (T-62-07 IDOR, T-62-08 derived-aggregate injection, T-62-09 read/write race, T-62-10 non-fatal history write) fully covers the surface touched by this plan; no new surface was introduced.

## Self-Check: PASSED

- FOUND: tests/expense-edit.test.ts
- FOUND: lib/dal/expenses.ts
- FOUND commit: 073252d
- FOUND commit: 83642f9

---
phase: 61-standalone-expense
plan: 01
subsystem: database
tags: [drizzle, vitest, zod, server-actions, categorization]

# Dependency graph
requires:
  - phase: 61-standalone-expense (prior quick task 260629-m9i, commit 90bfa69)
    provides: detachTransactionToDedicatedExpense base service, synthetic descriptionHash mechanism
provides:
  - "detachTransactionToDedicatedExpense(subCategoryId?) — persists subcategory on both multi-tx insert and single-tx in-place UPDATE paths"
  - "Single-transaction in-place re-hash branch — same expense id, no new expense, no reconcile call"
  - "SINGLE_TRANSACTION_EXPENSE guard removed from DetachTransactionErrorCode"
  - "DetachTransactionSchema.subCategoryId (optional positive integer)"
  - "detachTransaction action forwards subCategoryId"
  - "syntheticDescriptionHash exported (named export) for isolation-property testing"
  - "STEXP-03 isolation property test (hash-level, no DB)"
affects: [61-02-standalone-expense-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-row in-place UPDATE branch replaces a hard guard when the multi-row path would orphan a source with only one member"

key-files:
  created: []
  modified:
    - lib/services/transaction-detach.ts
    - lib/actions/transactions.ts
    - lib/validations/transactions.ts
    - tests/transaction-detach-service.test.ts
    - tests/transaction-detach-action.test.ts

key-decisions:
  - "In-place branch sets subCategoryId/status only when subCategoryId is supplied (not undefined); when omitted, existing subCategoryId/status on the row are left untouched rather than reset"
  - "hasSubCategoryId = input.subCategoryId !== undefined distinguishes 'omitted' from 'explicitly null' across both branches, matching the plan's backward-compatibility requirement"
  - "reconcileExpensesAfterTransactionRemoval is skipped entirely on the in-place branch — there is no separate source row once the branch is taken, so calling it would be a no-op at best and a latent bug surface at worst"

patterns-established:
  - "Isolation properties over synthetic hashes are tested at the hash-function level (no DB, no mocked aggregation query) — cheaper and less brittle than integration coverage of applyTier2History"

requirements-completed: [STEXP-01, STEXP-02, STEXP-03]

coverage:
  - id: D1
    description: "detachTransactionToDedicatedExpense persists a caller-supplied subCategoryId on both the multi-transaction insert path and the new single-transaction in-place UPDATE path; omitting it stays backward compatible (null/status '1')"
    requirement: "STEXP-01"
    verification:
      - kind: unit
        ref: "tests/transaction-detach-service.test.ts#persists the supplied subCategoryId and status \"3\" on the new expense (multi-tx path)"
        status: pass
      - kind: unit
        ref: "tests/transaction-detach-service.test.ts#defaults subCategoryId to null and status to \"1\" when omitted (multi-tx, backward compatible)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Single-transaction source expenses (transactionCount <= 1) are re-hashed in place (same expense id, synthetic descriptionHash) instead of throwing SINGLE_TRANSACTION_EXPENSE; no new expense is created and reconcile is not called"
    requirement: "STEXP-02"
    verification:
      - kind: unit
        ref: "tests/transaction-detach-service.test.ts#re-hashes the source expense in place for a single-transaction expense, without inserting or reconciling"
        status: pass
      - kind: unit
        ref: "tests/transaction-detach-service.test.ts#re-hashes the source expense in place with expenseTransactionCount 0 and no subCategoryId (status/subCategoryId left unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "syntheticDescriptionHash is deterministic per transaction id, distinct across transaction ids, and distinct from the ordinary description-based hash — proving a standalone expense stays out of descriptionHash aggregation and Tier 2 history"
    requirement: "STEXP-03"
    verification:
      - kind: unit
        ref: "tests/transaction-detach-service.test.ts#syntheticDescriptionHash isolation property (STEXP-03) > differs from the original-description hash"
        status: pass
      - kind: unit
        ref: "tests/transaction-detach-service.test.ts#syntheticDescriptionHash isolation property (STEXP-03) > is deterministic per transaction id"
        status: pass
      - kind: unit
        ref: "tests/transaction-detach-service.test.ts#syntheticDescriptionHash isolation property (STEXP-03) > is distinct across different transaction ids"
        status: pass
    human_judgment: false
  - id: D4
    description: "DetachTransactionSchema accepts an optional positive-integer subCategoryId; detachTransaction forwards it to the service while preserving IDOR guard order (verifySession before service call) and the existing return shape"
    verification:
      - kind: unit
        ref: "tests/transaction-detach-action.test.ts#forwards subCategoryId to the service when supplied"
        status: pass
      - kind: unit
        ref: "tests/transaction-detach-action.test.ts#returns validation error for invalid transaction id"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-01
status: complete
---

# Phase 61 Plan 01: Standalone Expense Backend Summary

**Subcategory capture and single-transaction in-place re-hash added to `detachTransactionToDedicatedExpense`, replacing the `SINGLE_TRANSACTION_EXPENSE` guard, with a hash-level test proving the standalone expense stays out of aggregation and Tier 2.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-01T07:52:13Z
- **Completed:** 2026-07-01T07:57:42Z
- **Tasks:** 3
- **Files modified:** 5 (lib/services/transaction-detach.ts, lib/actions/transactions.ts, lib/validations/transactions.ts, tests/transaction-detach-service.test.ts, tests/transaction-detach-action.test.ts)

## Accomplishments
- `detachTransactionToDedicatedExpense` now accepts an optional `subCategoryId`, persisted on the existing multi-transaction insert path (`status: '3'` when supplied, else `'1'`) and on a new single-transaction in-place UPDATE path.
- The `SINGLE_TRANSACTION_EXPENSE` guard is gone. When the source expense holds exactly one transaction, the service re-hashes that same expense row in place (`descriptionHash` → synthetic, `title` updated, `subCategoryId`/`status` set only when supplied) and returns the same `id` — no new expense, no orphaned source, no `reconcileExpensesAfterTransactionRemoval` call.
- `DetachTransactionSchema` and the `detachTransaction` action now thread `subCategoryId` end-to-end; omitting it keeps title-only callers valid.
- A dependency-free unit test proves the STEXP-03 isolation invariant: `syntheticDescriptionHash(txId)` differs from `computeDescriptionHash(description)`, is deterministic per transaction id, and distinct across transaction ids — without touching `applyTier2History` or the aggregation query.

## Task Commits

Each task was committed atomically, following RED/GREEN TDD for Tasks 1 and 2:

1. **Task 1 (RED): failing tests for subcategory persistence + in-place branch** - `175a0c9` (test)
2. **Task 1 (GREEN): subcategory capture + single-transaction in-place branch** - `0e30a97` (feat)
3. **Task 2 (RED): failing test for subCategoryId forwarding in detach action** - `963ce31` (test)
4. **Task 2 (GREEN): thread subCategoryId through validation schema and action** - `2606416` (feat)
5. **Task 3: isolation property test (STEXP-03)** - `3391a1f` (test)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `lib/services/transaction-detach.ts` - `subCategoryId` param on `detachTransactionToDedicatedExpense`; in-place UPDATE branch for `expenseTransactionCount <= 1`; `SINGLE_TRANSACTION_EXPENSE` removed from `DetachTransactionErrorCode`; `syntheticDescriptionHash` exported
- `lib/actions/transactions.ts` - `detachTransaction` accepts and forwards `subCategoryId` to the service
- `lib/validations/transactions.ts` - `DetachTransactionSchema` gains optional positive-integer `subCategoryId`
- `tests/transaction-detach-service.test.ts` - multi-tx subcategory/status assertions, single-tx in-place success test (replaces removed rejection test), edge case with `expenseTransactionCount: 0` and no `subCategoryId`, STEXP-03 isolation property tests
- `tests/transaction-detach-action.test.ts` - subCategoryId forwarding assertion added

## Decisions Made
- `hasSubCategoryId = input.subCategoryId !== undefined` is the single predicate controlling both the multi-tx insert's `subCategoryId`/`status` values and the in-place branch's conditional `set` spread — keeps "omitted" (leave existing values alone on in-place, default null/'1' on insert) distinct from any future "explicitly null" caller.
- The in-place branch never calls `reconcileExpensesAfterTransactionRemoval` — per ADR 0016 decision 4, there is no separate source row once this branch is taken (the transaction already points at this expense), so reconciling would operate on the wrong row or be a no-op.
- Reused `computeDescriptionHash` (already exported, import-safe, no `server-only`) from `lib/utils/import.ts` for the STEXP-03 test's "original hash" side, rather than duplicating hash logic in the test.

## Deviations from Plan

None - plan executed exactly as written. `SINGLE_TRANSACTION_EXPENSE` had zero other references anywhere in the codebase (confirmed via grep), so its removal was a clean deletion with no follow-on changes needed.

## Issues Encountered
- `yarn check:language` surfaced 4 pre-existing developer-facing-comment violations in files this plan did not touch (`components/expenses/bulk-categorize-dialog.tsx`, `components/expenses/expense-uncategorized-cta.tsx`, `lib/dal/expenses.ts`, `lib/dal/transactions.ts`). Out of scope per the scope-boundary rule; logged to `.planning/phases/61-standalone-expense/deferred-items.md` rather than fixed here.
- One of my own new test helpers (`updateSet` in the `expenseTransactionCount: 0` test) needed an explicit parameter type annotation to satisfy `tsc --noEmit` when indexing `mock.calls[0][0]` — fixed inline before committing GREEN.

## User Setup Required

None - no external service configuration required. No schema migration generated (confirmed `drizzle/migrations/` unchanged), consistent with ADR 0016.

## Next Phase Readiness

Backend slice is complete and test-proven. Ready for 61-02 (UI plan) to wire the `SubcategoryPicker` against:
- `detachTransaction({ transactionId, title, subCategoryId? })` action (returns `{ newExpenseId, newExpenseTitle, error }`)
- No remaining `SINGLE_TRANSACTION_EXPENSE` error code to handle in the UI — the action can call detach on any transaction unconditionally now.

No blockers.

---
*Phase: 61-standalone-expense*
*Completed: 2026-07-01*

## Self-Check: PASSED

All modified files and all 5 task/RED/GREEN commit hashes verified present on disk and in git log.

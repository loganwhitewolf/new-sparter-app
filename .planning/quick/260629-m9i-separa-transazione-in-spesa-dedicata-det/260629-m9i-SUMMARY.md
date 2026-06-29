---
phase: quick-260629-m9i
plan: 01
subsystem: expenses
tags: [detach, import, expense-reconciliation, manual-lock, transactions]

requires: []
provides:
  - Detach transaction to dedicated expense from /transactions row menu
  - Shared expense reconciliation helper reused by deletion and detach
  - Re-import manual categorization lock on expense upsert
affects: [transactions, import, expenses]

tech-stack:
  added: []
  patterns:
    - "Synthetic expense descriptionHash via SHA-256(detached:{transactionId})"
    - "Manual-lock guard: status 3 + latest history source manual"

key-files:
  created:
    - lib/services/expense-reconciliation.ts
    - lib/services/transaction-detach.ts
    - components/transactions/detach-expense-dialog.tsx
    - tests/transaction-detach-service.test.ts
    - tests/transaction-detach-action.test.ts
  modified:
    - lib/services/transaction-deletion.ts
    - lib/services/import.ts
    - lib/actions/transactions.ts
    - lib/validations/transactions.ts
    - lib/dal/transactions.ts
    - lib/dal/classification-history.ts
    - components/transactions/transaction-table.tsx
    - tests/import-service.test.ts

key-decisions:
  - "UI entry only from transaction table ⋮ menu (not expense details dialog)"
  - "Post-detach opens ExpenseCategorizeDialog on the new expense immediately"
  - "Manual lock uses latest history source manual only (not override)"
  - "Reconciliation logic extracted to expense-reconciliation.ts without behavior change"

requirements-completed: []

duration: 25min
completed: 2026-06-29
status: complete
---

# Quick Task 260629-m9i: Separa transazione in spesa dedicata Summary

**Detach one transaction from an aggregated expense into a dedicated expense with user title and immediate categorization; re-import preserves manually categorized expenses.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2
- **Files modified:** 12

## Accomplishments

- Added `detachTransactionToDedicatedExpense` service (db.transaction, IDOR-scoped, synthetic hash, source reconciliation).
- Extracted `expense-reconciliation.ts` from `transaction-deletion.ts` with identical reconcile rules.
- Added `detachTransaction` server action, `DetachTransactionSchema`, and `expenseTransactionCount` on transaction list rows.
- Transaction table shows **Separa in spesa dedicata** (Split icon) only when `expenseTransactionCount > 1`; success opens categorize dialog on new expense.
- Re-import upsert skips `subCategoryId`/`status` overwrite and classification history when expense is manually locked (`status 3` + latest history `manual`); totals still aggregate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `toDbDecimal` called with raw string in detach service**
- **Found during:** Task 1
- **Issue:** `toDbDecimal(row.transactionAmount)` failed — expects `Decimal` instance
- **Fix:** Wrap with `toDecimal()` before `toDbDecimal()`
- **Files modified:** `lib/services/transaction-detach.ts`
- **Commit:** 85cb4b2 (same commit as Task 1)

**2. [Rule 3 - Blocking] Missing `@/components/ui/label`**
- **Found during:** Task 2 verification (`tsc`)
- **Issue:** `Label` component not installed in project
- **Fix:** Use native `<label>` matching `expense-form-dialog.tsx` pattern
- **Files modified:** `components/transactions/detach-expense-dialog.tsx`
- **Commit:** 90bfa69

None other — plan executed as written.

## Verification

| Check | Result |
|-------|--------|
| `yarn vitest run tests/transaction-detach-service.test.ts tests/transaction-detach-action.test.ts` | 7 passed |
| `yarn vitest run tests/import-service.test.ts -t "manual"` | 1 passed |
| `yarn tsc --noEmit` | Pre-existing failures in unrelated test files; no errors in new detach/import paths after label fix |

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | 85cb4b2 | feat(quick-260629-m9i-01): detach transaction to dedicated expense |
| 2 | 90bfa69 | feat(quick-260629-m9i-01): lock manual categorization on re-import upsert |

## Self-Check: PASSED

- lib/services/transaction-detach.ts — FOUND
- lib/services/expense-reconciliation.ts — FOUND
- components/transactions/detach-expense-dialog.tsx — FOUND
- Commit 85cb4b2 — FOUND
- Commit 90bfa69 — FOUND

---
status: complete
quick_id: 260703-l2b
---

# Quick Task 260703-l2b — Summary

## Outcome

Deletion dialogs now offer optional cascade for linked entities:

- **Expense (single + bulk):** checkbox to also delete linked transactions (shown when count > 0)
- **Transaction (single + bulk):** checkbox to also delete 1:1 linked expense (`expenseTransactionCount === 1`)

## Changes

- `lib/services/expense-deletion.ts` — new service with `deleteLinkedTransactions` flag
- `lib/services/transaction-deletion.ts` — `deleteLinkedExpenses` for 1:1 cases
- Actions + Zod schemas accept boolean flags from form data
- `ExpenseRow.transactionCount` exposed from DAL for UI counts
- Updated delete dialogs in expense/transaction tables

## Verification

- `yarn vitest run tests/expense-deletion-service.test.ts tests/categorization-revalidation-actions.test.ts` — 17 passed

## Commit

Code: `feat(deletion): offer linked entity removal on expense/transaction delete`

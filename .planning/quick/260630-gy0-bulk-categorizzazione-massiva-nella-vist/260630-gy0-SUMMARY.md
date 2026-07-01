---
quick_id: 260630-gy0
status: complete
---

# Quick Task 260630-gy0 — Summary

## Done

- `TransactionBulkActionBar` now mirrors expenses: **Categorizza (N)** + **Elimina (N)**.
- `transaction-table` maps selected rows → unique `expenseId`s, opens shared `BulkCategorizeDialog`, calls `bulkCategorize`.
- Optimistic UI updates all rows sharing categorized expenses; toast uses "transazioni".
- Categorize disabled when selection has no linked expense.

## Verification

- `yarn test tests/transaction-bulk-action-bar.test.tsx` — 2 passed

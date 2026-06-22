---
status: complete
---

# Quick Task 260616-fo2 — Summary

## Root cause

UI shows absolute amounts; DAL sorted signed `transaction.amount`. DESC grouped positives first; ASC grouped negatives first — inverted vs displayed magnitude.

## Change

- `lib/dal/transactions.ts`: `transactionAmountAbsSortKey = ABS(amount::numeric)` for amount sort
- `tests/transactions-dal.test.ts`: updated expectations (46 tests pass)

## Note

Import **files** table (`/import`) toolbar sort is still not wired to `getImportRows` (pre-existing gap from phase 40). Separate task if needed.

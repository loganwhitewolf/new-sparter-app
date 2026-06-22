# Quick Task 260616-dlw: Fix transaction description sort

**Branch:** `fix/table-sorting-alphabetical`

## Root cause

- UI exposes `description` as sortable (`transactionsTableConfig`, `HeaderSortButton`)
- `transactionSortSchema` only allows `occurredAt` | `amount` → `parseTransactionFilters` silently falls back to default sort
- `getTransactionSortColumn` has no `description` case → even if parsed, DAL would sort by wrong column
- Infinite scroll already passes `searchParams` (incl. `sort`/`dir`); pagination reset on sort change works via table `key`

## Tasks

1. Allow `description` in validation + DAL orderBy (display title = COALESCE customTitle, description; LOWER for case-insensitive alpha)
2. Map `type` → `direction` in `loadMoreTransactions` (same as RSC page) so filters survive paginated fetches
3. Update unit tests

## Verification

- `yarn vitest run lib/validations/__tests__/transactions.test.ts tests/transactions-dal.test.ts`
- `yarn check:language` (if touching tests/comments)

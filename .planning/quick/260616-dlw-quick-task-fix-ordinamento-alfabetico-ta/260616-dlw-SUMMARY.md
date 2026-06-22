---
status: complete
---

# Quick Task 260616-dlw — Summary

## What changed

Fixed transaction table description sorting end-to-end:

1. **`transactionSortSchema`** — added `description` so URL `?sort=description` is no longer silently reset to `occurredAt`.
2. **`getTransactionSortColumn`** — orders by display title `LOWER(COALESCE(NULLIF(TRIM(custom_title), ''), description))`, matching the UI label (`customTitle ?? description`).
3. **`mapParsedTransactionFiltersToDal`** — shared mapper (`type` → `direction`) used by both the RSC page and `loadMoreTransactions`, so infinite-scroll fetches keep the same filters as the first page.

## Root cause

UI exposed description as sortable, but validation + DAL only supported `occurredAt` and `amount`. The header showed the active sort from the URL while every query still used the default date sort. Pagination reset on sort change already worked via `buildTransactionTableKey`.

## Verification

```
yarn vitest run lib/validations/__tests__/transactions.test.ts tests/transactions-dal.test.ts
# 65 passed
```

## Out of scope (known gap)

`category` and `platform` columns are still sortable in the UI but not in `transactionSortSchema` — same class of bug, separate follow-up.

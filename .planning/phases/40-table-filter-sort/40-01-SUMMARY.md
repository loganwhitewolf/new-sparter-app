---
phase: 40-table-filter-sort
plan: "01"
subsystem: dal-types-utils
tags: [foundation, types, url-params, dal, tdd, tiebreaker]
dependency_graph:
  requires: []
  provides:
    - lib/utils/table-config.ts (FilterFieldType, FilterField, SortColumn, TableConfig)
    - lib/utils/search-params.ts (parseMonths, parseAmount, parseStatus, parseSortDir, YEAR_MONTH_RE)
    - lib/dal/transactions.ts (id tiebreaker, months/amountMin/amountMax forward-looking fields)
    - lib/dal/imports.ts (file.id tiebreaker)
  affects:
    - Wave 2 (DataTableToolbar imports TableConfig)
    - Wave 4 (per-table config files use TableConfig; DAL uses months/amountMin/amountMax)
tech_stack:
  added: []
  patterns:
    - Total functions (never throw) for URL param parsing
    - Regex allowlist guards (YEAR_MONTH_RE, /^\d+(\.\d+)?$/) for input validation
    - Array orderBy with id tiebreaker (mirrors buildExpenseOrderBy pattern)
key_files:
  created:
    - lib/utils/table-config.ts
    - lib/utils/search-params.ts
    - tests/table-search-params.test.ts
  modified:
    - lib/dal/transactions.ts
    - lib/dal/imports.ts
    - tests/transactions-dal.test.ts
decisions:
  - "Total-function parser design: drop invalid tokens, never throw — prevents malformed URL params from surfacing as server errors"
  - "buildTransactionOrderBy returns SQL[] (array) not single SQL — enables spread call site and tiebreaker pattern consistent with buildExpenseOrderBy"
  - "TransactionFilters extended with months?/amountMin?/amountMax? now to avoid touching the type in Wave 4"
metrics:
  duration_seconds: 188
  completed_date: "2026-06-04"
  tasks_completed: 2
  files_changed: 6
---

# Phase 40 Plan 01: Foundation — Types + URL Parsers + id Tiebreaker Summary

**One-liner:** Shared `TableConfig` / `FilterField` / `SortColumn` types and total URL param parsers (`parseMonths`, `parseAmount`, `parseStatus`, `parseSortDir`) with `id` tiebreaker appended to all transaction and import DAL `orderBy` calls.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Shared TableConfig types + URL param parsers (TDD) | 378663c | lib/utils/table-config.ts, lib/utils/search-params.ts, tests/table-search-params.test.ts |
| 2 | id tiebreaker on transactions + imports orderBy | 439a8d4 | lib/dal/transactions.ts, lib/dal/imports.ts, tests/transactions-dal.test.ts |

## What Was Built

### Task 1 — Shared types + URL parsers (TDD)

`lib/utils/table-config.ts` — pure types, no runtime code:
- `FilterFieldType`: union of `'text' | 'select' | 'multi-select' | 'month-multi' | 'amount-range' | 'status'`
- `FilterField`: `{ key, label, type, options?, toChip }`
- `SortColumn`: `{ key, label }`
- `TableConfig`: `{ id, search, filters, sortable, defaultSort }`

`lib/utils/search-params.ts` — total parser functions:
- `YEAR_MONTH_RE`: `/^\d{4}-(?:0[1-9]|1[0-2])$/`
- `parseMonths`: comma-split + regex filter, returns `string[]`, never throws
- `parseAmount`: non-negative numeric only (`/^\d+(\.\d+)?$/`), returns `string | undefined`
- `parseStatus`: allowlist guard, returns `string | undefined`
- `parseSortDir`: sort-key allowlist + dir default to `'desc'`, returns `{ sort, dir }`

`tests/table-search-params.test.ts` — 32 unit tests, all green (TDD RED → GREEN cycle verified).

### Task 2 — id tiebreaker

`lib/dal/transactions.ts`:
- `buildTransactionOrderBy` now returns `[asc/desc(column), asc/desc(transaction.id)]` array
- Call site updated to `.orderBy(...buildTransactionOrderBy(filters))` (spread)
- `TransactionFilters` extended with `months?: string[]`, `amountMin?: string`, `amountMax?: string` (forward-looking for Wave 4; no WHERE clauses added yet)

`lib/dal/imports.ts`:
- `orderBy` updated to `desc(importListOrderTimestamp), desc(file.createdAt), desc(file.id)`

`tests/transactions-dal.test.ts`:
- Existing `buildTransactionOrderBy` assertions updated to expect array shape
- 2 new tiebreaker assertions added (array check, last-element check)
- Total: 25 tests, all green

`lib/dal/expenses.ts` — verified untouched (already had `[asc/desc(column), asc/desc(expense.id)]` tiebreaker per `buildExpenseOrderBy`).

## Verification

```
yarn vitest run tests/table-search-params.test.ts tests/transactions-dal.test.ts
  Test Files  2 passed (2)
       Tests  57 passed (57)
```

TypeScript: 0 new errors in new/modified files. 3 pre-existing errors in `.next/types/` cache (unrelated to this plan — `app/proto/overview/page.js` missing from compiled cache).

## Deviations from Plan

None — plan executed exactly as written.

The existing `transactions-dal.test.ts` test at line 184 expected a single object from `buildTransactionOrderBy`; after the array return change it required updating the assertion to expect an array. This is an expected consequence of the behavior change (not an additional deviation) and is documented in Task 2.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The parser functions (`parseMonths`, `parseAmount`) enforce strict allowlists per T-40-01 mitigation. No unmitigated surface added.

## Known Stubs

None. This plan is types + utility functions — no UI or data rendering involved.

## Self-Check: PASSED

---
phase: 40-table-filter-sort
plan: "04"
subsystem: per-table-filter-wiring
tags: [dal, config, toolbar, tdd, transactions, expenses, files, wave4]
dependency_graph:
  requires:
    - lib/utils/table-config.ts (TableConfig / FilterField / SortColumn — Wave 1)
    - lib/utils/search-params.ts (parseMonths, parseAmount, parseStatus — Wave 1)
    - components/data-table/DataTableToolbar.tsx (Wave 2 + Wave 3)
    - lib/dal/months-with-data.ts (getMonthsWithData — Wave 3)
  provides:
    - app/(app)/transactions/transactions.table.ts (transactionsTableConfig)
    - app/(app)/expenses/expenses.table.ts (expensesTableConfig)
    - app/(app)/import/files.table.ts (filesTableConfig)
    - lib/dal/transactions.ts (months OR, amountMin/Max ABS, status isNull/isNotNull)
    - lib/dal/expenses.ts (this-month default removed; D-05; O-01 status; amount ABS)
    - lib/dal/imports.ts (platform eq, statusBucket 3 buckets, coverage months, amount ABS)
    - lib/validations/transactions.ts (q, months, amountMin/Max, status in parser)
    - lib/validations/expense.ts (parseExpenseFilters total-function parser)
    - lib/validations/import.ts (platform, statusBucket, months, amount in parser)
  affects:
    - Wave 5 (URL migration name→q, from/to→months, remove period; empty states; a11y)
tech_stack:
  added: []
  patterns:
    - Declarative TableConfig per table — config file separate from page
    - TDD RED→GREEN cycle for each DAL suite (3 RED commits, 3 GREEN commits)
    - Total-function parsers (never throw) for all new URL params
    - D-05: explicit period-only date range (no implicit this-month default)
    - O-01: expense status 4 → uncategorized bucket (conservative mapping)
    - D-22: 3-bucket processing status for Files (imported/pending/failed)
key_files:
  created:
    - app/(app)/transactions/transactions.table.ts
    - app/(app)/expenses/expenses.table.ts
    - app/(app)/import/files.table.ts
  modified:
    - lib/dal/transactions.ts
    - lib/dal/expenses.ts
    - lib/dal/imports.ts
    - lib/validations/transactions.ts
    - lib/validations/expense.ts
    - lib/validations/import.ts
    - app/(app)/transactions/page.tsx
    - app/(app)/expenses/page.tsx
    - app/(app)/import/page.tsx
    - components/data-table/DataTableToolbar.tsx
    - tests/transactions-dal.test.ts
    - tests/expenses-dal.test.ts
    - tests/imports-dal.test.ts
decisions:
  - "expensesTableConfig has no month-multi field (D-11 — Expenses aggregate entity, no meaningful date)"
  - "expense.status 4 maps to uncategorized bucket via inArray(['1','4']) (O-01 — conservative)"
  - "ExpenseFilters.period no longer includes 'this-month' (D-05 — removed from type, not just from default)"
  - "platform filter for expenses implemented via importedFromFileId→file→importFormatVersion→platform left join chain"
  - "DataTableToolbar.status field: custom options via field.options override — enables 3-bucket Files status"
  - "import/page.tsx: platforms/monthsWithData fetched in a separate Promise.all after the error-catching getImports block to avoid hiding DAL errors"
metrics:
  duration_seconds: 739
  completed_date: "2026-06-04"
  tasks_completed: 3
  files_changed: 13
---

# Phase 40 Plan 04: Per-Table Config Wiring (Wave 4) Summary

**One-liner:** Three `TableConfig` objects + DAL WHERE conditions + rewired pages for Transactions (months/amount/platform/category/categorization), Expenses (no temporal, all-time default, status-4→uncategorized), and Files (3 processing buckets, coverage months, platform, amount) — all via `DataTableToolbar`.

## Tasks Completed

| Task | Name | RED Commit | GREEN Commit | Key Files |
|------|------|------------|--------------|-----------|
| 1 | Transactions — config + DAL conditions + page | 7c8c29b | 1707c6e | transactions.table.ts, dal/transactions.ts, page.tsx |
| 2 | Expenses — drop this-month + config + DAL + page | 18b6be0 | 0c2f978 | expenses.table.ts, dal/expenses.ts, page.tsx |
| 3 | Files — 3 processing buckets + coverage months + config + page | 4c7b7b0 | d0d73f6 | files.table.ts, dal/imports.ts, page.tsx |

## What Was Built

### Task 1 — Transactions

`app/(app)/transactions/transactions.table.ts`:
- `transactionsTableConfig`: id `'transactions'`, search `q`, filters `[months, amountMin (amount-range), platform (select), category (select), status]`, 5 sortable columns, defaultSort `occurredAt desc`

`lib/dal/transactions.ts`:
- `TransactionFilters.status?: 'uncategorized' | 'categorized'` added
- `months` filter: `or(...months.map(ym => sql\`TO_CHAR(${transaction.occurredAt}, 'YYYY-MM') = ${ym}\`))`
- `amountMin/amountMax`: `ABS(${transaction.amount}::numeric) >= ${amountMin}::numeric`
- `status uncategorized`: `isNull(expense.subCategoryId)`; `categorized`: `isNotNull(expense.subCategoryId)`

`lib/validations/transactions.ts`:
- `ParsedTransactionFilters` extended with `q`, `months`, `amountMin`, `amountMax`, `status`
- `parseTransactionFilters` reads `q` canonically (with `name` back-compat for Wave 5)
- Uses `parseMonths`, `parseAmount`, `parseStatus` from Wave 1 parsers

`app/(app)/transactions/page.tsx`:
- `getMonthsWithData('transactions')` added to Promise.all
- `<TransactionFilters>` replaced with `<DataTableToolbar config={transactionsTableConfig} ...>`
- `buildTransactionTableKey` updated to include all Wave 4 filter keys (D-04)

**Test results:** 32 tests, all green (6 new Wave 4 behavior tests)

### Task 2 — Expenses

`app/(app)/expenses/expenses.table.ts`:
- `expensesTableConfig`: id `'expenses'`, search `q`, filters `[amountMin (amount-range), category, platform, status]` — NO `month-multi` (D-11)

`lib/dal/expenses.ts`:
- `this-month` default removed (D-05): period date range only when `filters.period` is explicitly set
- `ExpenseFilters.period` type no longer includes `'this-month'` (removed as valid value)
- O-01: `status 'uncategorized'` → `inArray(expense.status, ['1','4'])` (conservative status-4 mapping)
- `status 'categorized'` → `inArray(expense.status, ['2','3'])`
- `amountMin/amountMax`: `ABS(${expense.totalAmount}::numeric)` conditions
- Platform filter via `importedFromFileId→file→importFormatVersion→platform` left join chain

`lib/validations/expense.ts`:
- `parseExpenseFilters` total-function parser added: `q`, `categorySlug`, `platform`, `status`, `amountMin/Max`, `sort`, `dir` — no `period` (D-05/D-11)

`app/(app)/expenses/page.tsx`:
- Inline filter parsing replaced with `parseExpenseFilters(params)`
- `<ExpenseFilters>` replaced with `<DataTableToolbar config={expensesTableConfig} ...>`
- `buildExpenseTableKey` drops `period`, includes Wave 4 keys

**Test results:** 9 tests, all green (6 new Wave 4 behavior tests)

### Task 3 — Files

`app/(app)/import/files.table.ts`:
- `filesTableConfig`: id `'files'`, search `q`, filters `[months (coverage), amountMin (amount-range), platform, statusBucket (status type, label 'Elaborazione', 3 custom options)]` — NO category
- Sortable: importedAt, platform, rowCount, importedCount, negativeTotal, status

`lib/dal/imports.ts`:
- `statusBucket 'imported'` → `eq(file.status, 'imported')`
- `statusBucket 'pending'` → `inArray(file.status, ['uploaded','analyzing','analyzed','importing','pending_upload'])`
- `statusBucket 'failed'` → `eq(file.status, 'failed')`
- Coverage months: `or(...months.map(ym => sql\`TO_CHAR(${file.referenceStartedAt}, 'YYYY-MM') = ${ym}\`))`
- Amount: `ABS(${file.negativeTotal}::numeric)` conditions

`lib/validations/import.ts`:
- `ParsedImportFilters` extended with `platform`, `statusBucket`, `months`, `amountMin`, `amountMax`
- `parseImportFilters` extended with all new fields (total functions)

`app/(app)/import/page.tsx`:
- `getMonthsWithData('files')` + `getTransactionPlatforms()` added
- `<ImportFilters>` replaced with `<DataTableToolbar config={filesTableConfig} ...>`
- `getFilterKey` updated to include all Wave 4 filter keys

`components/data-table/DataTableToolbar.tsx`:
- `status` field type now supports custom options via `field.options` override (enables Files 3-bucket status)

**Test results:** 19 tests, all green (5 new Wave 4 behavior tests + 1 updated orderBy test)

## Verification

```
yarn vitest run tests/transactions-dal.test.ts tests/expenses-dal.test.ts tests/imports-dal.test.ts
  Test Files  3 passed (3)
       Tests  60 passed (60)

npx tsc --noEmit → 0 new errors
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] DataTableToolbar status field hardcoded to 2 options**
- **Found during:** Task 3 (files table config — 3-bucket status)
- **Issue:** DataTableToolbar rendered `status` type with hardcoded "Categorizzate/Da categorizzare" labels; Files needs 3 custom options (Importato/Da completare/In errore)
- **Fix:** `status` field renderer now reads `field.options` when present, falling back to the 2-state categorization defaults
- **Files modified:** components/data-table/DataTableToolbar.tsx
- **Commit:** d0d73f6

**2. [Rule 1 - Bug] expenses-dal test expected old `or(eq('2'), eq('3'))` shape for status categorized**
- **Found during:** Task 2 (GREEN — test failure on existing test)
- **Issue:** Existing test `applies explicit pagination offsets` checked `op: 'or'` shape for status; new implementation uses `inArray` per O-01 alignment
- **Fix:** Test assertion updated to `{ op: 'inArray', left: 'expense.status', right: ['2','3'] }`
- **Files modified:** tests/expenses-dal.test.ts
- **Commit:** 0c2f978

**3. [Rule 1 - Bug] months OR condition search in test was picking wrong OR node**
- **Found during:** Task 1 (GREEN — 2 months tests failing)
- **Issue:** Test searched for first `op === 'or'` node; found file-ownership OR (isNull/eq) instead of months OR (sql nodes)
- **Fix:** Test predicate now checks that all inner `args` have `op === 'sql'` to uniquely identify the months OR
- **Files modified:** tests/transactions-dal.test.ts
- **Commit:** 1707c6e

**4. [Rule 2 - Missing functionality] expenses platform filter requires DAL join chain**
- **Found during:** Task 2 (implementation — plan says "platform via file join" but no join existed)
- **Issue:** `ExpenseFilters.platform` had no join in the DAL; platform filter would be silently ignored without the `importedFromFileId→file→importFormatVersion→platform` chain
- **Fix:** Added three leftJoins and `eq(platform.slug, filters.platform)` condition; updated schema mock in test
- **Files modified:** lib/dal/expenses.ts, tests/expenses-dal.test.ts
- **Commit:** 0c2f978

**5. [Rule 3 - Blocker] expenses schema mock missing file/importFormatVersion/platform**
- **Found during:** Task 2 (GREEN — all test failures with "No file export is defined on mock")
- **Issue:** Adding the platform join chain to expenses DAL requires `file`, `importFormatVersion`, `platform` in the schema mock
- **Fix:** Added the three schema objects to the `vi.mock('@/lib/db/schema')` factory
- **Files modified:** tests/expenses-dal.test.ts
- **Commit:** 0c2f978

## Known Stubs

None. All three tables have real server-side filter wiring. No placeholder components remain.

## Threat Surface Scan

New SQL conditions added across all three DAL files — security posture per threat register:

| Threat ID | Component | Status |
|-----------|-----------|--------|
| T-40-09 | statusBucket/platform params | Mitigated — `parseStatus` allowlist + slug regex in parsers before DAL |
| T-40-10 | months/amount SQL conditions | Mitigated — months pre-validated by `YEAR_MONTH_RE`; amounts by `/^\d+(\.\d+)?$/`; both bound via `sql` template parameters |
| T-40-11 | cross-user rows | Mitigated — all three DAL queries retain `eq(*.userId, userId)` from `verifySession`; new conditions are AND-ed |
| T-40-12 | expenses this-month default removal | Accepted (D-05 — intentional UX change, user-scoped) |

No new unmitigated threat surface added.

## Self-Check: PASSED

---
status: complete
phase: 260609-lcp
plan: "01"
subsystem: ui-filters
tags:
  - cascade-filters
  - amount-display
  - transaction-menu
  - expenses
  - data-table
dependency_graph:
  requires: []
  provides:
    - formatAbsoluteAmount (display-only, all tables)
    - buildTypeNatureMap / buildCategorySubcategoryMap (cascade options)
    - FilterField.dependsOn (cascade-aware DataTableToolbar)
    - expense parseExpenseFilters + getExpenses cascade conditions
  affects:
    - app/(app)/transactions (subCategory cascade, nature cascade, menu trim)
    - app/(app)/expenses (type/nature/subCategory cascade filters)
    - components/import/import-table.tsx (absolute amount display)
tech_stack:
  added:
    - lib/utils/format-amount.ts (Intl.NumberFormat + Math.abs, display-only)
    - lib/utils/cascade-options.ts (buildTypeNatureMap, buildCategorySubcategoryMap)
  patterns:
    - FilterField.dependsOn cascade resolution ('' all-bucket convention)
    - DependentOptions prop threaded through toolbar → FilterPanel → FilterField
    - cascade-aware onChange clears invalidated child param in one updateParams write
key_files:
  created:
    - lib/utils/format-amount.ts
    - lib/utils/cascade-options.ts
    - tests/format-amount.test.ts
    - tests/cascade-options.test.ts
  modified:
    - lib/utils/table-config.ts (dependsOn on FilterField)
    - components/data-table/DataTableToolbar.tsx (DependentOptions, cascade logic)
    - components/transactions/transaction-table.tsx (formatAbsoluteAmount, menu trim)
    - components/expenses/expense-table.tsx (formatAbsoluteAmount)
    - components/import/import-table.tsx (formatAbsoluteAmount, remove currencyFormatter)
    - app/(app)/transactions/transactions.table.ts (subCategory + dependsOn, reorder)
    - app/(app)/transactions/TransactionsToolbar.tsx (dependentOptions prop)
    - app/(app)/transactions/page.tsx (buildTypeNatureMap/buildCategorySubcategoryMap, dependentOptions)
    - app/(app)/expenses/expenses.table.ts (type/nature/subCategory fields)
    - app/(app)/expenses/ExpensesToolbar.tsx (dependentOptions prop)
    - app/(app)/expenses/page.tsx (cascade filters wired to DAL + toolbar)
    - lib/validations/expense.ts (nature/type/subCategoryId parse)
    - lib/dal/expenses.ts (nature/type/subCategoryId conditions)
    - tests/data-table-toolbar.test.tsx (cascade test suite)
    - lib/validations/__tests__/expense.test.ts (cascade parse tests)
    - tests/expenses-dal.test.ts (cascade condition tests)
decisions:
  - "formatAbsoluteAmount is display-only; stored values and Decimal write paths untouched; amountColorClass still reads raw transaction.amount.trim().startsWith('-')"
  - "'' (empty string) is the all-bucket key in DependentOptions maps — falls back to this when parent param is absent"
  - "Cascade child-clear on parent change uses one updateParams call (no stale intermediate render)"
  - "nature table deferred — cascade derives natures per type dynamically from existing taxonomy (no schema change)"
  - "TYPE_ALLOWED/NATURE_ALLOWED allowlists in expense.ts are local consts to avoid coupling to transactions.ts"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-09"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 17
---

# Phase 260609-lcp Plan 01: Filter cascade + amount sign + transaction menu Summary

**One-liner:** Cascade-aware DataTableToolbar (type→nature, category→subCategory) with display-only absolute amount formatting and categorized-transaction menu trimmed to Ricategorizza.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Strip minus from displayed amounts + trim categorized-transaction menu | 1d58221 (RED), 68b7eb0 (GREEN) | Done |
| 2 | Add cascade (dependent-options) support to DataTableToolbar + derive cascade maps | 7c47a18 (RED), cd42917 (GREEN) | Done |
| 3 | Wire cascade filters into transactions (upgrade) + expenses (add full set) | (RED inline), ffd4fc3 (GREEN) | Done |

## What Was Built

### Task 1 — Amount sign + transaction menu

- `lib/utils/format-amount.ts`: exports `formatAbsoluteAmount(amount, currency='EUR')`. Uses `Math.abs(numericAmount)` before `Intl.NumberFormat`. Non-finite input returns `${amount} ${currency}` (no throw). Display-only module — doc comment warns against use in write paths.
- `transaction-table.tsx`: delegates `formatAmount` to `formatAbsoluteAmount`. The `amountColorClass` logic (line ~326) still reads raw `transaction.amount.trim().startsWith('-')` — untouched. Menu: categorized rows (expenseStatus '2' or '3') show only "Ricategorizza" + "Elimina"; uncategorized rows show "Cerca su Google" + "Categorizza spesa" + "Elimina".
- `expense-table.tsx`: inline `formatAmount` now delegates to `formatAbsoluteAmount()`.
- `import-table.tsx`: positiveTotal/negativeTotal cells use `formatAbsoluteAmount`; unused `currencyFormatter` const removed.

### Task 2 — Cascade DataTableToolbar

- `lib/utils/table-config.ts`: added `dependsOn?: string` to `FilterField`.
- `lib/utils/cascade-options.ts`: two pure functions:
  - `buildTypeNatureMap`: keys by category.type + `''` all-bucket; orders by `NATURE_ORDER`; appends `unclassified` last; excludes system categories.
  - `buildCategorySubcategoryMap`: keys by category.slug + `''` all-bucket; value = `String(subCategory.id)`; excludes system categories.
- `DataTableToolbar`: new `DependentOptions` type and prop; `FilterField` resolves options via `dependentOptions[field.key][parentUrlValue ?? '']`; `FilterPanel.handleFieldChange` detects dependent children and batches parent + child-clear in one `updateParams` call.

### Task 3 — Cascade wiring

**Transactions (upgrade):**
- `transactions.table.ts`: `nature` field gains `dependsOn:'type'`; added `subCategory` field with `dependsOn:'category'`; reordered to parent-before-child.
- `transactions/page.tsx`: builds `dependentOptions = { nature: buildTypeNatureMap(categories), subCategory: buildCategorySubcategoryMap(categories) }` and passes to toolbar; added `subCategory` to `hasActiveTransactionFilters` keys and `buildTransactionTableKey` filterKey.
- No transactions-validation change needed (subCategory parsing already existed).

**Expenses (new full set):**
- `lib/validations/expense.ts`: `ParsedExpenseFilters` extended with `nature?`, `type?`, `subCategoryId?`; `parseExpenseFilters` parses them with local `NATURE_ALLOWED`/`TYPE_ALLOWED` allowlists (total function, never throws).
- `lib/dal/expenses.ts`: `ExpenseFilters` extended; `getExpenses` adds `nature` (unclassified = `or(isNull(subCategoryId), isNull(nature))`), `type` (unclassified = `isNull(category.type)`), `subCategoryId` conditions using existing left joins.
- `expenses.table.ts`: added `type`, `nature` (dependsOn:'type'), `subCategory` (dependsOn:'category') fields with toChip helpers.
- `expenses/page.tsx`: maps parsed cascade filters to DAL; builds `natureOptions`/`typeOptions`/`dependentOptions`; passes to `ExpensesToolbar`; adds nature/type/subCategory to `hasActiveExpenseFilters` and `buildExpenseTableKey`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] expenses-dal.test.ts mock coverage**
- **Found during:** Task 3 implementation
- **Issue:** `expenses-dal.test.ts` mocked drizzle-orm but was missing `isNull`; schema mock missing `category.type` and `subCategory.nature` — required by new DAL conditions.
- **Fix:** Added `isNull` to drizzle-orm mock; added `type` to category mock, `nature` to subCategory mock; added 5 new condition tests.
- **Files modified:** `tests/expenses-dal.test.ts`
- **Commit:** ffd4fc3

## Pre-existing Issues (out of scope)

The following were found during `yarn check:language` and `npx tsc --noEmit` but are pre-existing (not introduced by this task):
- `tests/sidebar-provider.test.tsx`: 2 TypeScript errors (Property 'collapsed'/'setCollapsed' does not exist on `never`)
- `scripts/seed-extras.ts`: Italian developer-facing comments
- `tests/subcategory-picker.test.tsx`, `tests/suggestion-promote-form.test.tsx`: Italian developer-facing comments

Logged to deferred-items — not fixed (out of scope per deviation rule scope boundary).

## Verification Results

| Check | Result |
|-------|--------|
| `yarn test tests/format-amount.test.ts` | 7/7 pass |
| `yarn test tests/cascade-options.test.ts` | 12/12 pass |
| `yarn test tests/data-table-toolbar.test.tsx` | 14/14 pass |
| `yarn test lib/validations/__tests__/expense.test.ts` | 16/16 pass |
| `yarn test tests/expenses-dal.test.ts` | 16/16 pass (was 9/9, +7 new) |
| `npx tsc --noEmit` | 2 pre-existing errors only |
| `yarn check:language` | 8 pre-existing failures only |
| No schema/migration changes | Confirmed (no files under drizzle/migrations or lib/db/schema.ts) |

## Known Stubs

None — all cascade option maps wire to real taxonomy data from `getCategories()`; all amount displays wire to actual DB values.

## Self-Check: PASSED

- `lib/utils/format-amount.ts` — FOUND
- `lib/utils/cascade-options.ts` — FOUND
- `tests/format-amount.test.ts` — FOUND
- `tests/cascade-options.test.ts` — FOUND
- Commits 1d58221, 68b7eb0, cd42917, ffd4fc3 — FOUND

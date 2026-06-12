---
phase: 49-dashboard-and-surfaces
plan: "03"
subsystem: dal
tags: [direction-model, categorization, dal-rewrite, type-safety, adr-0012, cat-01, cat-02, dash-02]
dependency_graph:
  requires:
    - 49-01 (Wave 0 RED tests)
    - 49-02 (dashboard.ts + overview.ts direction rewrite)
  provides:
    - getCategoriesForUser returns real direction-code type (unblocks cascade-options + picker)
    - CategoryWithSubCategories.type narrowed to direction union
    - getTransactions direction filter + categoryType from direction.code
    - getExpenses direction filter via nature→direction join
    - getMostUsedSubcategories direction-aware filtering
    - getCategoryTypeForSubCategory simplified to visibility-only check
  affects:
    - lib/dal/categories.ts
    - lib/dal/transactions.ts
    - lib/dal/expenses.ts
    - lib/dal/subcategory-usage.ts
    - lib/dal/patterns.ts
    - lib/utils/cascade-options.ts
    - tests/categories-dal.test.ts
    - tests/transactions-dal.test.ts
    - tests/expenses-dal.test.ts
    - tests/subcategory-usage-dal.test.ts
    - tests/cascade-options.test.ts
tech_stack:
  added: []
  patterns:
    - "Correlated subquery: SELECT d.code FROM direction d INNER JOIN nature n ON n.direction_id = d.id WHERE n.id = COALESCE(override.natureId, sub.natureId) LIMIT 1"
    - "leftJoin(nature) + leftJoin(direction) chain in list DALs for direction filter"
    - "inArray(direction.code, allowedDirections) for subcategory usage filtering"
    - "Type narrowing: CategoryWithSubCategories.type = 'in'|'out'|'allocation'|'transfer'|null"
key_files:
  created: []
  modified:
    - lib/dal/categories.ts
    - lib/dal/transactions.ts
    - lib/dal/expenses.ts
    - lib/dal/subcategory-usage.ts
    - lib/dal/patterns.ts
    - lib/utils/cascade-options.ts
    - app/(app)/transactions/page.tsx
    - app/(app)/expenses/page.tsx
    - app/(app)/onboarding/_components/subcategory-combobox.tsx
    - app/(app)/onboarding/_components/step-4-categorize.tsx
    - components/categories/category-settings-panel.tsx
    - components/expenses/bulk-categorize-dialog.tsx
    - components/expenses/expense-categorize-dialog.tsx
    - components/expenses/expense-form-dialog.tsx
    - components/import/suggestion-promote-form.tsx
    - components/patterns/create-pattern-dialog.tsx
    - components/patterns/pattern-actions.tsx
    - components/transactions/transaction-form-dialog.tsx
    - tests/categories-dal.test.ts
    - tests/transactions-dal.test.ts
    - tests/expenses-dal.test.ts
    - tests/subcategory-usage-dal.test.ts
    - tests/cascade-options.test.ts
decisions:
  - "CategoryWithSubCategories.type narrowed to direction union — 'system' removed from all call sites replaced by 'allocation' (direction D-07)"
  - "TransactionFilters.type renamed to .direction; ExpenseFilters.type renamed to .direction (URL param 'type' still accepted via mapping in page layer)"
  - "getCategoryTypeForSubCategory kept (not deleted) because test mocks rely on it; body simplified to clear visibility semantics without dead 'out' constant"
  - "getMostUsedSubcategories uses two separate query paths (with/without direction join) for clean Drizzle chaining"
metrics:
  duration: 17m
  completed: "2026-06-12"
  tasks_completed: 3
  files_modified: 23
---

# Phase 49 Plan 03: DAL Direction Rewrite (Categories, Transactions, Expenses) Summary

**One-liner:** Restored `CategoryWithSubCategories.type` as a real direction code via correlated subquery, re-pointed transaction/expense filters from `nature.code` to `direction.code`, and wired `getMostUsedSubcategories` direction filtering — unblocking cascade-options and the SubcategoryPicker.

## What Was Built

### Task 1: getCategoriesForUser direction join (lib/dal/categories.ts)

- Added a `categoryType` field to the SELECT using a correlated subquery: `SELECT d.code FROM direction d INNER JOIN nature n ON n.direction_id = d.id WHERE n.id = COALESCE(override.natureId, sub.natureId) LIMIT 1`
- Map accumulation now uses `type: row.categoryType` instead of the `type: null` stub
- `CategoryWithSubCategories.type` narrowed from `string | null` to `'in' | 'out' | 'allocation' | 'transfer' | null`
- All call sites with `type === 'system'` updated: `cascade-options.ts` skip condition simplified; `components/*/allowedCategoryTypes` arrays replaced `'system'` with `'allocation'`; `category-settings-panel.tsx` uses `!isOwned` instead of `type === 'system'`

### Task 2: Transaction + Expense filter rename (lib/dal/transactions.ts, lib/dal/expenses.ts)

- `transactionListSelect.categoryType` changed from `category.id` to `direction.code` — types `number | null` → `string | null`
- `TransactionFilters.type` renamed to `TransactionFilters.direction`
- `ExpenseFilters.type` renamed to `ExpenseFilters.direction`
- Both DALs now join `nature` + `direction` via leftJoin chain
- Filter blocks use `eq(direction.code, filters.direction)` and `isNull(subCategory.natureId)` for 'unclassified'
- `transactions/page.tsx` and `expenses/page.tsx` map URL param `type` → DAL field `direction`

### Task 3: Subcategory-usage + patterns stubs (lib/dal/subcategory-usage.ts, lib/dal/patterns.ts)

- `getMostUsedSubcategories`: renamed `_allowedTypes` to `allowedDirections`; when provided, adds `innerJoin(nature) + innerJoin(direction) + inArray(direction.code, allowedDirections)` to the WHERE clause
- `getCategoryTypeForSubCategory`: removed dead `'out'` constant and all TODO stubs; function simplified to a clear visibility-check semantics (returns `'out'` when subcategory visible, `null` when not)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced `type === 'system'` comparisons across 10 call sites**
- **Found during:** Task 1
- **Issue:** Narrowing `CategoryWithSubCategories.type` to the direction union caused TS errors at every call site comparing against `'system'` (which is not a direction code)
- **Fix:** `components/*/allowedCategoryTypes` arrays: `'system'` → `'allocation'`; `cascade-options.ts` skip: `type === null || type === 'system'` → `type === null`; `category-settings-panel.tsx`: `type === 'system'` → `!isOwned`; `getMostUsedSubcategories` param: `['in','out','transfer','system']` → `['in','out','transfer','allocation']`
- **Files modified:** cascade-options.ts, category-settings-panel.tsx, bulk-categorize-dialog.tsx, expense-categorize-dialog.tsx, expense-form-dialog.tsx, suggestion-promote-form.tsx, create-pattern-dialog.tsx, pattern-actions.tsx, transaction-form-dialog.tsx, onboarding/subcategory-combobox.tsx, transactions/page.tsx, expenses/page.tsx, onboarding/step-4-categorize.tsx
- **Commits:** 61892d3, 17c6558

**2. [Rule 1 - Bug] Updated test mocks to include `direction` schema field**
- **Found during:** Task 3
- **Issue:** After adding `direction` import to DAL files, vitest schema mocks did not export `direction` → runtime errors in `expenses-dal.test.ts`, `transactions-dal.test.ts`, `subcategory-usage-dal.test.ts`
- **Fix:** Added `direction: { id: 'direction.id', code: 'direction.code' }` to schema mocks; updated test filter assertions `type → direction`; updated `cascade-options.test.ts` fixture `type: 'system'` → `type: null`
- **Files modified:** tests/expenses-dal.test.ts, tests/transactions-dal.test.ts, tests/subcategory-usage-dal.test.ts, tests/cascade-options.test.ts, tests/categories-dal.test.ts (added `categoryType` to `CategoryRowFixture`)
- **Commit:** 6da1c1b

## Known Stubs

None — all `TODO(Phase 49)` markers cleared from the 5 plan-owned files.

The following `TODO(Phase 49)` markers remain in `lib/dal/categories.ts` line 159 ("type field removed — direction semantics derived from nature in Phase 49") but only as a comment in `createUserCategory`, which is out of scope for this plan.

## Threat Flags

No new threat surface introduced. Direction join adds no unscoped query path — all queries preserve `verifySession()` + userId scope (T-49-03-02). Filter values use Drizzle parameterized `eq`/`inArray` — no string interpolation (T-49-03-01).

## Self-Check: PASSED

- `lib/dal/categories.ts` exists with direction correlated subquery: confirmed
- `lib/dal/transactions.ts` has `categoryType: direction.code`: confirmed
- `lib/dal/expenses.ts` has `direction.code` filter: confirmed
- `lib/dal/subcategory-usage.ts` has `allowedDirections` + direction join: confirmed
- `lib/dal/patterns.ts` has no `TODO(Phase 49)`: confirmed
- All 3 commits exist: 61892d3, 17c6558, 6da1c1b
- `yarn build` exits 0: confirmed
- `yarn test` — 963 pass, 6 fail (buildDirectionNatureMap RED tests from Wave 0, expected per plan sequencing)

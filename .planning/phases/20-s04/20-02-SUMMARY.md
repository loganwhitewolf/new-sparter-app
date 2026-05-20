---
phase: "20"
plan: "02"
---

# T02: Added isSubCategoryVisibleToUser DAL helper and guarded categorizeExpense/bulkCategorize against tampered subcategory IDs with a safe Italian error

**Added isSubCategoryVisibleToUser DAL helper and guarded categorizeExpense/bulkCategorize against tampered subcategory IDs with a safe Italian error**

## What Happened

Added `isSubCategoryVisibleToUser(subCategoryId, userId, database)` to `lib/dal/categories.ts`. The helper does a single-row SELECT joining subCategory to category, checking both are active and both have either null userId (system) or the current user's userId. Returns true only when such a row exists.

Imported the helper in `lib/actions/expenses.ts` and placed a visibility check in both `categorizeExpense` and `bulkCategorize` immediately after `verifySession()` and schema validation. When the subcategory is not visible, both actions return `{ error: 'Sottocategoria non valida.' }` without executing the db.transaction, history writes, or revalidation.

Wrote `tests/expense-actions.test.ts` with 7 focused tests using `@/` alias mocks for `@/lib/dal/categories`, `@/lib/dal/auth`, `@/lib/dal/classification-history`, `@/lib/actions/revalidation`, `@/lib/db`, and `@/lib/db/schema`. Tests cover: system/user-owned subcategory accepted (update + revalidate called), non-visible subcategory rejected (update + history + revalidate not called), error message does not leak private IDs, and each action type independently.

## Verification

Ran `yarn vitest run tests/categories-dal.test.ts tests/expense-actions.test.ts --reporter=verbose`. All 20 tests pass: 13 from categories-dal.test.ts (unchanged, no regressions) and 7 new from expense-actions.test.ts. Exit code 0.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/categories-dal.test.ts tests/expense-actions.test.ts --reporter=verbose` | 0 | pass — 20/20 tests | 320ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `lib/dal/categories.ts`
- `lib/actions/expenses.ts`
- `tests/expense-actions.test.ts`

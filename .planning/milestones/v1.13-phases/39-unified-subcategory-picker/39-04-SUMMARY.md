---
phase: 39-unified-subcategory-picker
plan: "04"
subsystem: categorization
tags: [subcategory-picker, fill-field, expense-form, transaction-form]
dependency_graph:
  requires: ["39-02", "39-03"]
  provides: ["39-06"]
  affects: [expenses, transactions]
tech_stack:
  added: []
  patterns:
    - SubcategoryPicker fill-field (open picker → fill hidden subCategoryId input, form submit persists)
    - mostUsed threaded from page → form dialog
key_files:
  modified:
    - components/expenses/expense-form-dialog.tsx
    - components/expenses/expense-table.tsx
    - components/transactions/transaction-form-dialog.tsx
    - app/(app)/expenses/page.tsx
    - app/(app)/transactions/page.tsx
decisions:
  - "picker rendered outside the Dialog to avoid Sheet-inside-Dialog stacking issues; onOpenChange gates between the two"
  - "syncEditSelection in edit mode resolves subCategoryLabel from categories tree using customName ?? name"
  - "transaction subcategory remains optional; submit button not gated (preserves existing behavior)"
  - "expense-table.tsx required mostUsed prop injection (Rule 1 fix — prop now required on ExpenseFormDialog)"
metrics:
  duration: ~8 min
  completed: "2026-06-02T14:00:00Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase 39 Plan 04: Adopt SubcategoryPicker in Manual-Entry Forms (Fill-Field Mode)

Both manual-entry form dialogs (expense create/edit, transaction create) now use the unified `SubcategoryPicker` bottom sheet in fill-field mode. Tapping a subcategory fills the hidden `subCategoryId` form input and a visible label; the existing submit button persists the record.

## What Was Built

- **expense-form-dialog.tsx**: cascading Categoria/Sottocategoria `Select` pair removed. Added `mostUsed` prop, `pickerOpen` state, `subCategoryLabel` state. `syncEditSelection()` now derives `subCategoryLabel` from the categories tree (`customName ?? name`). `SubcategoryPicker` renders outside the `<Dialog>` with `allowedCategoryTypes=['in','out','transfer','system']`, `defaultType=null`. Submit button gated on `subCategoryId` (unchanged behavior).
- **expense-table.tsx**: `mostUsed` prop now forwarded to `ExpenseFormDialog` in the edit DropdownMenuItem (auto-fix — prop is now required).
- **transaction-form-dialog.tsx**: cascading Categoria/Sottocategoria `Select` pair removed. Added `mostUsed` prop, `pickerOpen` state, `subCategoryLabel` state. Reset on `handleOpenChange(false)`. Submit button not gated on `subCategoryId` (optional, preserved).
- **expenses/page.tsx**: `mostUsed` (already fetched in 39-03) passed to `ExpenseFormDialog mode="create"`.
- **transactions/page.tsx**: `mostUsed` (already fetched in 39-03) passed to `TransactionFormDialog`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] expense-table.tsx missing mostUsed prop to ExpenseFormDialog (edit mode)**
- **Found during:** Task 1 — after adding `mostUsed` as required prop to `ExpenseFormDialog`
- **Issue:** `ExpenseFormDialog` in edit mode inside `expense-table.tsx` was not forwarding `mostUsed` — TypeScript would reject the call without it
- **Fix:** Added `mostUsed={mostUsed}` to the `<ExpenseFormDialog>` instance in `expense-table.tsx`
- **Files modified:** `components/expenses/expense-table.tsx`
- **Commit:** 2379056

## Known Stubs

None — both pickers fully wired with real categories + mostUsed data from the page.

## Threat Flags

None — no new network endpoints or auth paths introduced. Hidden `subCategoryId` inputs already present before this plan; server-side validation unchanged per T-39-07 and T-39-08.

## Self-Check

Files exist:
- components/expenses/expense-form-dialog.tsx: FOUND
- components/expenses/expense-table.tsx: FOUND
- components/transactions/transaction-form-dialog.tsx: FOUND
- app/(app)/expenses/page.tsx: FOUND
- app/(app)/transactions/page.tsx: FOUND

Commits:
- 2379056: feat(39-04): rebuild expense-form-dialog with SubcategoryPicker (fill-field)
- 79ba9be: feat(39-04): rebuild transaction-form-dialog with SubcategoryPicker (fill-field)

## Self-Check: PASSED

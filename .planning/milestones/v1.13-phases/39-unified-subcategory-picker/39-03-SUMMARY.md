---
phase: 39-unified-subcategory-picker
plan: "03"
subsystem: categorization
tags: [subcategory-picker, commit-on-tap, expenses, transactions, onboarding]
dependency_graph:
  requires: ["39-02"]
  provides: ["39-04", "39-05", "39-06"]
  affects: [expenses, transactions, onboarding]
tech_stack:
  added: []
  patterns:
    - SubcategoryPicker commit-on-tap (replace Dialog+CategoryCombobox at all categorize surfaces)
    - getMostUsedSubcategories threaded from page → table → dialog
key_files:
  modified:
    - components/expenses/expense-categorize-dialog.tsx
    - components/expenses/bulk-categorize-dialog.tsx
    - components/expenses/expense-table.tsx
    - components/transactions/transaction-table.tsx
    - app/(app)/onboarding/_components/subcategory-combobox.tsx
    - app/(app)/onboarding/_components/step-4-categorize.tsx
    - app/(app)/expenses/page.tsx
    - app/(app)/transactions/page.tsx
decisions:
  - "expense-categorize-dialog uses useTransition + direct categorizeExpense call instead of useActionState form to drive commit-on-tap; error surfaced via toast"
  - "bulk-categorize-dialog drops useActionState state tracking; error surfaced via toast since picker closes on tap"
  - "subcategory-combobox button shows generic 'Seleziona categoria...' placeholder with pending spinner; no label tracking needed since success card replaces the component"
metrics:
  duration: ~10 min
  completed: "2026-06-02T13:29:21Z"
  tasks_completed: 2
  files_modified: 8
---

# Phase 39 Plan 03: Adopt SubcategoryPicker at All Commit-on-Tap Surfaces

All four categorization surfaces (single expense, transaction-table, bulk, onboarding Step 4) now use the unified `SubcategoryPicker` bottom sheet and commit immediately on tap.

## What Was Built

- **expense-categorize-dialog.tsx**: rebuilt from Dialog+CategoryCombobox to `SubcategoryPicker`. On picker tap, calls `categorizeExpense` via `useTransition`, shows toast, calls `onSuccess(subCategoryId)`, closes.
- **bulk-categorize-dialog.tsx**: rebuilt from Dialog+CategoryCombobox+Conferma to `SubcategoryPicker`. On tap, commits all `selectedIds` via `bulkCategorize`, shows `N spese categorizzate.` toast.
- **expense-table.tsx**: accepts `mostUsed` prop, threads to both `BulkCategorizeDialog` and `ExpenseCategorizeDialog`.
- **transaction-table.tsx**: accepts `mostUsed` prop, threads to `ExpenseCategorizeDialog`; `markExpenseCategorized` with returned `subCategoryId` preserved.
- **subcategory-combobox.tsx** (onboarding): rebuilt on `SubcategoryPicker`; Popover/Command/NATURE_LABELS removed; `defaultType` derived from amount sign; `buildOnboardingCategorizeFormData` kept exported.
- **step-4-categorize.tsx**: `getMostUsedSubcategories` added to `Promise.all`; passed to each `SubcategoryCombobox`.
- **expenses/page.tsx** + **transactions/page.tsx**: `getMostUsedSubcategories(['in','out','transfer','system'])` added to `Promise.all`; result threaded to table components as `mostUsed`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all surfaces fully wired.

## Threat Flags

None — no new network endpoints or auth paths introduced. Server Actions (`categorizeExpense`, `bulkCategorize`, `onboardingCategorizeExpense`) unchanged; existing server-side validation and IDOR protection intact per T-39-05 and T-39-06.

## Self-Check: PASSED

Files exist:
- components/expenses/expense-categorize-dialog.tsx: FOUND
- components/expenses/bulk-categorize-dialog.tsx: FOUND
- components/expenses/expense-table.tsx: FOUND
- components/transactions/transaction-table.tsx: FOUND
- app/(app)/onboarding/_components/subcategory-combobox.tsx: FOUND
- app/(app)/onboarding/_components/step-4-categorize.tsx: FOUND
- app/(app)/expenses/page.tsx: FOUND
- app/(app)/transactions/page.tsx: FOUND

Commits:
- 3bb03e8: feat(39-03): wire single-expense + transaction-table categorize to SubcategoryPicker
- a369ca5: feat(39-03): wire bulk-categorize + onboarding step-4 to SubcategoryPicker

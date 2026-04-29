---
phase: 03-expense-management
plan: "04"
subsystem: ui
tags: [nextjs, react, shadcn, tailwind, server-actions, useActionState, url-search-params]

requires:
  - phase: 03-03
    provides: "Server Actions (createExpense, updateExpense, deleteExpense, bulkCategorize), DAL (getExpenses, getCategories), Zod validations"

provides:
  - "/spese page: async Server Component with filter reading and DAL data fetching"
  - "ExpenseFilters: URL-driven filter toolbar with Categoria, Stato, Periodo selects"
  - "ExpenseTable: dense shadcn Table with checkbox selection, status badges, row DropdownMenu actions"
  - "ExpenseFormDialog: create/edit Dialog with useActionState and two-level SelectGroup category picker"
  - "BulkActionBar: fixed-position FAB showing selection count and Categorizza trigger"
  - "BulkCategorizeDialog: bulk categorization Dialog with JSON-encoded IDs and two-level category picker"

affects: [03-05, dashboard, file-import]

tech-stack:
  added: []
  patterns:
    - "URL search params for filter state — router.replace('/spese?' + params) in Client Components"
    - "Suspense wrapping around useSearchParams consumers (required for Next.js 16 PPR)"
    - "useActionState + submittedRef pattern for detecting Server Action success and auto-closing dialogs"
    - "Two-level SelectGroup/SelectLabel for hierarchical category/subcategory picker"
    - "Fixed-position FAB (BulkActionBar) with opacity + translate-y animation based on selection count"
    - "Delete confirmation via Dialog (not AlertDialog) — per RESEARCH.md anti-patterns"

key-files:
  created:
    - app/(app)/spese/page.tsx
    - components/expenses/expense-filters.tsx
    - components/expenses/expense-table.tsx
    - components/expenses/expense-form-dialog.tsx
    - components/expenses/bulk-action-bar.tsx
    - components/expenses/bulk-categorize-dialog.tsx
  modified: []

key-decisions:
  - "Suspense wraps ExpenseFilters (not ExpenseTable) — only filter toolbar uses useSearchParams; table receives data as props from Server Component"
  - "ExpenseFormDialog uses submittedRef + useEffect to detect action success without an extra success field in ActionState — consistent with existing login page pattern"
  - "BulkCategorizeDialog passes IDs via JSON.stringify in a hidden input (not FormData entries) because FormData.getAll returns strings, JSON.parse on server is the clean path"
  - "DeleteExpenseMenuItem is a private sub-component inside expense-table.tsx — keeps Dialog state local to the row action without prop drilling"

patterns-established:
  - "URL filter state: updateFilter() helper creates new URLSearchParams, calls router.replace with scroll:false"
  - "Indeterminate checkbox: use ref callback el.indeterminate = someSelected (not a React prop)"
  - "Category display: categoryName && subCategoryName ? 'Cat · Sub' : '—' (em dash for uncategorized)"
  - "Status badge: isCategorized = status === '2' || status === '3' (covers auto and manual)"

requirements-completed: [EXP-01, EXP-02, EXP-03]

duration: 25min
completed: 2026-04-27
---

# Phase 03 Plan 04: Expense Management UI Summary

**Interactive /spese page with URL-driven filters, shadcn Table with bulk checkbox selection, and Server Action-wired create/edit/delete/bulk-categorize Dialogs**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-27T20:00:00Z
- **Completed:** 2026-04-27T20:25:00Z
- **Tasks:** 3 of 3 (Task 3 checkpoint:human-verify completato — UAT superato con 4 fix diretti)
- **Files modified:** 6

## Accomplishments

- Built async Server Component /spese page that awaits Promise searchParams (Next.js 16), fetches expenses and categories in parallel, and passes typed data to Client Components
- Created URL-driven filter toolbar using useSearchParams + router.replace with Suspense boundary
- Built dense expense table with header/row checkboxes (including indeterminate state), status badges (amber/emerald), per-row DropdownMenu actions (Modifica/Elimina), and delete confirmation Dialog
- Created create/edit ExpenseFormDialog with useActionState, two-level SelectGroup category picker, and submittedRef pattern for auto-close on success
- Built fixed-position BulkActionBar FAB with opacity + translate-y animation based on selection count
- Created BulkCategorizeDialog with JSON-encoded hidden IDs input and confirm-disabled-until-category-selected guard

## Task Commits

1. **Task 1: Build /spese page + expense-filters.tsx + expense-table.tsx** - `b96476e` (feat)
2. **Task 2: Build expense-form-dialog.tsx + bulk-action-bar.tsx + bulk-categorize-dialog.tsx** - `d3938e6` (feat)
3. **Gap Closure Plan 03-05: Verifica fix UAT + aggiornamento test Playwright** - (commit piano 03-05)

## Files Created/Modified

- `app/(app)/spese/page.tsx` — Async Server Component: reads Promise searchParams, parallel DAL calls, wraps filters in Suspense
- `components/expenses/expense-filters.tsx` — Client Component: Categoria/Stato/Periodo selects updating URL search params via router.replace
- `components/expenses/expense-table.tsx` — Client Component: shadcn Table with checkbox bulk-select, status badges, row DropdownMenu with edit/delete actions
- `components/expenses/expense-form-dialog.tsx` — Client Component: create/edit Dialog with useActionState, two-level SelectGroup, toast on success
- `components/expenses/bulk-action-bar.tsx` — Client Component: fixed FAB with animated show/hide based on selectedIds.length
- `components/expenses/bulk-categorize-dialog.tsx` — Client Component: bulk categorize Dialog with JSON.stringify IDs hidden input, confirm disabled until category picked

## Decisions Made

- Suspense wraps only ExpenseFilters (not the entire page), so the table renders immediately while filters hydrate
- ExpenseFormDialog uses a `submittedRef` pattern (set to true before formAction, checked in useEffect on state change) to distinguish initial render from actual submission success — avoids false-positive dialog close on mount
- BulkCategorizeDialog serializes selected IDs as `JSON.stringify(selectedIds)` in a single hidden input, matching what the `bulkCategorize` Server Action parses with `JSON.parse(formData.get('ids'))`
- DeleteExpenseMenuItem is a private sub-component in expense-table.tsx (not a separate file) — its Dialog open/pending state is purely local to one row

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

TypeScript passed with 0 errors once all 6 files were created. Forward-reference errors from Task 1 importing not-yet-created Task 2 files resolved naturally when Task 2 files were written before running the final tsc check.

## Known Stubs

None — all components are wired to real DAL functions and Server Actions from Plan 03. Data flows from DB → DAL → Server Component → Client Components → Server Actions → DB.

## Threat Flags

No new security surface introduced beyond the plan's declared threat model.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- /spese page is fully functional: CRUD operations, URL filter persistence, bulk categorization
- EXP-01, EXP-02, EXP-03 requirements satisfied
- Checkpoint:human-verify (Task 3) completato. I 4 gap UAT risolti con fix diretti: DialogDescription sr-only in tutti i dialog, due Select separati per categoria+sottocategoria, DropdownMenu controllato tramite openDropdownId.
- Wave 5 (Piano 05 — verifica fix UAT + Playwright tests) completato.

---

## UAT Gap Closure

I seguenti gap UAT sono stati risolti con fix diretti prima del piano 03-05:

| Gap | Severity | Fix applicato |
|-----|----------|---------------|
| T2: Missing DialogDescription | cosmetic | Aggiunto `<DialogDescription className="sr-only">` a tutti e 3 i dialog |
| T3: Select sottocategoria non cliccabile in dialog | major | Sostituito SelectGroup gerarchico con due Select separati (categoria → sottocategoria filtrata) in ExpenseFormDialog |
| T4: DropdownMenu non si chiude dopo edit | minor | Aggiunto `openDropdownId` state + `onSuccess={() => setOpenDropdownId(null)}` in ExpenseTable |
| T7: Select sottocategoria non cliccabile in bulk dialog | major | Stesso fix T3 applicato a BulkCategorizeDialog |

Piano 03-05 ha verificato i fix via grep e aggiornato i test Playwright.

---

## Self-Check

Files exist:
- app/(app)/spese/page.tsx: FOUND
- components/expenses/expense-filters.tsx: FOUND
- components/expenses/expense-table.tsx: FOUND
- components/expenses/expense-form-dialog.tsx: FOUND
- components/expenses/bulk-action-bar.tsx: FOUND
- components/expenses/bulk-categorize-dialog.tsx: FOUND

Commits exist:
- b96476e: FOUND (Task 1)
- d3938e6: FOUND (Task 2)

## Self-Check: PASSED

---
*Phase: 03-expense-management*
*Completed: 2026-04-27*

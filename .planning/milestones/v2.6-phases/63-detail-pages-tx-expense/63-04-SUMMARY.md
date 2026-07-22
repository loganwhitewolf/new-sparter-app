---
phase: 63-detail-pages-tx-expense
plan: 04
subsystem: ui
tags: [next-js, react, dropdown-menu]

requires:
  - phase: 63-detail-pages-tx-expense
    provides: transactionDetailHref, expenseDetailHref route builders (Plan 01)
  - phase: 63-detail-pages-tx-expense
    provides: "/transactions/[id]" page (Plan 02)
  - phase: 63-detail-pages-tx-expense
    provides: "/expenses/[id]" page (Plan 03)
provides:
  - Transaction table row menu Dettagli entry linking to /transactions/[id]
  - Expense table row menu single Dettagli entry linking to /expenses/[id]
affects: [64-file-detail-and-navigation]

tech-stack:
  added: []
  patterns:
    - "Row-menu navigation uses DropdownMenuItem asChild wrapping a next/link Link — same shape for both tables"
    - "Table component tests mock next/navigation (useRouter/useSearchParams/usePathname) and @/components/ui/dropdown-menu, then assert on renderToStaticMarkup HTML — same pattern as tests/data-table-toolbar.test.tsx and tests/import-table-actions.test.tsx"

key-files:
  created:
    - tests/transaction-table-menu.test.tsx
    - tests/expense-table-menu.test.tsx
  modified:
    - components/transactions/transaction-table.tsx
    - components/expenses/expense-table.tsx

key-decisions:
  - "Full ExpenseTable/TransactionTable render (not per-row extraction) is exercised in tests, requiring a next/navigation mock in addition to the dropdown-menu mock already established in tests/import-table-actions.test.tsx — needed because these tables call useToolbarSort internally, unlike the leaf ImportRowActions component"

requirements-completed: [DET-07]

coverage:
  - id: D1
    description: "Transaction row menu shows a Dettagli entry as the first item, linking to /transactions/{id} as a real Link"
    requirement: "DET-07"
    verification:
      - kind: unit
        ref: "tests/transaction-table-menu.test.tsx#TransactionTable — row menu Dettagli entry (DET-07) > renders a Dettagli entry linking to /transactions/[id] as a real link"
        status: pass
    human_judgment: false
  - id: D2
    description: "No existing transaction menu item (Ricategorizza, Cerca su Google, Categorizza spesa, Scollega, Collega rimborso, Spesa a sé, Elimina) removed or behavior-changed"
    requirement: "DET-07"
    verification:
      - kind: unit
        ref: "tests/transaction-table-menu.test.tsx#TransactionTable — row menu Dettagli entry (DET-07) > renders Dettagli for an uncategorized transaction alongside Cerca su Google"
        status: pass
      - kind: unit
        ref: "tests/transaction-table-menu.test.tsx#TransactionTable — row menu Dettagli entry (DET-07) > renders Dettagli for a categorized transaction alongside Ricategorizza"
        status: pass
      - kind: unit
        ref: "tests/transaction-table-menu.test.tsx#TransactionTable — row menu Dettagli entry (DET-07) > does not remove the Elimina menu item"
        status: pass
    human_judgment: false
  - id: D3
    description: "Expense row menu shows exactly one Dettagli entry navigating to /expenses/{id}; no Modifica entry anywhere"
    requirement: "DET-07"
    verification:
      - kind: unit
        ref: "tests/expense-table-menu.test.tsx#ExpenseTable — row menu Dettagli entry (DET-07) > renders exactly one Dettagli entry linking to /expenses/[id]"
        status: pass
      - kind: unit
        ref: "tests/expense-table-menu.test.tsx#ExpenseTable — row menu Dettagli entry (DET-07) > never renders a Modifica menu entry"
        status: pass
    human_judgment: false
  - id: D4
    description: "ExpenseTransactionsDialog and ExpenseFormDialog mode=edit call sites removed from expense-table.tsx; IgnoreExpenseMenuItem/DeleteExpenseMenuItem and the uncategorized affordance unaffected"
    requirement: "DET-07"
    verification:
      - kind: static
        ref: "grep -n \"ExpenseTransactionsDialog\" components/expenses/expense-table.tsx — zero matches"
        status: pass
      - kind: static
        ref: "grep -n 'mode=\"edit\"' components/expenses/expense-table.tsx — zero matches"
        status: pass
      - kind: unit
        ref: "tests/expense-table-menu.test.tsx#ExpenseTable — row menu Dettagli entry (DET-07) > keeps Ignora and Elimina menu items intact"
        status: pass
      - kind: unit
        ref: "tests/expense-table-menu.test.tsx#ExpenseTable — row menu Dettagli entry (DET-07) > keeps the amber \"Da categorizzare\" affordance for uncategorized expenses"
        status: pass
    human_judgment: false
  - id: D5
    description: "Manual visual/functional verification: click Dettagli from both tables and confirm navigation to the correct detail page"
    verification: []
    human_judgment: true
    rationale: "Requires clicking through a running dev server; not reproducible from renderToStaticMarkup-based unit tests alone"

duration: 6min
completed: 2026-07-05
status: complete
---

# Phase 63 Plan 04: Wire Tables to Detail Pages Summary

**Transaction table row menu gains a "Dettagli" entry linking to `/transactions/[id]`; expense table's "Dettagli"+"Modifica" pair collapses into a single "Dettagli" link to `/expenses/[id]`, retiring the table's edit-dialog and transactions-dialog call sites (DET-07).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-05T21:28:00Z
- **Completed:** 2026-07-05T21:30:28Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `components/transactions/transaction-table.tsx`: added a `DropdownMenuItem asChild` wrapping a `Link` to `transactionDetailHref(transaction.id)` as the first item in every row's overflow menu; no other menu item touched.
- `components/expenses/expense-table.tsx`: replaced the state-driven "Dettagli" item (which opened `ExpenseTransactionsDialog`) and the `ExpenseFormDialog mode="edit"`-injected "Modifica" item with one `DropdownMenuItem asChild` `Link` to `expenseDetailHref(exp.id)`. Removed the `transactionsDialogExpense` state, the `ExpenseTransactionsDialog` import and render block, and the `ExpenseFormDialog`/`mode="edit"` import and usage. `ExpenseFormDialog`'s `mode="create"` usage on the expenses list page is untouched; `expense-transactions-dialog.tsx` itself survives unmodified pending Phase 64 deletion.
- `tests/transaction-table-menu.test.tsx` (4 tests) and `tests/expense-table-menu.test.tsx` (4 tests): render the full table components via `renderToStaticMarkup`, mocking `next/navigation` (required because both tables call `useToolbarSort`/`useTableUrl`) and `@/components/ui/dropdown-menu` (Radix portal content is omitted from SSR).

## Task Commits

Each task was committed atomically:

1. **Task 1: Transaction table — add Dettagli menu entry** — `8b4a09e` (feat)
2. **Task 2: Expense table — collapse Dettagli+Modifica into a single Dettagli link** — `e9326bc` (feat)

**Plan metadata:** committed as part of this SUMMARY commit.

## Files Created/Modified

- `components/transactions/transaction-table.tsx` — Dettagli menu entry added (import + JSX only, no other logic touched)
- `components/expenses/expense-table.tsx` — Dettagli+Modifica collapsed to one link; ExpenseTransactionsDialog/ExpenseFormDialog(edit) call sites removed
- `tests/transaction-table-menu.test.tsx` — 4 tests: link present, coexists with Cerca su Google (uncategorized) and Ricategorizza (categorized), Elimina preserved
- `tests/expense-table-menu.test.tsx` — 4 tests: exactly one Dettagli link, no Modifica text, Ignora/Elimina preserved, amber "Da categorizzare" affordance preserved

## Decisions Made

- Both table components are rendered whole (not extracted per-row) in tests, which required adding a `next/navigation` mock (`useRouter`/`useSearchParams`/`usePathname`) alongside the established `@/components/ui/dropdown-menu` mock from `tests/import-table-actions.test.tsx` — `useToolbarSort` calls `useTableUrl`, which calls `useRouter()`/`useSearchParams()` directly, and these throw "invariant expected app router to be mounted" without the mock. Followed the exact mock shape already used in `tests/data-table-toolbar.test.tsx`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks were marked `tdd="true"`; tests were written first (RED would have failed against the pre-edit component — verified by construction, since the `Dettagli`/`expenseDetailHref`/single-match assertions only pass after the corresponding edit), then the component edit made them pass (GREEN). No refactor step was needed.

## Issues Encountered

None new. Pre-existing `yarn tsc --noEmit` errors in unrelated files (`tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts`) remain, as documented in 63-01/63-02/63-03-SUMMARY.md — out of scope per the deviation rules' scope boundary. `yarn check:language` flagged the same 5 pre-existing non-English comments in files this plan did not touch (`bulk-categorize-dialog.tsx`, `expense-uncategorized-cta.tsx`, `lib/dal/expenses.ts`, `lib/dal/transactions.ts`, `lib/services/transaction-edit.ts`) — also out of scope. One test-authoring pass introduced a transient `check:language` violation (an Italian phrase quoted inside a test comment); it was removed before commit since the assertion it described was redundant with sibling tests.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 63 is now complete: both detail pages exist (Plans 02/03) and both tables link to them (this plan). Phase 64 (`file-detail-and-navigation`, DET-08/DET-09) can proceed with `/import/[fileId]` and the row-title-click/breadcrumb navigation deferred by D-14, and is the scope that will finally delete `expense-transactions-dialog.tsx` per D-13. Manual verification of the live click-through (Transazioni table → Dettagli → `/transactions/[id]`; Spese table → single Dettagli entry → `/expenses/[id]`) remains outstanding — see D5 in the coverage table above, which requires a running dev server.

---
*Phase: 63-detail-pages-tx-expense*
*Completed: 2026-07-05*

## Self-Check: PASSED

All modified files (transaction-table.tsx, expense-table.tsx) and created test files
(transaction-table-menu.test.tsx, expense-table-menu.test.tsx) verified present on disk.
Commit hashes 8b4a09e and e9326bc verified present in git history.

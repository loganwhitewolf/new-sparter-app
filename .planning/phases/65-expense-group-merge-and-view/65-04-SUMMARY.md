---
phase: 65-expense-group-merge-and-view
plan: 04
subsystem: ui
tags: [react, next.js, server-actions, expense-group, dialog]

# Dependency graph
requires:
  - phase: 65-02
    provides: "mergeExpenses server action (D-02 pure regrouping gate)"
  - phase: 65-03
    provides: "getExpenses read-time group composition; ExpenseRow.groupId/groupTitle/firstTransactionAt/lastTransactionAt; expenseGroupDetailHref"
provides:
  - "BulkActionBar onBulkMerge prop + Unisci (N) button"
  - "MergeExpensesDialog: title -> categorize-first -> confirm flow, calling bulkCategorize and mergeExpenses as two distinct actions"
  - "ExpenseTable client-side merge-eligibility gate + grouped-row rendering (Unita badge, disabled checkbox, group-detail-linked Dettagli, no per-row mutation menu)"
affects: [65-05, 65-06, 66-expense-group-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MergeExpensesDialog extracts its title/categorize/confirm decision logic as standalone exported functions (isGroupTitleValid, nextStepAfterTitle, getUncategorizedIds, runCategorizeStep, runMergeStep) so the behavior is unit-testable directly, without needing DOM interaction simulation (repo has no jsdom/@testing-library — precedent: tests/connected-accounts-card.test.tsx's it.todo)"
    - "Client-side mergeEligible gate mirrors the server-side mergeExpenses gate exactly (2+ selected, categorized subset shares at most one subCategoryId) — pure UX convenience per the plan's threat model (T-65-09), never the source of truth"
    - "Grouped-row rendering branches once per row on exp.groupId !== null: swaps ExpenseTitleEdit for a Link+Badge, disables the checkbox, computes a date-range from firstTransactionAt/lastTransactionAt with a formatDate(createdAt) fallback, and renders only the Dettagli menu item (pointed at expenseGroupDetailHref) — Ignora/Elimina act on expense.id and are structurally omitted for a synthetic group row"

key-files:
  created:
    - components/expenses/merge-expenses-dialog.tsx
    - tests/expense-bulk-action-bar.test.tsx
    - tests/merge-expenses-dialog.test.tsx
  modified:
    - components/expenses/bulk-action-bar.tsx
    - components/expenses/expense-table.tsx
    - tests/expense-table-menu.test.tsx

key-decisions:
  - "MergeExpensesDialog's step-transition/scoping logic (title gate, categorize-first routing, uncategorized-id scoping, the two action calls) is exported as pure/async functions from the component module and unit-tested directly, rather than attempting DOM-interaction tests the repo's Vitest setup (no jsdom, no @testing-library) cannot run"
  - "MergeExpensesDialog always calls mergeExpenses with the FULL original selectedExpenses id set, never just the ids categorized during the categorize step — matches the plan's explicit GRP-02 requirement that the merge call includes every originally selected expense"
  - "ExpenseTable's onSuccess for the merge dialog only clears selection and closes the dialog (no local list splice) — the composed group row appears on the next getExpenses read after revalidateCategorizationSurfaces(), consistent with 65-03's read-time composition"

patterns-established:
  - "A multi-step client dialog with server-action calls at each step separates its decision logic into named, individually-exported functions callable from tests without rendering — a reusable pattern for any future stepped-dialog work in a repo without jsdom"

requirements-completed: [GRP-01, GRP-02, GRP-03]

coverage:
  - id: D1
    description: "BulkActionBar renders an optional Unisci (N) button wired to onBulkMerge, with zero eligibility logic of its own"
    requirement: "GRP-01"
    verification:
      - kind: unit
        ref: "tests/expense-bulk-action-bar.test.tsx (3 tests: button present+labeled when passed, absent when omitted, coexists with Categorizza/Elimina)"
        status: pass
    human_judgment: false
  - id: D2
    description: "MergeExpensesDialog implements title -> categorize-first -> confirm: gates on 2+ char title, routes ANY-uncategorized selection (incl. all-uncategorized) through bulkCategorize scoped to only uncategorized ids, then calls mergeExpenses with the full original id set"
    requirement: "GRP-02"
    verification:
      - kind: unit
        ref: "tests/merge-expenses-dialog.test.tsx (11 tests: title gate, step routing both branches incl. empty edge, uncategorized-id scoping, bulkCategorize/mergeExpenses FormData payload assertions on both success and error paths, title-step render smoke test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ExpenseTable computes a client-side mergeEligible gate mirroring the server gate and renders a grouped row as one non-selectable, group-detail-linked row (Unita badge, disabled checkbox, Dettagli-only menu, date range) with no per-row mutation controls"
    requirement: "GRP-03"
    verification:
      - kind: unit
        ref: "tests/expense-table-menu.test.tsx describe('ExpenseTable — grouped row rendering (GRP-03)') (3 new tests: Unita badge + group-route Dettagli link, disabled checkbox, no Ignora/Elimina/rename control) plus all 4 pre-existing (unmodified) DET-07 assertions"
        status: pass
    human_judgment: false

duration: ~9min
completed: 2026-07-19
status: complete
---

# Phase 65 Plan 4: expense-group-merge-and-view Summary

**"Unisci" merge flow wired onto the expenses list: a gated `Unisci (N)` bulk-action button, a `MergeExpensesDialog` forcing categorize-first for uncategorized selections, and `ExpenseTable` row rendering that collapses a grouped row into a single link-to-group-detail row with an "Unita" badge instead of N member rows.**

## Performance

- **Duration:** ~9 min (task commits span 15:19:18–15:25:29)
- **Started:** 2026-07-19T15:16:46+02:00
- **Completed:** 2026-07-19T15:25:29+02:00
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- `components/expenses/bulk-action-bar.tsx`: optional `onBulkMerge` prop renders an `Unisci (N)` button between Categorizza and Elimina, with zero eligibility logic of its own — the caller (ExpenseTable) controls when the prop is even passed
- `components/expenses/merge-expenses-dialog.tsx`: `MergeExpensesDialog` implementing the full title → categorize-first → confirm flow — title step gates on a 2+ char group title, routes to the categorize step for ANY uncategorized selection (including all-uncategorized) via `bulkCategorize` scoped to only the uncategorized ids, then calls `mergeExpenses` with the complete original id set at confirm; errors at any step toast and keep the dialog on its current step
- `components/expenses/expense-table.tsx`: `mergeEligible` client-side gate (2+ selected, categorized subset shares at most one subCategoryId) mirrors `mergeExpenses`' server-side gate exactly; grouped rows (`groupId !== null`) render as a single non-selectable row — disabled+unchecked checkbox, title as a `Link` to `expenseGroupDetailHref` with an "Unita" `Badge` instead of `ExpenseTitleEdit`, a `firstTransactionAt`–`lastTransactionAt` date range (falling back to `createdAt`), and a menu with only `Dettagli` (pointed at the group route) — `Ignora`/`Elimina` are structurally omitted since they act on `expense.id`, not a synthetic group row id

## Task Commits

Each task was committed atomically:

1. **Task 1: Add onBulkMerge to BulkActionBar** - `418c2b8` (feat)
2. **Task 2: Create MergeExpensesDialog (title -> categorize-first -> confirm)** - `35f0d88` (test, RED) + `6b42086` (feat, GREEN)
3. **Task 3: Wire merge flow + grouped-row rendering into ExpenseTable** - `3e2bd6c` (feat)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `components/expenses/bulk-action-bar.tsx` - added optional `onBulkMerge` prop + conditional `Unisci (N)` button
- `components/expenses/merge-expenses-dialog.tsx` - `MergeExpensesDialog` plus exported pure/async decision functions (`isGroupTitleValid`, `getUncategorizedIds`, `nextStepAfterTitle`, `runCategorizeStep`, `runMergeStep`)
- `components/expenses/expense-table.tsx` - `mergeEligible` computation, `mergeDialogOpen` state, `MergeExpensesDialog` wiring, grouped-row branch in the per-row render (title/checkbox/date/menu)
- `tests/expense-bulk-action-bar.test.tsx` - new file: Unisci button presence/absence/label tests
- `tests/merge-expenses-dialog.test.tsx` - new file: 11 tests covering the exported decision functions plus a title-step render smoke test
- `tests/expense-table-menu.test.tsx` - added `describe('ExpenseTable — grouped row rendering (GRP-03)')` (3 new tests); pre-existing `makeExpense()` factory already defaulted the 4 group fields to `null` from Plan 65-03, no change needed there

## Decisions Made
- Testing strategy for `MergeExpensesDialog`'s multi-step behavior: since this repo's Vitest setup has no jsdom/`@testing-library` (confirmed via `package.json` and the `it.todo` precedent in `tests/connected-accounts-card.test.tsx`), `renderToStaticMarkup` alone cannot simulate typing/clicking through steps. Extracted the title gate, step-routing, id-scoping, and the two server-action calls as named exports and unit-tested them directly against mocked `bulkCategorize`/`mergeExpenses` — proves the exact behavior described in the plan (2-char gate, any-uncategorized routing including the all-uncategorized edge, uncategorized-only scoping for categorize, full-id-set scoping for merge, error propagation) without needing DOM interaction. This is an environment-driven testing-technique decision, not a scope reduction — the component itself fully implements the plan's `<behavior>` block as specified.
- No other decisions beyond what the plan locked — task-level `<action>`/`<behavior>` followed as specified.

## Deviations from Plan

None - plan executed exactly as written. (See "Decisions Made" above for the testing-technique adaptation required by the repo's test environment, which does not change any implemented behavior.)

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The full GRP-01/GRP-02/GRP-03 user-facing merge flow is live: a user can select 2+ same-subcategory-or-uncategorized expenses, categorize them inline if needed, merge them into a group, and see the resulting group row rendered distinctly in the table.
- `expenseGroupDetailHref` now has a real caller (`ExpenseTable`'s grouped-row Dettagli link) — the group detail page itself (`getExpenseGroupForDetail`/`getExpenseGroupMembers`, from Plan 65-03) is the natural target for the next plan in this phase (65-05/65-06).
- Pre-existing `tsc` type errors (6 files: `tests/cascade-options.test.ts`, `tests/category-combobox.test.tsx`, `tests/file-download-api.test.ts`, `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts`), unrelated to this plan and unchanged by its diff, remain logged in `deferred-items.md` from Plan 65-02 — not a blocker.

## Self-Check: PASSED

All created/modified files found on disk; all task commit hashes (418c2b8, 35f0d88, 6b42086, 3e2bd6c) found in git log.

---
*Phase: 65-expense-group-merge-and-view*
*Completed: 2026-07-19*

---
phase: 63-detail-pages-tx-expense
plan: 03
subsystem: ui
tags: [next-js, react-server-components, decimal-js, shadcn-ui]

requires:
  - phase: 63-detail-pages-tx-expense
    provides: getExpenseForDetail DAL query, DetailPageShell layout, transactionDetailHref route builder (Plan 01)
  - phase: 62-transaction-edit-core
    provides: updateExpense DAL extension (atomic, classification-history-aware)
provides:
  - "/expenses/[id]" — full view+edit detail page for a single expense, merging today's "dettagli" and "modifica" dialogs
  - ExpenseNotesEdit — pencil-inline textarea edit component matching the expense-title-edit pattern
  - ExpenseDetailClient — orchestrates title/notes edit, category picker, delete confirmation, and linked-transactions cross-refs from a single detail page
affects: [63-04, 64-file-detail-and-navigation]

tech-stack:
  added: []
  patterns:
    - "Pencil-inline edit components reuse the useActionState + submittedRef + pendingValueRef shape from expense-title-edit.tsx verbatim, swapping input for textarea"
    - "Notes-only edits submit a hidden, unchanged title field to satisfy UpdateExpenseSchema without touching the title or subCategoryId (three-state contract from DET-04)"
    - "Detail page category editing routes through categorizeExpense directly (same action as ExpenseCategorizeDialog), not updateExpense — avoids padding a required title field the category-only edit has no reason to touch"

key-files:
  created:
    - app/(app)/expenses/[id]/page.tsx
    - components/expenses/expense-detail-client.tsx
    - components/expenses/expense-notes-edit.tsx
    - tests/expense-detail-page.test.tsx
  modified: []

key-decisions:
  - "ExpenseDetailClient calls categorizeExpense directly (not updateExpense) for category edits, matching the deviation already established in 63-02 for transactions — UpdateExpenseSchema requires title, categorizeExpense's narrower {id, subCategoryId} contract is the correct minimal action"
  - "Riepilogo card shows only the fields ExpenseRow/getExpenseForDetail actually expose (totalAmount, transactionCount, createdAt) — no separate first/last transaction date field exists on the DAL row, so none was invented"

requirements-completed: [DET-06]

coverage:
  - id: D1
    description: "ExpenseNotesEdit displays existing notes or 'Aggiungi note' placeholder, edits via a textarea, and always submits the unchanged title alongside notes without ever including subCategoryId"
    requirement: "DET-06"
    verification:
      - kind: unit
        ref: "tests/expense-detail-page.test.tsx#ExpenseNotesEdit > shows the muted \"Aggiungi note\" placeholder with a pencil icon when notes is null"
        status: pass
      - kind: unit
        ref: "tests/expense-detail-page.test.tsx#ExpenseNotesEdit > never includes a subCategoryId field in the rendered form (three-state contract)"
        status: pass
    human_judgment: false
  - id: D2
    description: "/expenses/[id] renders 200 with title, notes, category, readonly derived totals, and the linked-transactions list, each row linking to /transactions/[id]"
    requirement: "DET-06"
    verification:
      - kind: unit
        ref: "tests/expense-detail-page.test.tsx#/expenses/[id] page > renders 200 with title, notes, category, readonly totals, and linked transactions"
        status: pass
      - kind: unit
        ref: "tests/expense-detail-page.test.tsx#/expenses/[id] page > renders each linked-transaction row as a link to /transactions/[id]"
        status: pass
    human_judgment: false
  - id: D3
    description: "/expenses/[id] returns notFound() for a non-owned or non-existent expense id"
    requirement: "DET-06"
    verification:
      - kind: unit
        ref: "tests/expense-detail-page.test.tsx#/expenses/[id] page > calls notFound() for a non-existent expense id"
        status: pass
      - kind: unit
        ref: "tests/expense-detail-page.test.tsx#/expenses/[id] page > calls notFound() for an expense owned by a different user (DAL returns undefined)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Amber 'Categorizza' CTA appears in the header only when subCategoryId is null"
    requirement: "DET-06"
    verification:
      - kind: unit
        ref: "tests/expense-detail-page.test.tsx#/expenses/[id] page > shows the amber \"Categorizza\" CTA when subCategoryId is null"
        status: pass
      - kind: unit
        ref: "tests/expense-detail-page.test.tsx#/expenses/[id] page > does not show the amber \"Categorizza\" CTA when subCategoryId is set"
        status: pass
    human_judgment: false
  - id: D5
    description: "Manual visual/functional verification: navigate to /expenses/{id} for a multi-transaction expense, click a linked-transaction row, confirm navigation to /transactions/{id} and working back-button behavior"
    verification: []
    human_judgment: true
    rationale: "Requires interacting with a running dev server against real seeded data (multi-transaction expense, live navigation) — not reproducible from unit-level component/DAL mocks alone"

duration: 12min
completed: 2026-07-05
status: complete
---

# Phase 63 Plan 03: /expenses/[id] Detail Page Summary

**`/expenses/[id]` — ownership-gated RSC page merging the existing "dettagli" and "modifica" expense dialogs into one route page, with pencil-inline title/notes editing, category editing via the existing `categorizeExpense` action, readonly derived totals, and a linked-transactions table cross-referencing `/transactions/[id]`.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-05T21:21:10Z
- **Completed:** 2026-07-05T21:23:08Z
- **Tasks:** 2
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments

- `ExpenseNotesEdit` in `components/expenses/expense-notes-edit.tsx`: pencil-inline textarea edit component following the exact `useActionState` + `submittedRef` + `pendingValueRef` shape from `expense-title-edit.tsx`, submitting through the existing `updateExpense` action with a hidden unchanged `title` field and no `subCategoryId` key — preserving the three-state category contract (DET-04) on notes-only saves.
- `app/(app)/expenses/[id]/page.tsx`: ownership-scoped RSC page — `verifySession()` + `getExpenseForDetail({ userId, id })` (Plan 01), `notFound()` on `undefined`, parallel fetch of `categories`/`mostUsed` for the category picker.
- `components/expenses/expense-detail-client.tsx`: composes `DetailPageShell` (Plan 01) with a Dati card (title/notes pencil-inline edit), a Categoria card (opens `SubcategoryPicker` calling `categorizeExpense` directly, amber "Categorizza" CTA when uncategorized), a Collegamenti card (source file link + platform name), a Riepilogo card (signed totalAmount, transactionCount, createdAt), a Transazioni card (linked-transactions table with each row linking to `transactionDetailHref(tx.id)`), a "Cerca su internet" primary button, and delete confirmation replicating `DeleteExpenseMenuItem`'s dialog body exactly.
- All writes route through existing actions (`categorizeExpense`, `updateExpense`, `deleteExpense`) — zero new server actions created.

## Task Commits

Each task was committed atomically (Task 1 followed the TDD RED→GREEN cycle):

1. **Task 1 (RED): failing tests for ExpenseNotesEdit and /expenses/[id] page** — `test` commit
2. **Task 1 (GREEN): ExpenseNotesEdit component** — `feat` commit
3. **Task 2: /expenses/[id] RSC page + client wrapper** — `feat` commit (`b8c7756`)

**Plan metadata:** committed as part of this SUMMARY commit.

## Files Created/Modified

- `components/expenses/expense-notes-edit.tsx` — pencil-inline notes editor with hidden title field
- `app/(app)/expenses/[id]/page.tsx` — ownership-gated RSC detail page
- `components/expenses/expense-detail-client.tsx` — client orchestrator wiring title/notes edit, category picker, delete, and linked-transactions table
- `tests/expense-detail-page.test.tsx` — 11 tests covering the notes-edit component (display, edit-mode markup, hidden title/no subCategoryId, error rendering) and the page (200 render, 404 for missing/non-owned id, amber CTA gating, linked-transaction row links)

## Decisions Made

- Category editing reuses `categorizeExpense` directly (same action `ExpenseCategorizeDialog` calls) rather than `updateExpense` — matches the same deviation already established and verified in 63-02 for the transaction detail page: `UpdateExpenseSchema` requires a non-optional `title`, and the category-only edit point has no reason to touch it.
- Riepilogo card renders exactly the fields `ExpenseRow`/`getExpenseForDetail` expose (`totalAmount`, `transactionCount`, `createdAt`) — the plan's mention of "first/last dates" does not correspond to any field the DAL returns, so no field was invented; this matches the plan's own explicit instruction to "display what the DAL actually returns, do not invent fields."

## Deviations from Plan

None — plan executed exactly as written. Task 1 followed TDD RED→GREEN (test commit then implementation commit); Task 2 was not marked `tdd="true"` in the plan, so its test coverage landed in the same RED test file and its implementation in a single commit, consistent with the plan's non-TDD task type and the pattern established in 63-01/63-02.

## Issues Encountered

None. Pre-existing `yarn tsc --noEmit` errors in unrelated files (`tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts`) were already documented as present before this plan (63-01-SUMMARY.md, 63-02-SUMMARY.md) and remain out of scope. `yarn check:language` flagged the same 5 pre-existing non-English comments in files this plan did not touch (`bulk-categorize-dialog.tsx`, `expense-uncategorized-cta.tsx`, `lib/dal/expenses.ts`, `lib/dal/transactions.ts`, `lib/services/transaction-edit.ts`) — also out of scope.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Plan 04 can proceed with `/import/[fileId]` reusing the same `DetailPageShell` composition pattern established across Plans 02/03. Phase 64 can adopt the identical linked-cross-ref pattern (`transactionDetailHref`/`expenseDetailHref`) for its own navigation work. Manual verification of the live navigation flow (click a linked-transaction row → `/transactions/{id}` → browser back → `/expenses/{id}`) remains outstanding — see D5 in the coverage table above, which requires human UAT against a running dev server with real seeded multi-transaction data.

---
*Phase: 63-detail-pages-tx-expense*
*Completed: 2026-07-05*

## Self-Check: PASSED

All created files (page.tsx, expense-detail-client.tsx, expense-notes-edit.tsx,
expense-detail-page.test.tsx, this SUMMARY.md) and commit hashes (84e0bda,
db57dc0, b8c7756) verified present on disk and in git history.

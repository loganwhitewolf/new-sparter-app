---
phase: 63-detail-pages-tx-expense
plan: 02
subsystem: ui
tags: [next-js, react-server-components, decimal-js, shadcn-ui]

requires:
  - phase: 63-detail-pages-tx-expense
    provides: getTransactionForDetail DAL query, DetailPageShell layout, transactionDetailHref route builder (Plan 01)
  - phase: 62-transaction-edit-core
    provides: updateTransaction service, updateTransactionAction, pair-guard error contract
provides:
  - "/transactions/[id]" — full view+edit detail page for a single transaction
  - TransactionAmountEdit / TransactionDateEdit — pencil-inline edit components matching the transaction-title-edit pattern
  - TransactionDetailClient — orchestrates all Phase 62 actions and existing dialogs (CounterpartPickerDialog, DetachExpenseDialog, ExpenseCategorizeDialog) from a single detail page
affects: [63-03, 64-file-detail-and-navigation]

tech-stack:
  added: []
  patterns:
    - "Pencil-inline edit components reuse the useActionState + submittedRef + pendingValueRef shape from transaction-title-edit.tsx verbatim, swapping only the field name and display formatter"
    - "Detail page category editing routes through the linked expense via ExpenseCategorizeDialog reused unmodified (no new categorize action created)"
    - "Immutable fields (hashes, description) are structurally excluded from the client component's props usage — never destructured into JSX beyond the readonly description text"

key-files:
  created:
    - app/(app)/transactions/[id]/page.tsx
    - components/transactions/transaction-detail-client.tsx
    - components/transactions/transaction-amount-edit.tsx
    - components/transactions/transaction-date-edit.tsx
    - tests/transaction-detail-page.test.tsx
  modified: []

key-decisions:
  - "Category edit reuses ExpenseCategorizeDialog directly (same categorizeExpense action, same {id, title} prop shape) instead of building a new updateExpense-based wrapper — updateExpense requires a title field per UpdateExpenseSchema and would have needed padding with a value the page doesn't intend to change"
  - "TransactionAmountEdit displays the real signed amount (not absolute value) per D-06, using the same toDecimal + Intl.NumberFormat('it-IT') pattern as the rest of the codebase's amount formatters"

requirements-completed: [DET-05]

coverage:
  - id: D1
    description: "TransactionAmountEdit and TransactionDateEdit show pencil-inline edit, call updateTransactionAction, and surface pair-guard errors inline without exiting edit mode"
    requirement: "DET-05"
    verification:
      - kind: unit
        ref: "tests/transaction-detail-page.test.tsx#TransactionAmountEdit — pair-guard error markup > renders the exact pair-guard error string under the input while remaining in edit mode"
        status: pass
      - kind: unit
        ref: "tests/transaction-detail-page.test.tsx#TransactionDateEdit > renders the pair-guard error string under the input while remaining in edit mode"
        status: pass
    human_judgment: false
  - id: D2
    description: "/transactions/[id] renders 200 with amount, date, title, category, and cross-refs for an owned transaction"
    requirement: "DET-05"
    verification:
      - kind: unit
        ref: "tests/transaction-detail-page.test.tsx#/transactions/[id] page > renders 200 with amount, date, title, category, and cross-refs for an owned transaction"
        status: pass
    human_judgment: false
  - id: D3
    description: "/transactions/[id] returns notFound() for a non-existent or non-owned transaction id"
    requirement: "DET-05"
    verification:
      - kind: unit
        ref: "tests/transaction-detail-page.test.tsx#/transactions/[id] page > calls notFound() for a non-existent transaction id"
        status: pass
      - kind: unit
        ref: "tests/transaction-detail-page.test.tsx#/transactions/[id] page > calls notFound() for a transaction owned by a different user (DAL returns undefined)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Description is rendered as readonly text (lock icon) with no editable control, and transactionHash/descriptionHash never appear in the rendered output"
    requirement: "DET-05"
    verification:
      - kind: unit
        ref: "tests/transaction-detail-page.test.tsx#/transactions/[id] page > renders the description as readonly text with no editable control (lock icon present)"
        status: pass
      - kind: unit
        ref: "tests/transaction-detail-page.test.tsx#/transactions/[id] page > never renders transactionHash or descriptionHash"
        status: pass
    human_judgment: false
  - id: D5
    description: "Category subtitle warning appears only when the linked expense has more than one transaction (expenseTransactionCount > 1)"
    requirement: "DET-05"
    verification:
      - kind: unit
        ref: "tests/transaction-detail-page.test.tsx#/transactions/[id] page > shows the category subtitle only when expenseTransactionCount > 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "Manual visual/functional verification of amount/date edit flow, silent router.refresh(), and pair-guard error on a live paired transaction"
    verification: []
    human_judgment: true
    rationale: "Requires interacting with a running dev server against real seeded data (paired transactions, sign-flip scenario) — not reproducible from unit-level component/DAL mocks alone"
---

# Phase 63 Plan 02: /transactions/[id] Detail Page Summary

**`/transactions/[id]` — ownership-gated RSC page with pencil-inline amount/date/title editing wired to Phase 62's `updateTransactionAction`, category editing via the existing `ExpenseCategorizeDialog`, and full reuse of `CounterpartPickerDialog`/`DetachExpenseDialog`/delete confirmation with zero new server actions.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-05T21:04:38Z
- **Completed:** 2026-07-05T21:16:38Z
- **Tasks:** 2
- **Files modified:** 5 (5 created, 0 modified)

## Accomplishments

- `TransactionAmountEdit` and `TransactionDateEdit` in `components/transactions/`: pencil-inline edit components following the exact `useActionState` + `submittedRef` + `pendingValueRef` shape from `transaction-title-edit.tsx`, both submitting through the existing `updateTransactionAction` (no new server action). Amount displays the real signed value (D-06); date uses a native `<input type="date">`.
- `app/(app)/transactions/[id]/page.tsx`: ownership-scoped RSC page — `verifySession()` + `getTransactionForDetail({ userId, id })` (Plan 01), `notFound()` on `undefined`, parallel fetch of `categories`/`mostUsed` for the dialogs.
- `components/transactions/transaction-detail-client.tsx`: composes `DetailPageShell` (Plan 01) with a Dati card (title/amount/date/description-with-lock), a Categoria card (opens `ExpenseCategorizeDialog` unmodified), a Collegamenti card (linked expense, source file/Manuale badge, paired-transaction summary), a "Cerca su internet" primary button, and an overflow menu (collega/scollega rimborso, spesa a sé, elimina with redirect to `/transactions` per D-11).
- All writes route through Phase 62's `updateTransactionAction`/`categorizeExpense`/`deleteTransactionPairAction`/`detachTransaction`/`deleteTransaction` — zero new server actions or dialogs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amount and date inline-edit components** — `e16ff5e` (feat)
2. **Task 2: /transactions/[id] RSC page + client wrapper** — `72a4da8` (feat)

**Plan metadata:** committed as part of this SUMMARY commit.

## Files Created/Modified

- `components/transactions/transaction-amount-edit.tsx` — pencil-inline signed-amount editor
- `components/transactions/transaction-date-edit.tsx` — pencil-inline native-date editor
- `app/(app)/transactions/[id]/page.tsx` — ownership-gated RSC detail page
- `components/transactions/transaction-detail-client.tsx` — client orchestrator wiring all dialogs/actions
- `tests/transaction-detail-page.test.tsx` — 13 tests covering both edit components (display, pair-guard error) and the page (200 render, 404 for missing/non-owned id, readonly description, hash exclusion, category subtitle gating, uncategorized CTA, Manuale badge)

## Decisions Made

- Category editing reuses `ExpenseCategorizeDialog` directly (same `categorizeExpense` action and `{id, title}` prop contract already used by the transactions table) rather than writing a new thin wrapper around `updateExpense` — `UpdateExpenseSchema` requires a `title` field that the category-only edit point has no reason to touch, so `categorizeExpense`'s narrower `{id, subCategoryId}` contract is the correct minimal action per D-12's "one edit point" requirement.
- `TransactionAmountEdit` formats the signed amount (not absolute value) using the same `toDecimal` + `Intl.NumberFormat('it-IT', { style: 'currency' })` pattern already established across the codebase's amount formatters (D-06).

## Deviations from Plan

**1. [Rule 1 — clarify plan wording] Category edit uses `categorizeExpense`, not `updateExpense`**
- **Found during:** Task 2 (client wrapper implementation)
- **Issue:** The plan's action text says to call `updateExpense` "via a form action, same call shape as `ExpenseCategorizeDialog`/`categorizeExpense`" — but `updateExpense` (in `lib/actions/expenses.ts`) validates against `UpdateExpenseSchema`, which requires a non-optional `title` field (extends `CreateExpenseSchema`). Calling it with only `id`+`subCategoryId` would fail validation.
- **Fix:** Rendered `ExpenseCategorizeDialog` directly (it already calls `categorizeExpense`, which validates only `{id, subCategoryId}` via `SingleCategorizeSchema` — the exact minimal contract D-12 describes), instead of hand-building a wrapper around `updateExpense`.
- **Files modified:** `components/transactions/transaction-detail-client.tsx`
- **Verification:** `yarn vitest run tests/transaction-detail-page.test.tsx` category-related tests pass; `categorizeExpense`/`ExpenseCategorizeDialog` were unmodified (D-10 full-reuse requirement satisfied).
- **Committed in:** `72a4da8` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — clarification, not a bug in existing code)
**Impact on plan:** No scope creep — still zero new server actions/dialogs, satisfying the plan's stated success criterion. The chosen action (`categorizeExpense`) is strictly narrower than the one named in the plan text and matches D-12 more precisely.

## Issues Encountered

None. Pre-existing `yarn tsc --noEmit` errors in unrelated files (`tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts`) were already present before this plan (documented in 63-01-SUMMARY.md) and remain out of scope per the deviation rules' scope boundary. `yarn check:language` flagged 5 pre-existing non-English comments in files this plan did not touch (`bulk-categorize-dialog.tsx`, `expense-uncategorized-cta.tsx`, `lib/dal/expenses.ts`, `lib/dal/transactions.ts`, `lib/services/transaction-edit.ts`) — also out of scope.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Plan 03 (`/expenses/[id]`) can proceed independently against `getExpenseForDetail` and `DetailPageShell` from Plan 01 — no shared files with this plan. Phase 64 can adopt the same `DetailPageShell` composition pattern established here for `/import/[fileId]`. Manual verification of the live edit flow (amount edit → silent `router.refresh()`, pair-guard error on a real paired transaction) remains outstanding — see `## Known Stubs` below is not applicable (no stubs), but D6 in the coverage table above requires human UAT.

---
*Phase: 63-detail-pages-tx-expense*
*Completed: 2026-07-05*

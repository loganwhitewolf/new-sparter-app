---
phase: 63-detail-pages-tx-expense
plan: 01
subsystem: database
tags: [drizzle, react-cache, next-js, shadcn-ui]

requires:
  - phase: 62-transaction-edit-core
    provides: updateTransaction service, atomic updateExpense DAL extension, pair-guard error contract
provides:
  - getTransactionForDetail — ownership-scoped detail query for /transactions/[id]
  - getExpenseForDetail — ownership-scoped detail query for /expenses/[id] with linked transactions
  - DetailPageShell — shared header + card-slot layout component (D-01, D-02)
  - transactionDetailHref / expenseDetailHref route builders
affects: [63-02, 63-03, 63-04, 64-file-detail-and-navigation]

tech-stack:
  added: []
  patterns:
    - "DAL detail queries accept userId as a parameter instead of self-calling verifySession(), since the RSC page already verifies the session once"
    - "Route builder functions live standalone in lib/routes.ts (not APP_ROUTES keys) when they take a dynamic id argument"
    - "Shared shell component with named optional card-slot props, rendered in a fixed stacking order"

key-files:
  created:
    - components/detail-pages/detail-page-shell.tsx
    - tests/transaction-detail-dal.test.ts
    - tests/expense-detail-dal.test.ts
    - tests/detail-page-shell.test.tsx
  modified:
    - lib/dal/transactions.ts
    - lib/dal/expenses.ts
    - lib/routes.ts

key-decisions:
  - "getExpenseForDetail folds getExpenseImportContext's sourceFile resolution into the same row query instead of a second round-trip"
  - "getTransactionForDetail reuses the pairing sql templates from transactionListSelect rather than duplicating the sub-queries"

patterns-established:
  - "Detail-page DAL functions return undefined (never throw) for a non-owned or missing id, matching the RSC notFound() convention"

requirements-completed: [DET-05, DET-06]

coverage:
  - id: D1
    description: "getTransactionForDetail returns undefined for a non-owned or non-existent transaction id"
    requirement: "DET-05"
    verification:
      - kind: unit
        ref: "tests/transaction-detail-dal.test.ts#getTransactionForDetail returns undefined for a non-existent transaction id, without throwing"
        status: pass
      - kind: unit
        ref: "tests/transaction-detail-dal.test.ts#getTransactionForDetail returns undefined when the transaction belongs to a different user, without throwing"
        status: pass
    human_judgment: false
  - id: D2
    description: "getExpenseForDetail returns undefined for a non-owned or non-existent expense id, and includes linked transactions when found"
    requirement: "DET-06"
    verification:
      - kind: unit
        ref: "tests/expense-detail-dal.test.ts#getExpenseForDetail returns the expense with sourceFile and linked transactions when found"
        status: pass
      - kind: unit
        ref: "tests/expense-detail-dal.test.ts#getExpenseForDetail returns undefined for a non-existent expense id, without throwing"
        status: pass
    human_judgment: false
  - id: D3
    description: "DetailPageShell renders header (title/amount/actions) and named card slots in fixed order without assuming which entity it wraps"
    verification:
      - kind: unit
        ref: "tests/detail-page-shell.test.tsx#renders all five card slots in fixed DOM order when all provided"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-05
status: complete
---

# Phase 63 Plan 01: DAL Foundation + Shared Shell Summary

**Ownership-scoped `getTransactionForDetail`/`getExpenseForDetail` DAL queries plus a shared `DetailPageShell` layout component and route builders — the read-side foundation Plans 02/03 will wire into `/transactions/[id]` and `/expenses/[id]`.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-05T21:02:44Z
- **Completed:** 2026-07-05T21:09:12Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `getTransactionForDetail({ userId, id })` in `lib/dal/transactions.ts`: full detail row (hashes, custom title, linked expense, category, file/platform, pair state) scoped to `and(eq(transaction.id, id), eq(transaction.userId, userId))`, reusing the existing pairing sub-queries from `transactionListSelect`.
- `getExpenseForDetail({ userId, id })` in `lib/dal/expenses.ts`: expense row plus `sourceFile` (folded from `getExpenseImportContext`'s logic, no second round-trip) and `transactions: ExpenseTransactionRow[]` ordered by `desc(transaction.occurredAt)`, scoped to both `expense.userId` and `transaction.userId`.
- `DetailPageShell` client component in `components/detail-pages/detail-page-shell.tsx`: back link, header (title/amount/primary action/overflow menu), and five optional card slots (`datiCard`, `categoriaCard`, `collegamentiCard`, `riepilogoCard`, `transactionsCard`) rendered in a fixed order using shadcn `Card`/`CardContent`.
- `transactionDetailHref(id)` / `expenseDetailHref(id)` standalone functions in `lib/routes.ts`, matching the existing `dashboardCategoryDetail` pattern.

## Task Commits

Each task was committed atomically (Task 1 followed the TDD RED→GREEN cycle):

1. **Task 1 (RED): failing DAL tests** — `db20b79` (test)
2. **Task 1 (GREEN): getTransactionForDetail + getExpenseForDetail** — `0610388` (feat)
3. **Task 2: DetailPageShell + route builders** — `c34ea6d` (feat, includes its own test)

**Plan metadata:** committed as part of this SUMMARY commit.

## Files Created/Modified

- `lib/dal/transactions.ts` — added `TransactionDetailRow` type + `getTransactionForDetail` export
- `lib/dal/expenses.ts` — added `ExpenseDetailRow` type + `getExpenseForDetail` export
- `lib/routes.ts` — added `transactionDetailHref` / `expenseDetailHref` route builders
- `components/detail-pages/detail-page-shell.tsx` — new shared layout component
- `tests/transaction-detail-dal.test.ts` — new, 4 tests
- `tests/expense-detail-dal.test.ts` — new, 6 tests
- `tests/detail-page-shell.test.tsx` — new, 6 tests

## Decisions Made

- `getExpenseForDetail` accepts `userId` as an argument instead of calling `verifySession()` internally, per the plan's explicit instruction — the RSC page (Plan 03) already verifies the session once and passes it down.
- Route builders are standalone exported functions, not `APP_ROUTES` object keys, preserving the object's `as const` static-string shape.

## Deviations from Plan

None — plan executed exactly as written. Task 1 followed TDD RED→GREEN (test commit then implementation commit); Task 2 was not marked `tdd="true"` in the plan, so its test and implementation landed in a single commit alongside a test file, consistent with the plan's non-TDD task type.

## Issues Encountered

None. Pre-existing `yarn tsc --noEmit` errors in unrelated files (`tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts`) were confirmed present before this plan's changes (via `git stash` diff) and are out of scope per the deviation rules' scope boundary.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Plans 02 and 03 can now build `/transactions/[id]` and `/expenses/[id]` RSC pages against `getTransactionForDetail`/`getExpenseForDetail` and compose `DetailPageShell` without touching the same files — no blockers.

---
*Phase: 63-detail-pages-tx-expense*
*Completed: 2026-07-05*

---
phase: 65-expense-group-merge-and-view
plan: 06
subsystem: ui
tags: [react, next.js, expense-group, transaction, display-only]

# Dependency graph
requires:
  - phase: 65-02
    provides: "categorizeExpense D-03 guard against recategorizing grouped members (server-side authorization already in place)"
  - phase: 65-03
    provides: "getExpenses/getExpenseForDetail/getTransactions/getTransactionForDetail groupId/groupTitle fields; expenseGroupDetailHref route helper"
provides:
  - "Transaction list + detail title precedence: customTitle -> groupTitle -> expenseTitle -> description"
  - "Expense detail page 'Parte di' cross-reference + hidden recategorize control when grouped"
affects: [66-expense-group-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Title precedence chains extended by inserting groupTitle between customTitle and expenseTitle at every existing display site (transactionRowLabel, TransactionTitleEdit fallbackTitle prop, transaction-detail-client displayTitle, 'Spesa collegata' label) — zero new components, purely a value-precedence change"
    - "Grouped-member UI hiding is a presentational mirror of an already-enforced server guard (categorizeExpense's D-03 check from Plan 65-02) — the Button is omitted client-side, not newly authorized"

key-files:
  created: []
  modified:
    - components/transactions/transaction-table.tsx
    - components/transactions/transaction-detail-client.tsx
    - components/expenses/expense-detail-client.tsx
    - tests/transaction-table-menu.test.tsx
    - tests/transaction-detail-page.test.tsx
    - tests/expense-detail-page.test.tsx

key-decisions:
  - "transaction-table.tsx's categorize-dialog-prefill call sites (setCategorizeTarget({ title: transaction.expenseTitle ?? rowLabel })) were left untouched per the plan's explicit scoping note — they only fire for uncategorized expenses, which can never be grouped (a group requires a shared non-null subcategory)"
  - "Expense detail page's 'Parte di' link target is expenseGroupDetailHref(expense.groupId); the transaction detail page's 'Spesa collegata' link target stays expenseDetailHref(expenseId) unchanged — the cross-reference chain is transaction -> member's own expense page -> that page's own 'Parte di' link to the group, never a direct transaction-to-group link"

requirements-completed: [GRP-08]

coverage:
  - id: D1
    description: "transactionRowLabel and the TransactionTitleEdit fallbackTitle prop in transaction-table.tsx check groupTitle between customTitle and expenseTitle; ungrouped transactions render byte-identical output"
    requirement: "GRP-08"
    verification:
      - kind: unit
        ref: "tests/transaction-table-menu.test.tsx describe('TransactionTable — group title precedence (GRP-08)') (2 new tests: groupTitle wins over expenseTitle, customTitle still wins over both) plus all 5 pre-existing (unmodified) DET-07/D-05 assertions"
        status: pass
    human_judgment: false
  - id: D2
    description: "transaction-detail-client.tsx's displayTitle, fallbackTitle prop, and 'Spesa collegata' label all prefer groupTitle over expenseTitle; link target stays expenseDetailHref (not a group route)"
    requirement: "GRP-08"
    verification:
      - kind: unit
        ref: "tests/transaction-detail-page.test.tsx (1 new test: grouped transaction shows group title in header + Spesa collegata, links to member's own expense detail page) plus all 16 pre-existing assertions"
        status: pass
    human_judgment: false
  - id: D3
    description: "expense-detail-client.tsx renders a 'Parte di' cross-reference linking to expenseGroupDetailHref(groupId) when grouped, and omits 'Cambia categoria'/'Assegna categoria' entirely when grouped; both still render for an ungrouped expense"
    requirement: "GRP-08"
    verification:
      - kind: unit
        ref: "tests/expense-detail-page.test.tsx (1 new test: 'Parte di' link present + group title text + neither category-edit button renders) plus all 12 pre-existing (unmodified) assertions, including the ungrouped 'Cambia categoria'/'Assegna categoria' cases"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-07-19
status: complete
---

# Phase 65 Plan 6: expense-group-merge-and-view Summary

**Final GRP-08 cross-reference surface: grouped transactions show the group's title ahead of the expense title in the transactions list and detail page, and a grouped member's own expense detail page declares its group membership via a "Parte di" link while hiding the recategorize control (D-03).**

## Performance

- **Duration:** ~15 min (task commits span single session, 2026-07-19)
- **Tasks:** 3
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments
- `components/transactions/transaction-table.tsx`: `transactionRowLabel()` and the `TransactionTitleEdit` `fallbackTitle` prop both check `groupTitle` between `customTitle` and `expenseTitle`; the categorize-dialog-prefill call sites (which only fire for uncategorized, therefore never-grouped, expenses) were left untouched per the plan's explicit scoping note.
- `components/transactions/transaction-detail-client.tsx`: `displayTitle`, the `TransactionTitleEdit` `fallbackTitle` prop, and the "Spesa collegata" cross-reference label all now prefer `groupTitle` over `expenseTitle`; the link target stays `expenseDetailHref(expenseId)` unchanged.
- `components/expenses/expense-detail-client.tsx`: `collegamentiCard` renders a new "Parte di" row (linking to `expenseGroupDetailHref(expense.groupId)`) when `expense.groupId` is non-null; `categoriaSection` omits the "Cambia categoria"/"Assegna categoria" `Button` entirely when grouped (the category name display itself is unaffected — only the edit control is hidden), per D-03.

## Task Commits

Each task was committed atomically:

1. **Task 1: Transaction list title precedence includes groupTitle** - `057d80e` (feat)
2. **Task 2: Transaction detail page title precedence + "Spesa collegata" label** - `4aa904a` (feat)
3. **Task 3: Expense detail page — "Parte di" cross-ref + hidden category control when grouped** - `c016c58` (feat)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `components/transactions/transaction-table.tsx` - `transactionRowLabel` groupTitle check, `TransactionTitleEdit` `fallbackTitle` prop
- `components/transactions/transaction-detail-client.tsx` - `displayTitle`, `fallbackTitle` prop, "Spesa collegata" label all prefer `groupTitle`
- `components/expenses/expense-detail-client.tsx` - "Parte di" cross-ref in `collegamentiCard`, hidden category-edit button in `categoriaSection` when grouped
- `tests/transaction-table-menu.test.tsx` - new `describe('TransactionTable — group title precedence (GRP-08)')` (2 tests)
- `tests/transaction-detail-page.test.tsx` - `groupId`/`groupTitle` factory defaults + 1 new grouped-transaction test
- `tests/expense-detail-page.test.tsx` - `groupId`/`groupTitle` factory defaults + 1 new grouped-expense test

## Decisions Made
- None beyond what the plan already locked — followed the plan's `<action>`/`<behavior>` blocks exactly (title-precedence value chains, cross-reference wiring, hidden-control condition).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `tests/transaction-table-menu.test.tsx`'s `makeTransaction()` factory and `lib/dal/expenses.ts`'s `ExpenseDetailRow` type already had `groupId`/`groupTitle` defaulted from Plan 65-03's type extensions, so only the two detail-page test factories (`transaction-detail-page.test.tsx`, `expense-detail-page.test.tsx`) needed the new default fields added in this plan.

**Pre-existing `tsc` type errors** (6 files: `tests/cascade-options.test.ts`, `tests/category-combobox.test.tsx`, `tests/file-download-api.test.ts`, `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts`), already logged in `deferred-items.md` from Plans 65-02/65-03/65-05, remain unchanged and unrelated to this plan's 3 commits — confirmed via `yarn tsc --noEmit` showing zero errors touching `transaction-table.tsx`, `transaction-detail-client.tsx`, or `expense-detail-client.tsx`. Not fixed (out of scope, pre-existing).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GRP-08 is fully delivered: every cross-reference surface this phase touches (transactions list, transaction detail, expense detail) now displays and links group membership correctly.
- Phase 65 (expense-group-merge-and-view) is now complete: all 6 plans shipped, GRP-01/GRP-02/GRP-03/GRP-04/GRP-08 requirements satisfied end-to-end (merge flow, read-time composition, group detail page, transaction/expense cross-references).
- Phase 66 (expense-group-lifecycle: GRP-05/GRP-06/GRP-07/GRP-09) can proceed — group recategorization, dissolve/remove-member, and the dashboard-totals invariant test are untouched by this plan.
- Pre-existing `tsc` type errors (6 files, unrelated, logged in `deferred-items.md`) remain outstanding — not a blocker for Phase 66.

## Self-Check: PASSED

All modified files found on disk; all task commit hashes (057d80e, 4aa904a, c016c58) found in git log.

---
*Phase: 65-expense-group-merge-and-view*
*Completed: 2026-07-19*

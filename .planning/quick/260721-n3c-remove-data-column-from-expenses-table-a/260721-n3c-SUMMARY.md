---
quick_id: 260721-n3c
subsystem: ui
tags: [react, nextjs, expenses, table, detail-pages]

requires: []
provides:
  - Expenses table no longer renders an overflowing "Data" column (createdAt HeaderSortButton + first-last date TableCell removed)
  - Expense detail page shows a "Periodo" row (first-last transaction date range) in riepilogoCard
  - Group detail page shows a "Periodo" row derived from member transactions' occurredAt dates
affects: [expense-table, expense-detail, group-detail]

tech-stack:
  added: []
  patterns:
    - "formatPeriodo(first, last) helper: '—' when no first date, single date when equal/no last, en-dash range otherwise — duplicated per-file matching existing formatDate/formatSignedAmount convention"

key-files:
  created: []
  modified:
    - components/expenses/expense-table.tsx
    - components/expenses/expense-detail-client.tsx
    - components/expenses/group-detail-client.tsx

key-decisions:
  - "formatPeriodo duplicated in both detail-client files (not extracted to a shared util) — matches this codebase's existing per-file formatDate/formatSignedAmount/formatTransactionAmount duplication convention"
  - "Group detail's first/last transaction dates computed via an explicit min/max reduce over group.transactions[].occurredAt rather than relying on the array's DESC sort order, since ExpenseGroupDetailRow has no own firstTransactionAt/lastTransactionAt field"

requirements-completed: []

coverage:
  - id: D1
    description: "Data column (HeaderSortButton + first-last date cell) removed from expense-table.tsx; dead formatDate helper deleted; sr-only TableCaption updated"
    verification:
      - kind: unit
        ref: "tests/expense-table-menu.test.tsx (full suite regression, no Data-column assertions existed)"
        status: pass
      - kind: other
        ref: "grep verification: no 'label: Data', no firstTransactionAt reference, no function formatDate in expense-table.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Periodo row added to expense detail riepilogoCard using expense.firstTransactionAt/lastTransactionAt"
    verification:
      - kind: unit
        ref: "full vitest suite regression (no dedicated expense-detail-client test exercises riepilogoCard rows)"
        status: pass
    human_judgment: true
    rationale: "No unit test asserts the rendered Periodo row's visual placement/format; only grep + full-suite regression were run — visual confirmation is a manual/optional step per the plan's verification section"
  - id: D3
    description: "Periodo row added to group detail riepilogoCard, derived from group.transactions[].occurredAt min/max"
    verification:
      - kind: unit
        ref: "tests/group-detail-page.test.tsx (full suite regression, no Periodo-row assertions existed)"
        status: pass
    human_judgment: true
    rationale: "No unit test asserts the rendered Periodo row's visual placement/format or the min/max derivation against real transaction data; only grep + full-suite regression were run"

duration: 15min
completed: 2026-07-21
status: complete
---

# Quick Task 260721-n3c: Remove Data column from expenses table Summary

**Removed the overflowing "Data" column from the expenses table and relocated the transaction period info as a new "Periodo" row on both the expense and group detail pages.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-21
- **Completed:** 2026-07-21
- **Tasks:** 3 (2 code tasks + 1 verification-only task)
- **Files modified:** 3

## Accomplishments
- `expense-table.tsx`: deleted the `w-24` `HeaderSortButton` for `createdAt` (label "Data") that overflowed and overlapped the adjacent `w-36` Piattaforma header, deleted its corresponding first-last transaction date `TableCell`, deleted the now-dead local `formatDate` helper, and updated the `sr-only` `TableCaption` to drop "e data"
- `expense-detail-client.tsx`: added a `formatPeriodo(first, last)` helper and a "Periodo" row in `riepilogoCard` (immediately after "Creata il"), reading `expense.firstTransactionAt`/`expense.lastTransactionAt` directly from the already-populated DAL row
- `group-detail-client.tsx`: added the same `formatPeriodo` helper (duplicated locally per this file's existing convention) and a "Periodo" row in `riepilogoCard` (immediately after "Creato il"), with first/last dates derived via an explicit min/max reduce over `group.transactions[].occurredAt` since `ExpenseGroupDetailRow` carries no such field of its own
- Full verification: `yarn vitest run` (137 test files, 1723 passed / 1 todo), `yarn lint` (0 errors, 40 pre-existing unrelated warnings), `yarn check:language` (clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete the "Data" column and its dead formatDate helper** - `c2b38a2` (fix)
2. **Task 2: Add a "Periodo" row to expense-detail-client.tsx and group-detail-client.tsx** - `72c82f8` (feat)
3. **Task 3: Full verification** - no commit (verification-only, no files modified)

**Plan metadata:** committed alongside this SUMMARY (docs commit)

## Files Created/Modified
- `components/expenses/expense-table.tsx` - Data column (header + cell) and dead `formatDate` helper removed; caption text updated
- `components/expenses/expense-detail-client.tsx` - `formatPeriodo` helper added; "Periodo" row added to `riepilogoCard`
- `components/expenses/group-detail-client.tsx` - `formatPeriodo` helper added; first/last dates derived from `group.transactions[].occurredAt`; "Periodo" row added to `riepilogoCard`

## Decisions Made
- `formatPeriodo` is duplicated in both detail-client files rather than extracted into a shared util, matching each file's existing per-file duplication of `formatDate`/`formatSignedAmount`/`formatTransactionAmount` (per plan instruction, not a new deviation)
- Group detail's first/last transaction dates computed via explicit min/max reduce (not relying on the transactions array's existing DESC sort order), per plan instruction — defensive against future sort-order changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Not phase-scoped (quick task). No blockers for ongoing v2.6 work (Phases 65/67/68 in progress). `merge-expenses-dialog.tsx` was correctly left untouched, per scope boundary.

---
*Quick task: 260721-n3c*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: c2b38a2 (fix commit)
- FOUND: 72c82f8 (feat commit)
- FOUND: components/expenses/expense-table.tsx
- FOUND: components/expenses/expense-detail-client.tsx
- FOUND: components/expenses/group-detail-client.tsx
- FOUND: .planning/quick/260721-n3c-remove-data-column-from-expenses-table-a/260721-n3c-SUMMARY.md

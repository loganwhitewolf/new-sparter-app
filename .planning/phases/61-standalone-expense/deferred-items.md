# Deferred Items — Phase 61 Plan 01

Pre-existing issues discovered during execution that are out of scope for this plan
(not caused by this plan's changes). Not fixed here per the scope boundary rule.

## Pre-existing `yarn check:language` failures

Discovered while running `yarn check:language` as part of Task 2 verification.
None of these files were touched by 61-01:

- `components/expenses/bulk-categorize-dialog.tsx:18` — developer-facing comment should be English
- `components/expenses/expense-uncategorized-cta.tsx:16` — developer-facing comment should be English
- `lib/dal/expenses.ts:92` — developer-facing comment should be English
- `lib/dal/transactions.ts:202` — developer-facing comment should be English

## Plan 61-02 — pre-existing failures re-confirmed (unchanged files)

Re-observed during 61-02 Task 2 verification (`yarn check:language`, `yarn vitest run`,
`yarn tsc --noEmit`). Same four `check:language` violations above still present, still
unrelated to files this plan touches.

Additional pre-existing `yarn vitest run` failures, none referencing
`transaction-table.tsx`, `detach-expense-dialog.tsx`, or `transaction-detach`:

- `tests/expense-actions.test.ts` — failing before this plan's changes.
- `tests/import-table-actions.test.tsx` > "Rivedi suggerimenti" dropdown item test.
- `tests/overview-interactions.test.tsx` > overview chart education (EDU-01, EDU-02) —
  6 failures, root cause `components/dashboard/overview/overview-chart-filters.tsx`
  missing `includedAllocation`/`onToggleAllocation` (matches pre-existing `tsc --noEmit`
  error `OverviewChartFiltersProps`).

Additional pre-existing `yarn tsc --noEmit` failures unrelated to this plan (not fixed,
scope boundary): `tests/cascade-options.test.ts`, `tests/category-combobox.test.tsx`,
`tests/file-download-api.test.ts`, `tests/overview-interactions.test.tsx`,
`tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`,
`tests/transactions-dal.test.ts`.

`tests/transaction-detach-service.test.ts` and `tests/transaction-detach-action.test.ts`
(the tests directly relevant to this plan's changes) — both GREEN, 14/14 passing.

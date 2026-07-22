# Deferred Items — Phase 65

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary rule
(auto-fix only issues directly caused by the current task's changes).

## Found during 65-02 verification (2026-07-18)

`yarn tsc --noEmit` reports pre-existing type errors unrelated to this plan's changes
(`lib/services/expense-group.ts`, `lib/actions/expenses.ts`). None of the failing files were
touched by the 65-02 commits (`f9c61a4`, `bf45228`, `e4e3693`):

- `tests/cascade-options.test.ts`
- `tests/category-combobox.test.tsx`
- `tests/file-download-api.test.ts`
- `tests/suggestion-card.test.tsx` / `tests/suggestion-promote-form.test.tsx` — test fixtures
  missing a `sampleAmounts` field now required on the `PatternSuggestion` type
- `tests/transactions-dal.test.ts` — a `SQL<string>` cast mismatch

Not fixed (out of scope for 65-02). `yarn test` (vitest) passes fully (1434 passed, 1 todo) —
these are `tsc`-only type-level mismatches in test fixtures, not runtime failures.

## Confirmed still pre-existing after 65-03 (2026-07-19)

Re-ran `yarn tsc --noEmit` with and without the 65-03 (Task 3) diff stashed. The
`suggestion-card.test.tsx` / `suggestion-promote-form.test.tsx` (`sampleAmounts` missing) and
`tests/transactions-dal.test.ts` (`SQL<string>` cast) errors are identical in both runs — not
caused by 65-03. `yarn test` passes fully (1450 passed, 1 todo).

One NEW type error was caused by 65-03 and was fixed inline (in scope, per the "blocking issue"
deviation rule): `tests/transaction-table-menu.test.tsx`'s `makeTransaction()` fixture built a
`TransactionListRow` literal missing the new `groupId`/`groupTitle` fields. Added
`groupId: null, groupTitle: null` to the fixture default.

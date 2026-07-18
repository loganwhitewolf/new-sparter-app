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

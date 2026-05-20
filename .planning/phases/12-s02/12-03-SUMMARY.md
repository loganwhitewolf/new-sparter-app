---
phase: "12"
plan: "03"
---

# T03: Added safe import load-more and rename server actions with localized failure contracts.

**Added safe import load-more and rename server actions with localized failure contracts.**

## What Happened

Implemented the import-management server-action boundary in `lib/actions/import.ts`. `loadMoreImports` now accepts URL-style import filters, parses them through `parseImportFilters`, normalizes missing/negative/non-integer offsets to zero, performs one bounded `getImports` read with `IMPORT_LIST_LIMIT`, and returns `{ imports, hasMore, error }` without exposing storage or stack diagnostics on failure. `updateImportDisplayNameAction` now validates form data, treats missing file IDs as UUID validation failures, verifies the session, calls the user-scoped `updateImportDisplayName` DAL method, revalidates `/import` on success, and returns safe localized errors for expired sessions, not-found/cross-user updates, and DAL failures. Added `tests/import-actions.test.ts` covering filter parsing, offset normalization, full-page `hasMore`, safe load failures, session failure, validation failures, not-found handling, DAL failure redaction, and successful `/import` revalidation.

## Verification

Verified the task-specific command `yarn vitest tests/import-actions.test.ts` after implementation: 1 file and 11 tests passed. Ran the slice-level Vitest command for validation, DAL, and action coverage: 3 files and 28 tests passed. Ran `yarn tsc --noEmit` as a substitute for unavailable LSP diagnostics, and it exited 0. Ran slice support checks: `yarn lint` exited 0 with one pre-existing warning in `components/transactions/transaction-form-dialog.tsx`, and `yarn check:language` passed. The slice Playwright grep still exits 1 with “No tests found” because the IMP-03 browser flow has not been added yet, matching prior S02 task summaries.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/import-actions.test.ts` | 0 | ✅ pass | 1008ms |
| 2 | `yarn vitest lib/validations/__tests__/import.test.ts tests/imports-dal.test.ts tests/import-actions.test.ts` | 0 | ✅ pass | 1125ms |
| 3 | `yarn playwright test tests/import.spec.ts --grep "IMP-03"` | 1 | ❌ fail | 3237ms |
| 4 | `yarn lint` | 0 | ✅ pass | 3383ms |
| 5 | `yarn check:language` | 0 | ✅ pass | 918ms |
| 6 | `yarn tsc --noEmit` | 0 | ✅ pass | 2068ms |

## Deviations

Kept blank display names as the T02-defined reset behavior instead of treating blank rename form values as validation failures; this preserves the existing validation/DAL contract where whitespace names are normalized to `null` by the DAL.

## Known Issues

`yarn playwright test tests/import.spec.ts --grep "IMP-03"` still finds no matching tests until a later UI task adds the IMP-03 browser flow. `yarn lint` still reports the pre-existing unused `useCallback` warning in `components/transactions/transaction-form-dialog.tsx`.

## Files Created/Modified

- `lib/actions/import.ts`
- `tests/import-actions.test.ts`

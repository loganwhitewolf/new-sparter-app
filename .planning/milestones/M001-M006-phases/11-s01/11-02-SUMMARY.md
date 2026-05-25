---
phase: "11"
plan: "02"
---

# T02: Persisted full-file import analysis and import statistics through file lifecycle updates.

**Persisted full-file import analysis and import statistics through file lifecycle updates.**

## What Happened

Extended the file DAL lifecycle update inputs so create, analysis, and import state transitions can persist imported counts, duplicate/skipped counts, signed totals, and reference date ranges in addition to status and diagnostics. Added a shared full-file stats derivation path in `lib/services/import.ts` that normalizes parsed rows after format detection, computes positive/negative totals and reference ranges from the full normalized file, detects malformed/skipped rows and repeated in-file transaction hashes without using platform ID in the duplicate identity, and then adjusts duplicate/importable counts using the existing bulk hash lookup. Updated `analyzeFile` to keep preview rows sample-limited while persisting all-row stats and safe bounded failure diagnostics for unknown formats. Updated `importFile` so the import transaction persists actual `importedCount = insertedTxs.length`, final duplicate/skipped counts including malformed, pre-existing, and in-file duplicates, full-file totals/range, and imported timestamps only inside the existing transaction. Extended `tests/import-service.test.ts` with assertions for full-file analysis stats, imported stats, existing duplicate hashes, repeated in-file duplicates, malformed rows, empty parsed rows, unknown-format safe diagnostics, and preview-sample independence.

## Verification

Task verification `yarn vitest run tests/import-service.test.ts` passed with 29 tests. Slice Vitest and TypeScript checks passed, lint and language checks passed, and lint only reported a pre-existing warning in `components/transactions/transaction-form-dialog.tsx`. The slice Playwright command still fails on the pre-existing upload widget tests where `#import-file-error` is not found and the upload button remains disabled after file selection; this was already recorded by T01 and is outside this file-statistics task.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/import-service.test.ts` | 0 | ✅ pass | 773ms |
| 2 | `yarn vitest run tests/import-service.test.ts tests/import-api.test.ts tests/imports-dal.test.ts` | 0 | ✅ pass | 757ms |
| 3 | `yarn tsc --noEmit` | 0 | ✅ pass | 2014ms |
| 4 | `yarn lint` | 0 | ✅ pass | 3110ms |
| 5 | `yarn check:language` | 0 | ✅ pass | 497ms |
| 6 | `yarn playwright test tests/import.spec.ts` | 1 | ❌ fail | 46528ms |

## Deviations

None.

## Known Issues

`yarn playwright test tests/import.spec.ts` still fails three pre-existing upload-flow tests: unsupported file type does not show `#import-file-error`, valid CSV selection leaves the upload button disabled, and the retry test times out clicking the disabled upload button. `yarn lint` exits 0 but reports the pre-existing unused `useCallback` warning in `components/transactions/transaction-form-dialog.tsx`.

## Files Created/Modified

- `lib/dal/files.ts`
- `lib/services/import.ts`
- `tests/import-service.test.ts`

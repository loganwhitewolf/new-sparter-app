---
phase: "14"
plan: "04"
---

# T04: Wired selected private import formats through retry analysis and confirmation import with fail-closed ownership checks and sanitized retry observability.

**Wired selected private import formats through retry analysis and confirmation import with fail-closed ownership checks and sanitized retry observability.**

## What Happened

Implemented the selected private-format retry loop through the existing analysis and import service boundaries. Analysis now uses an explicit selected format id or the stored file importFormatVersionId, scopes lookup through the ownership-aware DAL, records successful retry state as analyzed with the chosen format id, and logs sanitized retry outcomes without file contents or object keys. Import confirmation now uses the selected or stored private format id, persists the imported format id on success, and emits sanitized retry import/failure logs while preserving fail-closed behavior for inaccessible private formats. Server actions now reject malformed formatVersionId inputs before auth/service work with a localized Italian action error. Tests were extended for successful private-format retry analysis, inaccessible cross-user selected-format fail-closed behavior, parser diagnostic redaction, malformed action input handling, and an inline private detector format shape.

## Verification

Fresh final verification passed after the last code change: `yarn vitest tests/import-service.test.ts tests/import-format-wizard-actions.test.ts tests/import-detector.test.ts && yarn lint` exited 0. `yarn tsc --noEmit --pretty false && yarn check:language` also exited 0. LSP diagnostics were attempted for edited TypeScript files but no language server was available, so CLI typecheck/lint covered static verification. The lint command reported one warning in unrelated pre-existing file `components/transactions/transaction-form-dialog.tsx` for an unused `useCallback`, but exited successfully with 0 errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/import-service.test.ts tests/import-format-wizard-actions.test.ts tests/import-detector.test.ts && yarn lint` | 0 | ✅ pass | 4317ms |
| 2 | `yarn tsc --noEmit --pretty false && yarn check:language` | 0 | ✅ pass | 3159ms |

## Deviations

Extended `lib/dal/files.ts` so imported-state updates can persist `importFormatVersionId`; this was required to expose the selected-format import state requested by the slice observability contract.

## Known Issues

Unrelated lint warning remains in `components/transactions/transaction-form-dialog.tsx` for unused `useCallback`; lint exits 0 and the file was not touched by this task.

## Files Created/Modified

- `lib/services/import.ts`
- `lib/actions/import.ts`
- `lib/dal/files.ts`
- `tests/import-service.test.ts`
- `tests/import-format-wizard-actions.test.ts`
- `tests/import-detector.test.ts`

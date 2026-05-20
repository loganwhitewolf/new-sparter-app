---
phase: "15"
plan: "01"
---

# T01: Added lifecycle guards blocking analyze/import for in-progress and completed files, and replaced raw error propagation in analyze/confirm actions with bounded Italian messages.

**Added lifecycle guards blocking analyze/import for in-progress and completed files, and replaced raw error propagation in analyze/confirm actions with bounded Italian messages.**

## What Happened

Added two constant sets (`ANALYSIS_ALLOWED_STATUSES` = uploaded/failed/analyzed; `IMPORT_ALLOWED_STATUSES` = analyzed) in `lib/services/import.ts`. Each service function reads `fileRow.status` immediately after the ownership check and throws a safe Italian error if the status is not in the allowed set — before any `updateFileAnalysisState`/`updateFileImportState` call, R2 read, or parser invocation.

In `lib/actions/import.ts`, replaced the raw `error instanceof Error ? error.message : '...'` pattern in `analyzeImportAction` and `confirmImportAction` with `mapAnalyzeError` and `mapConfirmError` helpers. Each helper passes through only the known lifecycle guard Italian message verbatim; all other thrown errors map to a generic bounded Italian message. The existing S04 selected-format retry path (unknown-format recovery) is unaffected since the wizard sets status back to `uploaded`/`failed` before re-analysis.

Tests were extended in both files: `import-service.test.ts` gained parametrized lifecycle guard tests proving `updateFileAnalysisState`, `readObjectBody`, `parseImportFile`, and `markFileFailed` are never called for blocked statuses, plus positive tests confirming allowed statuses proceed. The `importFile` describe was updated to use `status: 'analyzed'` in its `beforeEach` default. `import-actions.test.ts` gained full `analyzeImportAction` and `confirmImportAction` describe blocks, including redaction checks asserting `objectKey`, `https://`, and stack frame substrings are absent from action return values, and lifecycle message pass-through tests.

## Verification

Ran `yarn vitest run tests/import-service.test.ts tests/import-actions.test.ts`. All 78 tests passed. Tests include assertions that `objectKey`, `https://`, stack frames, and raw row text are absent from action error payloads, and that `analyzing`/`importing`/`imported` rows do not trigger state mutation or R2/parser work.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/import-service.test.ts tests/import-actions.test.ts` | 0 | 78 tests passed | 944ms |

## Deviations

The default `getFileForUser` mock in the `importFile` describe was updated from `status: 'uploaded'` to `status: 'analyzed'` to match the new lifecycle guard requirement — this was a necessary test-fixture update, not a plan deviation.

## Known Issues

none

## Files Created/Modified

- `lib/services/import.ts`
- `lib/actions/import.ts`
- `tests/import-service.test.ts`
- `tests/import-actions.test.ts`

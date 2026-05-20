---
phase: "11"
plan: "01"
---

# T01: Added file-backed import statistic columns, migration backfill, and type-safe import test fixtures.

**Added file-backed import statistic columns, migration backfill, and type-safe import test fixtures.**

## What Happened

Extended the existing `file` table schema rather than introducing or renaming import tables, honoring the import-management architecture decision. Added nullable/defaulted persisted fields for display name, imported count, signed totals, and reference date range, plus additive user/date indexes for later import-list filters. Created `drizzle/migrations/0007_import_management_stats.sql` with matching column names and a single grouped backfill from `transaction.file_id` that leaves zero-transaction files on default zero/null values. Updated the import API and service test row factories to return explicit `FileRow` objects with the new default stat fields, preserving type-safety for upload/analyze/import fixtures.

## Verification

Fresh task verification passed: `yarn tsc --noEmit && yarn vitest run tests/import-api.test.ts tests/import-service.test.ts` exited 0 with 2 test files and 34 tests passing. Additional slice-level checks run after the final code change: `yarn lint` exited 0 with one pre-existing warning in `components/transactions/transaction-form-dialog.tsx`; `yarn check:language` exited 0; `yarn playwright test tests/import.spec.ts` exited 1 due existing upload-flow file-selection tests where the upload button remains disabled and `#import-file-error` is not found. `tests/imports-dal.test.ts` does not exist yet and is owned by downstream T03, so the full slice Vitest command is not yet applicable in T01.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn tsc --noEmit && yarn vitest run tests/import-api.test.ts tests/import-service.test.ts` | 0 | ✅ pass | 4167ms |
| 2 | `yarn lint` | 0 | ✅ pass | 4501ms |
| 3 | `yarn check:language` | 0 | ✅ pass | 1132ms |
| 4 | `yarn playwright test tests/import.spec.ts` | 1 | ❌ fail | 48782ms |

## Deviations

No implementation deviations from the T01 plan. Full slice verification is partial because downstream `tests/imports-dal.test.ts` is not created until T03 and the existing Playwright import smoke fails outside this schema task.

## Known Issues

`yarn playwright test tests/import.spec.ts` currently fails three upload-flow tests because file selection does not surface the expected validation/error state and the upload button remains disabled. `yarn lint` reports one warning for an unused `useCallback` import in `components/transactions/transaction-form-dialog.tsx`, but exits 0.

## Files Created/Modified

- `lib/db/schema.ts`
- `drizzle/migrations/0007_import_management_stats.sql`
- `tests/import-api.test.ts`
- `tests/import-service.test.ts`

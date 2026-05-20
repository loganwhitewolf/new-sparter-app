---
phase: "13"
plan: "01"
---

# T01: Added a transactional import deletion service with preview counts, scoped reconciliation, manual/override preservation, sanitized logs, and rollback tests.

**Added a transactional import deletion service with preview counts, scoped reconciliation, manual/override preservation, sanitized logs, and rollback tests.**

## What Happened

Implemented `lib/services/import-deletion.ts` as the service boundary for safe import deletion. The service validates UUID-shaped file IDs, loads imports through user-scoped queries, rejects missing/non-owned/non-imported files before destructive writes, computes preview impact from DB state only, and performs deletion inside `db.transaction`. Deletion explicitly removes linked transactions, recalculates affected expenses that still have transactions, deletes only empty non-manual expenses, preserves empty expenses with `manual` or `override` classification history, clears import linkage on retained expenses, and deletes the `file` row last. Added sanitized structured log events for preview success, rejection, delete success, and delete failure phases with identifiers/counts only. Added `tests/import-deletion-service.test.ts` with a stateful Drizzle mock covering preview payload redaction, malformed/non-owned/not-imported rejection, no-linked-transaction imports, mixed reconciliation outcomes, manual/override preservation, and forced mid-transaction rollback.

## Verification

Ran the scoped task verification `yarn vitest run tests/import-deletion-service.test.ts` after final edits: 1 test file passed with 8 tests. Ran `yarn tsc --noEmit --pretty false` after final edits: exit code 0. Ran `yarn check:language` because service/tests contain developer-facing strings and comments: passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn tsc --noEmit --pretty false` | 0 | ✅ pass | 1683ms |
| 2 | `yarn vitest run tests/import-deletion-service.test.ts` | 0 | ✅ pass | 645ms |
| 3 | `yarn check:language` | 0 | ✅ pass | 740ms |

## Deviations

Added `yarn tsc --noEmit --pretty false` and `yarn check:language` beyond the task's scoped Vitest command for stronger integration and project-convention verification. No deviations from the implementation contract.

## Known Issues

None.

## Files Created/Modified

- `lib/services/import-deletion.ts`
- `tests/import-deletion-service.test.ts`

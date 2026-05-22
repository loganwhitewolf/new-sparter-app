---
phase: "11"
plan: "03"
---

# T03: Added a session-scoped import list DAL read model with safe fields, left joins, bounded ordering, and contract tests.

**Added a session-scoped import list DAL read model with safe fields, left joins, bounded ordering, and contract tests.**

## What Happened

Created `lib/dal/imports.ts` as a server-only read model over the existing `file` table, keeping import-facing names above the database schema. The DAL verifies the active session internally, exposes no userId parameter, scopes rows by `file.userId`, left joins `import_format_version` and `platform`, and returns only the S01 import-management fields needed by the page and later slices. Added `tests/imports-dal.test.ts` with mocked Drizzle/session boundaries to prove the select contract, auth fail-closed behavior, user scoping, metadata-preserving left joins, hard limit, nullable-safe newest-first ordering, and redaction of object keys/raw diagnostics/stack-like fields. Security review notes: the attack surface is a server-only DAL function reachable by authenticated server components/actions; non-findings include no client-supplied user id, no raw object storage fields in the projection, and DB errors are not swallowed. I corrected the ordering to use `coalesce(importedAt, uploadedAt, createdAt)` because plain nullable `DESC` ordering in Postgres can put null lifecycle timestamps first.

## Verification

`yarn vitest run tests/imports-dal.test.ts` passed with 6 tests. `yarn vitest run tests/import-service.test.ts tests/import-api.test.ts tests/imports-dal.test.ts` passed with 44 tests. `yarn tsc --noEmit`, `yarn lint`, and `yarn check:language` exited 0; lint still reports one warning in `components/transactions/transaction-form-dialog.tsx` unrelated to this task. The current slice Playwright smoke was also run and still fails in existing upload UI validation/button enablement flows owned by T04, with 3 passed, 3 failed, and 3 skipped.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/imports-dal.test.ts` | 0 | ✅ pass | 674ms |
| 2 | `yarn tsc --noEmit` | 0 | ✅ pass | 2066ms |
| 3 | `yarn vitest run tests/import-service.test.ts tests/import-api.test.ts tests/imports-dal.test.ts` | 0 | ✅ pass | 785ms |
| 4 | `yarn lint` | 0 | ✅ pass | 3156ms |
| 5 | `yarn check:language` | 0 | ✅ pass | 560ms |
| 6 | `yarn playwright test tests/import.spec.ts` | 1 | ❌ fail | 45475ms |

## Deviations

Used a coalesced lifecycle timestamp plus created-at tie-breaker for ordering instead of chaining nullable timestamp DESC expressions, to avoid Postgres NULLS FIRST behavior for pending/metadata-less imports.

## Known Issues

`yarn playwright test tests/import.spec.ts` currently fails three existing upload UI validation/retry tests because the upload button stays disabled and `#import-file-error` is not found after file selection; T04 owns the `/import` UI/table work and Playwright smoke completion.

## Files Created/Modified

- `lib/dal/imports.ts`
- `tests/imports-dal.test.ts`

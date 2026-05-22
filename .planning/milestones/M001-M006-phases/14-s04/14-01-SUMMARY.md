---
phase: "14"
plan: "01"
---

# T01: Added ownership-aware private/global import format schema fields, DAL loading, and service enforcement.

**Added ownership-aware private/global import format schema fields, DAL loading, and service enforcement.**

## What Happened

Extended `platform` and `import_format_version` with nullable `ownerUserId`, `visibility`, and `reviewStatus` fields plus indexes and owner relations. Added migration `0008_private_import_formats.sql`, including a safe `platform_id_seq` default for future user-created platform rows while preserving existing integer IDs, and updated Drizzle journal metadata including the existing 0007 migration entry. Introduced `lib/dal/import-formats.ts` as the ownership-aware detector candidate loader: it scopes SQL to global approved or user-private rows, revalidates active flags/ownership/row shape in memory, and fails closed to an empty candidate list on malformed rows. Refactored `analyzeFile` and `importFile` to call the new DAL with `userId` and selected format id so cross-user private selections become deterministic no-candidate failures instead of broad unscoped detection. Added DAL tests for global/private/inactive/malformed ownership cases and service tests for selected-format DAL wiring and fail-closed private selection behavior.

## Verification

Ran the required slice/task Vitest command successfully: `yarn vitest tests/import-private-formats-dal.test.ts tests/import-service.test.ts` passed with 2 files and 36 tests. Also ran `yarn check:language`, targeted ESLint, and `yarn tsc --noEmit`; all exited 0. LSP diagnostics were attempted but no language server was available in the harness, so CLI lint/typecheck covered static verification.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/import-private-formats-dal.test.ts tests/import-service.test.ts` | 0 | ✅ pass | 949ms |
| 2 | `yarn check:language` | 0 | ✅ pass | 626ms |
| 3 | `yarn lint lib/dal/import-formats.ts lib/services/import.ts lib/db/schema.ts tests/import-private-formats-dal.test.ts tests/import-service.test.ts` | 0 | ✅ pass | 2248ms |
| 4 | `yarn tsc --noEmit` | 0 | ✅ pass | 3602ms |

## Deviations

Drizzle metadata already lacked an entry for the existing `0007_import_management_stats.sql`; I added the missing 0007 journal entry before the new 0008 entry so migration ordering remains consistent.

## Known Issues

No known issues.

## Files Created/Modified

- `lib/db/schema.ts`
- `drizzle/migrations/0008_private_import_formats.sql`
- `drizzle/migrations/meta/_journal.json`
- `lib/dal/import-formats.ts`
- `lib/services/import.ts`
- `tests/import-private-formats-dal.test.ts`
- `tests/import-service.test.ts`

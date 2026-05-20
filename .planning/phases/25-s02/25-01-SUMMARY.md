---
phase: "25"
plan: "01"
---

# T01: Added pure migration configuration guardrails for local and production targets with production-only env selection, bounded pool parsing, strict TLS handling, and sanitized error diagnostics.

**Added pure migration configuration guardrails for local and production targets with production-only env selection, bounded pool parsing, strict TLS handling, and sanitized error diagnostics.**

## What Happened

Created `scripts/migration-config.ts` as a pure helper module that does not import `pg`, create a `Pool`, or connect to Postgres. The helper models local and production migration targets, uses only `PRODUCTION_DATABASE_URL` for production, requires `PRODUCTION_MIGRATION_CONFIRM=apply-to-production`, defaults production pool max to 1, falls malformed/empty/zero/negative values back to 1, caps production pool max at 2, and enables strict TLS only for `PRODUCTION_DATABASE_SSL=true`. Added sanitized diagnostic/error helpers that expose stable safe codes/classes and generic messages without raw stacks, URLs, hostnames, passwords, or raw error objects. Added focused Vitest coverage in `tests/migration-config.test.ts` for the required positive and negative cases. A type-check pass initially exposed TypeScript narrowing issues in the tests/helper; those were fixed before final verification.

## Verification

Ran the required targeted suite with `yarn vitest tests/migration-config.test.ts`; all 9 tests passed. Also ran `yarn check:language` because test/developer-facing strings changed, and `yarn tsc --noEmit --pretty false` to verify the new helper and tests type-check cleanly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/migration-config.test.ts` | 0 | ✅ pass — 1 test file passed, 9 tests passed | 643ms |
| 2 | `yarn check:language` | 0 | ✅ pass — English code convention check passed | 645ms |
| 3 | `yarn tsc --noEmit --pretty false` | 0 | ✅ pass — no TypeScript errors | 1891ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `scripts/migration-config.ts`
- `tests/migration-config.test.ts`

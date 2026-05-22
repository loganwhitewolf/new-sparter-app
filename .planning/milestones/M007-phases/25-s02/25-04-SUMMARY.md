---
phase: "25"
plan: "04"
---

# T04: Verified the guarded production migration flow, redaction behavior, language convention, lint baseline, and production build baseline without requiring Supabase credentials.

**Verified the guarded production migration flow, redaction behavior, language convention, lint baseline, and production build baseline without requiring Supabase credentials.**

## What Happened

Inspected the migration config, migration CLI, package scripts, and targeted tests to confirm the implementation matched the slice contract before running checks. Because a local `.env` file exists, first checked only whether it defines the production migration keys, without printing any secret values; both `PRODUCTION_DATABASE_URL` and `PRODUCTION_MIGRATION_CONFIRM` were absent, so the missing-env negative test could safely exercise the intended validation path. Ran the targeted migration-config tests, the production migration command with production env and confirmation unset, the redaction grep, `yarn lint`, `yarn check:language`, and `yarn build`. No source changes were necessary.

## Verification

Verified `yarn vitest tests/migration-config.test.ts` passed with 9 tests. Verified `env -u PRODUCTION_DATABASE_URL -u PRODUCTION_MIGRATION_CONFIRM yarn db:migrate:production` exited non-zero with a sanitized JSON `migration_failed` event for `missing_production_database_url` and zero forbidden redaction-pattern matches for `postgres://`, `password`, `DATABASE_URL=.*://`, or `Error:`. Verified lint exited 0 with only unrelated warning-only findings, language convention passed, and `yarn build` completed successfully.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/migration-config.test.ts` | 0 | ✅ pass — 1 file and 9 tests passed | 595ms |
| 2 | `env -u PRODUCTION_DATABASE_URL -u PRODUCTION_MIGRATION_CONFIRM yarn db:migrate:production >/tmp/sparter-migration-missing-env.out 2>&1; test $? -ne 0; ! grep -E "postgres://|password|DATABASE_URL=.*://|Error:" /tmp/sparter-migration-missing-env.out` | 0 | ✅ pass — migration command exited 1 before connection, emitted sanitized missing_production_database_url diagnostics, and redaction grep found 0 matches | 961ms |
| 3 | `yarn lint` | 0 | ✅ pass — ESLint exited 0 with warning-only unrelated findings | 4261ms |
| 4 | `yarn check:language` | 0 | ✅ pass — English code convention check passed | 516ms |
| 5 | `yarn build` | 0 | ✅ pass — Next.js production build completed | 16811ms |

## Deviations

None.

## Known Issues

Existing lint warning-only findings remain in unrelated tests while `yarn lint` exits 0: unused `expectExactCategoryRevalidationRoutes` helpers in pattern test files.

## Files Created/Modified

None.

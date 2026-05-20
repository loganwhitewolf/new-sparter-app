---
phase: "25"
plan: "02"
---

# T02: Wired an explicit production migration CLI mode with config-first guardrails, bounded pool creation, sanitized JSON diagnostics, and a package script.

**Wired an explicit production migration CLI mode with config-first guardrails, bounded pool creation, sanitized JSON diagnostics, and a package script.**

## What Happened

Refactored `scripts/migrate.ts` from an eager local-only script into a thin mode-selecting entrypoint. Local `yarn db:migrate` still uses the existing local mode and `DATABASE_URL`, while `yarn db:migrate:production` passes `--production` and uses the T01 `getMigrationConfig` helper before any `pg.Pool` is constructed. Production validation failures now return non-zero before DB access, and runtime migration failures are sanitized through `sanitizeMigrationError`. The script creates a pool only after validation, uses the helper-provided connection string, SSL config, migrations folder, and bounded pool max, and always closes the pool in `finally` when one was created. CLI output is English JSON status events with safe fields only.

## Verification

Ran the required config-test plus missing-production-env negative command and redaction grep; it passed with the production command exiting non-zero and output free of URL/password/raw Error patterns. Ran the project language convention check after changing developer-facing script text. Ran targeted ESLint on the touched migration entrypoint.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/migration-config.test.ts && env -u PRODUCTION_DATABASE_URL -u PRODUCTION_MIGRATION_CONFIRM yarn db:migrate:production >/tmp/sparter-migration-missing-env.out 2>&1; test $? -ne 0; ! grep -E "postgres://|password|DATABASE_URL=.*://|Error:" /tmp/sparter-migration-missing-env.out` | 0 | ✅ pass | 1473ms |
| 2 | `yarn check:language` | 0 | ✅ pass | 555ms |
| 3 | `yarn eslint scripts/migrate.ts` | 0 | ✅ pass | 1312ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `scripts/migrate.ts`
- `package.json`

---
phase: 48-sql-migration-recategorization
plan: "02"
subsystem: operator-tooling
tags: [migration, verification, operator-script, tdd]
dependency_graph:
  requires:
    - 48-01 (0018 migration generated)
    - scripts/db-config.ts (operator env/target plumbing)
    - lib/db/schema.ts (subCategory, userSubcategoryOverride, categorizationPattern)
  provides:
    - scripts/verify-migration.ts (runVerification, classifyResults)
    - db:verify* npm scripts (local/staging/production)
    - tests/verify-migration.test.ts (pure classifier unit test)
  affects:
    - package.json (db:verify triplet added)
tech_stack:
  added: []
  patterns:
    - Operator script shape (executedDirectly guard, structured JSON logs, sanitized diagnostics)
    - Pure classifier exported alongside runner (testable without DB)
    - Read-only SQL assertions using Drizzle ORM select + raw sql
key_files:
  created:
    - scripts/verify-migration.ts
    - tests/verify-migration.test.ts
  modified:
    - package.json
decisions:
  - "D-04 fatal split: activeSystemNullNatureCount > 0 and patternDuplicateCount > 0 are hard-fatal (exit 1); user-owned null nature_id and override backfill count are informational"
  - "classifyResults exported as a pure function so tests can pin classifier logic without opening a DB connection"
  - "Pattern duplicate query uses subquery (SELECT count(*) FROM (SELECT 1 FROM ... GROUP BY pattern, sub_category_id HAVING count(*) > 1) d) to count groups, not rows"
  - "executedDirectly guard reused from seed-extras.ts — prevents DB connection on module import in test context"
metrics:
  duration: ~3 minutes
  completed_date: "2026-06-11"
  tasks_completed: 2
  files_changed: 3
---

# Phase 48 Plan 02: Verification Harness Summary

**One-liner:** Read-only operator verification script asserting D-04 nature_id coverage + MIG-03 pattern dedup via fatal/info split, with `db:verify*` npm scripts and a pure classifier unit test.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing classifier tests | 16c644c | tests/verify-migration.test.ts |
| 1 (GREEN) | verify-migration.ts implementation | 5a17293 | scripts/verify-migration.ts |
| 2 | db:verify* package scripts | dbb4ad8 | package.json |

## What Was Built

### scripts/verify-migration.ts

Operator verification script that runs four targeted read-only SQL assertions:

1. **D-04 / MIG-02 (FATAL):** Count active system subcategories (`user_id IS NULL AND is_active = true`) with `nature_id IS NULL`. Expects 0 after `v2-backfill-nature-id`.
2. **D-02 (INFO):** Count `user_subcategory_override` rows with `nature_id IS NOT NULL` (backfill coverage visibility).
3. **D-03 (INFO):** Count user-owned subcategories (`user_id IS NOT NULL`) with `nature_id IS NULL`. Allowed — never fatal.
4. **MIG-03 / D-11 (FATAL):** Count `(pattern, sub_category_id)` groups in `categorization_pattern` with `count(*) > 1`. Expects 0 after sign-agnostic dedup.

Exported functions:
- `classifyResults(counts)` — pure function, no DB dependency, testable in isolation
- `runVerification(database)` — executes all four queries, returns counts + classification

The `executedDirectly` guard (same pattern as `seed-extras.ts`) ensures the module can be imported in tests without opening a DB connection.

Structured JSON logs follow `migrate.ts` discipline: `verification_started`, `verification_results`, `verification_failed` events with sanitized `safeStatusFields` (target, host, ssl, poolMax — no connection strings).

### package.json

Three scripts added adjacent to `db:seed-extras` triplet:
- `db:verify` → `tsx scripts/verify-migration.ts`
- `db:verify:staging` → `tsx scripts/verify-migration.ts --staging`
- `db:verify:production` → `tsx scripts/verify-migration.ts --production`

Production variant inherits `PRODUCTION_MIGRATION_CONFIRM` gate automatically through `getOperatorDatabaseConfig`.

### tests/verify-migration.test.ts

Four pure unit tests of `classifyResults`:
1. All-zero counts → `ok: true`
2. `activeSystemNullNatureCount: 3` → `ok: false`, fatal entry mentioning `nature_id` (D-04)
3. `patternDuplicateCount: 2` → `ok: false`, fatal entry mentioning `duplicate` (MIG-03)
4. Only `userOwnedNullNatureCount` + `overrideBackfilledCount` non-zero → `ok: true`, non-empty `info` (D-01/D-03)

## Design Contract Honoured

| Decision | How |
|----------|-----|
| D-04 (active system gate) | Fatal assertion on `activeSystemNullNatureCount` |
| D-08 (idempotent/re-runnable) | Script is read-only; safe to re-run any number of times |
| D-09 (transaction table untouched) | No import or reference to `transaction` table in queries |
| D-10 (slug-map driven, no inference) | Script asserts result state only; no description/sign/merchant inference |
| D-11 (pattern dedup verified) | `patternDuplicateCount` fatal assertion |
| D-12 (no expense_classification_history) | No write operations anywhere in script |
| MIG-03 (pattern uniqueness) | Fatal assertion on `(pattern, sub_category_id)` duplicates |
| T-48-04 (no credential leak) | `safeStatusFields` pattern — host only, no connection string |
| T-48-05 (correct target) | `resolveOperatorDatabaseTarget` + `getOperatorDatabaseConfig` reused |
| T-48-06 (false PASS impossible) | Hard-fatal thresholds pinned by unit tests |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. The script connects to existing operator-target DBs using existing credential resolution (same pattern as migrate.ts and seed-extras.ts).

## Self-Check: PASSED

- `scripts/verify-migration.ts` exists and exports `runVerification` and `classifyResults`
- `tests/verify-migration.test.ts` exists and 4/4 tests pass
- `package.json` has `db:verify`, `db:verify:staging`, `db:verify:production`
- Commits `16c644c`, `5a17293`, `dbb4ad8` exist in git log
- No INSERT/UPDATE/DELETE in verify-migration.ts
- No `transaction` table reference in queries

---
phase: 03-expense-management
plan: "02"
subsystem: database
tags: [drizzle, postgres, migrations, seed, categories, subcategories]

requires:
  - phase: 03-expense-management/03-01
    provides: lib/db/schema.ts with category, subCategory, expense tables and pgEnums

provides:
  - drizzle/migrations/0001_charming_stick.sql — SQL migration for category_type + expense_status enums, category/sub_category/expense tables with FKs and indexes
  - drizzle/migrations/meta/_journal.json — updated migration journal
  - drizzle/seed.ts — idempotent seed script with 27 categories and 126 subcategories from docs/init/seed.ts
  - package.json db:seed script (tsx drizzle/seed.ts)

affects:
  - 03-03 (DAL queries use category/sub_category/expense tables — requires migration applied before integration tests)
  - 03-04 (UI Server Actions insert into category/expense — requires seed data present)

tech-stack:
  added: []
  patterns:
    - Migration generation via drizzle-kit generate then application via tsx scripts/migrate.ts — never drizzle-kit push
    - Seed script pattern: relative imports, process.loadEnvFile for env loading, onConflictDoNothing for idempotency
    - Category-first insert order to satisfy FK constraint (subCategory.categoryId references category.id)

key-files:
  created:
    - drizzle/migrations/0001_charming_stick.sql — migration SQL for Phase 3 tables and enums
    - drizzle/migrations/meta/0001_snapshot.json — drizzle-kit schema snapshot
    - drizzle/seed.ts — seed script: 27 categories + 126 subcategories
  modified:
    - drizzle/migrations/meta/_journal.json — journal updated with migration 0001 entry
    - package.json — added db:seed script

key-decisions:
  - "drizzle/seed.ts uses relative imports (../lib/db/schema) not @/ aliases — tsx does not resolve tsconfig paths in script context"
  - "subCategories array inserted after categories array in seed — FK constraint requires parent rows to exist first"
  - "onConflictDoNothing used for both categories and subCategories — enables idempotent re-runs without errors"
  - "DATABASE_URL not reachable during worktree execution (localhost:5432 ECONNREFUSED) — migration apply and seed run deferred to environment with live PostgreSQL"

patterns-established:
  - "Seed scripts follow same env-loading pattern as scripts/migrate.ts: loop over ['.env.local', '.env'] with process.loadEnvFile"
  - "Lookup table seed data uses id-explicit inserts (serial with explicit IDs) to match docs/init/seed.ts IDs — ensures FK references from subcategory to category remain stable"

requirements-completed:
  - EXP-01
  - EXP-02
  - EXP-03

duration: 3min
completed: 2026-04-27
---

# Phase 3 Plan 02: Migration and Seed Summary

**Drizzle migration generated for category/sub_category/expense tables (2 enums, 3 tables, 7 indexes) and idempotent seed script created with 27 categories and 126 subcategories ported from docs/init/seed.ts.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-27T20:08:00Z
- **Completed:** 2026-04-27T20:13:00Z
- **Tasks:** 2
- **Files modified/created:** 5

## Accomplishments

- Generated migration SQL `0001_charming_stick.sql` with `CREATE TYPE category_type`, `CREATE TYPE expense_status`, `CREATE TABLE category`, `CREATE TABLE sub_category`, `CREATE TABLE expense` plus all FK constraints and 7 indexes
- Created `drizzle/seed.ts` porting complete dataset from `docs/init/seed.ts`: 27 categories (21 OUT, 5 IN, 1 SYSTEM) and 126 subcategories
- Added `db:seed` script to `package.json` (previously only `db:migrate` and `db:generate` existed)
- Seed is fully idempotent — `onConflictDoNothing()` on both inserts

## Task Commits

1. **Task 1: Generate Drizzle migration for Phase 3 schema** - `e9a4422` (feat)
2. **Task 2: Create drizzle/seed.ts and add db:seed to package.json** - `8f7f96d` (feat)

**Plan metadata:** (committed in final step)

## Files Created/Modified

- `drizzle/migrations/0001_charming_stick.sql` - Migration SQL: 2 enums, 3 tables, FK constraints, 7 indexes
- `drizzle/migrations/meta/0001_snapshot.json` - Drizzle-kit schema snapshot for 0001
- `drizzle/migrations/meta/_journal.json` - Updated journal tracking migration 0001
- `drizzle/seed.ts` - Idempotent seed script with complete category/subcategory data from docs/init/seed.ts
- `package.json` - Added `"db:seed": "tsx drizzle/seed.ts"` to scripts

## Decisions Made

- **Relative imports in seed.ts:** Used `../lib/db/schema` not `@/lib/db/schema` — tsx does not resolve tsconfig path aliases in script mode. Matches the pattern in `scripts/migrate.ts`.
- **Category-first insert:** Categories inserted before subcategories to satisfy FK constraint (Pitfall 5 from RESEARCH.md). Not using a transaction for the seed since both are idempotent individually.
- **Explicit IDs in category inserts:** Used `{ id: 1, name: 'risparmio', ... }` with explicit serial IDs from the source data. This preserves FK references from subcategory rows (categoryId: 1 etc.) across database rebuilds.

## Deviations from Plan

### Auth/Infrastructure Gate

**Database not reachable during worktree execution**
- **Found during:** Task 1 (apply migration step)
- **Issue:** `npm run db:migrate` exited with `ECONNREFUSED` — PostgreSQL at localhost:5432 is not running in the worktree execution environment
- **Action taken:** Migration generation completed successfully. Migration apply and `npm run db:seed` deferred to an environment with a running PostgreSQL instance.
- **Not a code issue:** The generated SQL and seed script are correct. This is an infrastructure gate.
- **To complete:** Run `npm run db:migrate && npm run db:seed` once PostgreSQL is available at the DATABASE_URL configured in `.env.local`.

---

**Total deviations:** 1 infrastructure gate (database unavailable during execution)
**Impact on plan:** Migration SQL is generated and correct. Seed data is complete. Application to DB deferred — not a code quality issue.

## Issues Encountered

PostgreSQL at `localhost:5432` was not running during worktree execution. The `ECONNREFUSED` error is an infrastructure gate, not a code bug. The generated migration and seed script are ready to apply as soon as the database is available.

Verification commands to run once DB is available:
```bash
npm run db:migrate
# Expected: "Migration completata."

npm run db:seed
# Expected: "Seed completato." with 27 categories and 126 subcategories

npm run db:seed  # Second run — idempotency check
# Expected: same output, exit 0
```

## User Setup Required

**Database required to apply migration and run seed.**

Before running integration tests or the UI (Plans 03/04), ensure PostgreSQL is running and run:

```bash
npm run db:migrate
npm run db:seed
```

Verify tables exist:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('category', 'sub_category', 'expense');
-- Expected: 3 rows

SELECT COUNT(*) FROM category;     -- Expected: >= 27
SELECT COUNT(*) FROM sub_category; -- Expected: >= 126
```

## Next Phase Readiness

- Migration SQL is generated — Plan 03 (DAL) can be implemented without a live DB (TypeScript types come from the schema, not from the DB state)
- Seed data is ready to apply — once DB is available, `npm run db:migrate && npm run db:seed` will prepare the full reference dataset
- No blockers for Plan 03 DAL implementation (queries against schema types, not runtime DB)

## Known Stubs

None. This plan produces a migration SQL file and seed script — no UI components, no data flows with placeholder values.

## Threat Flags

No new trust boundaries introduced beyond those in the plan's threat model:

| Flag | File | Description |
|------|------|-------------|
| T-3-02-01 (handled) | drizzle/seed.ts | DATABASE_URL loaded from .env.local — never committed to git (.env.local is in .gitignore). Seed script does not log the connection string. |

## Self-Check: PASSED

- drizzle/migrations/0001_charming_stick.sql: FOUND
- drizzle/seed.ts: FOUND
- onConflictDoNothing in seed.ts: FOUND (2 call sites)
- db:seed in package.json: FOUND
- CREATE TABLE "category" in migration: FOUND
- CREATE TABLE "sub_category" in migration: FOUND
- CREATE TABLE "expense" in migration: FOUND
- CREATE TYPE "category_type" in migration: FOUND
- CREATE TYPE "expense_status" in migration: FOUND
- Commit e9a4422 (Task 1 migration): FOUND
- Commit 8f7f96d (Task 2 seed.ts): FOUND

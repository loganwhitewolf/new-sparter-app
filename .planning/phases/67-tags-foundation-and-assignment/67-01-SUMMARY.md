---
phase: 67-tags-foundation-and-assignment
plan: 01
subsystem: database
tags: [drizzle, postgres, zod, migrations, schema]

# Dependency graph
requires: []
provides:
  - "tag and transactionTag tables in lib/db/schema.ts with relations"
  - "Additive migration 0027 (tag, transaction_tag) applied to the dev database"
  - "lib/validations/tags.ts: CreateTagSchema, UpdateTagSchema, ArchiveTagSchema, BulkAssignTagsSchema, BulkRemoveTagsSchema, SingleTransactionTagSchema"
  - "parseDateOnly exported from lib/validations/transactions.ts"
  - "APP_ROUTES.tagSettings = '/settings/tags'"
affects: [67-02, 67-03, 67-04, 67-05, 67-06, 67-07, 67-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-level (userId, normalizedName) unique constraint closes a TOCTOU race that a service-only pre-check cannot (T-67-01)"
    - "N:N junction with composite unique(tagId, transactionId) but no standalone single-column unique, since a transaction may carry N tags (unlike expenseGroupMembership's one-group-per-expense rule)"

key-files:
  created:
    - lib/validations/tags.ts
    - drizzle/migrations/0027_overconfident_beast.sql
  modified:
    - lib/db/schema.ts
    - lib/validations/transactions.ts
    - lib/routes.ts
    - drizzle/migrations/meta/_journal.json
    - drizzle/migrations/meta/0027_snapshot.json

key-decisions:
  - "normalizedName is computed by the service layer (Plan 67-03) via name.trim().toLowerCase(), never derived in the DB — the tag table stores it as a plain column."
  - "transactionTag has no standalone unique on transactionId — a transaction can carry many tags, so only the composite (tagId, transactionId) unique applies."

patterns-established:
  - "Pattern: additive-only migration (no ALTER/DROP against existing tables) mirrors ADR 0017's expense_group precedent"

requirements-completed: [TAG-01, TAG-02, TAG-03]

coverage:
  - id: D1
    description: "tag + transactionTag schema tables with relations, compiling cleanly with the D-02 uniqueness constraint and D-04 archived-only removal state"
    requirement: TAG-01
    verification:
      - kind: unit
        ref: "yarn tsc --noEmit (schema.ts introduces no new type errors vs. baseline)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Migration 0027 generated via drizzle-kit generate and applied via yarn db:migrate; tag/transaction_tag tables live in the dev database with expected columns and constraints; no existing table altered"
    requirement: TAG-01
    verification:
      - kind: integration
        ref: "information_schema.columns + pg_constraint query against the migrated dev database (ad-hoc verification script, removed after use) confirmed tag_userId_normalizedName_unique and transaction_tag_tagId_transactionId_unique constraints and all expected columns/FKs"
        status: pass
    human_judgment: false
  - id: D3
    description: "lib/validations/tags.ts exports all six Zod schemas (CreateTagSchema, UpdateTagSchema, ArchiveTagSchema, BulkAssignTagsSchema, BulkRemoveTagsSchema, SingleTransactionTagSchema) with no category/amount field; parseDateOnly promoted to exported; APP_ROUTES.tagSettings added"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "yarn tsc --noEmit (validations/tags.ts, transactions.ts, routes.ts introduce no new type errors) + grep checks for all six schema exports and absence of subCategoryId"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-20
status: complete
---

# Phase 67 Plan 01: Tags Foundation Schema Summary

**Additive `tag`/`transaction_tag` Postgres tables with DB-level case/whitespace-insensitive uniqueness (D-02) and dedup-safe assignment (D-06), plus the six Zod schemas every later Tags plan imports.**

## Performance

- **Duration:** ~3 min (task execution; excludes context-read time)
- **Started:** 2026-07-20T13:36:00Z (approx, first task commit 13:36:52 CEST/15:36:52+02:00)
- **Completed:** 2026-07-20T13:39:36Z (last task commit)
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified/generated)

## Accomplishments
- `tag` table: curated per-user tag entity (name, normalizedName, optional date range, archived flag) with a `unique(userId, normalizedName)` constraint that makes D-02's case/whitespace-insensitive uniqueness race-safe at the DB level, not merely a service-layer pre-check.
- `transactionTag` junction table: N:N tag-to-transaction assignment with `unique(tagId, transactionId)`, enabling Plan 67-04's `onConflictDoNothing` bulk-assign (D-06) — deliberately no standalone unique on `transactionId` alone, since a transaction may carry many tags.
- Migration `0027_overconfident_beast.sql` generated via `drizzle-kit generate` and applied via `yarn db:migrate`; purely additive (`CREATE TABLE`/`ALTER TABLE ... ADD CONSTRAINT`/`CREATE INDEX` only — no `ALTER TABLE` against `transaction`, `expense`, or `user`).
- `lib/validations/tags.ts`: `CreateTagSchema`, `UpdateTagSchema`, `ArchiveTagSchema`, `BulkAssignTagsSchema`, `BulkRemoveTagsSchema`, `SingleTransactionTagSchema` + inferred types, reusing `parseDateOnly`/`getInclusiveToDate` for the D-09 inclusive date-range boundary.
- `parseDateOnly` promoted from module-private to exported in `lib/validations/transactions.ts` (no behavior change).
- `APP_ROUTES.tagSettings = '/settings/tags'` added for the D-01 `/settings/tags` surface.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tag + transactionTag schema tables and relations** - `81ffc3c` (feat)
2. **Task 2: [BLOCKING] Generate and apply the tag/transaction_tag migration** - `431c271` (feat)
3. **Task 3: Add tag Zod validation schemas + tagSettings route + promote parseDateOnly** - `5ffca05` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/db/schema.ts` - `tag`/`transactionTag` tables, `tagRelations`/`transactionTagRelations`, extended `userRelations`/`transactionRelations`
- `drizzle/migrations/0027_overconfident_beast.sql` - additive migration creating `tag` + `transaction_tag`
- `drizzle/migrations/meta/_journal.json`, `drizzle/migrations/meta/0027_snapshot.json` - drizzle-kit generated migration metadata
- `lib/validations/tags.ts` - the six tag Zod schemas + inferred types
- `lib/validations/transactions.ts` - `parseDateOnly` promoted to `export function`
- `lib/routes.ts` - `APP_ROUTES.tagSettings` entry

## Decisions Made
- None beyond what the plan specified — schema shape, migration, and validation schemas followed the plan's `<action>` blocks verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration verification target corrected from local Docker Postgres to the actual `DATABASE_URL`-configured dev database**
- **Found during:** Task 2 (migration apply/verify)
- **Issue:** The plan's `read_first`/`acceptance_criteria` assumed the local Docker container `sparter-postgres` (via `docker-compose.yml`) is the target `yarn db:migrate` applies to, and specified `docker compose exec -T postgres psql ...` as the verification command. In practice `yarn db:migrate`'s `local` target reads `DATABASE_URL` from `.env`, which in this environment points to a remote Supabase-hosted Postgres instance (host `aws-1-eu-central-1.pooler.supabase.com`), not the Docker container. Confirmed the Docker container (`sparter-postgres`, healthy) has zero relations (`\dt` → "Did not find any relations") — it is not the DB the app's own `db:migrate`/`db:seed` scripts write to in this dev setup.
- **Fix:** Applied the migration via the exact specified command (`yarn db:migrate`, no `drizzle-kit push`), which succeeded against the real `local`-target database. Verified table existence and constraint shape via an ad-hoc `tsx` script (`scripts/_verify-tag-tables-tmp.ts`, created and deleted within this task) that reused the project's own `scripts/db-config.ts` helpers (`getOperatorDatabaseConfig`, `connectionStringWithSsl`) to open a `pg.Pool` against the same connection string `db:migrate` uses, then queried `information_schema.columns` and `pg_constraint` for `tag`/`transaction_tag` — never printing the connection string or any secret.
- **Files modified:** none (verification script was temporary, removed before commit; not part of the committed diff)
- **Verification:** Confirmed `tag` has columns `id, user_id, name, normalized_name, date_range_start, date_range_end, archived, created_at, updated_at` and constraints `tag_userId_normalizedName_unique UNIQUE(user_id, normalized_name)` + FK to `user(id)` ON DELETE CASCADE. Confirmed `transaction_tag` has columns `id, tag_id, transaction_id, created_at` and constraints `transaction_tag_tagId_transactionId_unique UNIQUE(tag_id, transaction_id)` + FKs to `tag(id)`/`transaction(id)` ON DELETE CASCADE, with no standalone unique on `transaction_id` alone.
- **Committed in:** `431c271` (Task 2 commit; the verification script itself was never committed)

---

**Total deviations:** 1 auto-fixed (1 blocking — verification target correction, no schema/migration content change)
**Impact on plan:** No change to the schema, migration content, or acceptance criteria outcomes — only the verification *method* was adapted to match the real dev database target. All required acceptance criteria (constraint shape, additive-only migration, no altered existing tables) were independently confirmed.

## Issues Encountered
- Pre-existing, unrelated TypeScript errors in `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, and `tests/transactions-dal.test.ts` (missing `sampleAmounts` field on `PatternSuggestion` test fixtures; an `SQL<string>` cast mismatch) were confirmed present on a clean `git stash` baseline before this plan's changes — same 21 errors before and after. Out of scope per the scope-boundary rule; not touched.

## User Setup Required

None - no external service configuration required. Note for the operator: this plan's migration was applied against the `local` `DATABASE_URL` target as configured in `.env` (a Supabase-hosted Postgres instance in this environment), not the local Docker container defined in `docker-compose.yml`. Any parallel local Docker Postgres usage should be reconciled separately if it is expected to mirror schema state.

## Next Phase Readiness
- `tag`/`transaction_tag` tables and their relations are live in the dev database and importable from `lib/db/schema.ts` for Plan 67-02's DAL layer.
- All six Zod schemas in `lib/validations/tags.ts` are ready for Plan 67-03 (service layer: createTag/updateTag normalization, uniqueness handling) and Plan 67-04 (bulk-assign/remove actions).
- `APP_ROUTES.tagSettings` is ready for Plan 67-08's `/settings/tags` page.
- No blockers for downstream plans in this phase.

---
*Phase: 67-tags-foundation-and-assignment*
*Completed: 2026-07-20*

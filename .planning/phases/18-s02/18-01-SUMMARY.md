---
phase: "18"
plan: "01"
---

# T01: Added nullable category ownership, per-user subcategory overrides, and scoped partial uniqueness for system and user-managed category slugs.

**Added nullable category ownership, per-user subcategory overrides, and scoped partial uniqueness for system and user-managed category slugs.**

## What Happened

Updated `lib/db/schema.ts` to import `sql` and `uniqueIndex`, add nullable `userId` owner columns on `category` and `subCategory` with cascade-delete user FKs, and replace unsafe global/category-scope uniqueness with partial unique indexes for system rows and user-owned rows. Added the `userSubcategoryOverride` Drizzle table for `user_subcategory_override` with cascade FKs to `user` and `sub_category`, a `(userId, subCategoryId)` unique constraint, timestamps, and lookup indexes. Extended relations so users expose owned categories/subcategories/overrides, categories and subcategories expose owners, subcategories expose overrides, and overrides link back to user and subcategory.

Ran `yarn db:generate`; Drizzle produced `0010_peaceful_nightshade` but, because historical snapshots for 0007-0009 are absent despite existing SQL and journal entries, the initial generated SQL repeated already-applied 0007-0009 changes. Following the task's stale-snapshot failure-mode guidance, manually trimmed `drizzle/migrations/0010_peaceful_nightshade.sql` to contain only this task's schema changes while keeping the generated `0010_snapshot.json` as the latest full schema baseline. Re-running `yarn db:generate` reported no schema changes. Applied migrations against the configured database and verified live metadata without printing secrets or raw category contents.

## Verification

Verified Drizzle generation stability, migration SQL contents, real migration apply, TypeScript compile, ESLint, and live database metadata. `yarn db:generate` completed and then reported no schema changes after manual SQL correction. SQL inspection confirmed override table/FKs, nullable owner columns, dropped legacy uniqueness constraints, partial unique indexes for system/user category and subcategory scopes, and absence of duplicate 0007-0009 operations. `yarn db:migrate` applied successfully with configured `DATABASE_URL`. `yarn tsc --noEmit` and `yarn lint` passed. Live DB metadata confirmed nullable owner columns, override FKs/indexes, partial unique indexes, and seeded/system row compatibility with 27 categories and 126 subcategories still having `user_id IS NULL`. Slice-level `tests/categories-dal.test.ts` does not exist yet, so the DAL test demo is deferred to later S02 tasks.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn db:generate` | 0 | ✅ pass — generated drizzle/migrations/0010_peaceful_nightshade.sql and 0010 snapshot | 1246ms |
| 2 | `yarn db:generate && find drizzle/migrations -maxdepth 1 -type f -name '001*.sql' -print | sort` | 0 | ✅ pass — no schema changes after manual SQL correction; only 0010 migration present for this task | 970ms |
| 3 | `python SQL inspection of drizzle/migrations/0010_peaceful_nightshade.sql` | 0 | ✅ pass — required nullable owner columns, override table/FKs, dropped legacy constraints, partial unique indexes, and no duplicate 0007-0009 statements | 70ms |
| 4 | `node env presence check for DATABASE_URL` | 0 | ✅ pass — DATABASE_URL configured; value not printed | 95ms |
| 5 | `yarn db:migrate` | 0 | ✅ pass — configured database applied migrations successfully | 1254ms |
| 6 | `yarn tsc --noEmit` | 0 | ✅ pass — schema exports compile | 3755ms |
| 7 | `node/pg live metadata verification for columns, indexes, FKs, and system-row counts` | 0 | ✅ pass — live DB has nullable owners, override FKs/indexes, partial unique indexes, and seeded rows remain system-owned | 177ms |
| 8 | `yarn lint` | 0 | ✅ pass — ESLint reported no issues | 4209ms |
| 9 | `test -f tests/categories-dal.test.ts check` | 0 | ✅ pass — slice-level DAL test file not present yet; demo deferred to later S02 tasks | 16ms |

## Deviations

None. The only manual migration edit was the planned correction path for stale/missing historical Drizzle snapshots.

## Known Issues

Historical Drizzle snapshot files for 0007-0009 are still absent, although their SQL files and journal entries exist. The new 0010 snapshot now provides a forward baseline and generation is stable.

## Files Created/Modified

- `lib/db/schema.ts`
- `drizzle/migrations/0010_peaceful_nightshade.sql`
- `drizzle/migrations/meta/0010_snapshot.json`
- `drizzle/migrations/meta/_journal.json`

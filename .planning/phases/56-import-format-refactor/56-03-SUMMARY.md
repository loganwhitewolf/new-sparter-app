---
phase: 56-import-format-refactor
plan: "03"
subsystem: import-pipeline
tags: [seed-migration, schema-drop, drizzle, import-format, data-migration]
dependency_graph:
  requires: [56-02-importFormatVersion-contract-columns-schema]
  provides: [platform-identity-only, import-format-contract-seeded, drop-platform-contract-migration-0022]
  affects: [plan-04-detector-dal-consumers]
tech_stack:
  added: []
  patterns: [drizzle-kit-generate, add-then-drop-two-step, seed-extras-idempotent-step, onConflictDoNothing]
key_files:
  created:
    - drizzle/migrations/0022_wonderful_eternals.sql
    - drizzle/migrations/meta/0022_snapshot.json
  modified:
    - scripts/seed-extras.ts
    - scripts/seed-data.ts
    - scripts/seed.ts
    - lib/db/schema.ts
    - drizzle/migrations/meta/_journal.json
    - tests/import-hash-contract.test.ts
decisions:
  - "seed-extras STEP uses correlated UPDATE ... FROM platform WHERE delimiter IS NULL as idempotency guard — delimiter is NOT NULL on platform, so it reliably signals 'not yet copied'"
  - "importFormatVersions export in seed-data.ts is a separate parallel array (not restructured from platforms) — keeps additive contract and baseline insert separation clean"
  - "tests/import-hash-contract.test.ts buildConfig updated to read from seedFormatVersions rather than seedPlatforms — the contract source moved, the test follows it"
  - "Migration 0022 tightens import_format_version to SET NOT NULL on delimiter/descriptionColumn/amountType/timestampColumn and adds DEFAULT+NOT NULL to dateReplace/decimalReplace/multiplyBy — mirrors original platform nullability"
metrics:
  duration: "~4min"
  completed: "2026-06-25"
  tasks: 3
  files: 6
status: complete
---

# Phase 56 Plan 03: Data Migration, Seed Rework, and Platform Column Drop Summary

Migrate live data and seed source so the parsing contract lives on `import_format_version`; drop the contract columns from `platform`; generate the DROP/tighten migration (ADR 0013, IFMT-03, IFMT-05 seed half).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add `move-parsing-contract-to-format-version` seed-extras STEP | da687ce | scripts/seed-extras.ts |
| 2 | Rework seed-data/seed.ts — contract owned by importFormatVersion | f4be68e | scripts/seed-data.ts, scripts/seed.ts, tests/import-hash-contract.test.ts |
| 3 | Drop platform contract columns, tighten importFormatVersion — migration 0022 | 6aa7145 | lib/db/schema.ts, drizzle/migrations/0022_wonderful_eternals.sql, meta files |

## What Was Built

### Task 1 — seed-extras.ts STEP `move-parsing-contract-to-format-version`

A new STEP appended to `scripts/seed-extras.ts` that runs a single correlated `UPDATE import_format_version SET ... FROM platform WHERE ifv.platform_id = p.id AND ifv.delimiter IS NULL`. The `AND delimiter IS NULL` guard makes the STEP idempotent: rows already populated are skipped on re-run. All 12 contract columns are copied. The rowCount is logged.

This STEP is the **data bridge** that makes the DROP migration safe for production: running `yarn db:seed-extras` before `yarn db:migrate` (0022 drop) ensures every `import_format_version` row has a populated contract before the platform columns are removed.

### Task 2 — seed-data.ts and seed.ts

**seed-data.ts:**
- `platforms` array reduced to identity only: `id`, `name`, `slug`, `country`
- New `importFormatVersions` export — one entry per platform (platformId 1–7, version 1) carrying the full 12-column contract. Values are byte-identical to the previous platform column values to preserve transactionHash parity.
- Fineco `descriptionStripPattern: "\\s+Carta N\\..*$"` preserved on the format-version seed shape.

**seed.ts:**
- `headerSignatureFor` repointed to read from `seedFormatVersions[n]` (not `seedPlatforms[n]`); produces the identical five-column delimiter-joined signature string.
- `platform` insert writes identity columns only (`id`, `name`, `slug`, `country`, `isActive`).
- `importFormatVersion` insert writes the full contract from `seedFormatVersions` plus `headerSignature`, `notes`, `isActive`. Stays `onConflictDoNothing()`.

**tests/import-hash-contract.test.ts:**
- `buildConfig` updated to look up the format-version seed shape (`seedFormatVersions`) for contract fields instead of `seedPlatforms`. All 7 hash literals remain GREEN (IFMT-02 gate passes).

### Task 3 — schema drop + tighten, migration 0022

**lib/db/schema.ts:**
- `platform` pgTable: 12 parsing-contract columns removed. Retained: `id`, `ownerUserId`, `visibility`, `reviewStatus`, `name`, `slug`, `country`, `isActive`, `createdAt`, `updatedAt` + existing indexes.
- `importFormatVersion` pgTable: contract columns tightened to match original platform nullability:
  - `delimiter`, `descriptionColumn`, `amountType`, `timestampColumn` → `.notNull()`
  - `dateReplace`, `decimalReplace` → `.default(false).notNull()`
  - `multiplyBy` → `.default(1).notNull()`
  - `amountColumn`, `positiveAmountColumn`, `negativeAmountColumn`, `dateFormat`, `descriptionStripPattern` → remain nullable

**drizzle/migrations/0022_wonderful_eternals.sql** (generated via `yarn db:generate`):
```sql
ALTER TABLE "import_format_version" ALTER COLUMN "delimiter" SET NOT NULL;
ALTER TABLE "import_format_version" ALTER COLUMN "description_column" SET NOT NULL;
ALTER TABLE "import_format_version" ALTER COLUMN "amount_type" SET NOT NULL;
ALTER TABLE "import_format_version" ALTER COLUMN "timestamp_column" SET NOT NULL;
ALTER TABLE "import_format_version" ALTER COLUMN "date_replace" SET DEFAULT false;
ALTER TABLE "import_format_version" ALTER COLUMN "date_replace" SET NOT NULL;
ALTER TABLE "import_format_version" ALTER COLUMN "decimal_replace" SET DEFAULT false;
ALTER TABLE "import_format_version" ALTER COLUMN "decimal_replace" SET NOT NULL;
ALTER TABLE "import_format_version" ALTER COLUMN "multiply_by" SET DEFAULT 1;
ALTER TABLE "import_format_version" ALTER COLUMN "multiply_by" SET NOT NULL;
ALTER TABLE "platform" DROP COLUMN "delimiter";
-- ... 11 more DROP COLUMN statements for platform
```

Confirmed: touches only `import_format_version` (ALTER) and `platform` (DROP). No push used.

## Operator Apply Order (CRITICAL — T-56-05 mitigation)

The drop migration (0022) **must** be applied AFTER the data copy step. Required order:

```bash
yarn db:migrate        # apply 0021 ADD COLUMN migration (already generated in Plan 02)
yarn db:seed           # baseline insert (idempotent) — writes contract on new import_format_version rows
yarn db:seed-extras    # copy contract from platform to existing production import_format_version rows
yarn db:migrate        # apply 0022 DROP COLUMN migration (safe — all rows now have contract populated)
```

If 0022 is applied before `yarn db:seed-extras`, every production `platform` row loses its contract irreversibly. The STEP is the guard.

## Migration Filenames

| Migration | File | Content |
|-----------|------|---------|
| Plan 02 (ADD) | `drizzle/migrations/0021_glorious_callisto.sql` | ADD 12 nullable columns to import_format_version |
| Plan 03 (DROP/TIGHTEN) | `drizzle/migrations/0022_wonderful_eternals.sql` | DROP 12 columns from platform; SET NOT NULL on import_format_version |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated tests/import-hash-contract.test.ts to read contract from seedFormatVersions**
- **Found during:** Task 2
- **Issue:** The regression test's `buildConfig` read contract fields (`timestampColumn`, `descriptionColumn`, `amountType`, etc.) from `seedPlatforms`. After the seed-data reshape, those fields no longer exist on platform shapes — the test would have failed with TypeScript type errors and runtime undefined values.
- **Fix:** Updated `buildConfig` to look up `seedFormatVersions` (the new contract source) by `platformId`, reading contract fields from there. The hash literals are unchanged — the test confirms identical output (IFMT-02 remains GREEN).
- **Files modified:** `tests/import-hash-contract.test.ts`
- **Commit:** f4be68e (included in Task 2 commit)

## Known Stubs

None — no UI rendering, no data stubs. Schema, seed, and migration changes only.

## Threat Flags

None — no new runtime trust boundary introduced. The DROP migration is guarded by operator run order documented above.

## Self-Check: PASSED

- `scripts/seed-extras.ts` STEP `move-parsing-contract-to-format-version` — FOUND in STEPS array
- `scripts/seed-data.ts` `importFormatVersions` export — FOUND (7 entries, platformId 1–7)
- `scripts/seed.ts` `headerSignatureFor` reads from format-version seed shape — FOUND
- `lib/db/schema.ts` platform without contract columns — FOUND (10 columns)
- `drizzle/migrations/0022_wonderful_eternals.sql` — FOUND (ALTER + DROP statements confirmed)
- Commit `da687ce` (Task 1) — FOUND
- Commit `f4be68e` (Task 2) — FOUND
- Commit `6aa7145` (Task 3) — FOUND
- `yarn test tests/import-hash-contract.test.ts` — 7 passed (7) GREEN
- `yarn lint lib/db/schema.ts` — clean (no errors)
- `yarn check:language` — only pre-existing violations (lib/dal/expenses.ts:82, lib/dal/transactions.ts:200), none from this plan

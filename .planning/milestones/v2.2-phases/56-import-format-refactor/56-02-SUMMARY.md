---
phase: 56-import-format-refactor
plan: "02"
subsystem: import-pipeline
tags: [schema-migration, drizzle, import-format, transition-migration]
dependency_graph:
  requires: [56-01-transactionHash-regression-baseline]
  provides: [importFormatVersion-contract-columns-schema, add-column-migration-0021]
  affects: [plans-03-04-gate]
tech_stack:
  added: []
  patterns: [drizzle-kit-generate, nullable-transition-migration, add-then-drop-two-step]
key_files:
  created:
    - drizzle/migrations/0021_glorious_callisto.sql
    - drizzle/migrations/meta/0021_snapshot.json
  modified:
    - lib/db/schema.ts
    - drizzle/migrations/meta/_journal.json
decisions:
  - "All 12 contract columns added as nullable (no .notNull(), no default) so ALTER TABLE succeeds on existing populated rows without backfill conflict"
  - "platform table columns left completely untouched — DROP deferred to Plan 03 after seed-extras data copy"
  - "DB column names mirror exact snake_case of platform table to make Plan 03 type-identical copy trivial"
metrics:
  duration: "~8min"
  completed: "2026-06-25"
  tasks: 2
  files: 4
status: complete
---

# Phase 56 Plan 02: Schema — Add Contract Columns to importFormatVersion Summary

Add 12 nullable parsing-contract columns to `importFormatVersion` via `drizzle-kit generate`, completing the first half of the add-then-drop two-step migration (ADR 0013, IFMT-01).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add nullable parsing contract columns to importFormatVersion | 5c9e8ec | lib/db/schema.ts |
| 2 | Generate ADD-COLUMN SQL migration with drizzle-kit generate | 303c429 | drizzle/migrations/0021_glorious_callisto.sql, meta/_journal.json, meta/0021_snapshot.json |

## What Was Built

**Task 1 — Schema change (`lib/db/schema.ts`):**

Added 12 parsing-contract columns to the `importFormatVersion` pgTable definition, all nullable (no `.notNull()`, no default), to match the transition migration requirement:

| Column | Type | DB name |
|--------|------|---------|
| `delimiter` | varchar(4) | `delimiter` |
| `descriptionColumn` | varchar(120) | `description_column` |
| `amountType` | amountTypeEnum | `amount_type` |
| `amountColumn` | varchar(120) | `amount_column` |
| `positiveAmountColumn` | varchar(120) | `positive_amount_column` |
| `negativeAmountColumn` | varchar(120) | `negative_amount_column` |
| `timestampColumn` | varchar(120) | `timestamp_column` |
| `dateFormat` | varchar(60) | `date_format` |
| `dateReplace` | boolean | `date_replace` |
| `decimalReplace` | boolean | `decimal_replace` |
| `multiplyBy` | integer | `multiply_by` |
| `descriptionStripPattern` | text | `description_strip_pattern` |

The `platform` table definition was NOT modified — its columns remain with `.notNull()` / defaults intact, to be dropped in Plan 03 only after the seed-extras data copy confirms every `import_format_version` row has been populated.

**Task 2 — Generated migration (`drizzle/migrations/0021_glorious_callisto.sql`):**

`yarn db:generate` (= `drizzle-kit generate`) produced a 12-statement migration:

```sql
ALTER TABLE "import_format_version" ADD COLUMN "delimiter" varchar(4);
ALTER TABLE "import_format_version" ADD COLUMN "description_column" varchar(120);
ALTER TABLE "import_format_version" ADD COLUMN "amount_type" "amount_type";
ALTER TABLE "import_format_version" ADD COLUMN "amount_column" varchar(120);
ALTER TABLE "import_format_version" ADD COLUMN "positive_amount_column" varchar(120);
ALTER TABLE "import_format_version" ADD COLUMN "negative_amount_column" varchar(120);
ALTER TABLE "import_format_version" ADD COLUMN "timestamp_column" varchar(120);
ALTER TABLE "import_format_version" ADD COLUMN "date_format" varchar(60);
ALTER TABLE "import_format_version" ADD COLUMN "date_replace" boolean;
ALTER TABLE "import_format_version" ADD COLUMN "decimal_replace" boolean;
ALTER TABLE "import_format_version" ADD COLUMN "multiply_by" integer;
ALTER TABLE "import_format_version" ADD COLUMN "description_strip_pattern" text;
```

Confirmed: ADD COLUMN statements only, on `import_format_version` only. No `DROP COLUMN`, no ALTER on `platform`. `drizzle-kit push` was NOT used.

**Regression test:** `yarn test tests/import-hash-contract.test.ts` — 7/7 passed after the schema change (schema-level add alone changes no runtime parsing path).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — schema and migration only, no UI or runtime behavior.

## Threat Flags

None — migration is ADD-only; no new runtime trust boundary introduced. The generated SQL was inspected and confirmed: touches only `import_format_version`, drops nothing.

## Self-Check: PASSED

- `lib/db/schema.ts` — FOUND, importFormatVersion has 12 new nullable columns
- `drizzle/migrations/0021_glorious_callisto.sql` — FOUND, 12 ADD COLUMN statements only
- `drizzle/migrations/meta/_journal.json` — FOUND, updated by generator
- Commit `5c9e8ec` (Task 1) — FOUND
- Commit `303c429` (Task 2) — FOUND
- `yarn test tests/import-hash-contract.test.ts` — 7 passed (7)
- `yarn lint lib/db/schema.ts` — clean

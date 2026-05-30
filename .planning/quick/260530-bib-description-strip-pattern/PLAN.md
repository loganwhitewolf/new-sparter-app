---
id: 260530-bib
slug: description-strip-pattern
date: 2026-05-30
status: in_progress
tasks_total: 7
tasks_completed: 0
---

# Quick Task 260530-bib: Add DescriptionStripPattern to Platform

## One-liner

Add a nullable `descriptionStripPattern` field to the `platform` table so that per-platform regex rules can strip predictable description boilerplate (e.g. Fineco's card/date suffix) before normalization and hashing.

## Tasks

- [ ] T1: Generate Drizzle migration for `description_strip_pattern` column on `platform`
- [ ] T2: Update `platform` schema in `lib/db/schema.ts`
- [ ] T3: Update `ImportPlatformConfig` type and `normalizeTransactionRow` logic in `lib/utils/import.ts`
- [ ] T4: Verify DAL queries that load `ImportPlatformConfig` include the new field
- [ ] T5: Add Fineco strip pattern via `seed-extras.ts` step
- [ ] T6: Update/add unit tests in `tests/import-utils.test.ts`
- [ ] T7: Commit all changes atomically

## Key decisions (all LOCKED — do not reopen)

- Field on `platform`, NOT on `importFormatVersion`
- Strip applied before `normalizeDescription` and all hash computation
- Stripped description is what gets stored, displayed, and hashed
- Original preserved in `transaction.rawRow`
- Fineco regex: `\s+Carta N\..*$` (case-insensitive, strip from "Carta N." to end)
- No migration for existing data — user will delete + re-import

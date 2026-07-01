---
quick_id: 260701-ki4
slug: support-combining-two-columns-for-expens
type: quick
status: complete
date: 2026-07-01
branch: gsd/v2.4-standalone-expense
---

# Summary — Generic secondary description column (Satispay person payments)

## What shipped
A generic, nullable `secondaryDescriptionColumn` on the import-format parsing
contract. When set and a row's secondary value is non-empty (and differs from
primary), import composes the description as `Primary — @secondary` (em dash).
This disambiguates Satispay person-to-person payments — two "Federico P." rows
with different `@usernames` now hash to distinct `descriptionHash` values and
split into separate expenses instead of merging. Opt-in per format; future
imports only, no backfill.

## Commits (8, atomic — branch `gsd/v2.4-standalone-expense`)
| SHA | Task |
|-----|------|
| 2af5cd4 | schema: nullable `secondaryDescriptionColumn` on `importFormatVersion` |
| c5a5c09 | compose `Primary — @secondary` in `normalizeTransactionRow` |
| b5f922b | thread column through DAL projection/type/guard/mapper |
| 707ca03 | accept + persist optional column in wizard service + validation |
| 90119db | optional secondary-description dropdown in wizard UI (Italian copy) |
| c554141 | seed-extras STEP sets Satispay secondary column to `Descrizione` |
| 5b23bb5 | add column to DAL row test fixture |
| fb651ef | unit test: combined description → distinct hashes |

Generated migration: `drizzle/migrations/0024_wet_shiva.sql` — single nullable
`ALTER TABLE ... ADD COLUMN "secondary_description_column" varchar(120)`, no backfill.

## Verification
- `tests/import-utils.test.ts` — 13/13 pass (incl. new combined-description /
  distinct-hash / primary-only-on-empty-secondary assertions).
- `tests/import-private-formats-dal.test.ts` — 9/9 pass.
- `npx tsc --noEmit`, `yarn check:language`, `yarn test`: the only failures are
  **pre-existing on base commit 5d0f9e6** in files this task never touched
  (`suggestion-promote-form.test.tsx`, `transactions-dal.test.ts`,
  `expense-actions.test.ts`, `import-table-actions.test.tsx`,
  `overview-interactions.test.tsx`; 4 language warnings in expenses/dal files).
  This task introduced **zero** new type, lint, language, or test failures.
- `eslint` on changed files: 0 errors, 4 warnings (all pre-existing `_database`
  no-op step stubs in `seed-extras.ts`).

## Deviations
None from the locked plan. Design decisions were locked in CONTEXT.md
(generic column, `Primary — @secondary` format, future-imports-only hashing).

## Operator follow-up (needs live DB — NOT run here)
```
yarn db:migrate && yarn db:seed && yarn db:seed-extras
```
Applies migration 0024 and sets the active global Satispay format's secondary
column to `Descrizione`. Then, in the format wizard, other formats can opt in
via the new optional "Colonna descrizione secondaria" dropdown.

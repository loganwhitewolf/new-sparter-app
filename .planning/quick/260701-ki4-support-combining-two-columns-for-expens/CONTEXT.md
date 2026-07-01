# Quick Task Context — Combined description column (Satispay person payments)

## Problem
Satispay person-to-person rows carry an anonymized display name in `Nome`
("Federico P.") plus a unique `@username` in `Descrizione`. Distinct people
collapse to the same `Nome` (`Federico Piazza` → "Federico P." and
`Federico Piseddu` → "Federico P."). The `@username` disambiguates them.

Today `description` is derived from a **single** `descriptionColumn`. In
`lib/services/import.ts`, expenses are aggregated by
`descriptionHash = sha256(normalize(description))`, and the expense `title` is
`description.slice(0,120)`. So two different people with the same `Nome` merge
into one expense with a colliding title. Combining the username column fixes
both the **title** and the incorrect **grouping**.

Example (real export `Nome | Descrizione | Importo`):
```
"Federico P.","@federicopiazza82",-50
"Federico P.","@piseddu_f",-16
"Federico P.","@piseddu_f",-27.5
"@filippobertolotti",null,-65      # already a username, secondary empty
"Alice F.","@alicefurlan",45
```
For shop rows (`🏬 a un Negozio`) `Descrizione` is empty → primary only.

## Locked decisions (from user, 2026-07-01)
1. **Mechanism — generic secondary description column.** Add a nullable
   `secondaryDescriptionColumn varchar(120)` to `import_format_version`
   (ADR 0013: parsing contract lives on the format version). Opt-in per format;
   reusable beyond Satispay. NOT hardcoded to the Satispay platform.
2. **Compose format — `Primaria — @secondaria`** (em dash `—`, space-padded)
   when the secondary column value is non-empty; primary only when empty.
   Example: `Federico P. — @piseddu_f`. Shops stay `Nome` only.
3. **Hash impact — combined text feeds `descriptionHash`; future imports only.**
   New Satispay imports split the two "Federico P." into distinct expenses.
   No backfill of already-imported expenses.

## Compose rule (exact)
In `normalizeTransactionRow` (`lib/utils/import.ts`), after computing the
(strip-pattern-applied) primary `description`:
- read `secondary = String(row[platform.secondaryDescriptionColumn] ?? '').trim()`
  only when `platform.secondaryDescriptionColumn` is set;
- if `secondary` non-empty AND differs from primary → `description = `${description} — ${secondary}``;
- apply `descriptionStripPattern` to the **primary** column only (unchanged),
  then combine. Do not strip the secondary.
- `normalizedDescription`, `descriptionHash`, `transactionHash` all derive from
  the combined `description` (no separate code path — just the composed string).

## Blast radius / files
- `lib/db/schema.ts` (~line 297): add nullable `secondaryDescriptionColumn`.
- `drizzle/migrations/`: `drizzle-kit generate` → new SQL migration (nullable
  column, no backfill). Never `drizzle-kit push`.
- `lib/utils/import.ts`: `ImportPlatformConfig` type + `normalizeTransactionRow`
  compose logic.
- `lib/dal/import-formats.ts` / `lib/services/import.ts`: ensure the new column
  is selected and passed into the platform config object.
- `lib/services/import-format-wizard.ts` (~line 317) + `lib/validations/import.ts`:
  accept + persist `secondaryDescriptionColumn` (optional).
- `components/import/import-format-wizard.tsx`: optional dropdown for the
  secondary column (nullable/"none"). Not a required column.
- `lib/services/import-format-detector.ts`: do NOT require the secondary column
  for a format match (it is optional).
- `scripts/seed-extras.ts`: append a STEP that UPDATEs the existing Satispay
  active format version, `secondaryDescriptionColumn = 'Descrizione'`, by
  platform slug. **Do NOT** add the field to `scripts/seed-data.ts` shapes
  (baseline insert already ran in prod — additive-seed rule).

## Constraints
- Monetary logic untouched (no `Decimal` changes needed here).
- Dev-facing strings/comments English; Italian only for user-facing wizard copy.
- Run `yarn check:language` after touching wizard/validations/comments.
- Post-migration run order: `yarn db:migrate && yarn db:seed && yarn db:seed-extras`.

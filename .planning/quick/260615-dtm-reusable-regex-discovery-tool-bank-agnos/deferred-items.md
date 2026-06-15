# Deferred items — quick task 260615-dtm

Out-of-scope discoveries found during execution. NOT fixed (SCOPE BOUNDARY rule).

## Pre-existing tsc errors (unrelated to this task)

Confirmed present on clean HEAD (verified by stashing this task's changes and re-running `npx tsc --noEmit`). 6 errors total, none in files touched by this task:

- `tests/cascade-options.test.ts` (lines 125, 162, 397, 408) — `TS18050: The value 'null' cannot be used here.`
- `tests/category-combobox.test.tsx` (lines 70, 129) — `TS2322: Type '"system"' is not assignable to type '"out" | "in" | "transfer" | "allocation" | null'.`

These appear to be stale test fixtures referencing a removed `"system"` category type (ADR 0012 / Phase 46 nature-direction model). Should be addressed in a separate cleanup task.

## Junk import formats polluting the DB (deferred by user 2026-06-15)

The operator DB holds many wizard-created test import formats — `asd`, `asdasd`, `asdsa`, 7 duplicate private/draft Fineco `;` formats (one per user), and 4 Poste duplicates. They clutter format detection. User asked to clean these up in a **separate dedicated task**, not in this flow.

Related product gap: the `;`-delimited 8-column Fineco layout (`Data_Operazione;…;Moneymap`) exists only as per-user private drafts — never promoted to a **global-approved** format. Worth seeding one global Fineco `;` format so production auto-detects it instead of each user re-creating it.

## Import detection: xlsx date cells rejected

`parseBankDate` (used in `import-format-detector` sample validation) expects `DD/MM/YYYY`, but `.xlsx` date cells parse as ISO datetimes → valid Fineco-style spreadsheets score below the 0.8 match threshold and are surfaced as unmatched. Workaround for now: export as `;`-delimited CSV. Real fix: have detection accept ISO/Date values from spreadsheet parsing.

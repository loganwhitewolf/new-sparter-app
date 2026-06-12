---
phase: 49-dashboard-and-surfaces
plan: "06"
subsystem: database
tags: [drizzle, postgres, migration, schema, direction, totals]

# Dependency graph
requires:
  - phase: 49-dashboard-and-surfaces
    plan: "02"
    provides: notExcludedFromTotals() removed; all excludeFromTotals app references eliminated
  - phase: 49-dashboard-and-surfaces
    plan: "03"
    provides: remaining subCategory.excludeFromTotals references replaced with direction.included_in_totals
provides:
  - sub_category.exclude_from_totals column removed from schema and database (DATA-06 / D-10 closed)
  - direction.included_in_totals is now the sole source of spending-total exclusion (D-11)
  - Generated migration 0019_lame_layla_miller.sql applied and verified
affects: [dashboard totals, spending aggregation, any future migration referencing sub_category]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Operator-guarded migration: pg_dump snapshot → db:migrate → db:verify (Phase 48 protocol re-applied)"
    - "drizzle-kit generate produces the migration; never drizzle-kit push in production"

key-files:
  created:
    - drizzle/migrations/0019_lame_layla_miller.sql
  modified:
    - lib/db/schema.ts

key-decisions:
  - "D-10/D-11: exclude_from_totals dropped — direction.included_in_totals is the single source of truth for spending-total exclusion (3 transfer slugs + allocation natures map exactly to included_in_totals=false)"
  - "D-12: no hand-written down-migration; rollback path is restore-from-dump (pg_dump snapshot taken before apply)"
  - "Wave 3 sequencing constraint honored: column dropped only after Plans 02+03 confirmed zero app references"

patterns-established:
  - "Schema cleanup: remove dead columns only after all app references are provably gone (grep precondition gate)"

requirements-completed: [DASH-02]

# Metrics
duration: ~2 giorni (multi-sessione con operator checkpoint)
completed: 2026-06-12
---

# Phase 49 Plan 06: Drop exclude_from_totals Column Summary

**Rimossa la colonna `sub_category.exclude_from_totals` dallo schema e dal database via migration 0019; `direction.included_in_totals` è ora l'unica fonte di verità per l'esclusione dai totali di spesa.**

## Performance

- **Duration:** ~2 giorni (task 1 automatico + task 2 operator checkpoint)
- **Started:** 2026-06-11
- **Completed:** 2026-06-12
- **Tasks:** 2
- **Files modified:** 2 (schema.ts + migration generata)

## Accomplishments

- Precondition grep confermata: zero riferimenti ad `excludeFromTotals` in `lib/`, `app/`, `components/` — la sequenza Wave 1→2→3 ha garantito sicurezza del drop
- `excludeFromTotals` rimosso da `lib/db/schema.ts` (tabella `subCategory`) e da tutti i mock di test in `tests/dashboard-dal.test.ts`
- Migration `0019_lame_layla_miller.sql` generata con `yarn db:generate` — singolo `ALTER TABLE "sub_category" DROP COLUMN "exclude_from_totals"`, nessun DDL non intenzionale
- Migrazione applicata dall'operatore con pg_dump snapshot preventivo + `yarn db:migrate` + `yarn db:verify` → ok: true (1 INFO atteso per D-03: sottocategoria user-owned con nature_id null, zero fatal errors)
- `direction.included_in_totals` ora source unica per l'esclusione: transfer (3 slug) + allocation (savings/investment) esclusi semanticamente equivalenti alla precedente logica

## Task Commits

1. **Task 1: Remove excludeFromTotals from schema + clean test mocks, then generate migration** — `2aed322` (chore)
2. **Task 2: Operator-guarded migration apply** — applicata manualmente dall'operatore (nessun commit agente — task di tipo `checkpoint:human-action`)

## Files Created/Modified

- `lib/db/schema.ts` — campo `excludeFromTotals` rimosso dalla tabella `subCategory` pgTable
- `drizzle/migrations/0019_lame_layla_miller.sql` — migration generata: `ALTER TABLE "sub_category" DROP COLUMN "exclude_from_totals"`
- `drizzle/migrations/meta/_journal.json` — aggiornato da drizzle-kit (snapshot + journal entry per 0019)

## Decisions Made

- **D-10/D-11 confermati in esecuzione:** la colonna `exclude_from_totals` era ridondante rispetto a `direction.included_in_totals`; il manifest v2-taxonomy conferma equivalenza semantica esatta
- **D-12 rispettato:** nessuna down-migration scritta a mano; il rollback path è restore-from-dump (pg_dump effettuato prima di applicare)
- **Sequencing constraint Wave 3:** il drop è avvenuto in ultima istanza (Wave 3), dopo che Plans 02+03 avevano rimosso tutti i riferimenti applicativi — vincolo critico rispettato

## Deviations from Plan

Nessuna — piano eseguito esattamente come scritto. La sequenza precondition grep → schema removal → migration generate → operator apply → db:verify ha seguito il flusso pianificato senza deviazioni.

## Issues Encountered

Nessuno. Il `db:verify` ha restituito 1 INFO (sottocategoria user-owned con `nature_id null`) che è comportamento atteso per D-03, documentato nel piano. Zero errori fatali.

## User Setup Required

Nessuno — migrazione applicata dall'operatore, nessuna configurazione aggiuntiva richiesta.

## Next Phase Readiness

- DATA-06 / D-10 chiusi: `sub_category.exclude_from_totals` non esiste più in schema né in DB
- D-11 chiuso: `direction.included_in_totals` è l'unica fonte di esclusione dai totali
- D-12 rispettato: flow operatore con dump preventivo
- Phase 49 Wave 3 completa — tutte le 6 plan di Phase 49 eseguite

---
*Phase: 49-dashboard-and-surfaces*
*Completed: 2026-06-12*

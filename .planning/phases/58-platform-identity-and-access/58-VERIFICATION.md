---
phase: 58-platform-identity-and-access
verified: 2026-06-29T13:20:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 58: platform-identity-and-access — Verification Report

**Phase Goal:** Platform becomes a never-owned, review-gated identity, and a private Import Format is decoupled from a private Platform — so a user's private format can live on a global/approved platform without the system needing to duplicate the platform.
**Verified:** 2026-06-29T13:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | La tabella `platform` non ha colonna `visibility` | ✓ VERIFIED | `lib/db/schema.ts` righe 255–276: nessun campo `visibility` nella definizione pgTable di `platform`. Grep negativo confermato. |
| 2  | `platform.ownerUserId` rinominato in `proposedByUserId` senza perdita dati (true RENAME) | ✓ VERIFIED | `drizzle/migrations/0023_rename_platform_owner.sql` riga 3: `ALTER TABLE "platform" RENAME COLUMN "owner_user_id" TO "proposed_by_user_id"`. Nessun `ADD COLUMN proposed_by_user_id`. |
| 3  | Migration 0023 non contiene `ADD COLUMN proposed_by_user_id` | ✓ VERIFIED | Grep sul file SQL: `NO_ADD_COLUMN` — confermato assenza di ADD COLUMN per la colonna rinominata. |
| 4  | L'indice composito `platform_visibility_reviewStatus_idx` è stato droppato insieme alla colonna | ✓ VERIFIED | `0023_rename_platform_owner.sql` riga 1: `DROP INDEX "platform_visibility_reviewStatus_idx"`. Schema aggiornato: `platform_reviewStatus_idx` (monocolonna) lo sostituisce. |
| 5  | Piattaforma `pending` visibile solo al suo `proposedByUserId` (non ad altri utenti) | ✓ VERIFIED | `accessibleWhere` branch 2 in `lib/dal/import-formats.ts` righe 141–147: `eq(platform.proposedByUserId, userId)`. Test `import-private-formats-dal.test.ts` confirma PASS per proposer, FAIL per altri utenti (16/16 pass). |
| 6  | Piattaforma `approved` visibile a tutti gli utenti | ✓ VERIFIED | Branch 1 di `accessibleWhere` (riga 134–139): `eq(platform.reviewStatus, APPROVED_REVIEW_STATUS)`. Test su formati global-approved: 29/29 passati in `import-detector.test.ts`. |
| 7  | `import_format_version` privato visibile al proprietario su piattaforma approved (decoupling) | ✓ VERIFIED | `isOwnedBy` (righe 88–93): `row.ownerUserId === userId && (platformReviewStatus === approved OR platformProposedByUserId === userId)`. Test caso "owner-on-approved-platform" presente e passato. |
| 8  | `lib/dal/import-formats.ts` e `lib/services/import-format-wizard.ts` zero riferimenti a colonne droppate/rinominate | ✓ VERIFIED | Grep negativo su `platform.visibility`, `platform.ownerUserId`, `platformVisibility`, `platformOwnerUserId` in import-formats.ts: **CLEAN**. Grep negativo su `DRAFT_REVIEW_STATUS`, `'draft'` in import-format-wizard.ts: **CLEAN**. |

**Score:** 8/8 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Dettagli |
|----------|----------|--------|----------|
| `lib/db/schema.ts` | Platform table con `proposedByUserId`, senza `visibility` | ✓ VERIFIED | `proposedByUserId: text("proposed_by_user_id")` presente; nessun campo `visibility` sul platform pgTable. Indici: `platform_proposedByUserId_idx`, `platform_reviewStatus_idx`. `platformRelations.owner.fields: [platform.proposedByUserId]`. |
| `drizzle/migrations/0023_rename_platform_owner.sql` | True RENAME COLUMN, DROP visibility, no ADD COLUMN | ✓ VERIFIED | File presente. Contiene `RENAME COLUMN "owner_user_id" TO "proposed_by_user_id"`, `DROP COLUMN "visibility"`, drop indice composito. Nessun `ADD COLUMN proposed_by_user_id`. |
| `drizzle/migrations/meta/_journal.json` | Entry idx 23 presente | ✓ VERIFIED | Confermato da SUMMARY-01: idx 23 aggiunto. `yarn db:migrate` riporta `migration_succeeded`. |
| `lib/dal/import-formats.ts` | accessibleWhere 2-branch, zero riferimenti a colonne droppate | ✓ VERIFIED | OR a 2 branch: branch 1 (global-approved), branch 2 (format-owner + platform visibility guard). `listPdfImportPlatformNames` usa `isNull(platform.proposedByUserId)`. Nessun riferimento a `platformOwnerUserId`/`platformVisibility`. |
| `tests/import-private-formats-dal.test.ts` | Matrice visibilità owner/non-owner/pending/approved | ✓ VERIFIED | `makeRow` usa `platformProposedByUserId` (no `platformOwnerUserId`/`platformVisibility`). 7 test cases: proprietario su approved, non-proprietario escluso, pending-proposer-only, global-approved per tutti, fail-closed guard. 16/16 PASS. |
| `lib/services/import-format-wizard.ts` | `createPrivateRows` usa `proposedByUserId`, no `visibility` su platform, `reviewStatus: 'pending'` | ✓ VERIFIED | Righe 222–231: `proposedByUserId: input.userId`, `reviewStatus: PENDING_REVIEW_STATUS`. Nessuna riga `visibility` nell'insert platform. `DRAFT_REVIEW_STATUS` rimosso. |
| `tests/import-format-wizard-actions.test.ts` | Assert `proposedByUserId`, `not.toHaveProperty('visibility')`, `reviewStatus: 'pending'` | ✓ VERIFIED | 9/9 test passati. Assert esplicito `not.toHaveProperty('visibility')` presente. |

---

## Key Link Verification

| From | To | Via | Status | Dettagli |
|------|----|-----|--------|----------|
| `accessibleWhere` SQL (branch 2) | `isOwnedBy` in-memory | Devono concordare sul caso pending-platform | ✓ WIRED | SQL: `eq(platform.proposedByUserId, userId)`. In-memory: `row.platformProposedByUserId === userId`. Lockstep confermato. |
| `platformRelations.owner` | `platform.proposedByUserId` | `fields` punta alla nuova colonna | ✓ WIRED | `schema.ts` riga 619: `fields: [platform.proposedByUserId]`. |
| `createPrivateRows` platform insert | `platform.proposedByUserId` | Key dell'insert allineata alla colonna rinominata | ✓ WIRED | `import-format-wizard.ts` riga 225: `proposedByUserId: input.userId` — TypeScript error se la colonna non esistesse. |
| `listPdfImportPlatformNames` | `platform.proposedByUserId` | `isNull(platform.proposedByUserId)` filtra piattaforme globali | ✓ WIRED | Riga 230: `isNull(platform.proposedByUserId)`. |

---

## Behavioral Spot-Checks

| Comportamento | Comando | Risultato | Status |
|---------------|---------|-----------|--------|
| 16 test di fase (visibilità DAL + wizard write-path) | `yarn test tests/import-private-formats-dal.test.ts tests/import-format-wizard-actions.test.ts` | 16/16 PASS — 2 file, 500ms | ✓ PASS |
| Nessun riferimento a colonne droppate nel DAL | `grep -nE 'platform\.visibility\|platform\.ownerUserId\|platformVisibility\|platformOwnerUserId' lib/dal/import-formats.ts` | CLEAN (zero hits) | ✓ PASS |
| Nessun riferimento a `'draft'`/`DRAFT_REVIEW_STATUS` nel wizard | `grep -nE "DRAFT_REVIEW_STATUS\|'draft'" lib/services/import-format-wizard.ts` | CLEAN (zero hits) | ✓ PASS |
| Migration 0023 è true RENAME (no ADD COLUMN) | `grep -E "RENAME COLUMN\|ADD COLUMN.*proposed" drizzle/migrations/0023_rename_platform_owner.sql` | RENAME presente, ADD COLUMN assente | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Descrizione | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLAT-01 | 58-01, 58-03 | Platform never-owned: `visibility` drop, `ownerUserId`→`proposedByUserId`, migration 0023 via scripts/migrate.ts | ✓ SATISFIED | Schema aggiornato; migration 0023 RENAME COLUMN confermato; wizard usa `proposedByUserId` e `reviewStatus:'pending'` |
| PLAT-02 | 58-02 | Pending platform visibile solo al proposer | ✓ SATISFIED | `accessibleWhere` branch 2 + `isOwnedBy` guard su `proposedByUserId`; test pending-platform-proposer-only passato |
| PLAT-03 | 58-02 | Approved platform visibile a tutti; format privato visibile al proprietario su approved platform | ✓ SATISFIED | Branch 1 (global-approved) invariato; `isOwnedBy` decoupled da platform visibility; 36/36 test passati (incluendo 29 seeded formats) |

---

## Anti-Patterns Found

| File | Riga | Pattern | Severità | Impatto |
|------|------|---------|----------|---------|
| — | — | Nessuno | — | — |

Nessun `TBD`, `FIXME`, `XXX` nei file modificati dalla fase. `yarn check:language` segnala pre-existing failures in `lib/dal/expenses.ts:82` e `lib/dal/transactions.ts:200` — fuori scope, loggati in `deferred-items.md`.

---

## Success Criteria (ROADMAP)

| # | Criterio | Status | Evidence |
|---|----------|--------|----------|
| SC1 | Platform senza `visibility`, `proposedByUserId` sostituisce `ownerUserId`, migrazione senza perdita dati via drizzle-kit generate + scripts/migrate.ts | ✓ VERIFIED | Migration 0023 con RENAME COLUMN; schema aggiornato; `yarn db:migrate` completato con `migration_succeeded` |
| SC2 | Platform `pending` visibile solo al suo `proposedByUserId`; `approved` visibile a tutti | ✓ VERIFIED | accessibleWhere 2-branch; test visibilità 16/16 |
| SC3 | `import_format_version` privato visibile al proprietario anche su piattaforma approved | ✓ VERIFIED | isOwnedBy decoupled; test owner-on-approved-platform passato |
| SC4 | Formati globali esistenti immutati (nessuna regressione) | ✓ VERIFIED | import-detector.test.ts: 29/29 formati seeded risolti correttamente |

---

## Human Verification Required

Nessuna voce — tutti i criteri sono stati verificati in modo automatico o tramite test unitari.

---

## Gaps Summary

Nessun gap. Tutti gli 8 must-haves sono verificati, i 3 requisiti soddisfatti, i 4 Success Criteria del ROADMAP confermati, 16/16 test della fase passati.

---

_Verified: 2026-06-29T13:20:00Z_
_Verifier: Claude (gsd-verifier)_

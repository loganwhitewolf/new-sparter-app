---
phase: 57-pdf-import-trade-republic
plan: "05"
subsystem: import-pipeline
status: complete
tags: [error-ux, pdf-import, tdd, gap-closure]
requirements: [PDF-02]
completed_date: "2026-06-26"
metrics:
  duration: "3 minutes"
  tasks_completed: 1
  files_modified: 6
dependency_graph:
  requires: [57-04]
  provides: [user-friendly-unrecognized-pdf-error]
  affects: [lib/actions/import.ts, lib/dal/import-formats.ts]
tech_stack:
  added: []
  patterns:
    - stable error code emitted by parser, intercepted and enriched by action layer
    - allowlist co-located with dispatch (PDF_IMPORT_PLATFORM_SLUGS)
    - injectable database parameter for DAL testability
key_files:
  created: []
  modified:
    - lib/services/trade-republic-pdf-parser.ts
    - lib/services/import-parsers.ts
    - lib/dal/import-formats.ts
    - lib/actions/import.ts
    - tests/trade-republic-pdf-parser.test.ts
    - tests/import-actions.test.ts
decisions:
  - UNRECOGNIZED_PDF_FORMAT is both the machine-readable code (detected by action) and an Italian fallback string — single constant, no separate enum
  - PDF_IMPORT_PLATFORM_SLUGS co-located with .pdf dispatch in import-parsers.ts as single source of truth
  - No fileType column on import_format_version — allowlist approach avoids scope creep (plan constraint honored)
  - Minimal valid PDF buffer used in test instead of plain text — plain text fails at PDF open before reaching marker check
---

# Phase 57 Plan 05: Error UX for Unrecognized PDF Summary

Chiusura del gap UAT Test 5 (severity minor): il messaggio di errore tecnico in inglese che esponeva i marker interni (`TRADE REPUBLIC` / `TRANSAZIONI SUL CONTO`) viene sostituito con un messaggio user-friendly in italiano che elenca le piattaforme PDF supportate.

## What Was Built

Parser emette costante stabile `UNRECOGNIZED_PDF_FORMAT` (italiano generico, nessun marker interno) → `analyzeImportAction` intercetta la costante → chiama `listPdfImportPlatformNames()` → costruisce messaggio arricchito con la lista piattaforme.

Nessuna migration, nessun cambio schema, nessun seed.

## Tasks

| # | Task | Commit | Type |
|---|------|--------|------|
| RED | Failing tests: UNRECOGNIZED_PDF_FORMAT + enriched message | bf00a24 | test |
| GREEN | Implementation: parser constant + allowlist + DAL + action | cacadf6 | feat |

## Implementation Details

### 1. Parser (`lib/services/trade-republic-pdf-parser.ts`)

Esportata nuova costante:
```ts
export const UNRECOGNIZED_PDF_FORMAT =
  'Il file PDF non è stato riconosciuto come formato supportato.'
```

Sostituito il ramo `missingMarkers` che costruiva un messaggio inglese con `missingMarkers.join(', ')` con:
```ts
return errorResult([UNRECOGNIZED_PDF_FORMAT])
```

### 2. Allowlist (`lib/services/import-parsers.ts`)

```ts
export const PDF_IMPORT_PLATFORM_SLUGS = ['trade-republic'] as const
```

Co-locata con il dispatch `.pdf`. Aggiungere qui ogni nuova banca PDF.

### 3. DAL (`lib/dal/import-formats.ts`)

Nuova funzione `listPdfImportPlatformNames()`: query su `platform INNER JOIN importFormatVersion` filtrata per `PDF_IMPORT_PLATFORM_SLUGS`, deduplicata e ordinata. Parametro `database` iniettabile per test.

### 4. Action (`lib/actions/import.ts`)

In `analyzeImportAction`, nel ramo `errors.length > 0`: se `errors[0] === UNRECOGNIZED_PDF_FORMAT`, chiama `listPdfImportPlatformNames()` e costruisce:
> "Il file PDF non è stato riconosciuto. Le piattaforme supportate per l'import PDF sono: Trade Republic."

Tutti gli altri errori passano verbatim (comportamento invariato).

## Verification

```
yarn vitest run tests/trade-republic-pdf-parser.test.ts tests/import-actions.test.ts
→ 59 tests passed
```

`yarn check:language` — nessun problema nei file modificati (2 violazioni pre-esistenti in `dal/expenses.ts` e `dal/transactions.ts`, fuori scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Minimal valid PDF buffer nel test del parser**

- **Found during:** Task 1 (fase GREEN)
- **Issue:** Il test originale usava `Buffer.from('This is not a Trade Republic PDF document')` come PDF fake. `unpdf.getDocumentProxy()` lancia `Invalid PDF structure` prima di raggiungere il check dei marker — il test non poteva mai asserire su `UNRECOGNIZED_PDF_FORMAT`.
- **Fix:** Sostituito con un buffer PDF minimo valido (`%PDF-1.0` + struttura xref completa) che `unpdf` apre correttamente ma che non contiene i marker TR.
- **Files modified:** `tests/trade-republic-pdf-parser.test.ts`
- **Commit:** cacadf6 (incluso nel commit GREEN assieme all'implementazione)

## Known Stubs

Nessuno — la funzione `listPdfImportPlatformNames()` è completamente cablata al DB; il messaggio è costruito con dati reali letti dalla query.

## Threat Flags

Nessun nuovo threat surface introdotto. Le mitigazioni T-57-05-01 e T-57-05-02 del threat model del piano sono implementate:
- T-57-05-01: il messaggio non espone marker interni (asserito da test negativi su 'TRANSAZIONI' e 'appear')
- T-57-05-02: solo `platform.name` (dato pubblico di prodotto) incluso nel messaggio; nessun id, slug o diagnostica

## Self-Check: PASSED

- lib/services/trade-republic-pdf-parser.ts: FOUND
- lib/services/import-parsers.ts: FOUND
- lib/dal/import-formats.ts: FOUND
- lib/actions/import.ts: FOUND
- tests/trade-republic-pdf-parser.test.ts: FOUND
- tests/import-actions.test.ts: FOUND
- Commit bf00a24: FOUND
- Commit cacadf6: FOUND

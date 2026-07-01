# Phase 59: import-wizard-attach-format - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 59-import-wizard-attach-format
**Areas discussed:** Struttura del wizard, Entry point crea nuova platform, Scope delle modifiche al backend

---

## Struttura del wizard

| Option | Description | Selected |
|--------|-------------|----------|
| Due step distinti | Step 1 selezione platform, step 2 colonne. Componente gestisce currentStep client-side. | ✓ |
| Un'unica form con sezione condizionale | Radio in cima, lista o campo nome compaiono/scompaiono. Un solo submit. | |
| Platform picker come Select con sentinel | platformName diventa Select con "Crea nuova" come opzione sentinel. | |

**User's choice:** Due step distinti

| Option | Description | Selected |
|--------|-------------|----------|
| Stato interno del componente wizard | useState per currentStep, unica route /configure, URL stabile. | ✓ |
| Route separata per lo step 1 | Step 1 su /configure/platform, step 2 su /configure/columns, searchParam per passare la scelta. | |

**User's choice:** Stato interno del componente wizard

| Option | Description | Selected |
|--------|-------------|----------|
| Precaricata dalla page RSC | Page esegue listAttachablePlatforms server-side e passa come prop. Zero waterfall. | ✓ |
| Fetchata client-side al mount | Componente fa un action call per le platform. Aggiunge loader in step 1. | |

**User's choice:** Precaricata dalla page RSC

---

## Entry point crea nuova platform

| Option | Description | Selected |
|--------|-------------|----------|
| Voce sempre visibile in fondo alla lista | Radio list + riga "+ Crea nuova platform" sempre in fondo, selezionando compare inline il campo nome. | ✓ |
| Pulsante separato fuori dalla lista | Button "Crea nuova" alternativo alla lista, porta a step 2 con campo nome lì. | |
| Fallback automatico se lista vuota | "Crea nuova" solo se lista vuota, altrimenti non presentato come opzione esplicita. | |

**User's choice:** Voce sempre visibile in fondo alla lista

| Option | Description | Selected |
|--------|-------------|----------|
| Campo platformName nello step 1 inline | Input nome compare sotto la riga "Crea nuova" nello step 1 stesso. | ✓ |
| Campo platformName portato allo step 2 | Selezionare "Crea nuova" porta allo step 2 che mostra il campo nome in cima. | |

**User's choice:** Campo platformName inline nello step 1

| Option | Description | Selected |
|--------|-------------|----------|
| Mostra il nome come header/subtitle dello step 2 | "Configura il formato per [NomePlatform]" in testata dello step 2 (read-only). | ✓ |
| Nessun riferimento al nome in step 2 | Step 2 identico sia per attach che per create, nessun riepilogo platform. | |

**User's choice:** Mostra il nome come header/subtitle dello step 2

---

## Scope delle modifiche al backend

| Option | Description | Selected |
|--------|-------------|----------|
| Un parametro opzionale existingPlatformId | createPrivateImportFormat aggiunge existingPlatformId?: number. Due branch interni. | ✓ |
| Due funzioni separate | attachImportFormat() e createPlatformAndFormat() distinte, action instrada. | |

**User's choice:** Un parametro opzionale existingPlatformId

| Option | Description | Selected |
|--------|-------------|----------|
| Tutte le approved + le proprie pending | WHERE reviewStatus = 'approved' OR (reviewStatus = 'pending' AND proposedByUserId = userId) | ✓ |
| Solo le approved (globali) | Solo platform con reviewStatus = 'approved', esclude le proprie pending. | |

**User's choice:** Tutte le approved + le proprie pending

| Option | Description | Selected |
|--------|-------------|----------|
| Nuova funzione in lib/dal/import-formats.ts | listAttachablePlatforms(userId) nello stesso file di accessibleWhere. | ✓ |
| Nuova funzione in lib/dal/platforms.ts | File DAL dedicato per le query platform. | |

**User's choice:** lib/dal/import-formats.ts

---

## Claude's Discretion

- Ordine platform nella lista step 1 (alfabetico per nome o slug).
- Comportamento edge quando la lista platform è vuota (prima del seed o DB vergine).
- Stile esatto della riga "Crea nuova platform" nello step 1 (icona, radio vs outline button).

## Deferred Ideas

- Operator approval UI (platform pending → approved) — deferred per single-user (ADR 0015).
- Search/autocomplete nella lista platform — non necessario per < 20 entry.
- Seed slug-linkage e Trade Republic id-8 fix → Phase 60.
- DescriptionStripPattern docs correction → Phase 60.

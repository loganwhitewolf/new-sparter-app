# Phase 64: file-detail-and-navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 64-file-detail-and-navigation
**Areas discussed:** Transazioni del file, Semantica click-riga, Breadcrumb e back, File in stati intermedi

---

## Transazioni del file

| Option | Description | Selected |
|--------|-------------|----------|
| Preview + link | Card con le prime ~10–20 transazioni + link "Vedi tutte" verso /transactions filtrata per file | ✓ |
| Tabella completa inline | Tutte le transazioni con paginazione propria nella pagina | |
| Solo link alla tabella | Nessuna lista inline, solo link alla tabella filtrata | |

**User's choice:** Preview + link (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Set completo | Piattaforma, formato, data import, righe totali/importate/duplicate/errori, periodo coperto, totale importi | ✓ |
| Set minimo | Solo piattaforma, formato, data import, numero transazioni | |
| Decidi tu | In base a cosa il DAL espone già | |

**User's choice:** Set completo (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Come D-09 | 1–2 azioni visibili (Scarica, Suggerimenti), resto nel menu ⋯, Elimina destructive nel menu, delete → /import con toast | ✓ |
| Tutte visibili | Download, Suggerimenti, Elimina come bottoni header | |
| Decidi tu | Segui le row-actions della tabella import | |

**User's choice:** Come D-09 (recommended)

---

## Semantica click-riga

| Option | Description | Selected |
|--------|-------------|----------|
| Solo il titolo | Il testo del titolo/nome è link al dettaglio; matita/checkbox/celle interattive invariate | ✓ |
| Riga intera | Click ovunque naviga, con stopPropagation sui controlli | |
| Riga intera tranne celle interattive | Compromesso | |

**User's choice:** Solo il titolo (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Pagina dettaglio file | Il nome file in tabella transazioni punta a /import/[fileId] | ✓ |
| Mantieni filtro tabella | Resta /import?file=… | |

**User's choice:** Pagina dettaglio file (recommended)
**Notes:** Voci menu "Dettagli": tx e spese già fatte in 63-04; si aggiunge solo alla tabella import.

---

## Breadcrumb e back

| Option | Description | Selected |
|--------|-------------|----------|
| Solo back link | Back link nel DetailPageShell, nessun breadcrumb multi-livello | ✓ |
| Breadcrumb vero | Componente breadcrumb su tutte e tre le pagine | |
| Breadcrumb solo cross-entity | Back link + breadcrumb quando si arriva da altra pagina dettaglio | |

**User's choice:** Solo back link (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| router.back() smart | History del browser quando si arriva dalla tabella (filtri intatti), fallback statico altrimenti | ✓ |
| Link statico semplice | Sempre tabella base senza query params | |
| Decidi tu | Segui il DetailPageShell di fase 63 | |

**User's choice:** router.back() smart (recommended)
**Notes:** Si applica al shell condiviso → retrofit anche sulle pagine tx/spese di fase 63 (back coerente DET-09).

---

## File in stati intermedi

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect allo step giusto | Dettaglio solo per 'imported'; altri stati → redirect al wizard (analyze/configure); 'failed' gestito dalla tabella | ✓ |
| Pagina per tutti gli stati | Card di stato + CTA contestuale per ogni stato | |
| Pagina solo imported + failed | Dettaglio anche per failed, redirect per gli intermedi | |

**User's choice:** Redirect allo step giusto (recommended)

## Claude's Discretion

- Numero esatto di righe preview (10 vs 20) e ordinamento card nello shell.
- Statistiche: preferire query esistenti, non inventare campi non esposti dal DAL.
- Presentazione di "Suggerimenti" quando non ci sono suggerimenti pendenti.
- Mapping esatto redirect per stato non-imported (seguire il routing wizard esistente).
- Loading/skeleton e 404/ownership (pattern /import/[fileId]/suggestions).

## Deferred Ideas

None — discussion stayed within phase scope.

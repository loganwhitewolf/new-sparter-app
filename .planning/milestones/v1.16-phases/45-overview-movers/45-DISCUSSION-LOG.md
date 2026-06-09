# Phase 45: overview-movers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 45-overview-movers
**Areas discussed:** Panel placement, Visibilità iniziale del panel, Trigger MOVE-05

---

## Panel Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline sotto il chart | Card/sezione fissa dopo il chart, aggiornata al cambio mese. Sempre visibile dal caricamento. Layout lineare. | ✓ |
| Bottom drawer (vaul Sheet) | Si apre dal basso come il subcategory picker. Buono su mobile ma contrasta con MOVE-04. | |
| Aside / right panel | Pannello laterale su desktop. Cambio di layout a due colonne, pattern non esistente nell'app. | |

**User's choice:** Inline sotto il chart
**Notes:** Nessuna nota aggiuntiva.

---

### Panel heading e struttura

| Option | Description | Selected |
|--------|-------------|----------|
| Titolo mese + due sezioni | Card con heading "Maggio 2025 vs Aprile 2025", sezione rossa "Dove hai speso di più" e sezione verde "Dove hai risparmiato". Sezioni vuote nascoste (MOVE-02). | ✓ |
| Solo le due sezioni | Nessun heading, parte direttamente con i due gruppi. | |

**User's choice:** Titolo mese + due sezioni

---

## Visibilità iniziale del panel

| Option | Description | Selected |
|--------|-------------|----------|
| Visibile dal caricamento | Server pre-fetcha movers per l'ultimo mese con dati, passa come prop al client. Nessuna latenza al primo render. Coerente con MOVE-04. | ✓ |
| Appare al primo click | Panel nascosto al caricamento; Server Action al click. Più semplice ma overview "incompleta" finché l'utente non interagisce. | |

**User's choice:** Visibile dal caricamento

---

### Fetch al cambio mese

| Option | Description | Selected |
|--------|-------------|----------|
| Server Action al click | Client chiama `getMoversAction(year, monthIndex)` con `useTransition`. URL invariato. Pattern già usato nel progetto. | ✓ |
| URL param `?month=` | Click aggiorna URL, server ri-fetcha tutto. URL shareable ma re-render completo ad ogni click. | |

**User's choice:** Server Action al click

---

### Determinazione del default month index

| Option | Description | Selected |
|--------|-------------|----------|
| Server lo calcola e lo passa come prop | `OverviewDataSection`: trova il più alto indice con income+out > 0. Deterministico, nessuna logica client extra. | ✓ |
| Client lo deriva dall'array data | `OverviewChart` calcola da sé l'ultimo mese non-zero. Logica client, semplice. | |

**User's choice:** Server lo calcola e lo passa come prop

---

## Trigger dell'empty state (MOVE-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Movers array vuoto E movers con isNew=true mostrati normalmente | Empty state = array vuoto. "Spesa nuova" (isNew: true) è un mover valido, mostrato nella sezione rossa. | ✓ |
| Quando `getMonthOverMonthCategoryChanges` restituisce array vuoto | Empty state = zero movers qualunque sia la causa (under noise floor, first month, ecc.). | |
| Quando è il primo mese storico dell'utente | Richiede query extra o info aggiuntiva dal server. | |

**User's choice:** Array vuoto = empty state; isNew items = mostrati normalmente

---

### Contenuto dell'empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Messaggio contestuale | Es. "Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15." Semplice, in linea con il tono del prodotto. | ✓ |
| Icona + titolo + sottotitolo | Empty state elaborato con icona. Simile agli empty state delle altre sezioni. | |

**User's choice:** Messaggio contestuale

---

## Claude's Discretion

- Nome esatto del componente movers panel
- File del Server Action (`lib/actions/overview.ts` o nuovo file)
- Loading state durante il Server Action call
- Numero di movers mostrati (default DAL = 10)
- Test coverage per il formatter umanizzato

## Deferred Ideas

- Limit parameter esposto come config utente
- Selettore "Top N" nel movers panel
- FlowNature chart filters (FILT-01..03) → Phase 44 già shippata

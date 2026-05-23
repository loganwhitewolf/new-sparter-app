# Phase 36: post-import-reanalysis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 36-post-import-reanalysis
**Areas discussed:** Entry point, Empty state, Copy SCOP-03, Visibilità CTA

---

## Entry point e route

| Option | Description | Selected |
|--------|-------------|----------|
| Bottone primario + nuova pagina | CTA primaria in ImportRowActions per status='imported', link a /import/[fileId]/suggestions. Pattern coerente con "Analizza" e "Rivedi e importa". | |
| Solo nel dropdown delle azioni | DropdownMenuItem nel menu a tre puntini, affianco a "Vedi transazioni". Meno prominente, ma meno invasivo nel layout. | ✓ |
| Pagina accessibile da "Vedi transazioni" | Link/banner nella transaction list. Richiede navigazione extra. | |

**User's choice:** Solo nel dropdown delle azioni
**Notes:** Meno invasivo — l'utente che vuole fare re-analysis sa dove cercare nel menu azioni.

---

## Empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Messaggio inline semplice | Testo muted-foreground: "Nessun suggerimento trovato — tutte le transazioni risultano già categorizzate o non ci sono pattern ricorrenti." | ✓ |
| Card con CTA a /settings/categories | Empty state con card che invita a creare pattern manualmente. Più guidato ma più verboso. | |
| Redirect a /import con toast | Redirect silenzioso se suggestions = []. | |

**User's choice:** Messaggio inline semplice
**Notes:** Coerente con lo stile minimal del progetto.

---

## Copy SCOP-03

| Option | Description | Selected |
|--------|-------------|----------|
| Sottotitolo di pagina esplicito | "Crea pattern per categorizzare automaticamente transazioni simili nelle prossime importazioni." Bottone rimane "Crea pattern". | ✓ |
| Nota informativa inline per ogni card | Ogni card con nota "Creare il pattern non modifica le transazioni già importate." Più ridondante. | |
| Decidilo tu | Copia esatta a discrezione, evitare "ricategorizza" / "applica a esistenti". | |

**User's choice:** Sottotitolo di pagina esplicito
**Notes:** Chiaro a livello di pagina, non ridondante per ogni card.

---

## Visibilità CTA

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre per status='imported' | Sempre visibile per tutti i file importati. Nessuno stato aggiuntivo in ImportListRow. | ✓ |
| Solo se l'import originale aveva suggestion | Richiede salvataggio in DB del conteggio suggestion. Aggiunge complessità. | |
| Decidilo tu | Scelta tecnica al planner. | |

**User's choice:** Sempre per status='imported'
**Notes:** Più semplice da implementare — nessun campo aggiuntivo nel DB o nella query.

---

## Claude's Discretion

- Icona/label esatta del DropdownMenuItem
- Titolo h1 della pagina
- Struttura interna della DAL query (join vs subquery)
- Se usare `loadActivePatterns` direttamente nel server component o in un service helper

## Deferred Ideas

- REVAL-01: Applicare il pattern creato post-import alle transazioni esistenti → Future Requirements (già in REQUIREMENTS.md)
- GLOBAL-01: Suggestion su tutta la storia delle transazioni → Out of scope v1.10

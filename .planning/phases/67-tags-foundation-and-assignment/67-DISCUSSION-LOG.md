# Phase 67: tags-foundation-and-assignment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 67-tags-foundation-and-assignment
**Areas discussed:** Tag list surface & rules, Bulk-assign semantics, Date-range suggestion flow, Viaggi/vacanze audit depth
**Language:** discussion conducted in Italian at user request.

---

## Tag list surface & rules (TAG-01)

### Superficie della lista tag
| Option | Description | Selected |
|--------|-------------|----------|
| /settings/tags | Coerente con /settings/categories | ✓ |
| /tags in sidebar | Sezione top-level; anticipa la Tag section di Phase 68 | |
| Inline nelle transazioni | Rischio degenerazione lista curata | |

### Gestione nome duplicato/collisione
| Option | Description | Selected |
|--------|-------------|----------|
| Unique case-insensitive, blocca | Nome univoco per utente, duplicato → errore | ✓ |
| Warn ma permetti | Avvisa ma lascia procedere | |
| Nessun vincolo | Duplicati liberi | |

### Cosa è modificabile in modifica tag
| Option | Description | Selected |
|--------|-------------|----------|
| Nome + intervallo date | Entrambi editabili; cambio range non ri-suggerisce auto | ✓ |
| Solo nome, range immutabile | Range fissato alla creazione | |

**User's choice:** /settings/tags · nome unique case-insensitive (blocca) · nome+range editabili.
**Notes:** Cambiare il range non ri-esegue il suggerimento (atto esplicito) ma vale per import futuri.

---

## Bulk-assign semantics (TAG-02)

### Additivo o sostitutivo
| Option | Description | Selected |
|--------|-------------|----------|
| Additiva (union) | I tag scelti si aggiungono agli esistenti | ✓ |
| Sostitutiva (replace) | Il set scelto rimpiazza i tag esistenti | |

### Rimozione tag in bulk
| Option | Description | Selected |
|--------|-------------|----------|
| Sì, stesso dialog | Il dialog offre anche rimozione tag in bulk | ✓ |
| No, solo assegnazione | Rimozione solo per singola transazione | |

### Dove vede i tag correnti di una transazione
| Option | Description | Selected |
|--------|-------------|----------|
| Chip in riga + detail page | Chip nella riga + sezione tag nel dettaglio (rimozione lì) | ✓ |
| Solo detail page | Tag solo nella pagina di dettaglio | |
| Chip in riga (sola lettura) | Chip solo per vederli; add/remove sul detail | |

**User's choice:** additiva (union) · bulk-untag nello stesso dialog · chip in riga + detail page.

---

## Date-range suggestion flow (TAG-03)

### Dove appare la proposta dopo un import
| Option | Description | Selected |
|--------|-------------|----------|
| Blocco nel riepilogo import | Nella schermata post-import esistente (accanto ai pattern-suggestions) | ✓ |
| Dialog/nudge separato | Dialog dedicato dopo l'import | |

### Dedup a ogni import
| Option | Description | Selected |
|--------|-------------|----------|
| Solo non ancora taggate | Propone solo le transazioni nel range senza quel tag | ✓ |
| Tutte nel range | Ripropone tutte ogni volta | |

### Regola di match
| Option | Description | Selected |
|--------|-------------|----------|
| Solo data nel range | Data transazione in [inizio, fine] inclusivo | ✓ |
| Data + euristiche | Data + segnali (valuta/merchant) — territorio AI (TAG-F01) | |

**User's choice:** blocco nel riepilogo import · solo non-ancora-taggate · match solo su data (inclusivo).

---

## Viaggi/vacanze audit depth (TAG-06)

### Quali sottocategorie di vacanze restano
| Option | Description | Selected |
|--------|-------------|----------|
| Tieni le 3 intrinseche | alloggio/trasporto/assicurazione viaggio; rimuovi cibo-e-bevande + attività | ✓ (via review) |
| Tieni 3 + rinomina | Come sopra + rinomina agli slug del note | |
| Da rivedere insieme | Revisione caso per caso | ✓ (richiesto, poi confermato le 3) |

### Cosa succede alle transazioni esistenti nelle sottocat rimosse
| Option | Description | Selected |
|--------|-------------|----------|
| Rimetti in 'da categorizzare' | Transazioni tornano non categorizzate; ri-assegnazione manuale corretta | ✓ |
| Auto-rimappa best-effort | Sposta cibo→Ristorazione, attività→Cultura con default | |
| Non toccare lo storico | Solo regole future, storico invariato | |

### Aggiornamento regole regex + AI
| Option | Description | Selected |
|--------|-------------|----------|
| Sì, regex + prompt AI | Aggiorna pattern seed + regole categorizzatore AI | ✓ |
| Solo regex ora | Rimanda le regole AI | |

**User's choice:** tieni alloggio/trasporto/assicurazione viaggio, disattiva attivita-e-intrattenimento + cibo-e-bevande · esistenti → da categorizzare · regex + prompt AI entrambi in scope.
**Notes:** Verdetto confermato caso per caso dopo revisione della lista completa delle 5 sottocategorie.

---

## Claude's Discretion

- Schema esatto di `tag` + `transaction_tag` (colonne vincolate da D-01..D-04).
- Controllo multi-select per l'assegnazione: bottom-sheet (come SubcategoryPicker) vs multi-select leggero.
- Chip di riga direttamente rimovibili vs sola-lettura con rimozione sul detail page.
- Copy prodotto in italiano per tutte le superfici tag.

## Deferred Ideas

- AI tagging pass (TAG-F01) — post-stabilizzazione.
- Person/"per chi" tag family (TAG-F02) — supportata dalla meccanica, non promossa.
- Dashboard tag-filter (TAG-04), Tag section con totali per-tag (TAG-05), navigazione dashboard→transazioni (NAV-01) — Phase 68.
- Tag di stato/rimborso e comportamentali — fuori scope permanente (coperti da pairing + Standalone Expense, ADR 0016).

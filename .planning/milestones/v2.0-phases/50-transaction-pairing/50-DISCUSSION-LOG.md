# Phase 50: transaction-pairing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 50-transaction-pairing
**Areas discussed:** Modello dati pairing, Entry point UX, Picker della controparte, Indicatore visivo nel list

---

## Modello dati pairing

### Cardinalità

| Option | Description | Selected |
|--------|-------------|----------|
| 1:1 strict | Un'unica transazione opposta per pairing. Copre il 95% dei casi d'uso. Schema e UX più semplici. | ✓ |
| 1:N from the start | Una transazione può avere più controparti (rimborsi parziali). Schema più complesso. | |

**User's choice:** 1:1 strict

---

### Storage schema

| Option | Description | Selected |
|--------|-------------|----------|
| Tabella join `transaction_pair` | Due FK `(transaction_a_id, transaction_b_id)`, unique constraint su entrambe. Simmetrico. | ✓ |
| Self-referential FK su transaction | Aggiunge `paired_with_id` nullable su `transaction`. Asimmetrico. | |
| Tu decidi | Lascia la scelta al planner. | |

**User's choice:** Tabella join `transaction_pair`

---

### Scope del pair

| Option | Description | Selected |
|--------|-------------|----------|
| Stesso utente, qualsiasi file | Link tra transazioni `userId`-scoped, indipendentemente dal file di import. | ✓ |
| Stesso utente e stesso file | Restrizione più forte; raramente utile. | |

**User's choice:** Stesso utente, qualsiasi file

---

### Cancellazione di una transazione accoppiata

| Option | Description | Selected |
|--------|-------------|----------|
| CASCADE sul pair | La riga `transaction_pair` viene cancellata automaticamente. | ✓ |
| RESTRICT / errore | La cancellazione è bloccata finché il pairing non viene rimosso manualmente. | |

**User's choice:** CASCADE

---

### Impatto sulle expenses al momento del pair

| Option | Description | Selected |
|--------|-------------|----------|
| No — pairing puro | Il link esiste solo nella `transaction_pair`. Le expense restano invariate. | ✓ |
| Sì — suggerisce ricategorizzazione | Al momento del link, propone di assegnare al rimborso la stessa subcategory della spesa originale. | |

**User's choice:** No — pairing puro

**Notes:** Discussione chiave emersa organicamente. L'utente ha sollevato il caso "ricarica da Marco" — la stessa expense (stesso descriptionHash) copre sia rimborsi cena che contributi regalo. Il modello expense non può distinguere i due contesti. Quindi il pairing a livello transaction è l'unica fonte di verità per la distinzione. Questo ha portato alla decisione successiva sul dashboard.

---

### Dashboard-aware pairing

| Option | Description | Selected |
|--------|-------------|----------|
| No — solo transaction list | La pair è un'annotazione visiva; dashboard rimane sul modello algebraic-sum per direction. | |
| Sì — dashboard-aware | Le query di aggregazione joinano `transaction_pair` e trattano le coppie come unità nette. | ✓ |

**User's choice:** Dashboard-aware

**Notes:** L'utente ha identificato che con "pairing puro" la stessa expense "ricarica da Marco" usata da transazioni diverse (rimborso cena vs regalo) avrebbe lasciato entrambe visibili come IN nel dashboard, rendendo il netting impossibile senza ricategorizzazione manuale. La dashboard-aware pairing risolve questo: la secondaria (rimborso) esce dai totali IN; il netto entra nell'OUT del mese della primaria.

---

### Transazione primaria (determina direction e mese nel dashboard)

| Option | Description | Selected |
|--------|-------------|----------|
| Quella con importo assoluto maggiore | Euristicamente la spesa originale. Il sistema calcola automaticamente. | ✓ |
| Quella che l'utente sceglie come 'origine' | L'utente indica esplicitamente chi è l'ordine al momento della creazione del pair. | |

**User's choice:** Importo assoluto maggiore

---

### Scope del netting nel dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Tutto — grafici + KPI | Netting consistente ovunque: aggregazioni mensili, KPI, trend. | ✓ |
| Solo KPI totali | I grafici mostrano transazioni singole; i KPI mostrano i netti. | |

**User's choice:** Tutto — grafici + KPI

---

### Mese di attribuzione del netto

| Option | Description | Selected |
|--------|-------------|----------|
| Mese della transazione principale | Il netto appare nel mese della spesa originale. Il rimborso "sparisce" dal suo mese. | ✓ |
| Mese del rimborso | Il netto appare nel mese del rimborso. | |
| Spalmato (un mese ciascuno) | Nessun netting cross-month; le transazioni mantengono il loro mese. | |

**User's choice:** Mese della transazione principale

---

## Entry point UX

### Trigger per la creazione del pair

| Option | Description | Selected |
|--------|-------------|----------|
| Azione in riga nella transaction list | Bottone/icona 'Collega rimborso' nel dropdown azioni di ogni riga. | ✓ |
| Nel form dialog della transazione | Il TransactionFormDialog ottiene una sezione 'Pairing'. | |
| Entrambi i punti | Azione rapida in riga + sezione nel dialog. | |

**User's choice:** Azione in riga nella transaction list

---

### Da quale transazione si avvia il pair

| Option | Description | Selected |
|--------|-------------|----------|
| Solo dalla transazione principale | L'utente apre le azioni della spesa (€-100) e seleziona il rimborso. | ✓ |
| Da qualsiasi delle due transazioni | Sia la spesa che il rimborso hanno l'azione 'Collega'. | |

**User's choice:** Solo dalla transazione principale (ma il sistema swappa i ruoli silenziosamente se l'utente parte dalla secondaria)

---

### Trigger per l'unlink (PAIR-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Azione in riga sulla transazione già accoppiata | 'Scollega' sostituisce 'Collega rimborso' sulle righe già paired. | ✓ |
| Solo dall'indicatore visivo sul pair | L'utente clicca il badge del pair per trovare l'unlink. | |

**User's choice:** Azione in riga

---

## Picker della controparte

### Superficie del picker

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog/modal con lista ricercabile | Coerente con TransactionFormDialog. | ✓ |
| Bottom sheet (vaul) | Come il SubcategoryPicker. | |

**User's choice:** Dialog/modal

---

### Pre-filtro della lista

| Option | Description | Selected |
|--------|-------------|----------|
| Segno opposto + range di date configurabile | Pre-filtra transazioni con segno opposto. Range default: ±90 giorni. | ✓ |
| Solo segno opposto, senza filtro data | Potenzialmente molte righe su account attivi. | |
| Auto-suggest: importo uguale e segno opposto | Propone in cima le transazioni con |amount| simile. | |

**User's choice:** Segno opposto + range di date configurabile (±90 giorni default)

---

### Transazioni già accoppiate nel picker

| Option | Description | Selected |
|--------|-------------|----------|
| No — solo non accoppiate | Esclude le transazioni che hanno già un pair. | ✓ |
| Sì — mostra tutte con badge | Mostra tutte ma indica quelle già accoppiate. | |

**User's choice:** No — solo non accoppiate

---

## Indicatore visivo nel list

### Come appaiono le righe accoppiate

| Option | Description | Selected |
|--------|-------------|----------|
| Righe indipendenti con badge/chip link | Ogni riga mantiene la sua posizione cronologica. Badge 'Collegata' con importo netto. | ✓ |
| Righe raggruppate visivamente | Le due righe vengono messe adiacenti con connettore. Rompe l'ordinamento cronologico. | |
| Riga collassata con expand | Le due transazioni diventano una sola riga netta con toggle. | |

**User's choice:** Righe indipendenti con badge/chip link

---

### Contenuto del badge

| Option | Description | Selected |
|--------|-------------|----------|
| Icona + importo netto | Es. 🔗 €-50. Rende visibile subito l'effetto economico. | ✓ |
| Solo icona link | Es. 🔗 senza importo. Richiede click per capire l'effetto. | |

**User's choice:** Icona + importo netto

---

### Click sul badge

| Option | Description | Selected |
|--------|-------------|----------|
| Popover con dettaglio della controparte | Descrizione, importo, data, netto, link 'Vai alla transazione'. Leggero. | ✓ |
| Navigazione diretta alla controparte | Click scrolla/filtra la lista per mostrare la controparte. | |

**User's choice:** Popover con dettaglio della controparte

---

## Claude's Discretion

- Exact SQL per il netting nelle DAL (CTE vs subquery vs window function)
- Badge/chip visual style (colore, dimensione, posizione nella riga)
- Se `transaction_pair` porta un `created_at` timestamp
- Date range picker del picker (MonthMultiPicker vs ±N-days semplice)

## Deferred Ideas

- **1:N pairing** (un ordine ↔ più rimborsi parziali) — future phase
- **Ricategorizzazione suggerita al pair** — il netting dashboard-aware la rende non necessaria
- **Filter chip "mostra/nascondi paired"** nel dashboard overview — not in scope
- **Employer salary reimbursement split** — deferred per ADR 0012

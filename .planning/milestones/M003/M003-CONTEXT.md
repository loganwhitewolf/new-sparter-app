# M003 — Transactions, Deduplication & Inline Categorization

**Status:** Planning  
**Created:** 2026-05-04  
**Owner:** Andrea

---

## Goal

Rendere l'app pienamente usabile dopo l'import: l'utente può vedere tutte le transazioni importate, capire da dove vengono, categorizzare le spese inline, ignorare le spese irrilevanti, e fidarsi che i duplicati cross-platform vengano eliminati automaticamente.

---

## Problem Statement

Dopo l'import di file bancari (M001/M002) mancano strumenti essenziali per lavorare con i dati:
1. Non esiste una pagina `/transazioni` dove vedere le singole transazioni con filtri
2. La deduplicazione include `platformId` nell'hash → la stessa transazione importata da due file diversi crea duplicati
3. Non si può ignorare un'expense dalla dashboard (categoria "varie" o movimenti interni)
4. La categorizzazione inline richiede troppi click (solo via three-dot menu)
5. La pipeline regex probabilmente non gira perché il piano default è `free`
6. I titoli di expense e transazione non sono modificabili indipendentemente

---

## Scope

### In Scope

- **Pagina `/transazioni`**: lista transazioni con filtri URL-based (data, piattaforma, status) e sorting
- **Deduplicazione platform-agnostic**: rimozione `platformId` da `transactionHash` — hash = `userId + occurredAt + amount + normalizedDescription`
- **Ignore expense**: CTA "Ignora" su riga expense → `status='4'` → esclusa da dashboard totals
- **Inline categorization CTA**: pulsante diretto su riga expense, senza aprire three-dot menu
- **customTitle su transaction**: campo nullable editabile inline, non propagato a `expense.name`
- **Rename `expense.amount` → `total_amount`**: chiarezza semantica (somma delle transazioni collegate)
- **Fix regex pipeline**: seed utente con piano `basic` o aggiungere bypass per dev; verificare `categorizePipeline()` chiamata correttamente
- **Pattern regex utente**: UI per creare/modificare/eliminare pattern custom (ADV-01), applicati prima dei pattern di sistema
- **Expense title editabile**: modifica `expense.name` senza toccare `transaction.description` delle transazioni collegate

### Out of Scope

- Tier 3 AI categorization
- Bulk operations su transazioni (già in scope expense management)
- Export CSV transazioni (v2 ENH-01)
- Column mapping UI per piattaforme non supportate (v2)

---

## Architecture Decisions

### AD-1: Hash senza platformId

**Decision:** `transactionHash = MD5(userId + occurredAt + normalizedAmount + normalizedDescription)`  
**Rationale:** La stessa transazione bancaria (stesso giorno, stessa desc, stesso importo) è un duplicato indipendentemente dal file/piattaforma da cui è importata.  
**Consequence:** Import silenzioso — `ON CONFLICT (userId, transactionHash) DO NOTHING`. Nessun errore utente per duplicati.  
**Data impact:** DB vuoto, nessuna migrazione dati necessaria.

### AD-2: customTitle su transaction

**Decision:** Aggiungere `customTitle varchar(255) nullable` alla tabella `transactions`.  
**Rationale:** L'utente può correggere la descrizione grezza della banca senza toccare `expense.name` (che aggrega N transazioni).  
**Display logic:** UI mostra `customTitle ?? description`.

### AD-3: expense.amount → total_amount

**Decision:** Rinominare la colonna in schema Drizzle e tutti i DAL/services/actions.  
**Rationale:** `total_amount` comunica che è la somma aggregata delle transazioni collegate, non il valore di una singola transazione.

### AD-4: Ignore via status='4'

**Decision:** `expenseStatusEnum` già ha `'4'` — usarlo per "ignore".  
**Rationale:** Nessuna migrazione schema. Dashboard già filtra su `DASHBOARD_TOTAL_EXPENSE_STATUSES = ['1','2','3']`, quindi `'4'` è già escluso.

### AD-5: Pagina /transazioni server-side con URL state

**Decision:** Server Component, filtri come URL search params, nessun client state per i filtri.  
**Rationale:** Pattern Next.js App Router 2026 — SEO-friendly, bookmark-able, no hydration mismatch.

### AD-6: Pattern regex utente in M003

**Decision:** Anticipare ADV-01 da Phase 6 a M003.  
**Rationale:** Necessario per fare debugging completo della pipeline regex. Infrastruttura `components/patterns/` già presente.

---

## Slices (Roadmap)

| # | Slice | Goal | Est. |
|---|-------|------|------|
| S1 | Schema & migrations | `customTitle`, rinomina `total_amount`, hash senza platformId | ~2h |
| S2 | Fix dedup + regex pipeline | Aggiorna hash function, fix piano `free` → `basic` in seed/dev | ~1h |
| S3 | Transactions page `/transazioni` | Lista con filtri URL, sorting, paginazione | ~3h |
| S4 | Inline categorization + ignore | CTA inline su riga expense, ignore → status='4' | ~2h |
| S5 | Editable titles | Edit `customTitle` su transaction, edit `expense.name` | ~1.5h |
| S6 | User regex patterns | UI CRUD pattern custom, integrazione nella pipeline Tier 1 | ~2h |

---

## Requirements Mapping

| Req | Description | Slice |
|-----|-------------|-------|
| EXP-01 (esteso) | Modifica titolo expense senza toccare transaction | S5 |
| EXP-02 (esteso) | Lista expense con inline CTA categorizzazione/ignore | S4 |
| ADV-01 | Pattern regex custom utente | S6 |
| ADV-04 | Pipeline gated per subscription | S2 |
| TRX-01 (new) | Lista transazioni con filtri e sorting | S3 |
| TRX-02 (new) | Deduplicazione platform-agnostic | S2 |
| TRX-03 (new) | customTitle editabile su transaction | S5 |

---

## Quality Bar

- Unit test su hash function (no platformId)
- Integration test su `ON CONFLICT DO NOTHING` deduplication
- Smoke test page load `/transazioni`
- Vitest per DAL changes (total_amount rename)

---

## Open Questions

- None — all layers confirmed 2026-05-04

---

*Context confirmed: 2026-05-04*

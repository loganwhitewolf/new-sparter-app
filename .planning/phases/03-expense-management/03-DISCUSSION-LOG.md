# Phase 3: Expense Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 03-expense-management
**Areas discussed:** Amount sulle expense manuali, Form crea/modifica, Layout lista expense, Filtro date, Bulk categorization

---

## Amount sulle expense manuali

| Option | Description | Selected |
|--------|-------------|----------|
| Sì, amount obbligatorio | Expense richiede amount. Dashboard Fase 4 mostra dati reali subito. | |
| Sì, amount opzionale | Amount facoltativo — più flessibile ma dashboard parziale. | |
| No, amount non esiste su Expense | Importi solo sulle Transaction (Fase 5). Expense = contenitore semantico. | ✓ |

**User's choice:** No amount su Expense
**Notes:** Expense è un contenitore semantico (titolo + subcategoria + note). Gli importi derivano dalle Transaction create dall'import Fase 5. La dashboard Fase 4 mostrerà zeri fino all'import — comportamento accettato.

---

## Form Crea/Modifica

| Option | Description | Selected |
|--------|-------------|----------|
| Modal Dialog | Dialog già installato. L'utente resta sulla lista. Nessun cambio di route. | ✓ |
| Pagina dedicata /spese/nuova | URL bookmarkable, più spazio, gestione navigation richiesta. | |

**User's choice:** Modal Dialog
**Notes:** Standard per CRUD entry di questo tipo; Dialog già disponibile da Phase 1.

---

## Layout Lista Expense

| Option | Description | Selected |
|--------|-------------|----------|
| Tabella densa | Colonne: checkbox, titolo, categoria, status, data. Standard finance. Serve shadcn Table. | ✓ |
| Lista di Card | Card già disponibile. Più spazio per item, meno informazione per schermata. | |

**User's choice:** Tabella densa
**Notes:** Priorità alla densità dati — l'app è finance, l'utente vuole vedere molte voci in una schermata.

---

## Filtro Date

| Option | Description | Selected |
|--------|-------------|----------|
| Preset range | Questo mese / Ultimi 3 mesi / Ultimi 6 mesi / Quest'anno / Anno scorso. Coerente con DASH-02. | ✓ |
| DatePicker range completo | Massima flessibilità. Richiede Calendar + Popover da installare. | |

**User's choice:** Preset range
**Notes:** Coerenza con la dashboard Fase 4 (DASH-02 usa gli stessi preset). Nessun componente nuovo da installare.

---

## Bulk Categorization

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox + floating action bar | Checkbox per riga, bar floating in fondo con contatore e CTA. Pattern Gmail/Linear. | ✓ |
| Azione inline per riga | Menu tre puntini per riga — non soddisfa EXP-03 (bulk). | |

**User's choice:** Checkbox + floating action bar
**Notes:** Il click "Categorizza (N)" apre un Dialog separato per scegliere la categoria da applicare in bulk.

---

## Claude's Discretion

- Struttura Drizzle schema per Expense, Category, SubCategory
- Paginazione tabella (cursor vs offset)
- Gestione ottimistica degli aggiornamenti UI
- Exact error messages e validazione Zod
- Struttura interna DAL files

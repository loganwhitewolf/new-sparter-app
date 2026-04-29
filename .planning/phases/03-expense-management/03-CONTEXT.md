# Phase 3: Expense Management - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

La Fase 3 consegna la gestione manuale delle expense: creare, modificare, eliminare expense con titolo, subcategoria e note; visualizzare la lista con filtri per categoria, data e status; selezionare più expense e assegnare una categoria in bulk.

**Non include:** importi monetari su Expense (derivano dalle Transaction, arrivano in Fase 5), import file bancari, pipeline di auto-categorizzazione (Tier 1/2 si attiva in Fase 5), dashboard KPI (Fase 4).

</domain>

<decisions>
## Implementation Decisions

### Schema Expense

- **D-01:** Le expense create manualmente **non hanno un campo `amount`**. Expense è un contenitore semantico: titolo, descriptionHash, subCategoryId, userId, status, note. Gli importi monetari vivono sulle Transaction (tabella separata, popolata dall'import Fase 5). La dashboard Fase 4 mostrerà zeri fino a quando non ci sono Transaction importate — comportamento atteso e accettato.
- **D-02:** Il campo `date` di una expense manuale è il `createdAt` Drizzle (timestamp automatico). Non c'è un campo "data spesa" separato in Fase 3 — i filtri per data operano su `createdAt`.

### Form Crea/Modifica

- **D-03:** Il form per creare e modificare una expense si apre in una **Modal Dialog** (componente `Dialog` già installato da shadcn). L'utente resta sulla lista `/spese` — nessun cambio di route. Il trigger "Nuova spesa" è un Button nella topbar della pagina.
- **D-04:** Campi del form: `titolo` (obbligatorio), `subcategoria` (Select gerarchico categoria → subcategoria, opzionale), `note` (Textarea, opzionale). Submit crea/aggiorna via Server Action.

### Layout Lista Expense

- **D-05:** La pagina `/spese` usa una **tabella densa** (shadcn `Table` — da aggiungere). Colonne: checkbox (bulk select), titolo, categoria/subcategoria, status badge, data (createdAt formattata).
- **D-06:** Status badge: emerald per "Categorizzata" (status 2 o 3), amber per "Da categorizzare" (status 1). Il Badge component è già disponibile.
- **D-07:** Ogni riga ha un menu contestuale (tre puntini, `DropdownMenu` già installato) con azioni: Modifica, Elimina.

### Filtri Lista

- **D-08:** Tre filtri in toolbar sopra la tabella:
  - **Categoria**: Select con lista categorie (tutte le categorie del sistema, opzione "Tutte")
  - **Stato**: Select con opzioni "Tutti", "Da categorizzare", "Categorizzata"
  - **Data**: Select con preset range — "Questo mese", "Ultimi 3 mesi", "Ultimi 6 mesi", "Quest'anno", "Anno scorso". Coerente con DASH-02 della Fase 4.
- **D-09:** I filtri usano **URL search params** (Next.js `useSearchParams` + `router.push`). I filtri sono bookmarkabili e sopravvivono al refresh. URL example: `/spese?category=ristorazione&status=uncategorized&period=last-month`.

### Bulk Categorization

- **D-10:** Checkbox nella prima colonna della tabella. Quando ≥1 riga selezionata, appare un **floating action bar** in fondo alla pagina con: contatore ("N selezionate") e pulsante "Categorizza (N)".
- **D-11:** Il click "Categorizza (N)" apre un Dialog separato con il Select categoria/subcategoria. Alla conferma, la Server Action aggiorna in bulk tutte le expense selezionate con `status=3` (manuale) e il `subCategoryId` scelto.

### Claude's Discretion

- Struttura esatta del Drizzle schema per Expense (colonne, indici, relazioni con User/SubCategory)
- Paginazione della tabella (server-side cursor o offset — raccomandato cursor per performance)
- Gestione ottimistica degli aggiornamenti UI (React state locale vs revalidazione Server Actions)
- Exact error handling e messaggi di validazione Zod (italiano)
- Struttura DAL: `lib/dal/expenses.ts`, `lib/dal/categories.ts`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & Business Logic
- `docs/init/BUSINESS_LOGIC_HANDOFF.md` — schema Expense (campi, status enum, descriptionHash logic), Categories & SubCategories (tassonomia 2 livelli, seeded), relazioni chiave
- `docs/init/seed.ts` — dati seed: 26 categorie, ~120 subcategorie con type (in/out/system), slug, icon, color — struttura da replicare in `drizzle/seed.ts`

### Stack & Conventions
- `CLAUDE.md` — Decimal.js obbligatorio per amount (non usato in Fase 3 ma pattern da rispettare per futura compatibilità), DAL pattern `lib/dal/ → lib/services/ → lib/actions/`, directory structure
- `.planning/research/STACK.md` — pattern Drizzle ORM + PostgreSQL, Server Actions con Zod v4
- `.planning/research/ARCHITECTURE.md` — architettura DAL, pattern Server Actions

### Requirements
- `.planning/REQUIREMENTS.md` — EXP-01 (crea/modifica/elimina), EXP-02 (lista con filtri), EXP-03 (bulk categorization)
- `.planning/ROADMAP.md` — Phase 3 success criteria (sezione Phase 3)

### Phase 1 & 2 Artifacts (integration points)
- `.planning/phases/01-design-system/01-CONTEXT.md` — componenti shadcn disponibili, palette emerald/slate, New York style
- `.planning/phases/02-authentication/02-CONTEXT.md` — verifySession() disponibile in `lib/dal/auth.ts`, userId e subscriptionPlan dalla sessione

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/dialog.tsx` — Dialog già installato; usarlo per form crea/modifica e per la bulk categorization confirmation
- `components/ui/select.tsx` — Select già installato; usarlo per filtri categoria/data/status e per la selezione categoria nel form
- `components/ui/badge.tsx` — Badge già installato; usarlo per status (categorizzata/da categorizzare) con varianti emerald/amber
- `components/ui/button.tsx` — Button già installato; trigger "Nuova spesa", azioni tabella
- `components/ui/input.tsx` — Input già installato; campo titolo nel form
- `components/ui/dropdown-menu.tsx` — DropdownMenu già installato; menu tre puntini per azioni riga
- `lib/dal/auth.ts` — `verifySession()` disponibile per proteggere tutte le Server Actions e route di Fase 3

### Established Patterns
- DAL pattern: `lib/dal/` per query DB → `lib/services/` per business logic → `lib/actions/` per Server Actions `"use server"`
- Route group `(app)/` già configurato con layout autenticato (sidebar, topbar)
- Better Auth session: `userId`, `subscriptionPlan`, `role` disponibili via `verifySession()`
- Schema Drizzle con `pgTable`, `relations`, `pgEnum` — seguire pattern in `lib/db/schema.ts`

### Integration Points
- Nuova route: `app/(app)/spese/page.tsx` (lista expense con tabella e filtri)
- Schema Drizzle: aggiungere tabelle `expense`, `category`, `subcategory` a `lib/db/schema.ts`
- Nuovo componente shadcn da installare: `Table` (per la tabella densa) — `npx shadcn@latest add table`
- Server Actions in `lib/actions/expenses.ts`: createExpense, updateExpense, deleteExpense, bulkCategorize
- DAL in `lib/dal/expenses.ts` e `lib/dal/categories.ts`
- Seed file: aggiungere categorie/subcategorie in `drizzle/seed.ts` prima dei test

</code_context>

<specifics>
## Specific Ideas

- Layout tabella ispirato a tool finance densi — priorità alla leggibilità dei titoli expense (sono descrizioni bancarie normalizzate, spesso in maiuscolo)
- Floating action bar per la bulk categorization: pattern Gmail/Linear — appare solo quando selezionato, non disturba la navigazione normale

</specifics>

<deferred>
## Deferred Ideas

- Import amount diretto su Expense (cash entries) — potenzialmente utile ma non nel scope di questa fase; valutare per v2 o come backlog
- DatePicker range completo (Calendar + Popover) — non necessario in Fase 3; i preset range coprono i casi d'uso. Rivalutare in Fase 6 se richiesto
- Tag su transazioni — out of scope v1 (vedi REQUIREMENTS.md Out of Scope)
- Note lunghe con editor rich text — out of scope Fase 3; Textarea semplice sufficiente

</deferred>

---

*Phase: 03-expense-management*
*Context gathered: 2026-04-27*

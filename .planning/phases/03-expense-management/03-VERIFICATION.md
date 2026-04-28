---
status: human_needed
phase: 03-expense-management
verified: 2026-04-28T12:00:00Z
must_haves_checked: 24/24
requirements_covered:
  - EXP-01
  - EXP-02
  - EXP-03
gaps: []
human_verification:
  - test: "Crea una nuova spesa: clicca 'Nuova spesa', inserisci titolo, seleziona categoria e poi sottocategoria, clicca 'Salva spesa'"
    expected: "Il dialog si chiude, il toast conferma il successo, la riga appare in tabella con badge amber 'Da categorizzare' (se nessuna sottocategoria) o emerald 'Categorizzata'"
    why_human: "Richiede DB seed attivo e sessione autenticata — non testabile programmaticamente"
  - test: "Modifica una spesa: clicca il menu tre puntini su una riga, seleziona 'Modifica', cambia il titolo o la categoria, clicca 'Aggiorna spesa'"
    expected: "Il dialog si chiude, il DropdownMenu scompare, il toast conferma, la riga aggiorna i dati"
    why_human: "Dipende da dati nel DB e da comportamento visivo del DropdownMenu controllato"
  - test: "Elimina una spesa: tre puntini → 'Elimina' → conferma nel dialog"
    expected: "La riga scompare dalla tabella, il toast conferma l'eliminazione"
    why_human: "Richiede DB seed attivo"
  - test: "Filtro stato: seleziona 'Da categorizzare' nella select Stato"
    expected: "L'URL aggiorna a ?status=uncategorized, la tabella mostra solo spese non categorizzate; ricaricando la pagina il filtro persiste"
    why_human: "Richiede DB seed con almeno due spese di stato diverso"
  - test: "Selezione multipla + bulk categorize: seleziona 2+ righe, clicca 'Categorizza (N)', scegli sottocategoria, conferma"
    expected: "Le righe selezionate mostrano badge emerald 'Categorizzata'; il FAB scompare"
    why_human: "Richiede DB seed attivo e verifica visiva del FAB e del dialog"
  - test: "Verifica assenza warning console su /spese: apri DevTools → Console prima di interagire con la pagina"
    expected: "Nessun warning 'Missing Description or aria-describedby' — i fix DialogDescription sono in produzione"
    why_human: "Verifica runtime della correzione UAT accessibility"
---

# Phase 3: Expense Management — Verification Report

**Phase Goal:** Expense management — CRUD operations for expenses with category/subcategory assignment, URL-driven filters, and bulk categorization.
**Verified:** 2026-04-28T12:00:00Z
**Status:** human_needed
**Re-verification:** No — verifica iniziale

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Test stubs esistono per tutti e 8 i comportamenti EXP-01/02/03 | VERIFIED | `grep -c "test.fixme" tests/expenses.spec.ts` → 8 match |
| 2 | Sonner Toaster è montato nel root layout | VERIFIED | `app/layout.tsx` righe 4 e 20: import + `<Toaster />` |
| 3 | shadcn Table component installato a `components/ui/table.tsx` | VERIFIED | File esiste |
| 4 | `toDecimal()` e `toDbDecimal()` esistono e sono tipati correttamente | VERIFIED | `lib/utils/decimal.ts` esporta entrambe le funzioni con import Decimal da 'decimal.js' |
| 5 | `category`, `sub_category`, `expense` tables definite nello schema Drizzle | VERIFIED | `lib/db/schema.ts` righe 113, 125, 137 |
| 6 | `categoryTypeEnum` e `expenseStatusEnum` pgEnums esportati | VERIFIED | `lib/db/schema.ts` righe 23 e 25 con valori corretti |
| 7 | Relazioni dichiarate: category→subCategories, subCategory→category, expense→user, expense→subCategory | VERIFIED | `lib/db/schema.ts` righe 174, 178, 186 |
| 8 | `expense.id` usa text primary key (coerente con user.id) | VERIFIED | `lib/db/schema.ts` riga 138: `text('id').primaryKey()` |
| 9 | Tutti gli indici compound su expense definiti | VERIFIED | `lib/db/schema.ts` righe 148-151: expense_userId_idx, expense_userId_status_idx, expense_userId_createdAt_idx, expense_subCategoryId_idx |
| 10 | Migration SQL generata per category, sub_category, expense tables | VERIFIED | `drizzle/migrations/0001_chilly_clea.sql` contiene CREATE TYPE + CREATE TABLE per tutti e 3 |
| 11 | `drizzle/seed.ts` inserisce categorie e subcategorie in modo idempotente | VERIFIED | `onConflictDoNothing()` presente per categories e subCategories (righe 223, 228) |
| 12 | `package.json` ha script `db:seed` | VERIFIED | `"db:seed": "tsx drizzle/seed.ts"` presente |
| 13 | `getExpenses()` scopato a userId verificato — nessuna fuga dati cross-user | VERIFIED | `lib/dal/expenses.ts` riga 47: `verifySession()` + import 'server-only' |
| 14 | `getCategories()` ritorna struttura annidata con subCategories | VERIFIED | `lib/dal/categories.ts`: server-only + leftJoin + grouping Map |
| 15 | Server Actions createExpense/updateExpense/deleteExpense/bulkCategorize validano con Zod e ritornano `{ error: string | null }` | VERIFIED | 4 export async functions in `lib/actions/expenses.ts` + Zod v4 `{ error: '...' }` syntax |
| 16 | `bulkCategorize` include `eq(expense.userId, userId)` insieme a `inArray` — IDOR prevenuto | VERIFIED | `lib/actions/expenses.ts` righe 105-106: `inArray` + `eq(expense.userId, userId)` dentro `and()` |
| 17 | L'utente può navigare a /spese e vedere la lista con filter toolbar | VERIFIED (code) | `app/(app)/spese/page.tsx`: async Server Component, await searchParams, getExpenses + getCategories chiamate, Suspense wrapper per ExpenseFilters |
| 18 | L'utente può creare una spesa via Dialog 'Nuova spesa' | VERIFIED (code) | `components/expenses/expense-form-dialog.tsx`: useActionState + createExpense, due Select separati (selectedCategory → subCategories filtrate) |
| 19 | I filtri si riflettono nei parametri URL e persistono al refresh | VERIFIED (code) | `components/expenses/expense-filters.tsx`: router.replace (non router.push) + useSearchParams |
| 20 | Selezionando 1+ righe appare il FAB con conteggio | VERIFIED (code) | `components/expenses/bulk-action-bar.tsx`: fixed bottom-6, count, "Categorizza ({count})" |
| 21 | Bulk categorize Dialog assegna subCategoryId + status='3' | VERIFIED (code) | `lib/actions/expenses.ts` riga 97-110: status hardcoded '3' + bulkCategorize server action |
| 22 | Nessun DialogContent privo di DialogDescription | VERIFIED | expense-form-dialog.tsx riga 98, bulk-categorize-dialog.tsx riga 68, expense-table.tsx riga 267: DialogDescription className="sr-only" presente in tutti e 3 i dialog |
| 23 | I due Select separati (categoria + sottocategoria) sono presenti in EntrambiDialog | VERIFIED | `selectedCategory` pattern presente in expense-form-dialog.tsx (riga 51) e bulk-categorize-dialog.tsx (riga 46) |
| 24 | DropdownMenu controllato si chiude su onSuccess in ExpenseTable | VERIFIED | `openDropdownId` state (riga 47), `onSuccess={() => setOpenDropdownId(null)}` (riga 185), nav links /spese corretti in sidebar e bottom-nav |

**Score:** 24/24 truths verificabili programmaticamente — tutti VERIFIED

---

### Required Artifacts

| Artifact | Fornisce | Status | Dettagli |
|----------|----------|--------|---------|
| `tests/expenses.spec.ts` | Playwright stubs EXP-01/02/03 | VERIFIED | 8 test.fixme presenti, EXP-01/02/03 nei describe blocks |
| `app/layout.tsx` | Root layout con Toaster | VERIFIED | Import sonner + `<Toaster />` presente |
| `lib/utils/decimal.ts` | Monetary arithmetic utils | VERIFIED | toDecimal() e toDbDecimal() esportate, import Decimal from 'decimal.js' |
| `components/ui/table.tsx` | shadcn Table component | VERIFIED | File esiste |
| `lib/db/schema.ts` | Schema Drizzle con 3 nuove tabelle | VERIFIED | category, sub_category, expense + 2 enums + relations + indexes |
| `drizzle/migrations/0001_chilly_clea.sql` | SQL migration applicata | VERIFIED | CREATE TYPE + CREATE TABLE per tutti i nuovi artefatti |
| `drizzle/seed.ts` | Seed con 26+ categorie e ~120+ subcategorie | VERIFIED | onConflictDoNothing x2, dati da docs/init/seed.ts |
| `lib/dal/expenses.ts` | getExpenses, getExpenseById, insertExpense, updateExpense, deleteExpense, periodToDateRange | VERIFIED | Tutti esportati, server-only, userId-scoped, leftJoin |
| `lib/dal/categories.ts` | getCategories() con subCategories annidate | VERIFIED | server-only, cache(), leftJoin, grouping |
| `lib/validations/expense.ts` | CreateExpenseSchema, UpdateExpenseSchema, BulkCategorizeSchema, ActionState | VERIFIED | Zod v4 { error: } syntax, messaggi italiani |
| `lib/actions/expenses.ts` | createExpense, updateExpense, deleteExpense, bulkCategorize | VERIFIED | 'use server', 4 exports, verifySession in ognuno, revalidatePath('/spese') |
| `app/(app)/spese/page.tsx` | Async Server Component pagina spese | VERIFIED | export default async function, await searchParams, getExpenses + getCategories, Suspense |
| `components/expenses/expense-filters.tsx` | Filter toolbar URL-driven | VERIFIED | 'use client', useSearchParams, router.replace |
| `components/expenses/expense-table.tsx` | Dense Table con selezione checkbox, status badge, DropdownMenu | VERIFIED | selectedIds state, bg-amber-100/bg-emerald-100, BulkActionBar, BulkCategorizeDialog, openDropdownId |
| `components/expenses/expense-form-dialog.tsx` | Create/edit Dialog con useActionState e Select a due livelli | VERIFIED | useActionState, selectedCategory pattern, DialogDescription sr-only |
| `components/expenses/bulk-action-bar.tsx` | FAB con conteggio selezione | VERIFIED | fixed bottom-6, Categorizza ({count}) |
| `components/expenses/bulk-categorize-dialog.tsx` | Dialog bulk categorization | VERIFIED | JSON.stringify(selectedIds), selectedCategory pattern, DialogDescription sr-only |

---

### Key Link Verification

| From | To | Via | Status | Dettagli |
|------|----|-----|--------|---------|
| `app/(app)/spese/page.tsx` | `lib/dal/expenses.ts` | await getExpenses(filters) | WIRED | righe 2 e 27 |
| `app/(app)/spese/page.tsx` | `lib/dal/categories.ts` | await getCategories() | WIRED | righe 3 e 28 |
| `components/expenses/expense-filters.tsx` | /spese route | router.replace('/spese?' + params.toString()) | WIRED | riga 30 |
| `components/expenses/expense-form-dialog.tsx` | `lib/actions/expenses.ts` | useActionState(createExpense/updateExpense) | WIRED | import + useActionState |
| `components/expenses/bulk-categorize-dialog.tsx` | `lib/actions/expenses.ts` | useActionState(bulkCategorize) | WIRED | import + useActionState |
| `lib/actions/expenses.ts` | `lib/dal/auth.ts` | verifySession() in ogni action | WIRED | 4 occorrenze di verifySession() |
| `lib/dal/expenses.ts` | `lib/db/schema.ts` | leftJoin su subCategory e category | WIRED | righe 81-82 e 103-104 |
| `lib/actions/expenses.ts` | `lib/db/schema.ts` | bulkCategorize: and(inArray, eq(userId)) | WIRED | righe 105-106 |
| `components/expenses/expense-table.tsx` | `components/expenses/expense-form-dialog.tsx` | onSuccess prop → setOpenDropdownId(null) | WIRED | riga 185 |
| Sidebar/BottomNav | `/spese` | href="/spese" | WIRED | sidebar.tsx riga 12, bottom-nav.tsx riga 10 |

---

### Data-Flow Trace (Level 4)

| Artifact | Variabile dati | Sorgente | Dati reali | Status |
|----------|---------------|----------|-----------|--------|
| `app/(app)/spese/page.tsx` | expenses | getExpenses() → Drizzle query su expense table | Sì — Drizzle SELECT con leftJoin e WHERE userId | FLOWING |
| `app/(app)/spese/page.tsx` | categories | getCategories() → Drizzle query su category+subCategory | Sì — Drizzle SELECT con leftJoin | FLOWING |
| `components/expenses/expense-table.tsx` | expenses prop | Ricevuto da Server Component (page.tsx) | Sì — passato direttamente dalla query | FLOWING |
| `components/expenses/expense-filters.tsx` | categories prop | Ricevuto da Server Component (page.tsx) | Sì — stessa query getCategories() | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — i componenti richiedono un server attivo e un DB seed per eseguire comportamenti verificabili. I check statici (grep, esistenza file, TypeScript) sostituiscono i test runtime.

---

### Requirements Coverage

| Requirement | Piano sorgente | Descrizione | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| EXP-01 | 03-00, 03-01, 03-02, 03-03, 03-04, 03-05 | L'utente può creare, modificare ed eliminare manualmente una expense con titolo, subcategoria e note | VERIFIED (code) | CRUD completo: createExpense/updateExpense/deleteExpense server actions + dialogs + expense-table row actions |
| EXP-02 | 03-00, 03-01, 03-02, 03-03, 03-04, 03-05 | L'utente può visualizzare la lista delle expense con filtri per categoria, data e status di categorizzazione | VERIFIED (code) | expense-filters.tsx con URL-driven params, getExpenses(filters) nel DAL |
| EXP-03 | 03-00, 03-01, 03-02, 03-03, 03-04, 03-05 | L'utente può selezionare multiple expense e assegnare una categoria in bulk | VERIFIED (code) | selectedIds state, BulkActionBar, BulkCategorizeDialog, bulkCategorize server action con IDOR prevention |

---

### Anti-Patterns Found

| File | Linea | Pattern | Severità | Impatto |
|------|-------|---------|----------|---------|
| Nessun anti-pattern bloccante rilevato | — | — | — | — |

Note: `return null` non presente in nessun componente di rendering. I componenti expense-table ed expense-filters hanno implementazioni sostanziali. L'empty state `Nessuna spesa trovata` è un'UI legittima, non uno stub.

---

### Human Verification Required

#### 1. Flusso Create Expense completo

**Test:** Avvia il dev server (`npm run dev`), naviga a `/spese` da sessione autenticata, clicca "Nuova spesa", seleziona prima una categoria dal primo Select, poi verifica che appaia il secondo Select con le subcategorie, seleziona una subcategoria, inserisci un titolo, clicca "Salva spesa".
**Expected:** Il dialog si chiude, toast di conferma "Spesa creata con successo.", la nuova riga appare in tabella con badge emerald "Categorizzata" (se subcategoria selezionata) o amber "Da categorizzare" (senza subcategoria).
**Why human:** Richiede DB PostgreSQL con tabelle migrate e seed applicato, e una sessione autenticata valida.

#### 2. Edit expense con chiusura DropdownMenu

**Test:** Clicca il menu tre puntini su una riga, seleziona "Modifica", modifica il titolo nel dialog, clicca "Aggiorna spesa".
**Expected:** Il dialog di modifica si chiude E il DropdownMenu padre si chiude automaticamente (fix UAT T4 — openDropdownId state). Il toast conferma "Spesa aggiornata.".
**Why human:** Il comportamento di chiusura del DropdownMenu è visivo e dipende da interazione UI — non verificabile tramite grep.

#### 3. Filtri URL-driven con persist al refresh

**Test:** Cambia il select "Stato" a "Da categorizzare". Osserva l'URL. Ricarica la pagina.
**Expected:** L'URL diventa `/spese?status=uncategorized` (o equivalente). Dopo il refresh, il select Stato mostra ancora "Da categorizzare" e la tabella è filtrata.
**Why human:** Richiede dati nel DB per verificare che il filtro escluda davvero le righe sbagliate.

#### 4. Bulk categorize con due Select separati

**Test:** Seleziona 2+ righe tramite checkbox, clicca "Categorizza (N)" nel FAB, verifica che il dialog apra con un Select categoria e, dopo aver selezionato una categoria, appaia un secondo Select subcategoria. Scegli una subcategoria, clicca "Conferma".
**Expected:** Le righe selezionate mostrano badge emerald "Categorizzata". Il FAB scompare.
**Why human:** Verifica il fix UAT T7 (due Select separati in BulkCategorizeDialog) e il comportamento del FAB — richiede interazione visiva e DB seed.

#### 5. Verifica assenza warning DialogDescription in console

**Test:** Apri DevTools → Console su `/spese`. Apri ciascuno dei tre dialog (Nuova spesa, Modifica, Elimina) e osserva la console.
**Expected:** Nessun warning "Missing Description or aria-describedby" da Radix/shadcn. Il fix UAT T2 ha aggiunto `<DialogDescription className="sr-only">` a tutti i dialog.
**Why human:** I warning browser sono rilevabili solo a runtime.

---

### Gaps Summary

Nessun gap bloccante identificato. Tutti i 24 must-have verificabili programmaticamente risultano VERIFIED:

- Artefatti: tutti esistono, sono sostanziali (non stub), e sono collegati correttamente
- Sicurezza: userId scoping in tutte le DAL functions + bulkCategorize IDOR prevention
- Fix UAT: DialogDescription in tutti e 3 i dialog, due Select separati per categoria/subcategoria, openDropdownId per DropdownMenu controllato, nav links /spese corretti
- Data flow: getExpenses/getCategories producono dati reali da query Drizzle, non valori statici

Lo status `human_needed` riflette che la verifica interattiva/visiva end-to-end non è eseguibile programmaticamente — non indica gap nel codice.

---

_Verified: 2026-04-28T12:00:00Z_
_Verifier: Claude (gsd-verifier)_

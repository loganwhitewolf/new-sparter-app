# Roadmap: Sparter

## Overview

Sparter migrates from Express + Sequelize to Next.js 16 App Router + Drizzle ORM in 7 sequential phases. The journey starts with the design system and authentication shell, builds toward manual expense management and dashboard KPIs, then delivers the full CSV/Excel import pipeline with bank platform + format-version detection and gated categorization, and closes with the user profile screen. Every phase leaves the app in a coherent, usable state.

## Stack Context

All plan-phase agents must be aware of these constraints:

- **Stack**: Next.js 16 App Router, Drizzle ORM + PostgreSQL, Better Auth, Cloudflare R2, Zod, Decimal.js, Tailwind CSS + shadcn/ui
- **DAL pattern**: `lib/dal/` (Drizzle queries) → `lib/services/` (business logic) → `lib/actions/` (server actions, thin wrappers)
- **Seed data**: `docs/init/seed.ts` contains 26 categories, ~120 subcategories, initial bank/payment platforms, import format versions, 28 regex patterns — port to `drizzle/seed.ts`
- **Monetary arithmetic**: NEVER use JS native `+`, `-`, `*`, `/` on amounts — always `Decimal.js`. `toDecimal()` / `toDbDecimal()` utils must be created in Phase 3 before any amount writes
- **Import atomicity**: `importFile()` must be wrapped in `db.transaction(async (tx) => { ... })`; all helpers accept `DbOrTx` to stay within the transaction boundary
- **Import preview**: Required in Phase 5 — show row count, duplicate count, detected platform, detected format version, confidence, and sample rows before committing the import
- **Better Auth**: Ricercare l'API corrente al momento di pianificare la Fase 2 — sostituisce NextAuth v5. Verificare integrazione con Drizzle adapter, gestione sessioni e route protection
- **R2 upload**: Route Handler generates a short-lived presigned PUT URL → browser uploads directly to R2 → second call confirms. Never proxy file upload through server actions; never expose R2 credentials or backend `storageKey` to the UI unless strictly needed
- **Edge runtime**: Middleware must do JWT check only (no DB queries). `import 'server-only'` in `lib/db/index.ts`
- **CSV encoding**: Italian banks often use ISO-8859-1; parser must detect encoding or fallback to UTF-8
- **Drizzle DECIMAL**: Returned as strings — always pass raw string to `new Decimal()`, never convert to `Number` first

---

## Phases

- [x] **Phase 1: Design System** - Tokens colore/tipografia, componenti base shadcn/ui, layout shell `(auth)` / `(app)`
- [x] **Phase 2: Authentication** - Registrazione, login JWT, middleware di route protection con staging bypass
- [x] **Phase 3: Expense Management** - CRUD manuale expense, lista con filtri, bulk categorization
- [ ] **Phase 4: Dashboard KPI** - Overview mensile, breakdown categorie, trend mensile
- [ ] **Phase 5: File Import** - Upload CSV/Excel su R2, record `files`, rilevamento piattaforma + versione tracciato, preview, import con deduplicazione e categorizzazione gated
- [ ] **Phase 6: Import Avanzato & Categorizzazione** - Pattern regex custom utente, rafforzamento history-based Tier 2, subscription gating e strumenti avanzati
- [ ] **Phase 7: User Profile** - Schermata impostazioni account

---

## Phase Details

### Phase 1: Design System
**Goal**: L'app ha una base visiva coerente — token colore/tipografia definiti, componenti base disponibili, layout shell `(auth)` e `(app)` navigabili
**Depends on**: Nothing (first phase)
**Requirements**: DS-01, DS-02, DS-03
**Success Criteria** (what must be TRUE):
  1. Aprendo qualsiasi pagina pubblica (es. /login) si vede il layout `(auth)` minimal, senza sidebar
  2. Aprendo qualsiasi pagina autenticata (es. /dashboard) si vede il layout `(app)` con sidebar e topbar
  3. I componenti Button, Input, Card, Badge, Select, Modal sono renderizzabili da qualsiasi pagina e rispettano i token colore e tipografici definiti
  4. La palette colori e la scala tipografica sono definite come CSS variables Tailwind e si applicano globalmente
**Plans**: 5 plans
Plans:
- [ ] 01-01-PLAN.md — Wave 0: Playwright install + test stubs (layout.spec.ts, design-system.spec.ts)
- [ ] 01-02-PLAN.md — Wave 1: Next.js 16 bootstrap + stack packages + proxy.ts + .env.example
- [ ] 01-03-PLAN.md — Wave 2: shadcn/ui init + slate/emerald CSS variables + Geist fonts
- [ ] 01-04-PLAN.md — Wave 3: shadcn components (10x) + lib/ directory structure + db stub
- [ ] 01-05-PLAN.md — Wave 4: Layout shell ((auth)/(app) layouts + Sidebar/Topbar/BottomNav + page stubs)
**UI hint**: yes

### Phase 2: Authentication
**Goal**: L'utente può creare un account, effettuare il login e mantenere la sessione attiva; le route protette sono inaccessibili agli utenti non autenticati
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. Un nuovo utente può registrarsi con email e password e viene reindirizzato alla dashboard
  2. Un utente registrato può effettuare il login e la sessione persiste al refresh del browser
  3. Tentare di accedere a `/dashboard` senza sessione reindirizza a `/login`
  4. Una richiesta con header `x-staging-key` corretto bypassa l'autenticazione in ambiente non-produzione
**Plans**: 5 plans
Plans:
- [ ] 02-00-PLAN.md — Wave 0: Test stubs (tests/auth.spec.ts) + update tests/layout.spec.ts for proxy.ts compatibility
- [ ] 02-01-PLAN.md — Wave 1: lib/db/index.ts real pg pool + auth.ts Better Auth config + lib/auth-client.ts + route handler
- [ ] 02-02-PLAN.md — Wave 2: lib/db/schema.ts Better Auth tables + [BLOCKING] Drizzle migration + lib/validations/auth.ts Zod v4
- [ ] 02-03-PLAN.md — Wave 3: lib/dal/auth.ts verifySession() + lib/actions/auth.ts (signIn/signUp/signOut)
- [ ] 02-04-PLAN.md — Wave 4: proxy.ts route protection + login/register pages wired + topbar live session [checkpoint]

### Phase 3: Expense Management
**Goal**: L'utente può gestire manualmente le proprie expense — creare, modificare, eliminare, filtrare e categorizzare in bulk
**Depends on**: Phase 2
**Requirements**: EXP-01, EXP-02, EXP-03
**Success Criteria** (what must be TRUE):
  1. L'utente può creare una nuova expense con titolo, subcategoria e note, e vederla nella lista
  2. L'utente può modificare o eliminare un'expense esistente
  3. La lista expense si filtra per categoria, intervallo di date e status di categorizzazione
  4. L'utente può selezionare multiple expense e assegnare una categoria a tutte in un'unica operazione
**Plans**: 6 plans
Plans:
- [ ] 03-00-PLAN.md — Wave 0: Test stubs (tests/expenses.spec.ts) + shadcn Table install + Toaster in layout + lib/utils/decimal.ts
- [ ] 03-01-PLAN.md — Wave 1: lib/db/schema.ts extension (category, sub_category, expense tables + enums + relations)
- [ ] 03-02-PLAN.md — Wave 2: [BLOCKING] Drizzle migration + drizzle/seed.ts (26 categories + ~120 subcategories)
- [ ] 03-03-PLAN.md — Wave 3: lib/dal/expenses.ts + lib/dal/categories.ts + lib/validations/expense.ts + lib/actions/expenses.ts
- [ ] 03-04-PLAN.md — Wave 4: app/(app)/spese/page.tsx + 5 Client Components + human-verify checkpoint
- [ ] 03-05-PLAN.md — Wave 5 (gap_closure): Verifica fix UAT + aggiornamento test Playwright + SUMMARY 03-04 completato
**UI hint**: yes

### Phase 4: Dashboard KPI
**Goal**: L'utente vede in un colpo d'occhio la propria situazione finanziaria — overview mensile, breakdown per categoria e trend nel tempo
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. La dashboard mostra totalIn, totalOut, balance, savingsRate e uncategorizedCount del mese corrente con delta rispetto al mese precedente (categoria `ignore` esclusa)
  2. L'utente può vedere il breakdown delle spese per categoria e subcategoria con percentuale sul totale, filtrabile per preset (last-month, last-3-months, last-6-months, this-year, last-year)
  3. L'utente può vedere il trend mensile con totalIn, totalOut, non categorizzato e ignorato per ogni mese del periodo selezionato
**Plans**: 4 plans
Plans:
**Wave 0**
- [ ] 04-00-PLAN.md — Setup: shadcn chart/tabs, dashboard test stubs, shared date + Decimal helpers
**Wave 1 (blocked on Wave 0 completion)**
- [ ] 04-01-PLAN.md — Backend: dashboard validation + user-scoped KPI/breakdown/trend DAL
**Wave 2 (blocked on Wave 0 and Wave 1 completion)**
- [ ] 04-02-PLAN.md — UI components: filters, KPI cards, breakdown chart, trend chart, skeletons
**Wave 3 (blocked on Wave 1 and Wave 2 completion)**
- [ ] 04-03-PLAN.md — Page integration: data-backed `/dashboard` route + Playwright verification

Cross-cutting constraints:
- Every dashboard data path is scoped through `verifySession()` and `eq(expense.userId, userId)`.
- Monetary fields remain explicit `"0.00"` strings until Phase 5 introduces transaction amounts; count-based fallback data must be labelled and typed.
- Client chart components must not runtime-import server-only DAL modules.
- Next.js 16 async `searchParams` and `useSearchParams` Suspense requirements are mandatory.
**UI hint**: yes

### Phase 5: File Import
**Goal**: L'utente può importare un file CSV o Excel della propria banca — il file viene caricato su R2 via presigned URL, il sistema riconosce piattaforma e versione del tracciato, mostra un'anteprima e importa le transazioni con deduplicazione e categorizzazione gated
**Depends on**: Phase 2, Phase 3
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04, IMP-05
**Success Criteria** (what must be TRUE):
  1. L'utente può caricare un file CSV o Excel via presigned URL e vederlo apparire nella lista con record `files` e status `pending`; il file è su Cloudflare R2
  2. Il modello dati distingue piattaforme bancarie e versioni di tracciato: ogni piattaforma può avere più versioni con mapping colonne, detection rules, parser e stato di validità
  3. Il sistema propone automaticamente la coppia piattaforma + versione tracciato più compatibile usando colonne, header, formato date, separatori, valuta e segnali strutturali; l'utente può confermare o scegliere manualmente
  4. Prima di confermare l'import, l'utente vede: numero di righe rilevate, duplicati già importati, piattaforma rilevata, versione tracciato rilevata, confidence e sample di righe parsed
  5. Dopo la conferma, le transazioni vengono importate usando il mapping della versione selezionata, senza duplicati (`transactionHash`), aggregate in expense per descrizione normalizzata (`descriptionHash`) e sottoposte alla pipeline Tier 1 regex + Tier 2 history secondo il piano di subscription
**Plans**: TBD
**UI hint**: yes

### Phase 6: Import Avanzato & Categorizzazione
**Goal**: L'utente con piano basic o pro può gestire pattern regex personalizzati e il sistema applica la pipeline di categorizzazione completa con history-based Tier 2 e subscription gating
**Depends on**: Phase 5
**Requirements**: ADV-01, ADV-02, ADV-03, ADV-04
**Success Criteria** (what must be TRUE):
  1. Un utente basic o pro può creare, modificare ed eliminare pattern regex personalizzati; i pattern custom vengono applicati prima dei pattern di sistema nel Tier 1
  2. Dopo aver confermato manualmente la categoria di un'expense, il sistema aggiorna `ExpenseClassificationHistory`; le expense con weight >= 3 vengono auto-categorizzate via Tier 2 nei successivi import
  3. I pattern di sistema per Deliveroo, JustEat, Glovo e Wolt mappano correttamente alla subcategoria `take-away`
  4. Gli utenti `free` non ricevono auto-categorizzazione; `basic` riceve Tier 1 + Tier 2; `pro` riceve Tier 1 + Tier 2 (Tier 3 AI riservato a v2)
**Plans**: TBD
**UI hint**: yes

### Phase 7: User Profile
**Goal**: L'utente può visualizzare e aggiornare le proprie informazioni personali dalla schermata profilo
**Depends on**: Phase 2
**Requirements**: PROF-01
**Success Criteria** (what must be TRUE):
  1. L'utente può aprire la schermata profilo e vedere firstName, lastName, jobTitle, location, phone e timezone già valorizzati con i dati attuali
  2. L'utente può modificare uno o più campi e salvare; le modifiche si riflettono immediatamente nell'interfaccia
**Plans**: TBD
**UI hint**: yes

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Design System | 0/5 | Not started | - |
| 2. Authentication | 0/5 | Not started | - |
| 3. Expense Management | 6/6 | Complete | 2026-04-28 |
| 4. Dashboard KPI | 0/4 | Planned | - |
| 5. File Import | 0/? | Not started | - |
| 6. Import Avanzato & Categorizzazione | 0/? | Not started | - |
| 7. User Profile | 0/? | Not started | - |

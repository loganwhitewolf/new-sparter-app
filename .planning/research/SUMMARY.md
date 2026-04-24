# Research Summary — Sparter

**Researched:** 2026-04-22
**Domain:** Personal finance web app, Italian market
**Stack:** Next.js 16 App Router, Drizzle ORM + MySQL, Better Auth, Cloudflare R2, Tailwind + shadcn/ui

---

## Stack

**React 19 è obbligatorio con Next.js 16.** Non usare React 18 — compila ma crasha in runtime con le API async di request/runtime.

**Better Auth sostituisce NextAuth v5** — ricercare l'API corrente al momento di pianificare la Fase 2. Le note su NextAuth v5 presenti in STACK.md e PITFALLS.md sono superate per la parte auth.

**Drizzle restituisce le colonne DECIMAL come stringhe** — passare direttamente a `new Decimal(stringValue)`, mai convertire a `Number` prima. Creare utils `toDecimal()` e `toDbDecimal()` in Fase 3.

**Upload file: presigned PUT URL → R2 diretto dal browser**, mai proxiato attraverso Next.js (server actions bufferizzano l'intero body in memoria). Il Route Handler genera il presigned URL; il browser carica direttamente su R2; poi una seconda chiamata conferma il risultato. Il frontend non riceve credenziali R2 e non sceglie lo `storageKey`; orchestra solo il flusso UI initiate → upload → confirm.

**R2 richiede `region: 'auto'`** nell'S3Client — qualsiasi altra regione causa errori di firma.

**drizzle-kit push è vietato in produzione.** Usare sempre `generate` + `migrate` (Railway release command prima dello switch del traffico).

---

## Features

**Confermati corretti:**
- Coverage delle 6 piattaforme (Intesa SP, Intesa SP CC con `multiplyBy: -1`, Fineco con colonne separate, Satispay, Revolut, General)
- Tassonomia 26 categorie / ~120 subcategorie adeguata al mercato italiano
- 28 pattern regex con buona copertura (supermarket, telecom italiani, rail, streaming)
- Anno fiscale calendario (gen–dic), allineato con i preset date

**Gap critici da aggiungere a v1:**
1. **Import preview** — mostrare row count, duplicate count, piattaforma rilevata, versione tracciato rilevata, confidence e sample rows prima di committare l'import
2. **Bulk categorization** — seleziona multiple expense → assegna categoria (essenziale dopo il primo import)
3. **Pattern food delivery** — Deliveroo, JustEat, Glovo, Wolt → `take-away` (utenti 25-40 anni, alta frequenza)

**Da pianificare come v2 priority:**
- UniCredit e N26 platform adapters (seconda banca italiana + target demografico Sparter)
- Column mapping UI per piattaforma General (escape hatch per banche non supportate)

**Anti-features da evitare:**
- PSD2/Open Banking — implementazioni bancarie italiane frammentate, overhead sproporzionato per v1
- Push notification per le spese — percepite come invasive dal mercato italiano
- Gamification (streak, badge)
- Tassonomia categorie modificabile dall'utente

---

## Architecture

**Directory structure:**

```
app/
├── (auth)/          # Route group — login, signup (layout minimal)
└── (app)/           # Route group — shell autenticata (sidebar, topbar)
    ├── dashboard/
    ├── expenses/
    ├── transactions/
    ├── import/      # upload → [fileId]/analyze → [fileId]/confirm
    ├── categories/
    └── profile/

lib/
├── db/              # Drizzle client singleton + schema + migrations
├── dal/             # Data Access Layer — tutte le query Drizzle
├── services/        # Business logic (categorization, import, r2)
├── actions/         # "use server" thin wrappers → validate → service → revalidatePath
└── validations/     # Zod schemas

proxy.ts            # route protection + staging bypass header
auth.ts             # Better Auth config/server helpers (root del progetto)
```

**Pattern chiave:**
- Server Components per read (dashboard KPI direttamente da DAL)
- Server Actions per mutations (thin wrapper su services)
- DAL (`lib/dal/`) centralizza tutte le query — nessun accesso DB diretto nei componenti
- `import 'server-only'` in `lib/db/index.ts` per bloccare importazioni client-side

---

## Pitfalls Critici

**C-1 — DECIMAL come stringhe:** Drizzle non converte `DECIMAL(10,2)` in number. Passare sempre la stringa raw a `new Decimal()`. Creare `toDecimal(v)` e `toDbDecimal(d)` in Fase 3 prima di qualsiasi scrittura di amount.

**C-2 — Atomicità import:** Tutto `importFile()` deve essere wrappato in `db.transaction(async (tx) => { ... })`. Tutti gli helper devono accettare `DbOrTx` invece di `typeof db` — altrimenti le scritture escono dal transaction boundary e si committa parzialmente.

**C-3 — Session fields Better Auth:** I campi custom (`subscriptionPlan`, `role`, `userId`) devono essere disponibili in sessione/server context e tipizzati. Senza questo, le feature gate (free/basic/pro) non funzionano.

**C-4 — CSV encoding:** Le banche italiane usano spesso ISO-8859-1. Il parser deve rilevare l'encoding o forzare UTF-8 con fallback.

**C-5 — Middleware edge runtime:** Drizzle (mysql2) usa Node.js `net` — crasha sull'Edge Runtime. Il middleware deve fare solo JWT check (nessuna query DB). `import 'server-only'` in `lib/db/index.ts` previene errori accidentali.

---

## Ordine di sviluppo confermato

Il documento BUSINESS_LOGIC_HANDOFF.md definisce 7 fasi. La ricerca conferma questo ordine con due modifiche: aggiungere **bulk categorization** alla Fase 3 e rendere la Fase 5 responsabile dell'intero flusso File Import v1, inclusi upload R2 via presigned URL, detection piattaforma + versione tracciato, preview, dedup e categorizzazione Tier 1 + Tier 2 gated.

| Fase | Contenuto | Dipendenze |
|------|-----------|------------|
| 1 | Design system + layout shell | — |
| 2 | Auth (Better Auth, JWT/sessione, proxy route protection) | Fase 1 |
| 3 | Expense management CRUD + bulk categorization | Fase 2 |
| 4 | Dashboard KPI | Fase 3 |
| 5 | Import file bancari: presigned R2 upload, detection piattaforma + versione tracciato, preview, dedup, categorizzazione gated | Fase 2, 3 |
| 6 | Import avanzato: regex custom utente, history refinements, strumenti subscription | Fase 5 |
| 7 | User profile | Fase 2 |

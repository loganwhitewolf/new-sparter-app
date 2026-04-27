# Sparter — Project Guide

App di personal finance per il mercato italiano. Migrazione da Express+Sequelize a Next.js 15 App Router + Drizzle ORM.

## Planning Artifacts

- `.planning/PROJECT.md` — visione e requisiti
- `.planning/ROADMAP.md` — 7 fasi con requisiti e criteri di successo
- `.planning/REQUIREMENTS.md` — 21 requisiti v1 con REQ-IDs
- `.planning/STATE.md` — stato corrente del progetto
- `.planning/research/` — ricerca stack, features, architecture, pitfalls

## GSD Workflow

Questo progetto usa GSD (Get Shit Done) per la pianificazione e l'esecuzione.

```
/gsd-progress          # Verifica dove siamo e cosa fare dopo
/gsd-plan-phase 1      # Pianifica la fase successiva
/gsd-execute-phase 1   # Esegui i piani della fase
```

## Stack

```
Next.js 16 App Router
Drizzle ORM + PostgreSQL (drizzle-kit per migrations)
Better Auth (auth provider)
Cloudflare R2 (storage file CSV/Excel)
Zod (validazione)
Decimal.js (aritmetica monetaria — OBBLIGATORIO)
Tailwind CSS + shadcn/ui
```

## Regole Assolute

### Aritmetica monetaria
MAI usare JS nativo (`+`, `-`, `*`, `/`) su amount. Sempre `Decimal.js`:
```ts
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'
const result = toDecimal(expense.amount).plus(toDecimal(other.amount))
db.insert(...).values({ amount: toDbDecimal(result) })
```

### Drizzle DECIMAL
Drizzle restituisce `DECIMAL(10,2)` come **string**, non number. Passare direttamente a `new Decimal(stringValue)`.

### Import atomicità
Tutto `importFile()` deve essere wrappato in `db.transaction(async (tx) => { ... })`. Tutti gli helper accettano `DbOrTx`:
```ts
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]
```

### Upload file
Presigned PUT URL → browser carica direttamente su R2. MAI proxiare upload attraverso server actions o route handlers.

### Better Auth
- Sostituisce NextAuth v5 — ricercare l'API corrente prima di pianificare la Fase 2
- Drizzle adapter configurato con provider `pg`; gestione sessioni, route protection proxy, campi custom utente (`subscriptionPlan`, `role`)
- Proxy: session check only, nessuna query DB diretta se edge runtime

### Drizzle migrations
MAI usare `drizzle-kit push` in produzione. Sempre `generate` + `migrate`.

## Directory Structure

```
app/
├── (auth)/          # Route group — pagine pubbliche
└── (app)/           # Route group — shell autenticata

lib/
├── db/              # Drizzle client + schema + migrations
├── dal/             # Data Access Layer (tutte le query)
├── services/        # Business logic
├── actions/         # "use server" thin wrappers
└── validations/     # Zod schemas

drizzle/seed.ts      # Seed data (portato da docs/init/seed.ts)
proxy.ts             # Route protection + staging bypass
auth.ts              # Better Auth config
```

## Seed Data

Il file `docs/init/seed.ts` contiene:
- 26 categorie (IN/OUT/system)
- ~120 subcategorie
- 6 piattaforme bancarie (General, Satispay, Intesa SP, Intesa SP CC, Revolut, Fineco)
- 28 pattern regex di sistema

Va portato in `drizzle/seed.ts` adattato allo schema Drizzle in Fase 1.

## Feature Gates Subscription

```
free:  nessuna auto-categorizzazione
basic: Tier 1 (regex) + Tier 2 (history)
pro:   Tier 1 + Tier 2 + Tier 3 AI (solo v2)
```

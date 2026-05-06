---
type: project
status: active
tags: [side-project, personal, personal-finance, privacy-first]
created: 2026-05-06
updated: 2026-05-06
---
# Sparter — Personal Finance App

## Obiettivo

Sparter è una web app di personal finance privacy-first per il mercato italiano. L'utente analizza le proprie spese caricando estratti conto CSV/Excel, senza concedere accesso diretto ai conti bancari tramite open banking.

L'obiettivo attuale è arrivare a un MVP deployabile entro Q3 2026: import bancario affidabile, deduplicazione, categorizzazione automatica, dashboard chiara e flussi operativi per correggere o rifinire le transazioni importate.

## Contesto

Side project personale. Linked area: [[area-side-projects]].

USP: l'utente mantiene il controllo dei dati bancari perché carica file esportati dalla banca; l'app normalizza i movimenti, aggrega le spese, deduplica import ripetuti/cross-platform e categorizza automaticamente con una pipeline a più livelli.

La versione nuova non è più il vecchio Sparter Express/Sequelize: è una riscrittura Next.js 16 App Router con Drizzle ORM, Better Auth, upload diretto su R2 e osservabilità strutturata.

## Stato attuale

Il prodotto è già oltre il semplice prototipo locale: le principali capability v1 sono implementate e verificate a livello di codice/test, ma non è ancora deployato in produzione.

### Completato

- [x] Migrazione core da Express/Sequelize a Next.js 16 + Drizzle
- [x] Design system e shell autenticata
- [x] Auth con Better Auth, profilo utente e route protette
- [x] CRUD spese manuali
- [x] Dashboard KPI e breakdown categorie/sottocategorie
- [x] Upload CSV/Excel con presigned PUT diretto a Cloudflare R2
- [x] Pipeline import con parsing, detection formato, preview e conferma
- [x] Deduplicazione transazioni cross-platform
- [x] Pagina Transactions con filtri URL-based e sorting sicuro
- [x] Inline categorization delle expense
- [x] Ignore expense con esclusione dai totali dashboard
- [x] Titolo custom per singola transaction, separato da `expense.name`
- [x] CRUD pattern regex custom per utenti Basic/Pro
- [x] Pattern utente con precedenza sui pattern di sistema in Tier 1
- [x] Logging strutturato Pino e health endpoint
- [x] Regole di progetto: codice e developer-facing docs in inglese; UI/domain data possono restare in italiano

### Da fare prima dell'MVP deployabile

- [ ] Deploy staging/production
- [ ] CI/CD con GitHub Actions
- [ ] Ambiente DB/R2/Auth configurato fuori dal dev locale
- [ ] UAT autenticata su database seedato per i flussi protetti
- [ ] Review log import in ambiente seedato per verificare assenza di errori visibili su duplicate import
- [ ] Hardening finale privacy/security prima della beta privata
- [ ] Decisione finale hosting: Vercel/Railway o alternativa equivalente
- [ ] Beta privata con un piccolo gruppo di utenti

## Milestones

- [x] M001 — Migration: ricostruzione Next.js/Drizzle delle feature principali della vecchia app
- [x] M002 — Observability: logging strutturato, upload instrumentation, retry browser PUT, health endpoint
- [x] M003 — Transactions, Deduplication & Inline Categorization: modello transaction/expense corretto, dedup cross-platform, Transactions page, categorizzazione/ignore inline, titoli indipendenti, pattern regex custom
- [ ] M004 — Deployment & Release Readiness: rendere l'app deployabile e verificabile in staging/production
- [ ] M005 — Private Beta: onboarding primi utenti, feedback loop, correzione bug reali

## Stack attuale

- Frontend/app: Next.js 16 App Router, React 19, TypeScript 6
- UI: Tailwind CSS, shadcn/ui, Radix UI, lucide-react, Recharts
- Database: PostgreSQL + Drizzle ORM / drizzle-kit
- Auth: Better Auth con campi custom `subscriptionPlan` e `role`
- Storage: Cloudflare R2 con upload browser-direct tramite presigned PUT
- Validation: Zod
- Monetary math: Decimal.js obbligatorio per importi e aggregazioni
- Logging/observability: Pino, pino-pretty in dev, JSON stdout in test/prod, Better Stack opzionale
- Testing: Vitest, Playwright, ESLint, production build Next
- Package manager: Yarn 4

## Architettura e concetti chiave

### Privacy-first import

Sparter non usa Plaid/open banking. Il flusso principale è: l'utente esporta un CSV/Excel dalla banca, lo carica nell'app, Sparter rileva il formato, mostra una preview e importa solo dopo conferma.

Trade-off: UX meno automatica rispetto all'open banking, ma maggiore fiducia e minore superficie privacy/security.

### Transaction vs expense

Il nuovo modello separa:

- `transaction`: movimento bancario importato, con descrizione originale e `customTitle` opzionale.
- `expense`: aggregato semantico che può includere una o più transazioni, con `total_amount` come somma.

Questa separazione evita di confondere la correzione visiva di una riga importata con il nome dell'aggregato di spesa.

### Deduplicazione

La deduplicazione cross-platform usa un hash basato su utente, data, importo normalizzato e descrizione normalizzata. Il `platformId` non fa parte dell'identità: se lo stesso movimento arriva da due esportazioni diverse, deve essere un duplicato silenzioso.

La protezione è a due livelli: filtro pre-flight nel service layer e `onConflictDoNothing()` nel DAL.

### Categorizzazione

Pipeline attuale:

1. Tier 1: regex, con pattern custom utente prima dei pattern di sistema.
2. Tier 2: history-based categorization.
3. Tier 3: AI/enrichment rimandato a v2.

Il piano Free produce expense non categorizzate; Basic e Pro usano Tier 1 + Tier 2.

### Operatività utente

L'utente può:

- vedere e filtrare tutte le transazioni importate nella sezione Transactions;
- modificare il titolo visualizzato di una singola transaction;
- rinominare un'aggregazione expense separatamente;
- categorizzare una expense inline;
- ignorare una expense e rimuoverla dai totali dashboard;
- creare pattern regex custom se ha piano Basic/Pro.

## Decisioni importanti

- Privacy-first: niente Plaid/open banking nell'MVP; solo upload file bancari.
- Import browser-direct: i file vanno dal browser a R2 tramite presigned PUT, non passano dal server applicativo.
- Monetary math: mai usare aritmetica JS nativa sugli importi; usare Decimal.js.
- Dedup cross-platform: il source platform non identifica una transaction.
- `expense.total_amount`: rappresenta un aggregato, non una singola riga bancaria.
- `transaction.customTitle`: corregge una singola riga senza modificare `expense.name`.
- Pattern custom: input regex raw o slash-delimited, storage canonico source-only.
- Codice in inglese: identificatori, route, commenti, test name, log e docs tecniche devono essere in inglese; italiano ammesso per UI copy, taxonomy e dati/fixture bancari.

## Rischi e attenzione

- Manca ancora deploy reale: molte verifiche sono locali o test-level.
- Alcuni flussi protetti richiedono UAT autenticata su DB seedato.
- La lista Transactions è bounded a 200 righe: servirà paginazione/cursoring prima di dataset grandi.
- Tier 3 AI non è implementato: l'MVP si basa su regex + history.
- Va mantenuto il confine privacy: eventuale enrichment esterno deve essere esplicito, minimizzato e non inviare dati sensibili non necessari.

## Prossime azioni consigliate

1. Preparare milestone deploy/release readiness.
2. Configurare ambiente staging con PostgreSQL, R2, Better Auth e variabili sicure.
3. Aggiungere GitHub Actions per lint, language check, Vitest, build e Playwright smoke selettivi.
4. Eseguire UAT autenticata sui flussi principali.
5. Preparare checklist privacy/security per beta privata.
6. Definire metriche minime di beta: numero utenti, file importati, duplicati evitati, categorizzazioni corrette/corrette manualmente.

## Note di lavoro

- La documentazione GSD resta la fonte interna più dettagliata per milestone, decisioni e validazioni.
- Questo file è pensato come nota sintetica per il markdown database personale, non come specifica tecnica esaustiva.
- Se si cambia architettura o deployment target, aggiornare prima le decisioni GSD e poi questa nota.

## Risorse correlate

- [[area-side-projects]]
- [[topic-llm-cost-optimization]]
- [[topic-react-tables]]
- [[topic-privacy-first-product]]
- [[topic-personal-finance]]

# Phase 2: Authentication - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

La Fase 2 consegna il sistema di autenticazione completo: registrazione con email+password, login, gestione sessione JWT persistente, route protection (redirect /dashboard → /login se non autenticato), e staging bypass via header `x-staging-key`. Usa Better Auth v1.6.9 con Drizzle adapter e MySQL.

**Non include:** OAuth/social login, password reset via email, gestione profilo utente (firstName/lastName → Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Form Registrazione
- **D-01:** Il form `/register` raccoglie **solo email + password** — nessun campo nome all'iscrizione. firstName/lastName vengono aggiunti in Phase 7 (User Profile) quando l'utente configura il profilo.
- **D-02:** Dopo la registrazione l'utente viene **reindirizzato direttamente alla `/dashboard`** (auto-login post-signup). Nessuna pagina intermedia di conferma.
- **D-03:** Il form `/login` e `/register` usano il componente `Input` shadcn (già installato) e il componente `Button` per il CTA. Il CTA del login è "Accedi", del register è "Registrati".

### UX Errori Autenticazione
- **D-04:** Gli errori vengono mostrati come **banner inline in cima al form** (alert rosso con messaggio testuale). Nessun toast globale, nessun errore per singolo campo.
- **D-05:** Il messaggio per credenziali errate è **generico**: "Credenziali non valide. Riprova o contatta il supporto." — non rivela se l'email esiste o meno (prevenzione user enumeration). Già definito in UI-SPEC Phase 1.
- **D-06:** Per email già registrata in fase di signup: messaggio generico "Si è verificato un errore. Riprova." — non rivela che l'email è già registrata.

### Staging Bypass
- **D-07:** Il bypass `x-staging-key` è attivo **in qualsiasi ambiente dove la variabile `STAGING_KEY` sia definita** (non limitato a NODE_ENV=development). Logica: `if (process.env.STAGING_KEY && request.headers.get('x-staging-key') === process.env.STAGING_KEY) → allow`.
- **D-08:** Il bypass viene implementato in `proxy.ts` — prima del controllo sessione JWT Better Auth.

### Custom User Fields
- **D-09:** I campi custom Better Auth richiesti per i feature gate futuri:
  - `subscriptionPlan`: enum `'free' | 'basic' | 'pro'`, default `'free'`
  - `role`: enum `'user' | 'admin'`, default `'user'`
  - Questi campi vanno sull'oggetto `user` della sessione Better Auth (additionalFields), non su tabella separata.
- **D-10:** Il `userId` deve essere disponibile nella sessione lato server per DAL queries (necessario da Phase 3+).

### Password Requirements
- **D-11:** Password minima: **8 caratteri** — nessun requisito di complessità (maiuscole, numeri, simboli). Validazione Zod v4: `z.string().min(8)`. Standard NIST 2023.

### Architettura Better Auth
- **D-12:** Il file di configurazione Better Auth è `auth.ts` nella root del progetto (come indicato in CLAUDE.md).
- **D-13:** Better Auth usa il **Drizzle adapter** con MySQL (`drizzle-orm/mysql2`). Le tabelle Better Auth (users, sessions, accounts, verifications) vengono generate dallo schema e migrated con `drizzle-kit generate`.
- **D-14:** Il `db` viene inizializzato nella Fase 2 in `lib/db/index.ts` sostituendo lo stub null con la connessione reale `mysql2`.

### Claude's Discretion
- Struttura esatta del Drizzle schema per Better Auth (generato dall'adapter)
- Cookie settings (HttpOnly, Secure, SameSite) — Better Auth gestisce di default
- Struttura delle route API Better Auth (`/api/auth/[...all]`)
- Zod v4 migration details (API cambiata da v3 — da verificare nella ricerca)
- Esatto formato del JWT e durata della sessione (Better Auth default)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & Architecture
- `CLAUDE.md` — Regole assolute: Better Auth sostituisce NextAuth v5, verificare API corrente, Drizzle adapter, gestione sessioni, route protection middleware, campi custom (subscriptionPlan, role); middleware edge-compatible JWT only
- `.planning/research/STACK.md` — Pattern integrazione Next.js 16 + Better Auth + Drizzle; gotchas critici
- `.planning/research/ARCHITECTURE.md` — Architettura DAL pattern, directory structure

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-02, AUTH-03 con acceptance criteria
- `.planning/ROADMAP.md` — Phase 2 success criteria (sezione Phase 2)

### Phase 1 Artifacts (integration points)
- `.planning/phases/01-design-system/01-CONTEXT.md` — Decisioni UI riusabili: proxy.ts placeholder, .env.example, lib/db/index.ts stub, componenti shadcn disponibili
- `.planning/phases/01-design-system/01-UI-SPEC.md` — Copywriting contract: testo errore credenziali, layout (auth) shell
- `proxy.ts` — Placeholder con commento Phase 2 — file da modificare
- `lib/db/index.ts` — Stub da sostituire con connessione reale
- `lib/db/schema.ts` — Schema placeholder da popolare con tabelle Better Auth

### Environment
- `.env.example` — BETTER_AUTH_SECRET, BETTER_AUTH_URL, DATABASE_URL, STAGING_KEY già documentati

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/button.tsx` — Button shadcn (New York style) per CTA form
- `components/ui/input.tsx` — Input shadcn per campi email e password
- `app/(auth)/login/page.tsx` — Stub login esistente con form statico — da trasformare in form funzionante
- `app/(auth)/layout.tsx` — Layout auth già funzionante (logo + centered form)
- `components/layout/topbar.tsx` — Avatar dropdown (Profilo/Logout) da wiring a Better Auth session

### Established Patterns
- DAL pattern: `lib/dal/` → `lib/services/` → `lib/actions/` (tutti empty .gitkeep — Phase 2 crea i primi file)
- `lib/db/index.ts` con `import 'server-only'` e `DbOrTx` type — da completare con connessione reale
- `proxy.ts` come punto di ingresso per route protection (no `middleware.ts` — Next.js 16)

### Integration Points
- `proxy.ts` — Aggiungere JWT check Better Auth + staging bypass header
- `app/(auth)/login/page.tsx` — Wiring del form a Server Action o Route Handler Better Auth
- `app/(auth)/register/page.tsx` — Nuova pagina da creare (stub in Phase 1 non esisteva)
- `app/(app)/layout.tsx` — Protected shell; il redirect avviene in proxy.ts prima del render
- `lib/db/schema.ts` — Aggiungere tabelle Better Auth (users, sessions, accounts, verifications)

</code_context>

<specifics>
## Specific Ideas

- Il bypass staging deve essere il **primo check** in proxy.ts — prima del controllo sessione, così non interferisce con Better Auth
- Il topbar mostra già "Utente / utente@example.com" come placeholder — in Phase 2 questi dati vengono popolati dalla sessione reale
- Zod v4 è installato (v4.3.6) — breaking changes rispetto a v3: l'agent di ricerca deve verificare la nuova API prima di scrivere gli schema di validazione

</specifics>

<deferred>
## Deferred Ideas

- OAuth / social login (Google, GitHub) → Out of scope v1 (REQUIREMENTS.md)
- Password reset via email → v2 (ENH-02)
- "Remember me" checkbox → non richiesto, la sessione persiste già per default
- Rate limiting login attempts → Claude's discretion in Phase 2 o deferred a Phase 6

</deferred>

---

*Phase: 02-authentication*
*Context gathered: 2026-04-24*

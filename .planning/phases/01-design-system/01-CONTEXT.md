# Phase 1: Design System - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

La Fase 1 consegna la base visiva completa dell'app Sparter: bootstrap del progetto Next.js 16, configurazione Tailwind CSS + shadcn/ui, token colore/tipografia definiti come CSS variables, layout shell `(auth)` e `(app)` navigabili, e componenti base disponibili.

**Non include:** schema Drizzle, Better Auth setup, dati reali, logica business — tutto rimandato alle rispettive fasi.

</domain>

<decisions>
## Implementation Decisions

### Navigazione & Layout Shell

- **D-01**: Voci sidebar `(app)`: **Dashboard → Spese → Import → Categorie** + **Impostazioni** in fondo (separatore). Ordine fisso.
- **D-02**: Badge uncategorized count appare su **due punti**: voce "Categorie" nella sidebar (badge numerico) + sezione KPI in Dashboard. Entrambi mostrano il conteggio delle spese non categorizzate.
- **D-03**: Mobile (< 768px): **bottom navigation bar** con le voci principali (Dashboard, Spese, Import, Categorie). Impostazioni accessibile via avatar o menu separato.
- **D-04**: Topbar `(app)`: **logo Sparter a sinistra + avatar utente a destra** con dropdown (Profilo, Logout). Nessun titolo pagina nel topbar — il titolo appare nel corpo della pagina.
- **D-05**: Layout `(auth)`: minimal, senza sidebar e topbar. Solo logo centrato + contenuto (form login/register).

### Palette & Identità Brand

- **D-06**: Brand color: **Emerald** — `emerald-600` (#059669) come `--primary`. Base color shadcn/ui: **slate**.
- **D-07**: Colori semantici KPI:
  - Entrate (totalIn): `emerald-600` ✅
  - Uscite (totalOut): `red-500` 🟥
  - Balance/neutro: `slate-700`
  - savingsRate: emerald se positivo, red se negativo

### shadcn/ui & Tipografia

- **D-08**: shadcn/ui style: **New York** — compatto, border-radius 6px (button) / 8px (card), font-weight medium. Adatto alla densità dati di un'app finance.
- **D-09**: Font: **Geist** (UI generale) + **Geist Mono** (importi, numeri KPI, tabelle finanziarie) — entrambi via `next/font/google`. Nessun CLS, zero external requests a runtime.

### Scope Bootstrap Fase 1

- **D-10**: Fase 1 include **bootstrap completo**:
  - Next.js 16 App Router inizializzato
  - Tutti i pacchetti dello stack installati (Drizzle ORM, Better Auth, @aws-sdk R2, Zod, Decimal.js, shadcn/ui)
  - `tsconfig.json` con path alias `@/`
  - Tailwind CSS configurato con CSS variables shadcn/ui
  - `.env.example` con tutte le variabili ambiente richieste
  - `lib/db/` structure placeholder (file vuoti / stub tipizzati)
  - `lib/dal/`, `lib/services/`, `lib/actions/` directory structure vuota
- **D-11**: Page stubs Fase 1: solo **`/login`** (route group `(auth)`) e **`/dashboard`** (route group `(app)`). Le altre pagine le creano le rispettive fasi.
- **D-12**: Componenti base da installare con shadcn: Button, Input, Card, Badge, Select, Dialog (Modal), Separator, Avatar, DropdownMenu, Sheet (per drawer mobile se necessario).

### Claude's Discretion

- Esatta palette CSS variables (shade variants per hover, focus, muted, etc.) — Claude può derivarle dalla base emerald/slate seguendo le convenzioni shadcn/ui
- Breakpoints esatti sidebar → bottom-nav transition (raccomandato: `md` = 768px)
- Struttura file dei componenti UI (directory `components/ui/` standard shadcn vs organizzazione custom)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Business Logic & Seed Data
- `docs/init/BUSINESS_LOGIC_HANDOFF.md` — logica business completa dell'app Express originale; schema entità, pipeline categorizzazione, piattaforme bancarie
- `docs/init/seed.ts` — 26 categorie, ~120 subcategorie, piattaforme bancarie, pattern regex — da portare in `drizzle/seed.ts` (rilevante per struttura directory Fase 1)

### Stack & Architecture
- `.planning/research/STACK.md` — pattern di integrazione Next.js 15/16 + Drizzle + Better Auth + R2; versioni pacchetti, gotchas critici
- `.planning/research/ARCHITECTURE.md` — architettura target, pattern DAL
- `CLAUDE.md` — regole assolute stack, directory structure, aritmetica monetaria, pattern upload R2

### Requirements
- `.planning/REQUIREMENTS.md` — DS-01, DS-02, DS-03 (requirements Fase 1 con acceptance criteria)
- `.planning/ROADMAP.md` — success criteria Fase 1 (sezione Phase 1)

### Note su versione stack
- STACK.md riporta "Next.js 15" ma CLAUDE.md aggiornato specifica **Next.js 16** — usare Next.js 16. Verificare versione attuale su npm prima di installare.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nessun componente esistente — progetto da zero.

### Established Patterns
- Nessun pattern esistente — Fase 1 stabilisce i pattern per tutte le fasi successive.
- La directory structure `lib/dal/ → lib/services/ → lib/actions/` è definita in CLAUDE.md e va creata in Fase 1 come struttura vuota.

### Integration Points
- `lib/db/index.ts` deve avere `import 'server-only'` per impedire import client-side (regola CLAUDE.md + STACK.md pattern 1)
- Middleware `middleware.ts` deve essere edge-compatible (solo JWT check, no DB) — placeholder in Fase 1, implementato in Fase 2
- Route groups `app/(auth)/` e `app/(app)/` sono il punto di aggancio per tutte le pagine future

</code_context>

<specifics>
## Specific Ideas

- **Geist Mono per numeri finanziari**: numeri come importi, savingsRate%, count badge devono usare Geist Mono per allineamento colonne perfetto nelle tabelle/liste
- **Badge emerald-600**: il badge uncategorized count usa il brand color (non rosso) — è un invito all'azione, non un errore
- **Bottom nav mobile**: le 4 voci principali (Dashboard, Spese, Import, Categorie) — Impostazioni NON nella bottom nav, accessibile solo via avatar dropdown o da pagina Profilo

</specifics>

<deferred>
## Deferred Ideas

- Schema Drizzle completo → Fase 2+ (ogni fase aggiunge le tabelle che usa)
- Dark mode toggle → Out of scope v1 (da REQUIREMENTS.md)
- Animazioni/transizioni sidebar → Claude's discretion nelle fasi future
- Pagine stub aggiuntive (/register, /expenses, /import, /categories, /settings) → create dalle rispettive fasi

</deferred>

---

*Phase: 01-design-system*
*Context gathered: 2026-04-24*

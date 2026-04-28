# Phase 4: Dashboard KPI - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

La Fase 4 consegna la dashboard KPI: overview del mese corrente con 5 metriche + delta, breakdown delle spese per categoria/subcategoria filtrabile per preset date, e trend mensile con 4 serie di dati per mese.

**Non include:** import file bancari (Fase 5), auto-categorizzazione (Fase 5/6), gestione profilo utente (Fase 7). La dashboard mostrerà dati da expense manuali — zeri o dati minimi sono comportamento atteso fino a Fase 5.

</domain>

<decisions>
## Implementation Decisions

### Libreria Grafici
- **D-01:** Recharts installato come dipendenza, usato tramite il componente shadcn `chart` (`components/ui/chart.tsx`). Segue già la palette Tailwind/CSS variables senza configurazione aggiuntiva.

### Breakdown Categorie
- **D-02:** Visualizzazione breakdown: **bar orizzontali con drill-down**. Lista di categorie come barre orizzontali (Recharts HorizontalBar). Click su una categoria espande le subcategorie sotto, ciascuna con la propria barra, importo e percentuale. Funziona per 5-15 categorie.
- **D-03:** Filtro tipo: **3 tab** sopra il breakdown — Uscite (default) | Entrate | Tutti. I tab selezionano il tipo da visualizzare; il preset date è un Select separato nella stessa toolbar.

### Layout KPI Overview
- **D-04:** Desktop: **5 card in fila orizzontale** (1 riga, 5 colonne). Ogni card: label, importo in Geist Mono, delta badge +/-% rispetto al mese precedente con colore emerald (positivo) / red (negativo).
- **D-05:** Mobile (< 768px): le 5 card si dispongono su **2 colonne, 3 righe** (2+2+1 centrata). Nessun scroll orizzontale.
- **D-06:** Colori KPI confermati da Phase 1: entrate = `emerald-600`, uscite = `red-500`, balance/neutro = `slate-700`, savingsRate = emerald se positivo / red se negativo.

### Trend Mensile
- **D-07:** Visualizzazione trend: **bar grouped** (Recharts BarChart con 4 Bar per mese). Una barra per serie: entrate, uscite, non categorizzato, ignorato. Chiarezza immediata nel confronto mese per mese.
- **D-08:** Toggle serie via legenda: click sulla legenda Recharts mostra/nasconde ogni serie. Default: tutte e 4 le serie visibili. Permette all'utente di isolare entrate vs uscite.

### Claude's Discretion
- Struttura esatta dei componenti React per la dashboard (suddivisione in sotto-componenti)
- Gestione loading state e skeleton mentre i dati vengono fetchati
- Exact delta badge design (icona freccia vs +/- text)
- Paginazione o limite sul numero di categorie nel breakdown
- Comportamento del drill-down (accordion animato vs espansione statica)
- Empty state della dashboard (zeri attesi fino a Fase 5 — comportamento accettato, gestione a discrezione)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Business Logic & Schema
- `docs/init/BUSINESS_LOGIC_HANDOFF.md` — sezione "Dashboard KPI": definizioni getOverview, getCategoriesBreakdown, getAggregatedTransactionsData; presets date; nota Drizzle GROUP BY con sql template literals
- `docs/init/seed.ts` — 26 categorie con type (in/out/system), slug, icon, color — struttura delle categorie disponibili

### Stack & Conventions
- `CLAUDE.md` — Decimal.js obbligatorio per amount, DAL pattern lib/dal/ → lib/services/ → lib/actions/
- `.planning/research/STACK.md` — pattern Drizzle ORM + PostgreSQL, Server Actions con Zod
- `.planning/research/ARCHITECTURE.md` — architettura DAL

### Requirements
- `.planning/REQUIREMENTS.md` — DASH-01 (overview), DASH-02 (breakdown), DASH-03 (trend mensile)
- `.planning/ROADMAP.md` — Phase 4 success criteria

### Phase Precedenti (integration points)
- `.planning/phases/01-design-system/01-CONTEXT.md` — palette emerald/slate, Geist Mono per numeri, shadcn New York style
- `.planning/phases/03-expense-management/03-CONTEXT.md` — URL search params per filtri (pattern da seguire), verifySession(), DAL structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/card.tsx` — Card già installata; usarla per le KPI cards e le sezioni della dashboard
- `components/ui/badge.tsx` — Badge già installata; usarla per i delta +/-% e per uncategorizedCount
- `components/ui/select.tsx` — Select già installata; usarla per il preset date (last-month, last-3-months, ecc.)
- `components/ui/table.tsx` — Table già installata; disponibile per breakdown tabellare se necessario
- `lib/dal/auth.ts` — `verifySession()` disponibile per proteggere le route e le Server Actions
- `lib/dal/categories.ts` — DAL categorie già presente (struttura da estendere per query aggregate)

### Established Patterns
- URL search params per i filtri (stabilito in Phase 3) — da usare anche per preset date e tipo breakdown
- DAL pattern: `lib/dal/` → `lib/services/` → `lib/actions/` — seguire per le query KPI
- Drizzle `sql` template literals per aggregazioni GROUP BY complesse (indicato in BUSINESS_LOGIC_HANDOFF.md)
- Server Components per il fetch iniziale dei dati dashboard

### Integration Points
- Route esistente: `app/(app)/dashboard/page.tsx` — attualmente placeholder, da rimpiazzare con la dashboard reale
- Badge uncategorizedCount nella sidebar (voce "Categorie") — dato già previsto in Phase 1, da collegare al conteggio reale

</code_context>

<specifics>
## Specific Ideas

- "No specific requirements — open to standard approaches" per i grafici (Recharts + shadcn chart è la scelta standard)

</specifics>

<deferred>
## Deferred Ideas

- Sparkline mini-chart nelle KPI card — non selezionato per semplicità
- Hero card balance grande in cima — non selezionato (preferita 5 card in fila)

</deferred>

---

*Phase: 04-dashboard-kpi*
*Context gathered: 2026-04-28*

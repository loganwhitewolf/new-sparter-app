---
phase: 44-overview-interactions
verified: 2026-06-08T16:24:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Apri /dashboard/overview con un anno che ha spese non categorizzate e verifica che il nudge ambra appaia nella title row"
    expected: "Un banner ambra compare sopra i KPI con testo invitazionale (senza count numerico), link 'Categorizza ora' e pulsante X di dismiss"
    why_human: "Il componente OverviewNudge ha visible=false come default SSR-safe; la logica di visibilità si attiva solo dopo il mount client-side (useEffect)"
  - test: "Clicca X sul nudge, ricarica la pagina e verifica che resti nascosto"
    expected: "Il nudge non riappare dopo dismiss; il valore lastSeenCount è scritto in localStorage sotto la chiave sparter-overview-nudge-{year}"
    why_human: "Comportamento localStorage non verificabile con rendering statico; richiede interazione browser reale"
  - test: "Verifica che il nudge ricompaia quando il count supera l'ultimo lastSeenCount dismissato"
    expected: "Dopo dismiss con count=5, se il count sale a 8 il nudge riappare al prossimo caricamento pagina"
    why_human: "Richiede simulazione di nuovi movimenti non categorizzati e reload pagina nel browser"
  - test: "Apri /dashboard/overview e verifica che il link 'Categorizza ora' navighi a /transactions?status=uncategorized&months=YYYY-MM,... per tutti i 12 mesi dell'anno selezionato"
    expected: "URL della destinazione contiene status=uncategorized e 12 token YYYY-MM dell'anno corrente separati da virgola"
    why_human: "Verifica navigazione e costruzione URL richiede interazione browser; params sono generati dinamicamente"
  - test: "Clicca i chip Entrate (Ricorrenti, Straordinarie) e verifica che solo la barra verde cambi; i KPI rimangono invariati"
    expected: "La barra Entrate del mese si riduce quando si deseleziona un bucket; le card KPI (Totale entrate, Totale uscite, Bilancio, Tasso risparmio) non cambiano"
    why_human: "Interazione chip e verifica isolamento KPI richiedono rendering client-side con stato React attivo"
  - test: "Clicca i chip Uscite (tutti e sei: essenziale, discrezionale, operativo, finanziario, debito, straordinario) e verifica che solo la barra rossa cambi"
    expected: "La barra Uscite si riduce/azzera in funzione dei chip selezionati; la barra Entrate è indifferente ai chip Uscite e viceversa"
    why_human: "Interazione chip richiedono rendering client-side con stato React attivo"
  - test: "Deseleziona tutti i chip di un gruppo (es. tutte le Uscite) e verifica che il grafico resti visibile con barra a zero"
    expected: "Il grafico non mostra un empty-state alternativo; rimane la barra a 0 in quella posizione"
    why_human: "Comportamento D-08 (all-off allowed, no competing empty-state panel) richiede verifica visuale nel browser"
  - test: "Apri il popover ⓘ accanto al gruppo Entrate e accanto al gruppo Uscite"
    expected: "Ogni popover mostra una riga descrittiva del gruppo in italiano; i due popover hanno contenuti distinti"
    why_human: "Il contenuto dei Popover è portaled e non appare in rendering statico; richiede interazione browser"
  - test: "Posiziona il cursore su ciascun chip (Ricorrenti, Straordinarie e i sei chip Uscite)"
    expected: "Ogni chip mostra un tooltip con definizione in italiano di una riga derivata da NATURE_LABELS"
    why_human: "Il contenuto dei Tooltip è portaled e non appare in rendering statico; richiede interazione browser"
  - test: "Verifica il comportamento responsive del blocco chip-filter a viewport mobile (<768px)"
    expected: "I chip si wrappano correttamente, i popover e tooltip rimangono accessibili senza overflow orizzontale"
    why_human: "Layout responsive richiedono verifica visuale; non verificabile con grep o test unitari"
---

# Phase 44: Overview Interactions Verification Report

**Phase Goal:** Deliver the interactive layer of the overview dashboard — uncategorized nudge (NUDGE-01..04), chart filter chips for income and expense natures (FILT-01..03), and FlowNature education popovers (EDU-01..02).
**Verified:** 2026-06-08T16:24:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Una funzione helper pura somma solo i bucket income/out selezionati ed esclude gli altri | VERIFIED | `sumSelected` in `overview-chart-utils.ts` usa `toDecimal().plus()` iterando solo i `includedKeys`; test `filters income buckets` e `filters expense buckets` passano |
| 2 | Disabilitare tutti i bucket income restituisce entrate=0 ma il helper torna comunque una riga | VERIFIED | Test `all-off: empty selections return { label, entrate: 0, uscite: 0 }` passa; `deriveFilteredBarRow(FIXTURE, [], [])` restituisce row con entrate=0, uscite=0 |
| 3 | Il helper filter non legge, muta o ricalcola i totali KPI | VERIFIED | `deriveFilteredBarRow` ritorna solo `{ label, entrate, uscite }`; test `KPI independence` asserisce esattamente queste tre chiavi; nessun campo KPI nel tipo di ritorno |
| 4 | Quando l'anno selezionato ha spese OUT non categorizzate, un nudge ambra appare inline nella title row | VERIFIED (parziale - wiring server-side confermato) | `OverviewNudge` è importato e renderizzato in `page.tsx` con `overview.uncategorizedCount` e `year`; `getOverview()` chiama `getUncategorizedCount()` sotto `verifySession()`; la logica di visibilità client-side richiede verifica browser |
| 5 | Il nudge è assente quando il count è zero | VERIFIED | `shouldShowNudge(0, null) === false`; test `zero count is always hidden` passa; il componente ritorna `null` quando `!visible` |
| 6 | Il nudge offre un link 'Categorizza ora' a `/transactions?status=uncategorized&months=...` e un controllo X di dismiss | VERIFIED | `overview-nudge.tsx` righe 109-113 costruisce l'href con `URLSearchParams`; riga 128-130 Link con testo "Categorizza ora"; riga 133-135 button con `aria-label="Chiudi avviso"` e icona X |
| 7 | Il dismiss persiste in localStorage (year-scoped, lastSeenCount) e non scrive mai sul DB | VERIFIED | `dismiss()` scrive `localStorage.setItem(key, JSON.stringify({ lastSeenCount: ... }))` riga 101-103; chiave `sparter-overview-nudge-{year}` riga 38; nessun import di server action o DB |
| 8 | Il nudge riappare quando il count supera l'ultimo count dismissato | VERIFIED | `shouldShowNudge(8, { lastSeenCount: 5 }) === true`; test `reappears when new uncategorized arrive above lastSeenCount` passa |
| 9 | L'utente può attivare/disattivare i chip income (Ricorrenti/Straordinarie) per includere/escludere i bucket dalla barra verde Entrate | VERIFIED | `OverviewChart` inizializza `includedIncome = new Set(INCOME_KEYS)` e `handleToggleIncome` usa add/delete; `rows = data.map(p => deriveFilteredBarRow(p, [...includedIncome], [...includedOut]))`; test `-t income` passa |
| 10 | L'utente può attivare/disattivare i sei chip natura-spesa per includere/escludere i bucket dalla barra rossa Uscite | VERIFIED | `includedOut = new Set(OUT_KEYS)` e `handleToggleOut`; test `-t expense` passa |
| 11 | Il grafico rimane a due barre per mese senza stacking e senza serie balance; default all-on | VERIFIED | `overview-chart.tsx` contiene `dataKey="entrate"` e `dataKey="uscite"` (due Bar); `grep -c "stackId"` = 0; state inizializzato con `new Set(INCOME_KEYS)` e `new Set(OUT_KEYS)` |
| 12 | I totali KPI non cambiano in risposta allo stato chip | VERIFIED | `KpiRow data={overview}` in `page.tsx` riga 36; nessuno stato chip raggiunge `KpiRow`; chip state in `OverviewChart` non passato al parent RSC |
| 13 | Un ⓘ popover è posizionato accanto ai gruppi filtro Entrate e Uscite; ogni chip mostra un tooltip di una riga | VERIFIED | `overview-chart-filters.tsx` importa Popover e Tooltip; `aria-label="Informazioni sul gruppo Entrate"` e `aria-label="Informazioni sul gruppo Uscite"` presenti; `TooltipProvider` wrappa il subtree dei chip; test `-t education` (6 casi) e `-t tooltip` (4 casi) passano |

**Score:** 9/9 must-have groups verified (13 truths atomiche verificate)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/dashboard/overview/overview-chart-utils.ts` | Pure helpers + key constants | VERIFIED | 82 righe; esporta `OUT_KEYS`, `INCOME_KEYS`, `OutKey`, `IncomeKey`, `sumSelected`, `deriveFilteredBarRow`; nessun `'use client'`; `toDecimal` usato 2+ volte |
| `tests/overview-interactions.test.tsx` | Scaffold test condiviso Phase 44 | VERIFIED | 183 righe; contiene `deriveFilteredBarRow`, test `income`, `expense`, `KPI`, `nudge`, `lastSeenCount`, `education`, `tooltip`; 21 test passano |
| `components/dashboard/overview/overview-nudge.tsx` | Client island con dismissal localStorage | VERIFIED | 142 righe; esporta `OverviewNudge` e `shouldShowNudge`; localStorage letto in `useEffect`, non in `useState`; chiave year-scoped; nessun DB write |
| `app/(app)/dashboard/overview/page.tsx` | Wiring nudge con `uncategorizedCount` + `year` | VERIFIED | Importa `OverviewNudge`; renderizza `<OverviewNudge uncategorizedCount={overview.uncategorizedCount} year={year} />`; `KpiRow data={overview}` invariato |
| `components/dashboard/overview/overview-chart-filters.tsx` | Chip Entrate + Uscite con popovers e tooltips | VERIFIED | 222 righe; esporta `OverviewChartFilters`; usa `@/components/ui/popover`, `@/components/ui/tooltip`; `TooltipProvider` wrappa subtree; `aria-pressed` presente; `NATURE_LABELS` usato |
| `components/dashboard/overview/overview-chart.tsx` | Chart filter-aware con chip state | VERIFIED | Importa `deriveFilteredBarRow`, `OverviewChartFilters`; stato `includedIncome`/`includedOut` chart-local; nessun `localStorage`/`useSearchParams`; `selectedMonth` seam P45 preservato; due Bar, nessun `stackId` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `overview-chart-utils.ts` | `lib/utils/decimal` | `toDecimal` import | WIRED | Import riga 2; usato in `sumSelected` righe 44-45 |
| `overview-chart-utils.ts` | `lib/dal/overview` | `OverviewChartPoint` type import | WIRED | Import riga 3; usato come tipo parametro di `deriveFilteredBarRow` |
| `app/(app)/dashboard/overview/page.tsx` | `overview-nudge.tsx` | renderizza `OverviewNudge` con `overview.uncategorizedCount` e `year` | WIRED | Import riga 9; render riga 35 |
| `overview-nudge.tsx` | `/transactions` | Link `Categorizza ora` con `status=uncategorized` + mesi anno | WIRED | Righe 109-113 `URLSearchParams` con `status=uncategorized`; `APP_ROUTES.transactions` usato |
| `overview-chart.tsx` | `overview-chart-utils.ts` | `deriveFilteredBarRow` su chiavi income/out incluse | WIRED | Import riga 16-21; usato riga 84 |
| `overview-chart.tsx` | `overview-chart-filters.tsx` | renderizza `OverviewChartFilters` con chip state | WIRED | Import riga 22; render righe 90-96 |
| `overview-chart-filters.tsx` | `components/ui/popover` | group ⓘ legend popover (EDU-01) | WIRED | Import righe 6-9; usato righe 144-162 e 178-195 |
| `overview-chart-filters.tsx` | `components/ui/tooltip` | per-chip `TooltipProvider`/`Tooltip` (EDU-02) | WIRED | Import righe 11-15; `TooltipProvider` riga 137; `Tooltip` in `FilterChip` righe 89-110 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produce Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `OverviewNudge` | `uncategorizedCount` | `getOverview(year)` → `getUncategorizedCount(userId, from, to)` | Si: query DB `dal/overview.ts` riga 141 con `verifySession()` | FLOWING |
| `OverviewChart` | `rows` (bar data) | `data` prop da `getOverviewChart(year)` | Si: DAL query `OverviewChartPoint[]` con bucket reali per mese | FLOWING |
| `OverviewChartFilters` | `includedIncome`, `includedOut` | `useState` in `OverviewChart` | Stato transiente client React (corretto per D-09, non richiede DB) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 21 test Phase 44 passano | `yarn test tests/overview-interactions.test.tsx` | 21 passed (1 file) | PASS |
| Test income (FILT-01) | `yarn test tests/overview-interactions.test.tsx -t "income"` | 4 passed | PASS |
| Test expense (FILT-02) | `yarn test tests/overview-interactions.test.tsx -t "expense"` | 3 passed | PASS |
| Test KPI independence (FILT-03) | `yarn test tests/overview-interactions.test.tsx -t "KPI"` | 1 passed | PASS |
| Test nudge (NUDGE-01..04) | `yarn test tests/overview-interactions.test.tsx -t "nudge"` | 7 passed | PASS |
| Test lastSeenCount (NUDGE-03) | `yarn test tests/overview-interactions.test.tsx -t "lastSeenCount"` | 2 passed | PASS |
| Test education (EDU-01) | `yarn test tests/overview-interactions.test.tsx -t "education"` | 6 passed | PASS |
| Test tooltip (EDU-02) | `yarn test tests/overview-interactions.test.tsx -t "tooltip"` | 4 passed | PASS |

### Probe Execution

Step 7c: nessuna probe script dichiarata nei PLAN files di questa fase. Non ci sono file `scripts/*/tests/probe-*.sh` rilevanti.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| NUDGE-01 | 44-02-PLAN.md | Nudge ambra inline quando ci sono OUT non categorizzate | SATISFIED | `OverviewNudge` wired in `page.tsx` con `overview.uncategorizedCount`; `shouldShowNudge(5, null) === true` |
| NUDGE-02 | 44-02-PLAN.md | Link "Categorizza ora" + X dismiss | SATISFIED | Link con `status=uncategorized` + `months` in `overview-nudge.tsx` righe 125-130; button dismiss riga 132-138 |
| NUDGE-03 | 44-02-PLAN.md | Dismiss in localStorage; riappare con lastSeenCount | SATISFIED | `sparter-overview-nudge-{year}` chiave; `shouldShowNudge(8, { lastSeenCount: 5 }) === true` test passa |
| NUDGE-04 | 44-02-PLAN.md | Nudge nascosto con zero non categorizzate | SATISFIED | `shouldShowNudge(0, null) === false`; `return null` quando `!visible` |
| FILT-01 | 44-01-PLAN.md, 44-03-PLAN.md | Filtro chart income bars per tipo | SATISFIED | Chip Ricorrenti/Straordinarie in `OverviewChartFilters`; `handleToggleIncome` in `OverviewChart`; test income passa |
| FILT-02 | 44-01-PLAN.md, 44-03-PLAN.md | Filtro chart expense bars per natura | SATISFIED | 6 chip OUT in `OverviewChartFilters`; `handleToggleOut` in `OverviewChart`; test expense passa |
| FILT-03 | 44-01-PLAN.md, 44-03-PLAN.md | Filtri chart non influenzano KPI | SATISFIED | `deriveFilteredBarRow` ritorna solo `{ label, entrate, uscite }`; `KpiRow` non riceve chip state; test KPI independence passa |
| EDU-01 | 44-03-PLAN.md | Popover ⓘ accanto ai gruppi Entrate e Uscite | SATISFIED | `Popover` con `aria-label="Informazioni sul gruppo Entrate/Uscite"` in `overview-chart-filters.tsx`; test education passa |
| EDU-02 | 44-03-PLAN.md | Tooltip per chip con definizione di una riga | SATISFIED | `TooltipProvider` + `Tooltip`/`TooltipContent` per ogni chip in `FilterChip`; test tooltip passa |

**Nessun requisito orfano:** tutti i 9 requirement ID (NUDGE-01..04, FILT-01..03, EDU-01..02) sono dichiarati nei PLAN e verificati.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `overview-nudge.tsx` | 44, 54, 56, 106 | `return null` | Info | Comportamento corretto — non è uno stub. `return null` in `readStored()` è error-handling; riga 106 è la logica condizionale SSR-safe necessaria |
| Nessun `TBD`, `FIXME`, `XXX` nei file modificati da questa fase | — | — | — | — |

Nota: i `return null` in `overview-nudge.tsx` NON sono stub — sono il pattern SSR-safe corretto (`visible=false` default, il componente ritorna `null` prima dell'idratazione) più gestione errori nel parser localStorage. Nessun pattern di stub reale trovato.

### Human Verification Required

Tutte le verifiche automatiche passano (21/21 test, tutti gli artifact wired e sostanziali, data-flow reale). Le seguenti verifiche richiedono interazione browser perché coinvolgono comportamenti client-side non riproducibili con rendering statico:

#### 1. Nudge visibile con movimenti non categorizzati

**Test:** Apri `/dashboard/overview?year=YYYY` con un anno che ha spese OUT non categorizzate
**Expected:** Banner ambra compare sopra i KPI con testo "Hai movimenti da categorizzare", link "Categorizza ora", pulsante X — senza count numerico nel testo
**Why human:** `OverviewNudge` ha `visible=false` come default SSR-safe; la visibilità si attiva in `useEffect` dopo mount client — non verificabile con rendering statico

#### 2. Dismiss persiste tra i reload

**Test:** Clicca X sul nudge, ricarica la pagina per lo stesso anno
**Expected:** Il nudge rimane nascosto; `localStorage.getItem('sparter-overview-nudge-{year}')` contiene `{ lastSeenCount: N }`
**Why human:** Scrittura/lettura localStorage e persistenza across reload non verificabili staticamente

#### 3. Nudge ricompare con nuovi non categorizzati

**Test:** Simula un count che supera l'ultimo `lastSeenCount` dismissato e ricarica
**Expected:** Il nudge riappare al successivo caricamento pagina
**Why human:** Richiede manipolazione dati o localStorage + reload nel browser

#### 4. CTA link naviga correttamente

**Test:** Clicca "Categorizza ora" e verifica l'URL di destinazione
**Expected:** `/transactions?status=uncategorized&months=2024-01,2024-02,...,2024-12` per l'anno 2024
**Why human:** Navigazione e costruzione URL con parametri dinamici richiede verifica browser

#### 5. Chip Entrate isolano solo la barra verde

**Test:** Deseleziona "Straordinarie" nel gruppo Entrate con dati reali per un anno
**Expected:** La barra verde (Entrate) del mese si riduce dell'importo straordinario; le card KPI rimangono invariate
**Why human:** Interazione chip e verifica isolamento KPI richiedono stato React attivo nel browser

#### 6. Chip Uscite isolano solo la barra rossa

**Test:** Deseleziona alcuni chip Uscite (es. "Discrezionale" e "Operativo")
**Expected:** La barra rossa (Uscite) si riduce dei bucket esclusi; la barra verde è invariata
**Why human:** Interazione chip richiedono rendering client-side attivo

#### 7. All-off mantiene il grafico visibile

**Test:** Deseleziona tutti e sei i chip Uscite
**Expected:** La barra Uscite scende a zero per ogni mese ma il grafico non mostra un empty-state alternativo
**Why human:** Comportamento D-08 (zero bar, no competing empty-state) richiede verifica visuale

#### 8. Popover ⓘ mostrano il contenuto corretto

**Test:** Clicca ⓘ accanto a "Entrate" e poi ⓘ accanto a "Uscite"
**Expected:** Ogni popover mostra una riga descrittiva distinta in italiano; i popover si chiudono cliccando fuori
**Why human:** Contenuto Radix Popover è portaled — non compare in `renderToStaticMarkup`

#### 9. Tooltip per chip mostrano le definizioni

**Test:** Hover su ogni chip (Ricorrenti, Straordinarie, Essenziale, Discrezionale, Operativo, Finanziario, Debito, Straordinario uscite)
**Expected:** Ogni chip mostra una definizione di una riga in italiano derivata da `NATURE_LABELS`
**Why human:** Contenuto Radix Tooltip è portaled — non compare in `renderToStaticMarkup`

#### 10. Layout responsive chip-filter

**Test:** Verifica il blocco filtri a viewport mobile (< 768px)
**Expected:** I chip si wrappano senza overflow orizzontale; popovers e tooltips rimangono accessibili
**Why human:** Layout responsive richiede verifica visuale nel browser

---

## Summary

**Tutti e 9 i must-have group sono verificati a livello di codebase.** L'implementazione è sostanziale e completamente cablata:

- `overview-chart-utils.ts` (82 righe) esporta i 6 simboli richiesti con aritmetica Decimal-safe
- `overview-nudge.tsx` (142 righe) implementa SSR-safe localStorage con lastSeenCount semantics senza DB write
- `overview-chart-filters.tsx` (222 righe) è un controlled component con Popover, Tooltip, `aria-pressed` chips
- `overview-chart.tsx` integra `deriveFilteredBarRow`, monta `OverviewChartFilters`, preserva il seam P45
- `page.tsx` wira `OverviewNudge` con dati reali dal DAL
- 21 test passano coprendo tutti i requirement ID con filtri `-t` nominati correttamente
- I commit dichiarati (848d322, b32ea17, 6564b12, 0915715, b505b31, b32a398, 64dc366, 8fb307c) esistono tutti nel repository

Lo status `human_needed` riflette esclusivamente la necessità di verificare i comportamenti client-side interattivi (localStorage, chip toggle, popovers portaled, tooltips portaled) nel browser — non indica gap di implementazione.

---

_Verified: 2026-06-08T16:24:00Z_
_Verifier: Claude (gsd-verifier)_

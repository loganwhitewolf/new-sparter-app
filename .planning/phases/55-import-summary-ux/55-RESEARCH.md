# Phase 55: import-summary-ux - Research

**Researched:** 2026-06-21
**Domain:** Next.js App Router — UI cleanup, legacy code removal, copy/UX polish
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SUMUI-03 — "Discovery is a separate step" cue**
- D-01: Il cue vive esclusivamente nella **suggestions page** (`/import/[fileId]/suggestions`). La CTA post-import in `ImportPreview` ("X pattern proposti — Rivedi suggerimenti") non si tocca.
- D-02: Il cue è un **paragrafo descrittivo** (`p.text-muted-foreground`) sotto l'`h1 "Suggerimenti pattern"` esistente. Niente Alert/banner — frase informativa. Deve comunicare: (a) i pattern sono stati rilevati dalle transazioni non categorizzate di questa piattaforma dopo l'import, (b) si può ricontrollare dal tab Importazioni.

**SUMUI-02 — Separazione visiva regex vs single-categorization**
- D-03: Usare **intestazioni di sezione con breve testo introduttivo** per ciascun gruppo. Il layout card-heavy (regex) vs compact-row (single-cat) già differenzia strutturalmente — nessun nuovo icon, colore o elemento. Solo etichette heading + 1 riga descrittiva per ciascuna sezione.
- D-04: I single-categorization item restano **read-only informativi** — nessuna azione, CTA o link. L'utente li categorizza manualmente dalla pagina Spese.

**SUMUI-01 — Cap example transactions**
- D-05: Cap a **10** righe nel campione mostrato in `ImportPreview` (la tabella della analyze page). Il parser/service può mantenere fino a 25 per uso interno; la UI esegue il `.slice(0, 10)` a render time (o nel punto più naturale — discrezione del planner).

**Legacy cleanup — rimozione detectPatternSuggestions dal flusso analyze**
- D-06: Rimuovere la chiamata a `detectPatternSuggestions()` da `analyzeImportAction` in `lib/services/import.ts` (blocco `// TODO Phase 55: remove`, righe ~301–316).
- D-07: Rimuovere il campo `patternSuggestions` da `ImportAnalysisResult` e dall'oggetto restituito in `lib/services/import.ts`.
- D-08: Rimuovere `<SuggestionSection>` da `ImportPreview` (`components/import/import-preview.tsx`) e il suo import. La analyze page non mostra più suggerimenti pre-import.
- D-09: **Eliminare** la funzione `detectPatternSuggestions()` (e `detectPatternSuggestionsWithMeta()` se non ha consumatori rimanenti) da `lib/utils/pattern-suggestions.ts`, insieme ai test. Il planner deve prima eseguire grep per consumatori non-discovery; se ne sopravvivono, lasciare la funzione e annotarlo.

### Claude's Discretion
- Testo italiano esatto per il sotto-heading nella suggestions page (tono: informativo, non promozionale).
- Etichette esatte per le due sezioni in SuggestionSection (es. "Pattern proposti" vs "Transazioni identiche — nessun pattern").
- Testo descrittivo di 1 riga sotto ciascuna intestazione di sezione.
- Se il cap delle sampleRows (D-05) viene applicato in `ImportPreview` a render time o spinto nel service/type — purché la UI mostri ≤10.
- Se `detectPatternSuggestionsWithMeta()` va eliminata o mantenuta (dipende dai risultati del grep).

### Deferred Ideas (OUT OF SCOPE)
- Link dai single-cat item alla pagina Spese filtrata per descrizione.
- Quick-categorize inline per single-cat items.
- Bulk "ricontrolla tutto" su tutte le piattaforme (rimandato in Phase 54).
- Dismissal persistente dei suggerimenti (DISM-01).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUMUI-01 | Import summary mostra al massimo 10 transazioni di esempio | `result.sampleRows` in ImportPreview si mappa senza slice — basta aggiungere `.slice(0, 10)` inline. `DEFAULT_SAMPLE_SIZE = 25` rimane invariato nel parser. [VERIFIED: codebase] |
| SUMUI-02 | La import summary separa visivamente regex candidates da single-categorization suggestions | `SuggestionSection` già ha due `<section>` separate con `aria-label`; serve solo polish heading + intro text. [VERIFIED: codebase] |
| SUMUI-03 | L'utente viene informato che la regex discovery avviene come step separato dopo l'import | La suggestions page ha già un `p.text-muted-foreground` sotto l'`h1` — va arricchito con il messaggio richiesto. [VERIFIED: codebase] |
</phase_requirements>

---

## Summary

Phase 55 è interamente un cleanup/polish UI: niente nuovi servizi, niente nuove rotte, niente schema DB. I tre requirement (SUMUI-01/02/03) sono tutti modifiche di bassa complessità tecnica a componenti già esistenti.

Il lavoro si divide in due famiglie: (1) **cleanup legacy** — rimozione della chiamata `detectPatternSuggestions` dal flusso analyze, del campo `patternSuggestions` dal tipo e dal component `ImportPreview`; (2) **polish UI** — cap sampleRows a 10, miglioramento heading/intro in `SuggestionSection`, aggiunta paragrafo SUMUI-03 nella suggestions page.

La parte più delicata è il cleanup: va fatto con attenzione ai test esistenti che coprono `patternSuggestions`, `detectPatternSuggestions` e `SuggestionSection` in `ImportPreview`. Quei test devono essere aggiornati o rimossi insieme al codice. La funzione `detectPatternSuggestionsWithMeta()` sopravvive: è consumata da `lib/services/regex-discovery.ts` che è il servizio post-import attuale.

**Primary recommendation:** Eseguire prima il cleanup legacy (rimozione `patternSuggestions` + `detectPatternSuggestions`), poi il polish UI (SuggestionSection headings, sub-heading SUMUI-03, sampleRows cap). Questo ordine minimizza la probabilità di conflitti tra i task.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cap sampleRows a 10 | Frontend Server (RSC) / Client Component | — | `ImportPreview` è un Client Component; il slice avviene a render time in JSX |
| Heading/intro text SuggestionSection | Client Component | — | `SuggestionSection` è 'use client'; solo markup e copy |
| Sub-heading SUMUI-03 | Frontend Server (RSC) | — | `suggestions/page.tsx` è un Server Component async |
| Rimozione detectPatternSuggestions | API / Backend service | — | `lib/services/import.ts` + `lib/utils/pattern-suggestions.ts` |
| Rimozione patternSuggestions da ImportAnalysisResult | API / Backend service + Client Component | — | tipo in import.ts + consumo in ImportPreview |
| Aggiornamento test | Test layer | — | Vitest; suite da aggiornare insieme al codice |

---

## Standard Stack

### Core (nessuna dipendenza nuova)

Questa phase non installa pacchetti. Usa lo stack esistente:

| Library | Purpose | Status |
|---------|---------|--------|
| React 19 / Next.js 16 App Router | RSC + Client Components | Già installato |
| Tailwind CSS + shadcn/ui | Styling; `p`, `h2`, `section` | Già installato |
| Vitest 4.x | Test runner | Già installato |

**Nessun pacchetto da installare.** [VERIFIED: codebase]

---

## Package Legitimacy Audit

Nessun pacchetto esterno installato in questa phase.

| Package | Verdict | Disposition |
|---------|---------|-------------|
| — | — | Nessuna installazione |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Analyze Flow (PRIMA di Phase 55):
  analyzeFile → detectPatternSuggestions → ImportAnalysisResult.patternSuggestions
                                                    ↓
                                           ImportPreview → <SuggestionSection> (pre-import)

Analyze Flow (DOPO Phase 55):
  analyzeFile → ImportAnalysisResult (patternSuggestions RIMOSSO)
                                                    ↓
                                           ImportPreview (SuggestionSection RIMOSSO)

Post-import Suggestions Flow (invariato):
  confirmImport → discoverRegexCandidates
                        ↓
        /import/[fileId]/suggestions → SuggestionSection (Polish SUMUI-02)
                        ↓
              [h1] + [p SUMUI-03] + [candidates section] + [singleSuggestions section]
```

### Recommended Project Structure

Nessun nuovo file. Tutti i cambiamenti avvengono su file esistenti:

```
components/import/
├── import-preview.tsx        # Rimuove SuggestionSection + slice sampleRows a 10 (SUMUI-01, D-08)
└── suggestion-section.tsx    # Polish heading + intro text per entrambe le sezioni (SUMUI-02)

app/(app)/import/[fileId]/suggestions/
└── page.tsx                  # Aggiunge paragrafo SUMUI-03 (D-01, D-02)

lib/
├── services/import.ts        # Rimuove detectPatternSuggestions call + patternSuggestions field (D-06, D-07)
└── utils/pattern-suggestions.ts  # Elimina detectPatternSuggestions (D-09); mantenere detectPatternSuggestionsWithMeta

tests/
├── import-preview-ui.test.tsx           # Aggiornare: rimuovere test REV-01 su patternSuggestions
├── import-analyze-page.test.tsx         # Aggiornare: rimuovere patternSuggestions da analysisResult helper
├── import-service.test.ts               # Aggiornare: rimuovere tutti i test ANL-01/ANL-03 su patternSuggestions
├── import-actions.test.ts               # Aggiornare: rimuovere patternSuggestions da fixture
├── pattern-suggestion-detector.test.ts  # ELIMINARE: testa solo detectPatternSuggestions (da rimuovere)
└── import-suggestions-page.test.tsx     # Aggiornare: copy test D-08 che verifica il vecchio subtitle
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Truncazione lista renderizzata | Custom pagination component | `.slice(0, 10)` inline in JSX | Caso strettamente UI, nessuna logica di stato necessaria |
| Separazione visiva sezioni | Layout grid custom | Due `<section>` con `aria-label` già presenti in `SuggestionSection` | Struttura già corretta, serve solo polish heading |

---

## Runtime State Inventory

> Non applicabile — questa è una phase di UI cleanup/polish su Next.js. Nessun rename di entità, nessuna migrazione di dati, nessun cambio di rotta o schema DB.

**Stored data:** None — nessun record DB cambia.
**Live service config:** None.
**OS-registered state:** None.
**Secrets/env vars:** None.
**Build artifacts:** None — rimozione di codice non genera artefatti stale.

---

## Common Pitfalls

### Pitfall 1: Test legacy su patternSuggestions non aggiornati

**What goes wrong:** I test in `import-service.test.ts` (ANL-01, ANL-03) e `import-preview-ui.test.tsx` (REV-01) testano `patternSuggestions` sul tipo e sul component. Se il codice viene rimosso senza aggiornare i test, la suite rompe.

**Why it happens:** Il tipo `ImportAnalysisResult.patternSuggestions` è referenziato sia nel service che nei test di UI attraverso `baseResult`.

**How to avoid:** Aggiornare/eliminare i test nello stesso task che rimuove il codice. Non separare la rimozione del codice dall'aggiornamento dei test.

**Warning signs:** `Property 'patternSuggestions' does not exist on type 'ImportAnalysisResult'` a compile time; fallimento dei test REV-01 in `import-preview-ui.test.tsx`.

---

### Pitfall 2: Eliminazione errata di detectPatternSuggestionsWithMeta

**What goes wrong:** D-09 dice di eliminare `detectPatternSuggestionsWithMeta()` se non ha consumatori rimanenti. Ma `lib/services/regex-discovery.ts` la importa e la usa (riga 10 e 105). Eliminarla romperebbe il discovery service post-import.

**Why it happens:** Il CONTEXT.md richiede un grep preventivo. Se non eseguito, si elimina una funzione ancora in uso.

**How to avoid:** Eseguire `grep -rn "detectPatternSuggestionsWithMeta"` prima di eliminare. Risultato atteso: trovata in `lib/services/regex-discovery.ts` → **non eliminare**. Solo `detectPatternSuggestions()` (la variante senza Meta) può essere rimossa.

**Warning signs:** `Cannot find module '@/lib/utils/pattern-suggestions'` o `export 'detectPatternSuggestionsWithMeta' not found`.

---

### Pitfall 3: TypeScript compile error su ImportPreview dopo rimozione campo

**What goes wrong:** Dopo aver rimosso `patternSuggestions` da `ImportAnalysisResult`, il type `Props` di `ImportPreview` (che accetta `result: ImportAnalysisResult`) e tutti i suoi test che costruiscono `baseResult` devono essere aggiornati contestualmente.

**Why it happens:** TypeScript è strict; qualsiasi fixture di test che include `patternSuggestions: []` nel tipo aggiornato causerà "Object literal may only specify known properties".

**How to avoid:** Aggiornare le fixture dei test nello stesso task che rimuove il campo dal tipo.

---

### Pitfall 4: aria-label su <section> da non perdere nel refactor heading

**What goes wrong:** `SuggestionSection` ha `aria-label` su entrambe le `<section>`. Il refactor dei heading non deve rimuovere questi attributi, altrimenti si perde accessibilità.

**Why it happens:** Facile dimenticare l'attributo quando si riscrive il contenuto della section.

**How to avoid:** Mantenere `aria-label` invariato (o aggiornarlo in modo coerente con il nuovo testo heading). I valori attuali sono: `"Suggerimenti pattern"` e `"Transazioni identiche senza categoria"`.

---

## Code Examples

### Consumatori esistenti da aggiornare (inventario completo)

**[VERIFIED: codebase grep]**

`detectPatternSuggestions` è consumata solo in:
- `lib/services/import.ts` riga 29 (import) e righe 313-314 (call) — **da rimuovere** (D-06)
- `lib/utils/pattern-suggestions.ts` — **da eliminare** (D-09)
- `tests/pattern-suggestion-detector.test.ts` — **da eliminare** (intero file)
- `tests/pattern-suggestion-detector-meta.test.ts` riga 4 (import per parity test) — **da aggiornare** (rimuovere il test di parità che usa entrambe)
- `tests/import-service.test.ts` riga 34 (mock), righe 1618, 1622-1680+ — **da aggiornare** (rimuovere i test ANL-01, ANL-03)

`detectPatternSuggestionsWithMeta` è consumata in:
- `lib/services/regex-discovery.ts` righe 10, 105 — **NON eliminare**
- `lib/utils/pattern-suggestions.ts` — **mantenere la funzione**
- `tests/pattern-suggestion-detector-meta.test.ts` — **mantenere** (copre il servizio ancora in uso)

`patternSuggestions` (campo/prop) è referenziata in:
- `lib/services/import.ts` righe 58, 301, 314, 382 — **da rimuovere**
- `components/import/import-preview.tsx` riga 214 — **da rimuovere** (SuggestionSection call)
- `tests/import-preview-ui.test.tsx` righe 31, 97-130 — **da aggiornare**
- `tests/import-analyze-page.test.tsx` riga 53 — **da aggiornare**
- `tests/import-service.test.ts` (molteplici) — **da aggiornare**
- `tests/import-actions.test.ts` riga 556 — **da aggiornare**

### Pattern per sampleRows cap (SUMUI-01)

```tsx
// In components/import/import-preview.tsx
// PRIMA:
{result.sampleRows.map((row) => (

// DOPO (slice a render time — D-05):
{result.sampleRows.slice(0, 10).map((row) => (
```

`DEFAULT_SAMPLE_SIZE = 25` in `lib/services/import-parsers.ts` rimane invariato — il parser mantiene 25 righe per l'uso interno. [VERIFIED: codebase]

### Pattern per il paragrafo SUMUI-03

```tsx
// In app/(app)/import/[fileId]/suggestions/page.tsx
// Sotto l'h1 esistente, aggiungere (copy a discrezione del planner):
<p className="mt-1 text-sm text-muted-foreground">
  {/* Comunicare: (a) scope platform, (b) entry point ricontrolla */}
  I suggerimenti sono stati rilevati dalle transazioni non categorizzate di questa piattaforma
  dopo l'importazione. Puoi ricontrollare i pattern in qualsiasi momento dal tab Importazioni.
</p>
```

Il paragrafo esistente (`"Crea pattern per categorizzare automaticamente..."`) va sostituito o affiancato con il contenuto SUMUI-03. Verificare che il test `D-08 copy` in `import-suggestions-page.test.tsx` venga aggiornato.

### Pattern per SuggestionSection headings (SUMUI-02)

```tsx
// PRIMA (suggestion-section.tsx):
<h2 className="text-base font-semibold">
  Suggerimenti pattern ({suggestions.length})
</h2>

// DOPO (esempio, copy a discrezione del planner):
<h2 className="text-base font-semibold">Pattern proposti</h2>
<p className="text-sm text-muted-foreground">
  Crea un pattern per categorizzare automaticamente queste transazioni nelle importazioni future.
</p>
```

```tsx
// PRIMA:
<h2 className="text-base font-semibold">
  Transazioni identiche ({singleSuggestions.length})
</h2>

// DOPO (esempio):
<h2 className="text-base font-semibold">Transazioni identiche</h2>
<p className="text-sm text-muted-foreground">
  Queste descrizioni compaiono più volte ma non generano un pattern automatizzabile.
  Categorizzale manualmente dalla pagina Spese.
</p>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `detectPatternSuggestions` in analyze flow (pre-import) | `discoverRegexCandidates` post-import (Phase 54) | Phase 54 | Il flusso analyze non calcola più pattern; la discover è separata |
| `patternSuggestions` in `ImportAnalysisResult` | Campo rimosso (Phase 55) | Phase 55 (questa phase) | Tipo più semplice; nessun pre-import UI |

**Deprecated/outdated:**
- `detectPatternSuggestions()`: legacy — il blocco `// TODO Phase 55: remove` lo segnala esplicitamente.
- `patternSuggestions` field su `ImportAnalysisResult`: da rimuovere in questa phase.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**Se questa tabella è vuota:** Tutte le claim in questa ricerca sono state verificate direttamente sul codebase — nessuna conferma utente necessaria.

---

## Open Questions

1. **Copy italiana esatta per il paragrafo SUMUI-03 e gli heading SUMUI-02**
   - What we know: Le decisioni D-01/D-02/D-03 definiscono struttura e tono ma lasciano il copy al planner.
   - What's unclear: Lunghezza preferita del paragrafo (1 frase vs 2); se includere il count nella heading ("Pattern proposti (3)") o tenerla neutra.
   - Recommendation: Usare heading neutre senza count per le regex section (il count è già nel rendering delle card); aggiungere count solo per single-cat per aiutare l'utente a calibrare l'effort manuale.

2. **Test D-08 nella suggestions page**
   - What we know: Il test `'D-08 copy: page contains required heading and subtitle'` verifica il testo `'Crea pattern per categorizzare automaticamente...'`.
   - What's unclear: Questo testo va sostituito dal paragrafo SUMUI-03 o affiancato?
   - Recommendation: Sostituirlo con il nuovo contenuto SUMUI-03 e aggiornare il test. Il vecchio testo era generico; il nuovo è più informativo.

---

## Environment Availability

> SKIPPED — phase puramente di codice/markup. Nessuna dipendenza esterna oltre al toolchain esistente (Node, Vitest, TypeScript).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `yarn test` |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUMUI-01 | `ImportPreview` renderizza max 10 righe anche con 25 sampleRows | unit | `yarn test tests/import-preview-ui.test.tsx` | ✅ (aggiornare) |
| SUMUI-02 | `SuggestionSection` mostra heading distinti con intro text per i due gruppi | unit | `yarn test tests/import-suggestions-page.test.tsx` | ✅ (aggiornare) |
| SUMUI-03 | suggestions page contiene il paragrafo SUMUI-03 | unit | `yarn test tests/import-suggestions-page.test.tsx` | ✅ (aggiornare) |
| D-06/D-07 | `analyzeFile` non chiama più `detectPatternSuggestions`; `ImportAnalysisResult` non include `patternSuggestions` | unit | `yarn test tests/import-service.test.ts` | ✅ (aggiornare) |
| D-08 | `ImportPreview` non renderizza `SuggestionSection` | unit | `yarn test tests/import-preview-ui.test.tsx` | ✅ (aggiornare) |
| D-09 | `detectPatternSuggestions` rimossa; `detectPatternSuggestionsWithMeta` ancora funzionante | unit | `yarn test tests/pattern-suggestion-detector-meta.test.ts` | ✅ (mantenere) |

### Sampling Rate
- **Per task commit:** `yarn test` (fast, < 60 secondi)
- **Per wave merge:** `yarn test`
- **Phase gate:** Full suite green prima di `/gsd-verify-work`

### Wave 0 Gaps

**Nessun nuovo file di test da creare.** I test esistenti coprono tutti i requirement — vanno aggiornati (non creati). Il Wave 0 in questa phase consiste nell'aggiornamento dei test contestualmente alla rimozione del codice legacy.

---

## Security Domain

Non applicabile. Questa phase tocca solo markup UI e rimozione di codice morto. Nessuna nuova superficie di input, autenticazione o accesso ai dati. Il flusso di autenticazione esistente in `suggestions/page.tsx` (`verifySession` + `getFileForUser` + ownership guard) rimane invariato.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact su questa phase |
|-----------|----------------------|
| Italian product surfaces | Copy UI in italiano; commenti e identificatori in inglese |
| `aria-label` su `<section>` in SuggestionSection | Da preservare quando si rinominano i heading |
| `dal / services / actions` layering | Non rilevante (nessuna nuova query) |
| `yarn check:language` dopo modifiche a route/commenti | Eseguire dopo ogni task che modifica copy o commenti |
| GSD execute: seguire il locked plan senza rinegoziare | Applicato |
| Decimal.js per monetario | Non rilevante (nessuna aritmetica monetaria) |
| Seeds additive | Non rilevante (nessuna modifica seed) |

---

## Sources

### Primary (HIGH confidence)
- Lettura diretta codebase — `components/import/import-preview.tsx` [VERIFIED: codebase]
- Lettura diretta codebase — `components/import/suggestion-section.tsx` [VERIFIED: codebase]
- Lettura diretta codebase — `app/(app)/import/[fileId]/suggestions/page.tsx` [VERIFIED: codebase]
- Lettura diretta codebase — `lib/services/import.ts` (righe 1-80, 280-384) [VERIFIED: codebase]
- Lettura diretta codebase — `lib/utils/pattern-suggestions.ts` [VERIFIED: codebase]
- `grep -rn` per tutti i consumatori di `patternSuggestions`, `detectPatternSuggestions`, `SuggestionSection` [VERIFIED: codebase]
- `grep -rn` per `sampleRows` e `DEFAULT_SAMPLE_SIZE` [VERIFIED: codebase]
- Lettura test: `import-suggestions-page.test.tsx`, `import-preview-ui.test.tsx`, `import-analyze-page.test.tsx` [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `.planning/phases/55-import-summary-ux/55-CONTEXT.md` — decisioni discusse con l'utente [CITED: 55-CONTEXT.md]
- `.planning/REQUIREMENTS.md` — SUMUI-01/02/03 [CITED: REQUIREMENTS.md]

---

## Metadata

**Confidence breakdown:**
- Inventario consumatori: HIGH — grep diretto, zero assunzioni
- Impatto sui test: HIGH — test letti direttamente
- Copy italiana: MEDIUM — a discrezione del planner per testo esatto
- Scope dei cambiamenti: HIGH — tutto il codice rilevante è stato letto

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stack stabile, nessuna dipendenza esterna)

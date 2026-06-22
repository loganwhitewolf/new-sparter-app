# Phase 55: import-summary-ux - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 8 (5 source + 3 test update groups)
**Analogs found:** 8 / 8 — tutti file esistenti da modificare, nessun file nuovo

---

## File Classification

| File da modificare | Role | Data Flow | Closest Analog / Self | Match Quality |
|---|---|---|---|---|
| `components/import/import-preview.tsx` | component | request-response | self (leggi direttamente) | exact |
| `components/import/suggestion-section.tsx` | component | transform | self (leggi direttamente) | exact |
| `app/(app)/import/[fileId]/suggestions/page.tsx` | RSC page | request-response | self (leggi direttamente) | exact |
| `lib/services/import.ts` | service | CRUD | self (leggi direttamente) | exact |
| `lib/utils/pattern-suggestions.ts` | utility | transform | self (grep + delete) | exact |
| `tests/import-preview-ui.test.tsx` | test | — | self (aggiornare fixture) | exact |
| `tests/import-service.test.ts` | test | — | self (rimuovere blocchi ANL-01/ANL-03) | exact |
| `tests/import-suggestions-page.test.tsx` | test | — | self (aggiornare copy test D-08) | exact |

---

## Pattern Assignments

### `components/import/import-preview.tsx` (component — SUMUI-01 + D-08)

**Analog:** self

**Posizione del cambio SUMUI-01 — sampleRows cap** (riga 184):

```tsx
// PRIMA (riga 184):
{result.sampleRows.map((row) => (

// DOPO — slice a render time, nessuna modifica al tipo:
{result.sampleRows.slice(0, 10).map((row) => (
```

**Posizione del cambio D-08 — rimozione SuggestionSection** (righe 28 e 214):

```tsx
// Riga 28 — import da rimuovere:
import { SuggestionSection } from './suggestion-section'

// Riga 214 — JSX da rimuovere (l'intera riga):
<SuggestionSection suggestions={result.patternSuggestions} categories={categories} fileId={result.fileId} />
```

**Invarianti da preservare:**

- Il blocco `{/* Pattern suggestions — REV-01: ... */}` (commento + componente) va rimosso insieme.
- Il resto del component (summary tiles, format override, warnings, errors, sample table, confirm button) rimane invariato.
- L'import di `SuggestionSection` si rimuove solo se non ha altri usi nel file (attualmente non ne ha).

---

### `components/import/suggestion-section.tsx` (component — SUMUI-02)

**Analog:** self

**Struttura attuale delle due section** (righe 20-35 e 38-56):

```tsx
// Section 1 — regex candidates (righe 21-35)
<section aria-label="Suggerimenti pattern" className="flex flex-col gap-4">
  <h2 className="text-base font-semibold">
    Suggerimenti pattern ({suggestions.length})
  </h2>
  ...
</section>

// Section 2 — single-cat (righe 38-56)
<section aria-label="Transazioni identiche senza categoria" className="flex flex-col gap-4">
  <h2 className="text-base font-semibold">
    Transazioni identiche ({singleSuggestions.length})
  </h2>
  ...
</section>
```

**Pattern di modifica SUMUI-02** — aggiungere `<p>` descrittivo subito dopo ogni `<h2>`, mantenere `aria-label`:

```tsx
// Section 1 — DOPO:
<section aria-label="Suggerimenti pattern" className="flex flex-col gap-4">
  <div>
    <h2 className="text-base font-semibold">Pattern proposti</h2>
    <p className="mt-1 text-sm text-muted-foreground">
      Crea un pattern per categorizzare automaticamente queste transazioni nelle importazioni future.
    </p>
  </div>
  ...
</section>

// Section 2 — DOPO:
<section aria-label="Transazioni identiche senza categoria" className="flex flex-col gap-4">
  <div>
    <h2 className="text-base font-semibold">
      Transazioni identiche ({singleSuggestions.length})
    </h2>
    <p className="mt-1 text-sm text-muted-foreground">
      Queste descrizioni compaiono più volte ma non generano un pattern automatizzabile.
      Categorizzale manualmente dalla pagina Spese.
    </p>
  </div>
  ...
</section>
```

**Regola:** `aria-label` su `<section>` deve essere preservato invariato — non rinominare.

---

### `app/(app)/import/[fileId]/suggestions/page.tsx` (RSC — SUMUI-03)

**Analog:** self

**Struttura attuale del blocco header** (righe 34-39):

```tsx
<div>
  <h1 className="text-xl font-semibold">Suggerimenti pattern</h1>
  <p className="mt-1 text-sm text-muted-foreground">
    Crea pattern per categorizzare automaticamente transazioni simili nelle prossime importazioni.
  </p>
</div>
```

**Pattern di modifica SUMUI-03** — sostituire il `<p>` con il messaggio richiesto da D-02:

```tsx
<div>
  <h1 className="text-xl font-semibold">Suggerimenti pattern</h1>
  <p className="mt-1 text-sm text-muted-foreground">
    I suggerimenti sono stati rilevati dalle transazioni non categorizzate di questa piattaforma
    dopo l&apos;importazione. Puoi ricontrollare i pattern in qualsiasi momento dal tab Importazioni.
  </p>
</div>
```

**Nota:** Il copy esistente ("Crea pattern per...") va **sostituito**, non affiancato. Il test `D-08 copy` in `import-suggestions-page.test.tsx` verifica questo testo e va aggiornato contestualmente.

---

### `lib/services/import.ts` (service — D-06 + D-07)

**Analog:** self

**D-07 — Rimozione campo dal tipo** `ImportAnalysisResult` (riga 58):

```ts
// Riga 58 — rimuovere:
patternSuggestions: PatternSuggestion[]

// Il tipo risultante non include più il campo.
// Aggiornare anche l'oggetto restituito a riga 382 (rimuovere la proprietà patternSuggestions).
```

**D-06 — Rimozione import e blocco TODO** (righe 29 e 301-325):

```ts
// Riga 29 — import da rimuovere:
detectPatternSuggestions,

// Righe 301-325 — intero blocco da rimuovere:
let patternSuggestions: PatternSuggestion[] = []
// TODO Phase 55: remove — ...
if (best && !input.skipPatternSuggestions) {
  try {
    ...
  } catch (error) {
    ...
  }
}
```

**Pattern di errore handling da NON modificare:** Il logger `logger.warn({ event: 'pattern_suggestion_detection_failed', ... })` dentro il blocco rimosso va eliminato insieme al blocco. Il resto del logger pattern nel file rimane invariato.

---

### `lib/utils/pattern-suggestions.ts` (utility — D-09)

**Analog:** self

**Azione:** eliminare `detectPatternSuggestions()` dalla funzione (non l'intero file).

**`detectPatternSuggestionsWithMeta` va mantenuta** — consumata da `lib/services/regex-discovery.ts` righe 10 e 105.

**Grep di verifica da eseguire prima della rimozione:**

```bash
grep -rn "detectPatternSuggestions\b" /path/to/project
# Atteso: solo in lib/services/import.ts (già rimosso) + lib/utils/pattern-suggestions.ts (da rimuovere)
# NON atteso: lib/services/regex-discovery.ts (quella usa detectPatternSuggestionsWithMeta)
```

---

## Test Assignments

### `tests/import-preview-ui.test.tsx` (aggiornare — SUMUI-01 + D-08)

**Cambio REV-01:** rimuovere il blocco di test che verifica `patternSuggestions` su `ImportPreview`.

**Cambio SUMUI-01:** aggiungere (o aggiornare) un test che verifica che con 25 sampleRows il component ne renderizzi al massimo 10.

**Pattern fixture esistente** (riga 31 — campo da rimuovere):

```ts
// baseResult helper — rimuovere la proprietà:
patternSuggestions: [],
```

---

### `tests/import-service.test.ts` (aggiornare — D-06/D-07)

**Cambiamenti:**

- Riga 34: rimuovere il mock di `detectPatternSuggestions`.
- Righe 1618+: rimuovere i blocchi di test ANL-01 e ANL-03 che verificano `patternSuggestions` nell'`ImportAnalysisResult`.
- Fixture `baseResult`/`analysisResult` helper: rimuovere la proprietà `patternSuggestions`.

---

### `tests/import-suggestions-page.test.tsx` (aggiornare — SUMUI-02 + SUMUI-03)

**Cambio D-08 copy:** aggiornare il test che verifica il subtitle della suggestions page dal testo vecchio al testo SUMUI-03.

**Cambio SUMUI-02:** aggiungere (o aggiornare) test che verificano che le due section abbiano heading e intro text distinti.

---

## Shared Patterns

### Pattern UI italiano — copy prodotto

**Fonte:** `app/(app)/import/[fileId]/suggestions/page.tsx`, `components/import/suggestion-section.tsx`

**Regola:** tutto il copy user-facing in italiano; commenti e identifier in inglese. Seguire il tono informativo non promozionale (D-02).

```tsx
// Esempio di tono corretto (informativo):
"I suggerimenti sono stati rilevati dalle transazioni non categorizzate..."

// Esempio da evitare (promozionale):
"Crea subito pattern per ottimizzare le tue importazioni!"
```

### Pattern aria-label su section

**Fonte:** `components/import/suggestion-section.tsx` righe 21 e 39

**Regola:** `aria-label` su `<section>` va preservato invariato quando si modificano i contenuti interni.

```tsx
// Mantenere invariati:
<section aria-label="Suggerimenti pattern" ...>
<section aria-label="Transazioni identiche senza categoria" ...>
```

### Pattern RSC page — auth guard + ownership check

**Fonte:** `app/(app)/import/[fileId]/suggestions/page.tsx` righe 14-24

```ts
const { userId } = await verifySession()
const fileRow = await getFileForUser({ userId, fileId })
if (!fileRow || fileRow.status !== 'imported') {
  notFound()
}
```

**Applicare a:** la page non cambia il flusso auth — questo pattern rimane invariato.

---

## No Analog Found

Nessun file senza analog — tutti i file da modificare sono file esistenti già letti.

---

## Files da eliminare integralmente

| File | Motivo |
|---|---|
| `tests/pattern-suggestion-detector.test.ts` | Testa solo `detectPatternSuggestions()` che viene rimossa (D-09) |

**Nota:** `tests/pattern-suggestion-detector-meta.test.ts` va **mantenuto** — copre `detectPatternSuggestionsWithMeta` che rimane in uso.

---

## Metadata

**Analog search scope:** `components/import/`, `app/(app)/import/`, `lib/services/`, `lib/utils/`, `tests/`
**Files letti direttamente:** 4 source + grep su import.ts
**Pattern extraction date:** 2026-06-21

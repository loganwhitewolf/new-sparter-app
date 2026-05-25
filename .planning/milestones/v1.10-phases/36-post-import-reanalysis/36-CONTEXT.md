# Phase 36: post-import-reanalysis - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-run pattern suggestion detection on persisted transactions after an import is confirmed (`status = 'imported'`). The user triggers re-analysis from the import history table and can promote post-import suggestions to `CategorizationPattern` entries. No R2 reads, no new DB schema, no automatic reclassification of existing transactions (SCOP-03).

</domain>

<decisions>
## Implementation Decisions

### Entry point and route
- **D-01:** Il trigger è un `DropdownMenuItem` "Rivedi suggerimenti" aggiunto a `ImportRowActions` per `status = 'imported'`, sempre visibile per tutti i file importati (nessuna condizione su presence/count di suggestion precedenti). Il link punta alla nuova route `/import/[fileId]/suggestions`.
- **D-02:** Nuova pagina server component `/import/[fileId]/suggestions`. Ownership guard: `notFound()` se il file non esiste, non appartiene all'utente sessione, o `status !== 'imported'`.

### Service layer — uncategorized transactions
- **D-03:** "Uncategorized" per POST-04 significa `expenseId IS NULL` — transazione non collegata ad alcuna spesa. Nuova DAL function `getUncategorizedTransactionsByFileId(db, fileId, userId)` che ritorna le transazioni per il fileId verificando la ownership (join su `importFile.userId = userId`) e filtra `expenseId IS NULL`.
- **D-04:** Il risultato della DAL viene mappato a `PatternDetectorRow[]` con lo stesso adapter usato in `analyzeFile` (`covered: false`, le coverage patterns vengono passate come secondo parametro a `detectPatternSuggestions`). Poi sort + cap a 5 identici a fase 34.

### Component reuse
- **D-05:** `SuggestionSection` + `SuggestionCard` + `SuggestionPromoteForm` riutilizzati as-is. La pagina `/import/[fileId]/suggestions` fetchta `categories` (stessa `getCategories()` usata nella analyze page) e passa `PatternSuggestion[]` + `categories` a `SuggestionSection`.
- **D-06:** `promoteSuggestionAction` (già in `lib/actions/patterns.ts` da fase 35) è la stessa action per la promozione post-import. Nessuna azione separata.

### Empty state
- **D-07:** Quando `patternSuggestions.length === 0` (tutte le transazioni già categorizzate oppure nessun pattern ricorrente rilevato), la pagina mostra un messaggio inline semplice in `text-muted-foreground`: "Nessun suggerimento trovato — tutte le transazioni risultano già categorizzate o non sono stati rilevati pattern ricorrenti." Nessuna card, nessuna illustrazione.

### Copy e framing (SCOP-03)
- **D-08:** La pagina ha un sottotitolo esplicito tipo "Crea pattern per categorizzare automaticamente transazioni simili nelle prossime importazioni." Nessuna menzione di ricategorizzazione delle transazioni esistenti nel copy. Il bottone di promozione rimane "Crea pattern" (nessun "Applica" o "Ricategorizza").

### Claude's Discretion
- Icona/label esatta del DropdownMenuItem ("Rivedi suggerimenti" è una proposta; può variare)
- Titolo della pagina h1 (es. "Suggerimenti pattern" o "Revisione suggerimenti")
- Struttura interna della DAL query per uncategorized transactions (join vs subquery)
- Se usare `loadActivePatterns` per le coverage patterns nello stesso identico modo di `analyzeFile`, oppure inline nel server component

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Algorithm e contratto suggestion
- `docs/adr/0002-pattern-suggestion-detection.md` — Shape di `PatternSuggestion`, algoritmo token-prefix, cap a 5, `detectedAmountSign`, scope ephemeral dismissal, post-import re-analysis su transazioni persistite.

### Requirements
- `.planning/REQUIREMENTS.md` §Post-Import Re-Analysis — POST-01 (re-run da transazioni persistite per fileId), POST-02 (stesso algoritmo e shape), POST-03 (ownership fileId), POST-04 (escludi transazioni già categorizzate), POST-05 (promuovi suggestion a pattern).
- `.planning/REQUIREMENTS.md` §Scope Boundaries — SCOP-03 (creare un pattern post-import NON ricategorizza transazioni esistenti).

### Decisioni fasi precedenti
- `.planning/phases/34-import-analysis-suggestions/34-CONTEXT.md` — D-01 (failure handling: catch + warn + return []), D-03 (all plans free), D-04 (loadActivePatterns coverage), D-06 (sort + cap 5), D-07 (patternSuggestions sempre presente).
- `.planning/phases/35-import-review-promotion/35-CONTEXT.md` — D-03 (promoteSuggestionAction bypassa canManageCustomPatterns), D-04 (SuggestionSection layout e integrazione).

### Codice da leggere prima di implementare
- `components/import/import-row-actions.tsx` — Dove aggiungere il DropdownMenuItem "Rivedi suggerimenti" per `status='imported'`. Vedere pattern esistente per "Vedi transazioni".
- `app/(app)/import/[fileId]/analyze/page.tsx` — Template per la nuova page `/import/[fileId]/suggestions`: ownership guard con `notFound()`, fetch parallelo categories + analisi, render con `SuggestionSection`.
- `components/import/suggestion-section.tsx` — Props: `{ suggestions: PatternSuggestion[], categories: CategoryWithSubCategories[] }`. Riutilizzare as-is.
- `lib/actions/patterns.ts#promoteSuggestionAction` — Action di promozione già disponibile da fase 35. Riutilizzare senza modifiche.
- `lib/services/import.ts#analyzeFile` — Pattern del DAL query + adapter `NormalizedTransactionRow → PatternDetectorRow` da replicare per le transazioni persistite.
- `lib/dal/transactions.ts` — Punto di aggiunta per la nuova `getUncategorizedTransactionsByFileId`. Vedere `transactionListSelect` per schema e join pattern con `importFile`.
- `lib/services/categorization.ts#loadActivePatterns` — Coverage patterns per `detectPatternSuggestions`, stessa chiamata di `analyzeFile`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/import/suggestion-section.tsx` — Accetta `PatternSuggestion[]` + `CategoryWithSubCategories[]`. Riutilizzabile as-is senza props aggiuntive.
- `components/import/suggestion-card.tsx` + `suggestion-promote-form.tsx` — Figli di SuggestionSection. Già gestiscono stato promozione (badge "Pattern creato", form disabilitata post-promozione).
- `lib/actions/patterns.ts#promoteSuggestionAction` — Server Action già implementata e testata in fase 35. Nessuna modifica necessaria.
- `lib/utils/pattern-suggestions.ts#detectPatternSuggestions` — Funzione pura. Stesso algoritmo, diversa data source.
- `lib/services/categorization.ts#loadActivePatterns` — Già richiamata in `analyzeFile`; stessa chiamata per la phase 36.
- `lib/dal/categories.ts#getCategories` — Usata dalla analyze page; stessa chiamata per la nuova page.

### Established Patterns
- Server components dell'(app) fetchano dati direttamente con DAL calls e li passano ai client components come props (pattern analyze page).
- `notFound()` da `next/navigation` per ownership/access guard — usato in analyze page e import deletion.
- `ImportRowActions` ha CTA primarie condizionali per status (uploaded → "Analizza", analyzed → "Rivedi e importa"). Il DropdownMenuItem è il punto di aggiunta per 'imported'.
- Sort + cap: `suggestions.sort((a, b) => b.matchCount - a.matchCount).slice(0, 5)` — identico a `analyzeFile`.

### Integration Points
- `components/import/import-row-actions.tsx`: aggiungere `DropdownMenuItem` con `Link` a `/import/${encodeURIComponent(row.id)}/suggestions` per `row.status === 'imported'`.
- `app/(app)/import/[fileId]/suggestions/page.tsx`: nuova route server component. Fetch ownership (getImportFile with userId check), `getUncategorizedTransactionsByFileId`, `loadActivePatterns`, `getCategories` → `detectPatternSuggestions` → `SuggestionSection`.
- `lib/dal/transactions.ts`: nuova funzione `getUncategorizedTransactionsByFileId(db, fileId, userId)` — query transazioni per fileId con `expenseId IS NULL`, join su `importFile` per ownership check.

</code_context>

<specifics>
## Specific Ideas

- Il DropdownMenuItem "Rivedi suggerimenti" si posiziona affianco a "Vedi transazioni" (entrambi solo per `status='imported'`).
- L'adapter per `PatternDetectorRow` dalla DAL: `{ description: t.description, normalizedDescription: t.description, amount: t.amount, valid: true, covered: false }` — le transazioni persistite sono già "valid" (sono state importate con successo).
- La pagina `/import/[fileId]/suggestions` NON ha un bottone di conferma import (è una pagina post-import, non un review pre-import).

</specifics>

<deferred>
## Deferred Ideas

- **REVAL-01** (deferred requirement): Applicare il nuovo pattern creato post-import alle transazioni esistenti dello stesso import. Esplicitamente fuori scope per v1.10 (già documentato in REQUIREMENTS.md §Future Requirements).
- **GLOBAL-01**: Rilevamento suggestion su tutta la storia delle transazioni (non per singolo fileId). Fuori scope.

None — la discussione è rimasta nel perimetro della fase 36.

</deferred>

---

*Phase: 36-post-import-reanalysis*
*Context gathered: 2026-05-23*

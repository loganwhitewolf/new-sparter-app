# Phase 35: import-review-promotion - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a suggestions section to the existing import analysis page (`/import/[fileId]/analyze`) that renders `patternSuggestions` already present in `ImportAnalysisResult` (delivered by phase 34) and lets users promote individual suggestions to `CategorizationPattern` entries before confirming the import. No new DB schema, no dismissed-suggestions persistence (SCOP-01). Post-import re-analysis is phase 36.

</domain>

<decisions>
## Implementation Decisions

### Promotion form design
- **D-01:** Promozione tramite form inline semplificata — nessun dialog. Ogni suggestion card ha un selector di subcategoria (categoria → sottocategoria) e un bottone "Crea pattern". Il campo `pattern` è pre-compilato dalla suggestion e inviato come hidden input. Il `detectedAmountSign` è pre-compilato come hidden input. La confidence è fissa a 0.85. Nessuna descrizione obbligatoria. L'utente seleziona solo la sottocategoria.

### Promotion feedback
- **D-02:** Dopo una promozione riuscita, la suggestion card viene marcata visivamente con un badge "Pattern creato" e la form inline viene disabilitata. La card rimane visibile per consentire all'utente di vedere quante suggestion ha promosso prima di confermare l'import.

### Subscription gate per la promozione
- **D-03:** La promozione da suggestion è libera per tutti i piani incluso `free` (coerente con D-03 phase 34: la discovery è disponibile a tutti). Richiede una nuova Server Action `promoteSuggestionAction` separata da `createPatternAction` che bypassa `canManageCustomPatterns`. La action usa `CreatePatternSchema` per la validazione e chiama lo stesso DAL `createPattern`.

### Suggestion section layout
- **D-04:** La sezione suggerimenti viene inserita in `ImportPreview` tra la tabella anteprima e il bottone di conferma importazione. Titolo: "Suggerimenti pattern (N)". Card separate per ogni suggestion con: pattern mostrato come testo in font monospace, badge con `matchCount`, toggle per i sample descriptions, e la form inline per la promozione.

### Sample descriptions display
- **D-05:** I sample descriptions sono nascosti di default. Un bottone/link compatto "Mostra N esempi" espande inline le descrizioni campione (max 3). Riduce il clutter per utenti che capiscono il pattern senza esempi.

### Claude's Discretion
- Stile esatto del badge "Pattern creato" (variante Badge shadcn)
- Struttura interna del selector categoria → sottocategoria nella inline form (può riusare il pattern del CreatePatternDialog)
- Gestione errori di validazione inline (es. "Seleziona una sottocategoria")
- Se il selector di categoria è necessario o si salta direttamente alle sottocategorie con una ricerca flat

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Algorithm e contratto suggestion
- `docs/adr/0002-pattern-suggestion-detection.md` — Shape di PatternSuggestion, cap a 5, detectedAmountSign, scope ephemeral dismissal.

### Requirements
- `.planning/REQUIREMENTS.md` §Review and Promotion — REV-01 (suggestion visibili in analisi), REV-02 (sample descriptions), REV-03 (promozione a pattern con subcategory), REV-04 (conferma import non bloccata), REV-05 (feedback successo/errore).
- `.planning/REQUIREMENTS.md` §Scope Boundaries — SCOP-01 (dismissed suggestions non persistiti).

### Decisioni fasi precedenti
- `.planning/phases/34-import-analysis-suggestions/34-CONTEXT.md` — D-03 (suggestion disponibili a tutti i piani incluso free), D-06 (sort matchCount desc, cap 5 già applicato in analyzeFile), D-07 (patternSuggestions sempre presente, [] se nessuna).

### Codice da leggere prima di implementare
- `components/import/import-preview.tsx` — Il componente client esistente dove si aggiunge la sezione suggestion. Riceve `result: ImportAnalysisResult` che include già `patternSuggestions`.
- `app/(app)/import/[fileId]/analyze/page.tsx` — Server component che chiama `analyzeImportAction` e passa `result.data` a `ImportPreview`. Deve essere esteso per fetchare categories (necessarie per il selector).
- `components/patterns/create-pattern-dialog.tsx` — Reference per il flusso esistente di creazione pattern (categoria → sottocategoria, amountSign, confidence). Riusare il pattern del selector.
- `lib/actions/patterns.ts` — `createPatternAction` esistente (usa `canManageCustomPatterns`). La nuova `promoteSuggestionAction` bypassa quel gate ma usa lo stesso `CreatePatternSchema` e DAL `createPattern`.
- `lib/validations/pattern.ts` — `CreatePatternSchema`, `normalizePatternInput` — riutilizzare per validare il pattern dalla suggestion.
- `lib/utils/pattern-suggestions.ts` — `PatternSuggestion` type (pattern, matchCount, detectedAmountSign, sampleDescriptions).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/import/import-preview.tsx` — Client component (`'use client'`), già esteso con suggestions section. Riceve `result.patternSuggestions` automaticamente da phase 34.
- `components/patterns/create-pattern-dialog.tsx` — Modello per il selector categoria → sottocategoria (useState per categoryId/subCategoryId, useActionState per l'action). Riusare il pattern, non il componente.
- `createPatternAction` / `createPattern` DAL — La nuova `promoteSuggestionAction` chiama lo stesso DAL `createPattern`; non duplicare logica DB.
- `CreatePatternSchema` — Validazione riutilizzabile; il campo `pattern` viene dal suggestion.pattern già normalizzato dal detector.
- `CategoryWithSubCategories` type (da `lib/dal/categories`) — Già usato da `CreatePatternDialog`; la analyze page dovrà fetchare le categorie con la stessa DAL call.

### Established Patterns
- Server components della (app) fetchano dati aggiuntivi e li passano ai client components come props. La analyze page dovrà aggiungere un fetch di categories.
- `useActionState` + `submittedRef` pattern per il feedback post-azione (vedi `CreatePatternDialog`).
- `Badge` shadcn per stati visivi (già usato in `ImportPreview` per Duplicato/Valida/Errore).
- Tutti i testi UI rivolti all'utente sono in italiano.

### Integration Points
- `ImportPreview` props: attualmente `{ result: ImportAnalysisResult, candidates?, confirmDisabledReason? }`. Per la sections suggestions, aggiungere `categories: CategoryWithSubCategories[]` come prop.
- `app/(app)/import/[fileId]/analyze/page.tsx`: aggiungere fetch categories (server-side) e passarle a `ImportPreview`.
- Nuova `promoteSuggestionAction` in `lib/actions/patterns.ts` (o nuovo file `lib/actions/suggestions.ts`): firma `(prev: ActionState, formData: FormData) => Promise<ActionState>`, chiama `createPattern` DAL direttamente senza gate di piano.

</code_context>

<specifics>
## Specific Ideas

- La form inline per ogni suggestion: hidden inputs per `pattern` (dalla suggestion) e `amountSign` (da `detectedAmountSign`), confidence fissa 0.85 come hidden input. Solo il selector categoria → sottocategoria è visibile.
- Il badge "Pattern creato" può usare `<Badge variant="default">Pattern creato</Badge>` o una variante green custom.
- Il toggle "Mostra N esempi" può essere un `<button>` con testo che alterna "Mostra" / "Nascondi" via useState locale.
- Se `patternSuggestions` è array vuoto, la sezione non viene renderizzata (nessun titolo, nessuna card).

</specifics>

<deferred>
## Deferred Ideas

None — la discussione è rimasta nel perimetro della phase 35.

</deferred>

---

*Phase: 35-import-review-promotion*
*Context gathered: 2026-05-23*

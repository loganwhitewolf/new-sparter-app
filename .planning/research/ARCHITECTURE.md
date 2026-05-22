# v1.10 Research: Architecture

## Existing Flow

1. `/import/[fileId]/analyze` calls `analyzeImportAction`.
2. `analyzeImportAction` verifies the session and calls `analyzeFile`.
3. `analyzeFile` reads R2 bytes, parses the file, detects the format, derives normalized stats, checks duplicates, updates file analysis state, and returns `ImportAnalysisResult`.
4. `ImportPreview` renders summary tiles, warnings/errors, sample rows, and calls `confirmImportAction`.
5. `confirmImportAction` calls `importFile`, which loads active patterns and categorizes imported expenses during persistence.

## Pre-Import Integration

- Add `PatternSuggestion` type to `lib/services/import.ts` or a dedicated suggestions module.
- In `analyzeFile`, once a best format exists and `fullStats.normalizedRows` are available, load active patterns and detect suggestions from valid non-duplicate rows that do not match Tier 1 regex.
- Return `patternSuggestions` alongside `sampleRows`.
- Keep file status transitions unchanged: suggestion detection failure should not fail import analysis unless the implementation chooses to surface a safe warning.

## Detector Boundary

Use a pure detector that accepts normalized rows:

- `description`
- `amount`
- `valid`
- duplicate/importability metadata
- optional already-categorized flag

The same detector can be reused by a persisted transaction adapter that maps transaction rows into this shape.

## Post-Import Integration

- Add a service like `analyzePatternSuggestionsForImportedFile({ userId, fileId })`.
- Query persisted transactions for the file with user ownership enforced through the `file` join.
- Join to expenses and keep uncategorized rows only. Candidate filters should treat `expense.subCategoryId IS NULL` or status not categorized as uncategorized, depending on final domain choice.
- Load active patterns and exclude descriptions already covered by regex.
- Return the same `PatternSuggestion[]` shape.

## Promotion Integration

Options:

1. Reuse `createPatternAction` from a suggestion card form. This is simplest but the component must provide hidden `pattern`, `amountSign`, `confidence`, and selected `subCategoryId`.
2. Add `createPatternFromSuggestionAction` that validates a suggestion-specific schema and delegates to `createPattern`. This gives better error messages and can optionally include `fileId` for revalidation.

Recommendation: use a suggestion-specific action if promotion needs file-level re-analysis refresh; otherwise reuse `createPatternAction`.

## UI Placement

- Pre-import: add a Pattern Suggestions section between warnings/errors and sample rows or immediately above the confirm button. It should not block import confirmation.
- Post-import: add an action from import history row actions or an import detail/filter view that opens a re-analysis panel. Since no import detail page exists, import row action plus a dialog/panel is the smallest product surface.

## Build Order

1. Pure detector and tests.
2. Pre-import service integration and response/action tests.
3. Import preview UI and promotion action flow.
4. Persisted transaction re-analysis service/action.
5. Post-import UI entry point.

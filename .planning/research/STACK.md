# v1.10 Research: Stack Additions

## Scope

Pattern Suggestions adds deterministic suggestion detection around the existing import and categorization stack. No new runtime dependency is required.

## Existing Stack To Reuse

- `lib/services/import.ts`: `analyzeFile`, `importFile`, `deriveFullFileImportStats`, and `ImportAnalysisResult`.
- `lib/utils/import.ts`: normalized descriptions, parsed amounts, description hashes, and normalized transaction rows.
- `lib/services/categorization.ts`: `loadActivePatterns`, `applyTier1Regex`, and amount-sign matching behavior.
- `lib/dal/patterns.ts` and `lib/actions/patterns.ts`: user-scoped pattern creation, validation, plan gating, and categorization-surface revalidation.
- `lib/dal/transactions.ts`: user-scoped transaction access by `fileId`, with existing file ownership joins.
- `components/import/import-preview.tsx`: import analysis checkpoint UI.
- `components/patterns/create-pattern-dialog.tsx` and `components/expenses/category-combobox.tsx`: existing category/pattern selection patterns.

## Recommended Additions

- Add a pure detector module, likely `lib/services/pattern-suggestions.ts`, with exported helpers and focused unit tests.
- Add a DAL/service query for persisted transaction suggestion inputs by `fileId`, user-scoped through `file.userId`.
- Extend `ImportAnalysisResult` with `patternSuggestions: PatternSuggestion[]`.
- Add a server action for post-import re-analysis, using the same safe error mapping style as import actions.
- Add an import preview child component for suggestion review/promotion, reusing `createPatternAction` semantics or a narrower suggestion-specific action.

## Non-Additions

- Do not add an LLM/ML dependency for clustering.
- Do not add a dismissal persistence table in this milestone.
- Do not add a new import workflow step; suggestions belong in the existing analysis checkpoint.
- Do not read raw R2 files for post-import re-analysis; persisted transactions are the source of truth.

## Verification Stack

- Vitest for pure detector, service, action, and component static-render coverage.
- Playwright can track the browser flow with existing import spec conventions, but DB-backed cases may remain `fixme` without staging data.
- `yarn check:language` is required after docs/tests/routes/developer-facing string changes.

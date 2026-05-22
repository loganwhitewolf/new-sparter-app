# v1.10 Research Summary: Pattern Suggestions

## Stack Additions

No new dependency is needed. Build on `lib/services/import.ts`, `lib/utils/import.ts`, `lib/services/categorization.ts`, `lib/dal/patterns.ts`, `lib/actions/patterns.ts`, and the existing import preview UI.

## Feature Table Stakes

- Detect recurring uncategorized descriptions with the ADR's token-prefix algorithm.
- Return capped, ranked suggestions in `ImportAnalysisResult`.
- Show suggestions during import review without blocking confirmation.
- Let users promote a suggestion to a categorization pattern with a chosen subcategory.
- Let users re-run suggestion analysis after import from persisted transactions filtered by `fileId`.
- Keep dismissed suggestions ephemeral.

## Recommended Architecture

Create a pure suggestion detector plus two adapters:

- Pre-import adapter over normalized import rows inside `analyzeFile`.
- Post-import adapter over persisted transactions scoped by user-owned `fileId`.

Promotion can reuse existing pattern creation infrastructure, with a suggestion-specific action added only if the UI needs tailored refresh/error behavior.

## Watch Out For

- Escape generated regex prefixes before storing them as pattern source.
- Exclude rows already covered by active regex patterns.
- Exclude invalid and duplicate rows from pre-import counts.
- Enforce user ownership for `fileId` and pattern destination subcategory.
- Make clear that post-import pattern creation does not automatically reclassify existing transactions unless that is explicitly added.

## Suggested Milestone Shape

Four phases:

1. Detector and contract.
2. Pre-import analysis integration.
3. Import review promotion UX.
4. Post-import re-analysis UX.

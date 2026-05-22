# v1.10 Research: Feature Shape

## Table Stakes

### Detection

- User receives suggestions only for valid, non-duplicate, uncategorized import rows.
- Detection strips purely numeric tokens before computing common prefixes.
- Detection emits suggestions only when at least two rows share a common prefix of at least two tokens.
- Detection returns readable regex-prefix patterns, not arbitrary substrings.
- Detection ignores rows already matched by active regex patterns.
- Suggestions are sorted by `matchCount` descending and capped to 5 for the import analysis response.

### Suggestion Shape

- Each suggestion exposes `pattern`, `matchCount`, `detectedAmountSign`, and up to 3 `sampleDescriptions`.
- `detectedAmountSign` is `positive`, `negative`, or `any` based on the grouped transaction amounts.
- Pattern source should be canonical and compatible with existing `normalizePatternInput` / `new RegExp(pattern, 'i')` behavior.

### Import Review

- User sees Pattern Suggestions during `/import/[fileId]/analyze` when suggestions exist.
- User can choose a destination subcategory and promote a suggestion to a categorization pattern before confirming import.
- Successful promotion gives feedback, removes or marks the suggestion as handled in the current UI, and leaves import confirmation available.
- Plan gating for custom patterns remains enforced by existing pattern creation rules.

### Post-Import Re-Analysis

- User can re-run suggestion analysis for an imported file from persisted transactions filtered by `fileId`.
- Re-analysis uses the same detector as pre-import analysis.
- Re-analysis does not depend on the raw R2 object.

## Differentiators

- Suggestions appear at the moment they are most actionable: before committing an import.
- Re-analysis allows users to skip suggestions during import and clean up later.
- The algorithm is explainable: grouped by recurring description prefixes, with sample descriptions shown.

## Anti-Features

- No global suggestions across all history in v1.10; scope stays import-file-local.
- No suggestion dismiss tracking.
- No automatic pattern creation without user subcategory choice.
- No automatic reclassification of imported transactions in this milestone unless explicitly planned later; pattern creation affects future categorization unless a separate revalidation flow is added.

## Complexity Notes

- The hardest product detail is post-import placement: a user needs a discoverable action tied to an import record or transaction import filter.
- The hardest correctness detail is "uncategorized only" because pre-import rows have categorization simulation results while persisted rows require joining transactions to expenses and filtering null/uncategorized classification.

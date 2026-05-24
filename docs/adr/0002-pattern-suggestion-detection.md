# PatternSuggestion detection algorithm

During import analysis, the system detects recurring transaction descriptions and surfaces them as `PatternSuggestion` candidates — regex prefixes the user can promote to `CategorizationPattern` before committing the import.

## Decisions

### Algorithm: token-prefix with numeric stripping

Descriptions are tokenized by whitespace. Purely numeric tokens (reference numbers, years, amounts) are stripped before comparison. The longest common prefix across the token sequence is extracted. A suggestion is emitted when ≥2 uncategorized descriptions in the file share a common prefix of ≥2 tokens.

Alternatives considered:
- **Longest common substring (anywhere in description):** more powerful but produces patterns anchored nowhere, harder for the user to read, and more expensive to compute.
- **ML/LLM clustering:** higher recall, but introduces latency, cost, and non-determinism into a synchronous analysis step. Ruled out for the initial implementation.
- **Exact-match grouping (descriptionHash):** already covered by Tier 2 history categorization. PatternSuggestion targets the gap — new descriptions the user has never seen before.

Numeric stripping is intentional: bank reference numbers and dates vary per transaction and would prematurely truncate the common prefix, producing shorter and less useful patterns.

### Scope: uncategorized transactions only

Pattern detection runs only on rows not already matched by an active `CategorizationPattern`. Suggesting patterns where coverage already exists produces noise, not value.

**Partial matches only.** A bucket of fully identical normalized descriptions (after numeric stripping) does not produce a suggestion. Identical descriptions are covered by Tier 2 (history) categorization once the user assigns a category to one of them; surfacing a regex for them is noise. The detector requires at least one row in the bucket to have stripped tokens beyond the shared prefix.

### Timing: part of ImportAnalysisResult, re-analysis on persisted transactions

`PatternSuggestion` is produced during `analyzeImportFile` and included in `ImportAnalysisResult`. No new intermediate step is introduced in the import flow — the analysis checkpoint is already the natural pre-import review moment.

Post-import re-analysis (for users who skipped suggestions on first import) operates on persisted transactions filtered by `fileId`, not on the raw R2 file. Transactions are the source of truth; the R2 file is a transient upload artifact.

### Ephemeral: no persistence of dismissed suggestions

Dismissed suggestions are not stored. The detection runs fresh each time from the available data. A "do not suggest again" table would add schema complexity for a low-frequency action with minimal user cost if the suggestion reappears.

### Shape and cap

Each `PatternSuggestion` exposes: `pattern`, `matchCount`, `detectedAmountSign`, `sampleDescriptions` (max 3). At most 5 suggestions are returned per analysis, ordered by `matchCount` descending. The cap prevents overwhelming the user during import review; a future re-analysis flow addresses the cases beyond the top 5.

`detectedAmountSign` is inferred from the group: if all transactions share the same sign, that sign is set; otherwise `any`.

## Consequences

- The detection function must accept two input shapes: an array of parsed rows (pre-import) and a query against persisted transactions (post-import re-analysis). The algorithm is identical; only the data source differs.
- Callers must not require exactly 2 matched tokens — the minimum is a floor, not an exact count.
- The 5-suggestion cap is a UX constraint, not a correctness constraint. The underlying detector may find more; callers truncate after sorting.

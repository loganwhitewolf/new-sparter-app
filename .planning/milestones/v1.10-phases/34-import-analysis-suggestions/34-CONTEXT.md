# Phase 34: import-analysis-suggestions - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `detectPatternSuggestions` (delivered in phase 33) into `analyzeFile` in `lib/services/import.ts`. Extend `ImportAnalysisResult` with `patternSuggestions: PatternSuggestion[]`. No UI, no new DB schema, no dismissed-suggestions persistence. The detector is a pure function already tested; this phase is pure service integration.

</domain>

<decisions>
## Implementation Decisions

### Failure handling
- **D-01:** If suggestion detection fails (exception in `loadActivePatterns` or `detectPatternSuggestions`), the import analysis must NOT fail. Catch the exception, log a `logger.warn` with `error.message` safe-truncated (no R2 keys, presigned URLs, raw rows, or stack traces — same pattern as `safeImportErrorMessage`), and return `patternSuggestions: []`. File status stays `analyzed`.
- **D-02:** The warning log message should be a fixed-prefix string (e.g. `'Pattern suggestion detection failed'`) with only `error.message` appended. Do not log the rows array, object keys, or any import-file data.

### Subscription gating
- **D-03:** Pattern suggestions are available to all subscription plans including `free`. No `subscriptionPlan` parameter added to `analyzeFile`. The feature is discovery (not auto-categorization), consistent with users being able to create patterns manually on all plans.
- **D-04:** `loadActivePatterns(db, userId)` is called as-is — it loads both user-owned patterns and system patterns (`userId IS NULL`). This is the same coverage set as `importFile`'s categorization pipeline, ensuring consistency.

### Integration placement
- **D-05:** Suggestion detection runs after `normalizedRows` are computed (`deriveFullFileImportStats` result) and after `existingHashes` are resolved. It runs only when `best` (detected format) is non-null — when `best` is null, `normalizedRows` is `[]` and suggestions would be empty anyway; skip the DB call.
- **D-06:** Sort by `matchCount` descending and cap at 5 in `analyzeFile` before returning (ADR: "callers truncate after sorting"). The detector returns unsorted.
- **D-07:** `patternSuggestions` is always present in `ImportAnalysisResult` even when `errors.length > 0` (partial analysis). On error or no rows, it is `[]`.

### Claude's Discretion
- Local helper function naming for the NormalizedTransactionRow → PatternDetectorRow adapter (inline or extracted private function — either is fine)
- Whether to reuse `safeImportErrorMessage` directly or mirror its pattern inline for the warning log
- Whether to add adapter-level unit tests in this phase (acceptable to defer to later; detector is fully tested in phase 33)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Algorithm and contract
- `docs/adr/0002-pattern-suggestion-detection.md` — Primary source of truth: token-prefix algorithm, scope boundaries, ephemeral dismissal, shape and cap, caller truncation responsibility.

### Requirements
- `.planning/REQUIREMENTS.md` §Analysis Contract — ANL-01 (`patternSuggestions` in result), ANL-02 (suggestion shape), ANL-03 (cap at 5, matchCount desc), ANL-04 (`detectedAmountSign` inference), ANL-05 (failure safety — no leaking R2 keys, presigned URLs, raw rows, stack traces).
- `.planning/REQUIREMENTS.md` §Scope Boundaries — SCOP-01 (dismissed suggestions not persisted), SCOP-02 (scoped to one import file).

### Existing code to read before implementing
- `lib/services/import.ts` — `analyzeFile`, `ImportAnalysisResult`, `deriveFullFileImportStats`, `NormalizedImportStats`, `safeImportErrorMessage` — the function to be modified and its helpers.
- `lib/utils/pattern-suggestions.ts` — `detectPatternSuggestions`, `PatternDetectorRow`, `CoveragePattern`, `PatternSuggestion` — the detector module from phase 33.
- `lib/services/categorization.ts` — `loadActivePatterns`, `ActivePattern` — the pattern-loading function called during analysis (satisfies `CoveragePattern` structurally via duck typing).
- `lib/utils/import.ts` — `NormalizedTransactionRow` — the type that gets mapped to `PatternDetectorRow` in the adapter.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/utils/pattern-suggestions.ts#detectPatternSuggestions`: Pure function, no IO, no mocking needed. Already handles invalid/covered/numeric filtering internally.
- `lib/services/categorization.ts#loadActivePatterns`: Accepts `DbOrTx`; returns `ActivePattern[]`. Structurally satisfies `CoveragePattern` (has `pattern` and `amountSign` fields).
- `lib/services/import.ts#safeImportErrorMessage`: Safe error message extractor that strips sensitive data. Mirror or reuse for the `logger.warn` call on suggestion failure.
- `lib/logger.ts#logger`: Pino-based structured logger used throughout `import.ts`.

### Established Patterns
- Error isolation: `analyzeFile` already wraps R2 reads and parse steps in try/catch with `safeImportErrorMessage` + `markFileFailed`. Suggestion detection follows the same isolation pattern but does NOT call `markFileFailed` — it is non-critical.
- `NormalizedTransactionRow.valid` maps directly to `PatternDetectorRow.valid`.
- `NormalizedTransactionRow.amount` maps directly to `PatternDetectorRow.amount`.
- `PatternDetectorRow.covered` should be set to `false` in the adapter — the detector handles regex-based coverage internally via `CoveragePattern[]`.

### Integration Points
- `ImportAnalysisResult` (line 33–51 of `lib/services/import.ts`) — add `patternSuggestions: PatternSuggestion[]`.
- `analyzeFile` return statement (line 336–345) — add `patternSuggestions` to the returned object.
- `lib/actions/import.ts` — `analyzeFile` is called and its result returned. If `ImportAnalysisResult` gains `patternSuggestions`, the action passes it through automatically (no change needed in the action unless the type check requires it).

</code_context>

<specifics>
## Specific Ideas

- The adapter mapping is intentionally thin: `{ description: r.description, normalizedDescription: r.normalizedDescription, amount: r.amount, valid: r.valid, covered: false }`. The detector handles coverage via its second parameter.
- The sort+cap sequence: `suggestions.sort((a, b) => b.matchCount - a.matchCount).slice(0, 5)`.
- When `best` is null: skip `loadActivePatterns` entirely and return `patternSuggestions: []` without a DB round-trip.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 34-import-analysis-suggestions*
*Context gathered: 2026-05-22*

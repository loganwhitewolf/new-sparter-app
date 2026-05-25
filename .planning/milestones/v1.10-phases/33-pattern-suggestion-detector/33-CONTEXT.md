# Phase 33: pattern-suggestion-detector - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the pure deterministic detector contract from the ADR. Deliver the `detectPatternSuggestions` function, its input/output types, and comprehensive test coverage. No DB access, no UI, no integration with `analyzeFile` — that is phase 34. No integration with post-import transactions — that is phase 36.

</domain>

<decisions>
## Implementation Decisions

### Module location
- **D-01:** Detector lives in `lib/utils/pattern-suggestions.ts` — pure function, no `server-only`, testable without mocking. Follows the same convention as `lib/utils/import.ts` (normalizeDescription, NormalizedTransactionRow, etc.).

### Input interface
- **D-02:** Define `PatternDetectorRow` now as a narrow interface: `{ description: string; normalizedDescription: string; amount: string | null; valid: boolean; covered: boolean }`. Both the phase 34 pre-import adapter and the phase 36 post-import DB adapter will map to this interface. No refactoring needed when phase 36 arrives.

### Coverage check
- **D-03:** The detector accepts a `CoveragePattern[]` as second parameter — a local minimal interface defined in the same file: `{ pattern: string; amountSign: 'positive' | 'negative' | 'any' }`. Callers pass their loaded `ActivePattern[]` objects, which satisfy this interface structurally (TypeScript duck typing). The detector does the regex matching internally. Zero import from `lib/services/`.
- **D-04:** Rows where `valid` is false, `covered` is true (matched by an active pattern), or that are filtered before the detector call (invalid/duplicate pre-filter done by caller) are excluded from suggestion grouping.

### Output type
- **D-05:** `PatternSuggestion`: `{ pattern: string; matchCount: number; detectedAmountSign: 'positive' | 'negative' | 'any'; sampleDescriptions: string[] }`. Defined in the same file as the detector. Exported for use by phase 34.

### Test file
- **D-06:** Tests in `tests/pattern-suggestion-detector.test.ts` using Vitest. Must cover: numeric token stripping, longest-prefix behavior, minimum count floor (≥2), minimum token floor (≥2 non-numeric), regex escaping of metacharacters, amount-sign inference (all positive → positive, all negative → negative, mixed → any), exclusion of covered/invalid rows, sample description cap (max 3), grouping correctness.

### Claude's Discretion
- Exact internal helper function naming within the detector module
- Whether to use a regex or simple check for numeric token detection (e.g. `/^\d+$/.test(token)`)
- Test fixture organization within the test file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Algorithm and contract
- `docs/adr/0002-pattern-suggestion-detection.md` — Algorithm spec (token prefix, numeric stripping, longest prefix), input/output contract, scope exclusions, consequences. This is the primary source of truth for the detector.

### Requirements
- `.planning/REQUIREMENTS.md` §Detection — SUG-01 through SUG-06: recurring prefix detection, numeric stripping, count/token floors, longest prefix, exclusion rules, regex escaping.
- `.planning/REQUIREMENTS.md` §Analysis Contract — ANL-02, ANL-04: PatternSuggestion shape and detectedAmountSign inference rules.

### Existing code to read before implementing
- `lib/utils/import.ts` — `NormalizedTransactionRow`, `normalizeDescription` — the type that phase 34 will map to `PatternDetectorRow`.
- `lib/services/categorization.ts` — `ActivePattern` type definition, `applyTier1Regex` logic — understand what the coverage check should replicate internally using the `CoveragePattern` local interface.
- `tests/import-utils.test.ts` — test file structure reference (Vitest describe/it/expect, how pure utility tests are organized in this project).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/utils/import.ts#normalizeDescription`: normalizes descriptions by trimming, collapsing spaces, lowercasing (it-IT). `normalizedDescription` field on `PatternDetectorRow` uses this output — the detector tokenizes `normalizedDescription`, not raw `description`.
- `lib/services/categorization.ts#applyTier1Regex`: shows the pattern matching logic (new RegExp(p.pattern, 'i').test(description) + amountSign check). The detector's coverage check should replicate this pattern inline using the local `CoveragePattern` interface.

### Established Patterns
- Pure utility functions with no IO live in `lib/utils/` without `server-only`.
- Tests for utilities live in `tests/{module-name}.test.ts` and import directly from `../lib/utils/{module}`.
- Types are defined in the same file as the functions that use them and exported explicitly.
- `amountSign: 'positive' | 'negative' | 'any'` is the established enum across `ActivePattern`, `CreatePatternSchema` — reuse the same values in `PatternSuggestion.detectedAmountSign`.

### Integration Points
- Phase 34 will import `PatternDetectorRow`, `PatternSuggestion`, and `detectPatternSuggestions` from `lib/utils/pattern-suggestions.ts` and wire them into `analyzeFile` in `lib/services/import.ts`.
- Phase 36 will create a post-import adapter that maps DB transaction rows to `PatternDetectorRow[]` and calls the same `detectPatternSuggestions`.
- `lib/validations/pattern.ts#normalizePatternInput` and `CreatePatternSchema` are the existing pattern creation contract — phase 35 will use these when promoting a suggestion.

</code_context>

<specifics>
## Specific Ideas

- The detector is the smallest deliverable in the milestone: a single pure function, its types, and tests. Phases 34–36 are all integration on top of it.
- The ADR explicitly notes: "Callers must not require exactly 2 matched tokens — the minimum is a floor, not an exact count." Tests must verify longest-prefix behavior (e.g. 3-token common prefix produces a 3-token pattern, not truncated to 2).
- Regex escaping: escape the generated prefix string before setting it as `pattern`. Bank descriptions can contain characters like `.`, `(`, `)`, `+` that are regex metacharacters.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 33-pattern-suggestion-detector*
*Context gathered: 2026-05-22*

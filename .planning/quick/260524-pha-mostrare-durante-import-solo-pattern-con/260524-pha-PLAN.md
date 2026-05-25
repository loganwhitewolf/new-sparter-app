---
phase: 260524-pha
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/utils/pattern-suggestions.ts
  - tests/pattern-suggestion-detector.test.ts
autonomous: true
requirements:
  - QUICK-260524-PHA
must_haves:
  truths:
    - "Pattern suggestions are emitted ONLY when at least one bucket member has a normalized description that extends beyond the shared prefix (i.e. a true partial match exists)"
    - "Buckets where every member's stripped normalizedDescription tokens equal the shared prefix exactly (fully identical transactions) produce NO PatternSuggestion"
    - "Existing suggestion behaviour for genuinely partial-match buckets (different suffixes, varying numeric tokens, mixed amounts) is unchanged"
  artifacts:
    - path: lib/utils/pattern-suggestions.ts
      provides: "detectPatternSuggestions with partial-match-only filter"
      contains: "detectPatternSuggestions"
    - path: tests/pattern-suggestion-detector.test.ts
      provides: "regression tests for SUG-07 (fully identical rows excluded) and partial-match coverage"
      contains: "SUG-07"
  key_links:
    - from: lib/services/import.ts
      to: lib/utils/pattern-suggestions.ts
      via: "import { detectPatternSuggestions }"
      pattern: "detectPatternSuggestions\\("
---

<objective>
Restrict `detectPatternSuggestions` to emit suggestions only when at least one row in a bucket has additional non-numeric tokens beyond the shared prefix. Fully identical normalized descriptions do not need a regex pattern — they will be categorized directly via Tier 2 (history) categorization; emitting a regex for them is noise (ADR 0002 already states "Exact-match grouping is covered by Tier 2 history categorization. PatternSuggestion targets the gap").

Purpose: align the implementation with the documented intent — pattern suggestions are for PARTIAL matches only, not full duplicates.
Output: corrected detector + regression test pinning the new behaviour.
</objective>

<execution_context>
@/Users/andreabernardini/ai-projects/new-sparter-app/.claude/get-shit-done/workflows/execute-plan.md
@/Users/andreabernardini/ai-projects/new-sparter-app/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@CONTEXT.md
@.planning/STATE.md
@docs/adr/0002-pattern-suggestion-detection.md
@lib/utils/pattern-suggestions.ts
@tests/pattern-suggestion-detector.test.ts

<interfaces>
<!-- Current contract from lib/utils/pattern-suggestions.ts -->
```ts
export interface PatternDetectorRow {
  description: string
  normalizedDescription: string
  amount: string | null
  valid: boolean
  covered: boolean
}

export interface PatternSuggestion {
  pattern: string
  matchCount: number
  detectedAmountSign: 'positive' | 'negative' | 'any'
  sampleDescriptions: string[]
}

export function detectPatternSuggestions(
  rows: PatternDetectorRow[],
  coveragePatterns: CoveragePattern[],
): PatternSuggestion[]
```

Internal helpers already in place:
- `stripNumericTokens(normalized: string): string[]` — splits and drops digits-only tokens
- `longestCommonPrefix(a: string[], b: string[]): string[]`
- Buckets are keyed by the first 2 stripped tokens; the shared prefix is computed by intersecting down all members.

Key invariant to add: a bucket qualifies ONLY IF `prefix.length < max(group[i].tokens.length)` — i.e. at least one member has tokens BEYOND the prefix. If all members' token arrays equal the prefix exactly, they are fully identical (Tier 2 territory) and must not produce a suggestion.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add SUG-07 regression test for fully-identical exclusion</name>
  <files>tests/pattern-suggestion-detector.test.ts</files>
  <behavior>
    - SUG-07a: Two rows with IDENTICAL `normalizedDescription` (e.g. both "pagamento pos market", no numeric tail) → `detectPatternSuggestions` returns `[]` (no suggestion — fully identical, Tier 2 handles them).
    - SUG-07b: Three rows where two are identical ("netflix abbonamento", "netflix abbonamento") and one has an extra token ("netflix abbonamento premium") → ONE suggestion is emitted with `pattern = "netflix abbonamento"` and `matchCount = 3` (at least one row has tokens beyond the prefix, so the bucket qualifies; all three rows still count as members).
    - SUG-07c: Two rows that differ ONLY in numeric tokens which get stripped (e.g. "pagamento pos 12345" and "pagamento pos 67890") — stripped token arrays are both `["pagamento", "pos"]` → no suggestion (after numeric stripping they are fully identical; direct categorization covers them).
    - Confirm SUG-01..SUG-06 and ANL-02/ANL-04 still pass unchanged (their fixtures all have at least one differing non-numeric suffix token, except SUG-05 — see note in Task 2).
  </behavior>
  <action>
    Append three new `it(...)` blocks (SUG-07a, SUG-07b, SUG-07c) to the existing describe block in `tests/pattern-suggestion-detector.test.ts`. Use the `row(...)` helper already defined at the top of the file. Do not modify existing test cases yet — Task 2 will update SUG-05 if its fixtures collide with the new rule.

    Run `yarn vitest run tests/pattern-suggestion-detector.test.ts` and confirm SUG-07a/b/c FAIL (RED) while SUG-01..06 and ANL-02/ANL-04 still pass. Commit on RED:
    `test(260524-pha-01): add SUG-07 fully-identical-row exclusion tests (RED)`
  </action>
  <verify>
    <automated>yarn vitest run tests/pattern-suggestion-detector.test.ts 2>&1 | grep -E "SUG-07|FAIL|PASS" | head -20</automated>
  </verify>
  <done>SUG-07a/b/c exist in the test file, fail with a clear assertion error against the current implementation, and the RED commit is recorded.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Filter fully-identical buckets in detectPatternSuggestions (GREEN)</name>
  <files>lib/utils/pattern-suggestions.ts, tests/pattern-suggestion-detector.test.ts</files>
  <behavior>
    - In `detectPatternSuggestions`, after computing `prefix` for a bucket and confirming `prefix.length >= 2`, add a final guard: emit a suggestion ONLY IF `group.some(g => g.tokens.length > prefix.length)`. If every member's stripped token list has length equal to the prefix, the bucket is fully identical → skip without emitting.
    - All SUG-07 cases pass; existing tests continue to pass.
    - SUG-05 fixture review: all five "pagamento pos market" rows share an identical `normalizedDescription`. Under the new rule that bucket is fully identical → would produce 0 suggestions, breaking the assertion `matchCount === 2`. Update SUG-05 so the two INCLUDED rows (A and E) have differing non-numeric suffix tokens (e.g. `"pagamento pos market"` and `"pagamento pos shop"`) while EXCLUDED rows (B invalid, C covered, D coverage-match) keep their existing flags. Keep the test name and its original intent (verifying exclusion by `valid`, `covered`, and `coveragePatterns`). Assertion stays `matchCount === 2`, pattern becomes `"pagamento pos"`.
  </behavior>
  <action>
    1. Edit `lib/utils/pattern-suggestions.ts` inside the `for (const group of buckets.values())` loop in `detectPatternSuggestions`. After the existing `if (prefix.length < 2) continue` guard and before constructing `prefixString`, insert:
       ```ts
       // Partial-match-only: skip buckets where every member's stripped tokens equal the prefix exactly.
       // Fully identical normalized descriptions are handled by Tier 2 (history) categorization;
       // emitting a regex for them produces noise (see docs/adr/0002).
       const hasExtension = group.some(g => g.tokens.length > prefix.length)
       if (!hasExtension) continue
       ```
    2. Update SUG-05 in `tests/pattern-suggestion-detector.test.ts`: change row A's `normalizedDescription` to `'pagamento pos market'` (unchanged) and row E's to `'pagamento pos shop'` so the included pair has a differing non-numeric suffix. Keep all other rows (B, C, D) on `'pagamento pos market'` with their existing flags — the new guard is irrelevant to them because they are excluded BEFORE bucketing (invalid / caller-covered / coverage-pattern-matched). The assertions `toHaveLength(1)` and `matchCount === 2` remain valid; the emitted pattern is `"pagamento pos"`.
    3. Run `yarn vitest run tests/pattern-suggestion-detector.test.ts` — ALL tests pass (GREEN). Commit: `feat(260524-pha-01): emit pattern suggestions only for partial matches (GREEN)`.
    4. Run the wider import suite to catch downstream regressions: `yarn vitest run tests/pattern-suggestion-detector.test.ts tests/import-service.test.ts tests/import-preview-ui.test.tsx tests/import-suggestions-page.test.tsx tests/import-analyze-page.test.tsx`. If any of those fixtures relied on fully-identical rows producing suggestions, adjust the FIXTURE (add a differentiating suffix token to one row) — do NOT weaken the new guard. Document any fixture change in the commit body.
    5. Final commit if fixture updates were needed: `test(260524-pha-01): align import test fixtures with partial-match-only suggestions`.
    6. Update `docs/adr/0002-pattern-suggestion-detection.md`: under "Scope: uncategorized transactions only", append a paragraph:
       > **Partial matches only.** A bucket of fully identical normalized descriptions (after numeric stripping) does not produce a suggestion. Identical descriptions are covered by Tier 2 history categorization once the user assigns a category to one of them; surfacing a regex for them would be noise. The detector requires at least one row in the bucket to have tokens beyond the shared prefix.
       Commit: `docs(260524-pha-01): document partial-match-only rule in ADR 0002`.
  </action>
  <verify>
    <automated>yarn vitest run tests/pattern-suggestion-detector.test.ts tests/import-service.test.ts tests/import-preview-ui.test.tsx tests/import-suggestions-page.test.tsx tests/import-analyze-page.test.tsx 2>&1 | tail -30</automated>
  </verify>
  <done>
    - All SUG-07 tests pass, SUG-01..06 and ANL-02/ANL-04 still pass.
    - All five listed import test files pass with no skipped/failed cases.
    - `detectPatternSuggestions` contains the `hasExtension` guard with the explanatory comment.
    - ADR 0002 documents the partial-match-only rule.
    - Three (or four) atomic commits recorded: RED test, GREEN implementation, (optional fixture realignment), ADR update.
  </done>
</task>

</tasks>

<verification>
- `yarn vitest run tests/pattern-suggestion-detector.test.ts` — all SUG-0x and ANL-0x cases pass.
- `yarn vitest run tests/import-service.test.ts tests/import-preview-ui.test.tsx tests/import-suggestions-page.test.tsx tests/import-analyze-page.test.tsx` — no regressions.
- `yarn check:language` passes (only English comments / identifiers added).
- Manual sanity grep: `grep -n "hasExtension" lib/utils/pattern-suggestions.ts` returns one line inside `detectPatternSuggestions`.
</verification>

<success_criteria>
During import analysis, a file containing N copies of an identical description ("NETFLIX ABBONAMENTO" appearing 5 times) produces ZERO `PatternSuggestion`. A file containing two descriptions sharing a partial prefix ("NETFLIX ABBONAMENTO" and "NETFLIX ABBONAMENTO PREMIUM") produces ONE suggestion with pattern `"netflix abbonamento"` and `matchCount = 2`. All existing import flow tests still pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260524-pha-mostrare-durante-import-solo-pattern-con/260524-pha-01-SUMMARY.md` summarising the change, the new SUG-07 cases, any fixture realignment, and the ADR update.
</output>

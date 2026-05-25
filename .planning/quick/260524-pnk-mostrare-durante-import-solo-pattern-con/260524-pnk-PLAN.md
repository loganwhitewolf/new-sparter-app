---
phase: 260524-pnk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/utils/pattern-suggestions.ts
  - tests/pattern-suggestion-detector.test.ts
  - docs/adr/0002-pattern-suggestion-detection.md
autonomous: true
requirements:
  - QUICK-260524-PNK
must_haves:
  truths:
    - "detectPatternSuggestions emits a PatternSuggestion for a bucket ONLY when at least one row in that bucket has stripped tokens that extend beyond the shared prefix (true partial match)."
    - "A bucket where every member's stripped tokens equal the shared prefix exactly (fully identical normalized descriptions after numeric stripping) produces ZERO suggestions — those rows are handled by Tier 2 (history) categorization, not by a regex pattern."
    - "Existing partial-match behaviour (SUG-01..SUG-06, ANL-02, ANL-04) and import-flow consumers (analyzeFile result, /import/[fileId]/suggestions page, ImportPreview UI) keep working unchanged for buckets that ARE partial matches."
  artifacts:
    - path: lib/utils/pattern-suggestions.ts
      provides: "detectPatternSuggestions with partial-match-only guard"
      contains: "hasExtension"
    - path: tests/pattern-suggestion-detector.test.ts
      provides: "SUG-07 regression cases pinning fully-identical exclusion"
      contains: "SUG-07"
    - path: docs/adr/0002-pattern-suggestion-detection.md
      provides: "ADR paragraph documenting partial-match-only rule"
      contains: "Partial matches only"
  key_links:
    - from: lib/services/import.ts
      to: lib/utils/pattern-suggestions.ts
      via: "import { detectPatternSuggestions }"
      pattern: "detectPatternSuggestions\\("
    - from: app/(app)/import/[fileId]/suggestions/page.tsx
      to: lib/utils/pattern-suggestions.ts
      via: "import { detectPatternSuggestions }"
      pattern: "detectPatternSuggestions\\("
---

<objective>
Restrict `detectPatternSuggestions` so that suggestions are emitted only when at least one row in a bucket has stripped tokens extending beyond the shared prefix. Buckets where every member's normalized description (after numeric stripping) is identical must produce NO suggestion: those rows are already handled by Tier 2 (history) categorization — emitting a regex pattern for them is noise.

Bug today: in the last milestone (Phase 34) pattern recognition during import was wired in, but it surfaces suggestions even when the matched rows have completely identical descriptions. The user wants regex suggestions only for the genuinely partial-match case (e.g. "NETFLIX ABBONAMENTO" + "NETFLIX ABBONAMENTO PREMIUM"), not for exact duplicates (e.g. five copies of "NETFLIX ABBONAMENTO").

Purpose: align the implementation with the documented intent of ADR 0002 ("Exact-match grouping is covered by Tier 2 history categorization. PatternSuggestion targets the gap — new descriptions the user has never seen before.").

Output: corrected detector + RED→GREEN regression tests + ADR clarification + verified pass on all import-flow test files that consume the detector.
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
<!-- Current contract from lib/utils/pattern-suggestions.ts — do NOT change the signature. -->
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

Internal pipeline already in place (do not restructure):
1. Filter eligible rows (`valid`, `!covered`, not matched by `coveragePatterns`, `stripNumericTokens(...).length >= 2`).
2. Bucket candidates by the first 2 stripped tokens.
3. For each bucket with `>= 2` members, intersect token arrays down to compute the longest common prefix.
4. If `prefix.length >= 2`, emit a suggestion with `pattern = escapeRegex(prefix.join(' '))`, `matchCount = group.length`, `detectedAmountSign = inferAmountSign(amounts)`, `sampleDescriptions = group.slice(0,3).map(g => g.row.description)`.

New invariant to add at step 4: emit ONLY IF `group.some(g => g.tokens.length > prefix.length)`. If every member's stripped token list equals the prefix exactly, skip — fully identical normalized descriptions belong to Tier 2 (history) categorization, not to regex suggestions.

Consumers of `detectPatternSuggestions` to keep green:
- `lib/services/import.ts` → tests/import-service.test.ts, tests/import-preview-ui.test.tsx, tests/import-analyze-page.test.tsx
- `app/(app)/import/[fileId]/suggestions/page.tsx` → tests/import-suggestions-page.test.tsx
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add SUG-07 RED regression cases for fully-identical exclusion</name>
  <files>tests/pattern-suggestion-detector.test.ts</files>
  <behavior>
    Append three new `it(...)` cases to the existing `describe('detectPatternSuggestions', ...)` block in `tests/pattern-suggestion-detector.test.ts`. They must fail against the current implementation and pass once Task 2 lands.

    - **SUG-07a (fully identical, no numeric tail):** Two rows with `normalizedDescription: 'pagamento pos market'` (identical, no digits) → `detectPatternSuggestions(rows, [])` returns `[]`. Rationale: stripped tokens are `["pagamento", "pos", "market"]` for both; the shared prefix equals BOTH members' full token list, so no row extends beyond the prefix → not a partial match.

    - **SUG-07b (mixed: two identical + one extension):** Three rows — `'netflix abbonamento'`, `'netflix abbonamento'`, `'netflix abbonamento premium'` → ONE suggestion with `pattern === 'netflix abbonamento'` and `matchCount === 3`. Rationale: at least one member (the "premium" row) has tokens beyond the prefix, so the bucket qualifies; all three rows are still counted.

    - **SUG-07c (differ only in stripped numeric tokens):** Two rows `'pagamento pos 12345'` and `'pagamento pos 67890'` → `[]`. Rationale: after `stripNumericTokens`, both reduce to `["pagamento", "pos"]`, equal to the shared prefix → fully identical post-strip → no suggestion. This case is the inverse of SUG-02 (which DOES emit because the rows have a non-numeric extension `supermercato` beyond the shared prefix).

    Confirm SUG-01..SUG-06 and ANL-02/ANL-04 still pass (their fixtures all have at least one differing non-numeric suffix token, EXCEPT SUG-05 — Task 2 will adjust SUG-05 in lockstep with the implementation change).
  </behavior>
  <action>
    1. Open `tests/pattern-suggestion-detector.test.ts`. After the existing `it('ANL-04: ...')` block (last test in the file), append three new `it(...)` blocks named exactly `'SUG-07a: ...'`, `'SUG-07b: ...'`, `'SUG-07c: ...'` matching the behaviors above. Reuse the existing `row(...)` helper at the top of the file — do not introduce a new helper.

    2. Do NOT touch SUG-05 yet. Do NOT modify `lib/utils/pattern-suggestions.ts` in this task. The goal of Task 1 is a clean RED on SUG-07a/b/c against the current detector.

    3. Run `yarn vitest run tests/pattern-suggestion-detector.test.ts` and confirm:
       - SUG-07a FAIL (current impl emits one suggestion because the prefix === member tokens does not block emission today).
       - SUG-07b PASS already (today it emits one suggestion with matchCount 3 — keeping it documents the desired behaviour and protects against over-eager regression).
       - SUG-07c FAIL (current impl emits a suggestion for purely-numeric-differing rows).
       - SUG-01..SUG-06, ANL-02, ANL-04 PASS.

    4. Commit on RED: `test(260524-pnk-01): add SUG-07 partial-match-only regression tests (RED)`.
  </action>
  <verify>
    <automated>yarn vitest run tests/pattern-suggestion-detector.test.ts 2>&1 | grep -E "SUG-07|✓|✗|FAIL|PASS|Tests" | head -40</automated>
  </verify>
  <done>
    SUG-07a/b/c exist verbatim in the test file. SUG-07a and SUG-07c fail with assertion errors (expected `[]`, received one suggestion). SUG-07b passes. SUG-01..SUG-06, ANL-02, ANL-04 still pass. The RED commit is recorded on the current branch.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add partial-match-only guard and align fixtures (GREEN)</name>
  <files>lib/utils/pattern-suggestions.ts, tests/pattern-suggestion-detector.test.ts, docs/adr/0002-pattern-suggestion-detection.md</files>
  <behavior>
    - `detectPatternSuggestions` skips any bucket where `group.every(g => g.tokens.length === prefix.length)` — i.e. no member extends beyond the shared prefix.
    - SUG-07a, SUG-07b, SUG-07c all pass after the guard is added (RED → GREEN).
    - SUG-05 is re-aligned (its fixture currently relies on five identical `'pagamento pos market'` rows — under the new guard the bucket of included rows A+E would be fully identical and emit 0 suggestions, breaking the assertion `matchCount === 2`). After the fix the test still verifies what it was meant to verify (`valid`, caller `covered`, and `coveragePattern` exclusion) but with row E given a differing non-numeric suffix so the included pair is a true partial match.
    - The downstream consumer test files (`tests/import-service.test.ts`, `tests/import-preview-ui.test.tsx`, `tests/import-analyze-page.test.tsx`, `tests/import-suggestions-page.test.tsx`) keep passing. If any of them happen to use fully-identical fixtures and now produce 0 suggestions where they expected ≥1, adjust the FIXTURE by adding a differentiating non-numeric suffix token to one row — do NOT weaken the new guard. Most likely candidates: `tests/import-service.test.ts` Phase 34 Wave 0 cases (`describe('analyzeFile — pattern suggestions')` test case 3 uses six rows with prefixes `'merchant a'..'merchant f'` followed by integer counts — those already have differing non-numeric tokens at index 1, so they should remain green; verify in step 4 below).
  </behavior>
  <action>
    1. Edit `lib/utils/pattern-suggestions.ts` inside the `for (const group of buckets.values())` loop in `detectPatternSuggestions` (around lines 127–134). After the existing `if (prefix.length < 2) continue` guard and BEFORE the `const prefixString = prefix.join(' ')` line, insert:
       ```ts
       // Partial-match-only: skip buckets where every member's stripped token list
       // is exactly the shared prefix. Fully identical normalized descriptions
       // (after numeric stripping) are covered by Tier 2 (history) categorization
       // once the user assigns a category to one of them; surfacing a regex
       // suggestion for them is noise. See docs/adr/0002.
       const hasExtension = group.some(g => g.tokens.length > prefix.length)
       if (!hasExtension) continue
       ```

    2. Update SUG-05 in `tests/pattern-suggestion-detector.test.ts`:
       - Change row E's `normalizedDescription` from `'pagamento pos market'` to `'pagamento pos shop'` (and keep `description: 'ROW E'`, `amount: '10.00'`).
       - Leave rows A, B, C, D unchanged: A has `'pagamento pos market'` (valid, included), B has `valid: false` (excluded), C has `covered: true` (excluded), D has `amount: '-10.00'` and is excluded by the `coveragePattern` `'pagamento pos'` with `amountSign: 'negative'`.
       - The assertions `expect(suggestions).toHaveLength(1)` and `expect(suggestions[0].matchCount).toBe(2)` remain unchanged and valid (A + E form the only qualifying bucket, share prefix `["pagamento", "pos"]`, and E extends with `"shop"` so the new guard passes).
       - The emitted `pattern` becomes `'pagamento pos'` (still 2 tokens, no metacharacters to escape).

    3. Run `yarn vitest run tests/pattern-suggestion-detector.test.ts`. All cases pass. Commit: `feat(260524-pnk-01): emit pattern suggestions only for partial matches (GREEN)`.

    4. Run the import-flow consumer tests to catch downstream regressions:
       ```
       yarn vitest run tests/pattern-suggestion-detector.test.ts tests/import-service.test.ts tests/import-preview-ui.test.tsx tests/import-suggestions-page.test.tsx tests/import-analyze-page.test.tsx
       ```
       If any fixture in those files relied on fully-identical rows producing suggestions, adjust the FIXTURE (add a differentiating non-numeric suffix to one row of the qualifying bucket) — do NOT loosen the new `hasExtension` guard. Record any fixture change with: `test(260524-pnk-01): align import test fixtures with partial-match-only rule`. If no fixture changes are needed, skip this commit.

    5. Run the full test suite once to catch unexpected callers: `yarn vitest run`. Expect 0 regressions outside the files listed in step 4.

    6. Update `docs/adr/0002-pattern-suggestion-detection.md`. Under the existing `### Scope: uncategorized transactions only` section, append a new paragraph:
       > **Partial matches only.** A bucket of fully identical normalized descriptions (after numeric stripping) does not produce a suggestion. Identical descriptions are covered by Tier 2 (history) categorization once the user assigns a category to one of them; surfacing a regex for them is noise. The detector requires at least one row in the bucket to have stripped tokens beyond the shared prefix.

       Commit: `docs(260524-pnk-01): document partial-match-only rule in ADR 0002`.

    7. Run `yarn check:language` and `yarn tsc --noEmit` to confirm no language-policy or type regressions. Both must exit 0 (modulo pre-existing tsc errors in `tests/production-smoke.test.ts` and `tests/set-r2-cors.test.ts` noted in `.planning/phases/34-import-analysis-suggestions/34-02-SUMMARY.md` — no NEW errors are acceptable).
  </action>
  <verify>
    <automated>yarn vitest run tests/pattern-suggestion-detector.test.ts tests/import-service.test.ts tests/import-preview-ui.test.tsx tests/import-suggestions-page.test.tsx tests/import-analyze-page.test.tsx 2>&1 | tail -20 && echo "---" && grep -c "hasExtension" lib/utils/pattern-suggestions.ts && echo "---" && grep -c "Partial matches only" docs/adr/0002-pattern-suggestion-detection.md</automated>
  </verify>
  <done>
    - `lib/utils/pattern-suggestions.ts` contains the `hasExtension` guard with the explanatory comment.
    - SUG-07a/b/c pass; SUG-01..06, ANL-02, ANL-04 pass; SUG-05 updated and passes with the new fixture.
    - All five listed import test files pass with no failures and no new skips.
    - `yarn tsc --noEmit` produces no NEW type errors.
    - `yarn check:language` exits 0.
    - ADR 0002 contains the "Partial matches only." paragraph.
    - Atomic commits recorded: RED test (Task 1), GREEN implementation + SUG-05 fixture adjustment, optional fixture-realignment for import tests if needed, ADR update.
  </done>
</task>

</tasks>

<verification>
- `yarn vitest run tests/pattern-suggestion-detector.test.ts` → all SUG-0x and ANL-0x cases pass.
- `yarn vitest run tests/import-service.test.ts tests/import-preview-ui.test.tsx tests/import-suggestions-page.test.tsx tests/import-analyze-page.test.tsx` → no regressions.
- `yarn vitest run` → full suite green (no NEW failures vs the pre-change baseline).
- `yarn tsc --noEmit` → exits 0 (or only pre-existing errors documented in 34-02-SUMMARY).
- `yarn check:language` → exits 0.
- `grep -v '^#' lib/utils/pattern-suggestions.ts | grep -c "hasExtension"` → at least 1 (guard is present).
- `grep -c "Partial matches only" docs/adr/0002-pattern-suggestion-detection.md` → 1 (ADR updated).
</verification>

<success_criteria>
Given an import file containing five identical descriptions (e.g. "NETFLIX ABBONAMENTO" appearing 5 times), `analyzeFile` returns `patternSuggestions: []` — the user is no longer offered a useless regex for exact duplicates and can rely on Tier 2 history categorization. Given an import file containing two descriptions sharing a partial prefix (e.g. "NETFLIX ABBONAMENTO" and "NETFLIX ABBONAMENTO PREMIUM"), `analyzeFile` returns one suggestion with `pattern: 'netflix abbonamento'` and `matchCount: 2`. The `/import/[fileId]/suggestions` page reflects the same rule for post-import re-analysis on persisted transactions. No regressions in the wider test suite.
</success_criteria>

<output>
After completion, create `.planning/quick/260524-pnk-mostrare-durante-import-solo-pattern-con/260524-pnk-01-SUMMARY.md` summarising: the `hasExtension` guard, the three SUG-07 cases, the SUG-05 fixture adjustment, any fixture realignment in import tests, the ADR paragraph, and the final test counts.
</output>

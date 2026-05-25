# Phase 33: pattern-suggestion-detector - Research

**Researched:** 2026-05-22
**Domain:** Pure TypeScript utility — deterministic token-prefix pattern detection
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Detector lives in `lib/utils/pattern-suggestions.ts` — pure function, no `server-only`, testable without mocking. Follows the same convention as `lib/utils/import.ts`.
- **D-02:** Define `PatternDetectorRow` as `{ description: string; normalizedDescription: string; amount: string | null; valid: boolean; covered: boolean }`. Both the phase 34 pre-import adapter and the phase 36 post-import DB adapter will map to this interface.
- **D-03:** The detector accepts a `CoveragePattern[]` as second parameter — a local minimal interface defined in the same file: `{ pattern: string; amountSign: 'positive' | 'negative' | 'any' }`. Callers pass their loaded `ActivePattern[]` objects, which satisfy this interface structurally (TypeScript duck typing). Zero import from `lib/services/`.
- **D-04:** Rows where `valid` is false, `covered` is true (matched by an active pattern), or that are filtered before the detector call (invalid/duplicate pre-filter done by caller) are excluded from suggestion grouping.
- **D-05:** `PatternSuggestion`: `{ pattern: string; matchCount: number; detectedAmountSign: 'positive' | 'negative' | 'any'; sampleDescriptions: string[] }`. Defined in the same file as the detector. Exported for use by phase 34.
- **D-06:** Tests in `tests/pattern-suggestion-detector.test.ts` using Vitest. Must cover: numeric token stripping, longest-prefix behavior, minimum count floor (≥2), minimum token floor (≥2 non-numeric), regex escaping of metacharacters, amount-sign inference (all positive → positive, all negative → negative, mixed → any), exclusion of covered/invalid rows, sample description cap (max 3), grouping correctness.

### Claude's Discretion

- Exact internal helper function naming within the detector module
- Whether to use a regex or simple check for numeric token detection (e.g. `/^\d+$/.test(token)`)
- Test fixture organization within the test file

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUG-01 | User receives pattern suggestions for recurring valid uncategorized import rows that share a common normalized token prefix | ADR token-prefix algorithm; `normalizeDescription` output is the tokenization input |
| SUG-02 | Suggested patterns strip purely numeric tokens before prefix comparison | ADR: "Purely numeric tokens (reference numbers, years, amounts) are stripped before comparison" |
| SUG-03 | Suggested patterns require at least 2 matching rows and at least 2 non-numeric prefix tokens | ADR: "≥2 uncategorized descriptions share a common prefix of ≥2 tokens" — both are floors |
| SUG-04 | Suggested patterns preserve the longest qualifying common prefix, not exactly 2 tokens | ADR: "Callers must not require exactly 2 matched tokens — the minimum is a floor, not an exact count" |
| SUG-05 | Suggested patterns exclude rows that are invalid, duplicate, or already matched by an active categorization pattern | D-03/D-04: coverage check via `CoveragePattern[]` second parameter; `valid` flag gates inclusion |
| SUG-06 | Suggested regex sources are escaped so bank-description metacharacters cannot create unintended regex behavior | CONTEXT.md: bank descriptions can contain `.`, `(`, `)`, `+` — escape before setting as `pattern` |
| ANL-02 | Each pattern suggestion includes `pattern`, `matchCount`, `detectedAmountSign`, and up to 3 sample descriptions | D-05 output type; ADR "sampleDescriptions (max 3)" |
| ANL-04 | `detectedAmountSign` is `positive`, `negative`, or `any` based on grouped transaction amounts | ADR: "if all transactions share the same sign, that sign is set; otherwise `any`" |
</phase_requirements>

## Summary

Phase 33 delivers a single pure function `detectPatternSuggestions` in `lib/utils/pattern-suggestions.ts`, plus its exported types and full Vitest test coverage. There is no DB access, no server-only import, and no UI. The function is a deterministic algorithm that groups uncovered, valid import rows by their longest common normalized token prefix (after stripping purely numeric tokens), and emits a `PatternSuggestion` per group that meets the count and token-length floors.

The algorithm is fully specified by the ADR (`docs/adr/0002-pattern-suggestion-detection.md`) and the CONTEXT.md decisions. All design choices are locked. Research confirms the codebase conventions to follow: same module structure as `lib/utils/dashboard.ts` (types and functions in one file, no server-only), same Vitest pattern as `tests/dashboard-utils.test.ts` (inline data, describe/it/expect, import via `@/` alias or `../lib/utils/...` relative path), and the same `amountSign` string union that `ActivePattern` and `CreatePatternSchema` already use.

**Primary recommendation:** Implement the detector as a single file with four exported symbols (`PatternDetectorRow`, `CoveragePattern`, `PatternSuggestion`, `detectPatternSuggestions`) and no external dependencies beyond native TypeScript. Tests should use inline inline arrays of `PatternDetectorRow` — no fixture files needed for a pure function.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pattern detection algorithm | Pure utility (lib/utils/) | — | No IO, no DB, no framework — belongs in the utils layer by project convention and testability requirement |
| Coverage check (active pattern matching) | Inside detector | — | D-03 locks zero imports from lib/services/; detector replicates the match logic locally via CoveragePattern |
| Amount-sign inference | Inside detector | — | Part of the grouping output — same pure computation as the rest of the algorithm |
| Regex escaping | Inside detector | — | The detector generates the pattern string; it must escape before returning |
| Test execution | Vitest (tests/ layer) | — | Confirmed: vitest.config.ts includes tests/**/*.test.ts; framework is already installed |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | (project-wide) | Type definitions and implementation | Already the project language |
| Vitest | ^4.1.5 | Unit testing | Already installed; confirmed in package.json |

[VERIFIED: package.json]

No new dependencies are needed. The detector uses only native JavaScript string and array operations.

### Supporting

None required. The coverage check replicates the `applyTier1Regex` pattern (`new RegExp(p.pattern, 'i').test(description)`) inline using the local `CoveragePattern` interface — no Decimal.js, no node:crypto.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline regex escape | `escape-string-regexp` npm package | Not needed — a one-liner handles the standard metacharacter set; adding a dep for this is disproportionate |
| Single function file | Separate types file | Project convention is types colocated with the functions that define them (see lib/utils/dashboard.ts) — no split needed |

**Installation:** No new packages to install.

## Architecture Patterns

### System Architecture Diagram

```
PatternDetectorRow[]  +  CoveragePattern[]
         |
         v
  [filter: valid === true AND covered === false]
         |
         v
  [tokenize normalizedDescription by whitespace]
         |
         v
  [strip purely numeric tokens from each token list]
         |
         v
  [group rows by stripped token list prefix]
  — try longest prefix, walk down to minimum 2-token prefix
  — emit one group per qualifying longest prefix
         |
         v
  [filter groups: matchCount >= 2 AND prefix.length >= 2]
         |
         v
  [for each group]
    ├── pattern = escapeRegex(prefix.join(' '))
    ├── matchCount = group.length
    ├── detectedAmountSign = inferAmountSign(group amounts)
    └── sampleDescriptions = group.slice(0, 3).map(r => r.description)
         |
         v
  PatternSuggestion[]
  (callers sort by matchCount desc and slice to 5 — ANL-03 is phase 34 scope)
```

### Recommended Project Structure

```
lib/
└── utils/
    └── pattern-suggestions.ts   # PatternDetectorRow, CoveragePattern, PatternSuggestion, detectPatternSuggestions

tests/
└── pattern-suggestion-detector.test.ts   # Vitest unit tests — inline data, no fixture files
```

### Pattern 1: Pure Utility Module (no server-only)

**What:** Types and functions colocated in one file, exported explicitly, no framework imports.
**When to use:** Any computation with no IO that must be testable in isolation.

```typescript
// Source: lib/utils/dashboard.ts (project reference)
import Decimal from 'decimal.js'
import { toDecimal } from '@/lib/utils/decimal'

export type DeviationResult = number | null | 'new'

export function computeDeviation(
  referenceAmount: string | number,
  baseline: string | number
): DeviationResult { ... }
```

The pattern-suggestions module follows the same shape: exported types at the top, exported function(s) below.

### Pattern 2: Coverage Check — Inline Regex Match (no service import)

**What:** Replicate `applyTier1Regex` logic locally using the local `CoveragePattern` interface.
**When to use:** D-03 mandates zero dependency on `lib/services/categorization.ts`.

```typescript
// Source: lib/services/categorization.ts — pattern to replicate, not import
function isCovered(
  normalizedDescription: string,
  amount: string | null,
  patterns: CoveragePattern[]
): boolean {
  for (const p of patterns) {
    try {
      const regex = new RegExp(p.pattern, 'i')
      if (!regex.test(normalizedDescription)) continue
      if (p.amountSign === 'any' || amount === null) return true
      // sign check: positive >= 0, negative < 0
      try {
        const d = parseFloat(amount)
        if (p.amountSign === 'positive' && d >= 0) return true
        if (p.amountSign === 'negative' && d < 0) return true
      } catch { return true }
    } catch { /* invalid regex — skip */ }
  }
  return false
}
```

Note: The original `amountSignMatches` in `categorization.ts` uses `Decimal.js` for the sign check. The detector can use the same approach or a simpler `parseFloat` check — this is Claude's discretion (D-06). The Decimal.js import would be a valid choice given it is already a project dependency.

### Pattern 3: Numeric Token Detection

**What:** Classify a token as purely numeric to exclude it from prefix comparison.
**When to use:** Every token in the stripped prefix step.

```typescript
// Source: CONTEXT.md — discretion item; this is the recommended approach
function isNumericToken(token: string): boolean {
  return /^\d+$/.test(token)
}
```

This is simpler and more predictable than `Number.isNaN(Number(token))` because it strictly requires digit-only strings. Tokens like `"12.34"` or `"ref-001"` are NOT purely numeric under this definition — which is correct behavior since only integer-style reference numbers and years need stripping.

### Pattern 4: Longest Common Prefix Extraction

**What:** Given two stripped token arrays, find the longest common prefix.
**When to use:** Pairwise or iterative grouping to find what strings share.

```typescript
// Source: ASSUMED — standard algorithm, confirmed correct by ADR description
function longestCommonTokenPrefix(a: string[], b: string[]): string[] {
  const result: string[] = []
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) break
    result.push(a[i])
  }
  return result
}
```

For grouping all rows: iterate rows, build a map keyed by stripped token array (JSON.stringify works for a pure prefix key), and for each group reduce the prefix down to the longest common prefix across all members of the group.

### Pattern 5: Regex Escape

**What:** Escape metacharacters in the prefix string before using it as a regex pattern.
**When to use:** Final step before assigning `PatternSuggestion.pattern`.

```typescript
// Source: ASSUMED — MDN standard approach
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

[ASSUMED] The specific character set above is the standard set. The ADR notes bank descriptions can contain `.`, `(`, `)`, `+` — all covered.

### Pattern 6: Amount-Sign Inference

**What:** Given the group's `amount` values (string | null), determine `detectedAmountSign`.
**When to use:** Once per qualifying group.

```typescript
// Source: ADR + lib/services/categorization.ts amountSignMatches pattern
function inferAmountSign(amounts: (string | null)[]): 'positive' | 'negative' | 'any' {
  const signs = new Set<'positive' | 'negative'>()
  for (const amount of amounts) {
    if (amount === null) continue
    const d = parseFloat(amount)  // or new Decimal(amount).isNegative()
    if (d < 0) signs.add('negative')
    else signs.add('positive')
  }
  if (signs.size === 1) return signs.values().next().value!
  return 'any'
}
```

If all amounts are null (edge case: rows with invalid amounts that passed the `valid` check — unlikely given `valid` requires a parseable amount), fall back to `'any'`.

### Pattern 7: Vitest Test Structure (inline data)

**What:** Tests for pure utilities use inline data arrays, not fixture files.
**When to use:** Any pure function with no IO dependencies.

```typescript
// Source: tests/dashboard-utils.test.ts (project reference)
import { describe, expect, it } from 'vitest'
import { detectPatternSuggestions } from '../lib/utils/pattern-suggestions'

describe('detectPatternSuggestions', () => {
  it('groups rows sharing a 2-token prefix and emits one suggestion', () => {
    const rows = [
      { description: 'PAGAMENTO POS 12345', normalizedDescription: 'pagamento pos 12345', amount: '-10.00', valid: true, covered: false },
      { description: 'PAGAMENTO POS 67890', normalizedDescription: 'pagamento pos 67890', amount: '-20.00', valid: true, covered: false },
    ]
    const suggestions = detectPatternSuggestions(rows, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].pattern).toBe('pagamento pos')
    expect(suggestions[0].matchCount).toBe(2)
  })
})
```

### Anti-Patterns to Avoid

- **Importing from `lib/services/categorization.ts`:** D-03 forbids it. Replicate the match logic inline.
- **Adding `'use server'` or `'server-only'`:** D-01 requires the file to be testable without mocking. No server imports.
- **Using `JSON.stringify` for the grouping key across the full token array:** Groups must be formed by shared prefix, not exact token equality. The key must be built from the stripped prefix, not the full stripped sequence.
- **Sorting/slicing to 5 in the detector:** ANL-03 (cap at 5) is phase 34 scope. The detector returns all qualifying suggestions; callers truncate.
- **Zero-amount rows treated as positive:** `amount: null` on a `PatternDetectorRow` should not be classified as positive — it contributes `any` semantics to the group.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Regex metacharacter escaping | Custom character list from memory | Standard `/[.*+?^${}()|[\]\\]/g` replace | Omitting one character (e.g. `]`) creates injection — use the full known set |
| Running tests | Custom test runner | `vitest run` (already installed) | Vitest 4.1.5 is in package.json; no new tooling needed |

**Key insight:** This phase has minimal "don't hand-roll" risk because the algorithm is a bespoke domain function. The only pitfall is the regex escape character set — use the complete standard set from the start.

## Common Pitfalls

### Pitfall 1: Prefix key collision — grouping by full stripped sequence instead of by prefix

**What goes wrong:** If rows are keyed by their full stripped token array (e.g. `["pagamento", "pos"]` vs `["pagamento", "pos", "supermercato"]`), rows that share a 2-token prefix but have different lengths are placed in separate groups. The detector produces no suggestion for the 2-token prefix even though 5 rows share it.

**Why it happens:** Naive map-keying by `strippedTokens.join(' ')` groups by exact sequence, not by shared prefix.

**How to avoid:** Build groups by iterating over candidate prefixes from longest to shortest. One approach: sort rows by stripped token sequence, then do a single pass finding runs where consecutive rows share a minimum-length common prefix. Another: for each pair of rows, compute their LCP; if ≥2 tokens, they are candidates for the same group.

**Warning signs:** Test `it('groups rows with different suffix tokens under the same prefix')` failing — e.g. "pagamento pos 12345" and "pagamento pos supermercato" not grouped together.

### Pitfall 2: Numeric stripping collapses descriptions to zero tokens

**What goes wrong:** A description like `"12345 67890"` after normalization becomes `["12345", "67890"]`; after numeric stripping, the token array is empty. If the code then attempts to find a common prefix of empty arrays, it produces an empty-string pattern and may emit a spurious suggestion.

**Why it happens:** No guard on the post-strip token count before attempting prefix comparison.

**How to avoid:** After stripping numeric tokens, skip rows where the resulting token array has fewer than 2 elements. They cannot contribute a qualifying prefix.

**Warning signs:** Suggestion with `pattern: ""` or `matchCount` counting rows that had only-numeric descriptions.

### Pitfall 3: `covered` flag is caller-computed vs. detector-computed confusion

**What goes wrong:** Phase 34 may pass rows where `covered` is pre-set by the caller's categorization pipeline. If the detector also does coverage re-checking internally, rows might be double-filtered or incorrectly included.

**Why it happens:** D-03 and D-04 are slightly in tension: D-03 says the detector accepts `CoveragePattern[]` and does the regex matching internally; D-04 says `covered: true` rows are excluded. The resolution is: the detector uses `CoveragePattern[]` to compute `covered` at call time, populating the `covered` field — OR it trusts the `covered` boolean already set on `PatternDetectorRow`.

**How to avoid:** The locked design (D-02 + D-03) is clear: `PatternDetectorRow.covered` is set by the caller. The `CoveragePattern[]` second parameter is what the caller uses to compute it before constructing `PatternDetectorRow`. The detector only reads `row.covered` — it does not re-run the coverage check internally. The `CoveragePattern[]` parameter serves as documentation of the interface contract and enables the caller to populate `covered`.

**Clarification needed by planner:** D-03 says "callers pass their loaded `ActivePattern[]` objects, which satisfy this interface structurally" and "the detector does the regex matching internally." This directly conflicts with the interpretation above. The planner must resolve: does the detector run coverage internally using `CoveragePattern[]`, or does it trust `PatternDetectorRow.covered`?

Reading D-03 and D-04 together more carefully: D-04 says `covered: true` rows are excluded from suggestion grouping. D-03 says the detector accepts `CoveragePattern[]` as second parameter and "the detector does the regex matching internally." This means: the detector receives rows (which may NOT have `covered` pre-set — they may have `covered: false` as a default), and it computes coverage inline against the `CoveragePattern[]`. The `PatternDetectorRow.covered` field in D-02 may be intended as a pre-computed hint (set by the caller's broader dedup logic, not the coverage regex check). The planner should clarify this to avoid two implementations of coverage logic.

**Resolution recommended by research:** The cleaner contract — and one consistent with D-03 "the detector does the regex matching internally" — is: the detector runs the coverage check against `CoveragePattern[]` internally, ignoring the `covered` field on `PatternDetectorRow`. The `covered` field on `PatternDetectorRow` would then represent a different exclusion (e.g. already-duplicate rows filtered by the caller's dedup step), not the regex-pattern coverage. This interpretation makes the detector self-contained and phase 36 safe.

### Pitfall 4: `sampleDescriptions` uses `normalizedDescription` instead of `description`

**What goes wrong:** The sample descriptions shown to the user in the UI (phase 35) are lowercased/normalized strings ("pagamento pos supermercato") instead of the original bank description ("PAGAMENTO POS SUPERMERCATO"), which is harder to read for users.

**Why it happens:** The algorithm tokenizes `normalizedDescription` for prefix matching, and a developer copies `normalizedDescription` into `sampleDescriptions` by mistake.

**How to avoid:** `sampleDescriptions` must be populated from `row.description` (the original, pre-normalization string), not `row.normalizedDescription`.

### Pitfall 5: Amount-sign inference when all amounts are null

**What goes wrong:** If a group of rows all have `amount: null` (edge case), the `inferAmountSign` function iterates an empty signs set and falls through, potentially returning `undefined` or throwing.

**Why it happens:** The `signs.size === 1` branch assumes at least one non-null amount.

**How to avoid:** Explicitly handle the empty-signs case by returning `'any'` as the default.

### Pitfall 6: Regex flag case-sensitivity in coverage check

**What goes wrong:** The coverage check uses `new RegExp(p.pattern, 'i')` in `applyTier1Regex`. If the detector's inline replication forgets the `'i'` flag, patterns that rely on case-insensitive matching will fail to mark rows as covered.

**Why it happens:** Copy-paste omission.

**How to avoid:** Always use `new RegExp(p.pattern, 'i')` in the inline coverage replication, consistent with `applyTier1Regex`.

## Code Examples

### detectPatternSuggestions — top-level signature

```typescript
// Source: docs/adr/0002-pattern-suggestion-detection.md + 33-CONTEXT.md D-01 through D-05

export interface PatternDetectorRow {
  description: string
  normalizedDescription: string
  amount: string | null
  valid: boolean
  covered: boolean
}

export interface CoveragePattern {
  pattern: string
  amountSign: 'positive' | 'negative' | 'any'
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

### Test structure reference

```typescript
// Source: tests/dashboard-utils.test.ts (project convention — inline data, no fixtures)
import { describe, expect, it } from 'vitest'
import {
  detectPatternSuggestions,
  type PatternDetectorRow,
  type CoveragePattern,
} from '../lib/utils/pattern-suggestions'

function row(overrides: Partial<PatternDetectorRow> & { normalizedDescription: string }): PatternDetectorRow {
  return {
    description: overrides.normalizedDescription.toUpperCase(), // default raw form
    amount: '-10.00',
    valid: true,
    covered: false,
    ...overrides,
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A — new feature | Token-prefix deterministic detection | Phase 33 (new) | No migration needed |

**Deprecated/outdated:**
- None — this is a greenfield module.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The standard regex escape character set `/[.*+?^${}()|[\]\\]/g` covers all metacharacters relevant to bank descriptions | Common Pitfalls, Code Examples | A missing character (e.g. `-` inside character class context) could allow injection; low probability given the pattern is used as a prefix match, not a character class |
| A2 | `covered: boolean` on `PatternDetectorRow` is a pre-set hint from the caller's dedup logic, distinct from the regex coverage check the detector runs internally against `CoveragePattern[]` | Common Pitfalls (Pitfall 3) | If both `covered` and `CoveragePattern[]` check the same thing, one of them is redundant; implementation would still work but the interface would be confusing |
| A3 | Purely numeric token detection should use `/^\d+$/` (integer-only), not `Number.isNaN(Number(token))` | Architecture Patterns, Pattern 3 | If tokens like `"12.34"` should also be stripped (e.g., amounts embedded in descriptions), the stricter definition misses them — but the ADR says "reference numbers and years," which are integers |

## Open Questions

1. **Is `PatternDetectorRow.covered` pre-computed by the caller, or does the detector compute it from `CoveragePattern[]`?**
   - What we know: D-03 says "the detector does the regex matching internally"; D-04 says `covered: true` rows are excluded.
   - What's unclear: If the detector computes coverage from `CoveragePattern[]`, then `PatternDetectorRow.covered` serves a different purpose (caller-side dedup exclusion). If the caller pre-computes it, `CoveragePattern[]` is documentation-only.
   - Recommendation: Planner should choose one: (a) detector computes coverage internally from `CoveragePattern[]`, ignores `PatternDetectorRow.covered`; or (b) caller sets `covered` using `CoveragePattern[]`, detector only reads the boolean. Option (a) is cleaner and avoids split responsibility. Tests must cover whichever path is chosen.

2. **Should `detectedAmountSign` use Decimal.js or `parseFloat` for the sign check?**
   - What we know: `amountSignMatches` in `categorization.ts` uses `new Decimal(amount).lessThan(0)` for the negative check. `PatternDetectorRow.amount` is a DB decimal string (e.g. `"-10.00"`), which `parseFloat` handles correctly.
   - What's unclear: The project rule is "never use native arithmetic on monetary amounts." Sign checking (positive/negative classification) is not arithmetic — it is comparison.
   - Recommendation: Use Decimal.js for consistency with the rest of the codebase (`import Decimal from 'decimal.js'` is already in `lib/utils/import.ts`), even though `parseFloat` would work. This is Claude's discretion per D-06.

## Environment Availability

Step 2.6: SKIPPED — Phase 33 is a pure code addition with no external dependencies beyond the already-installed Vitest framework.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | All tests | ✓ | ^4.1.5 | — |
| TypeScript | Implementation | ✓ | (project-wide) | — |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/pattern-suggestion-detector.test.ts` |
| Full suite command | `npx vitest run` |

[VERIFIED: vitest.config.ts, package.json]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUG-01 | Rows with shared normalized prefix produce a suggestion | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ Wave 0 |
| SUG-02 | Purely numeric tokens stripped before comparison | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ Wave 0 |
| SUG-03 | Groups with <2 rows or <2 token prefix are excluded | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ Wave 0 |
| SUG-04 | Longest qualifying prefix is preserved (3-token example) | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ Wave 0 |
| SUG-05 | `valid: false` rows excluded; covered rows excluded | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ Wave 0 |
| SUG-06 | Pattern contains escaped metacharacters from raw description | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ Wave 0 |
| ANL-02 | `PatternSuggestion` has `pattern`, `matchCount`, `detectedAmountSign`, `sampleDescriptions` (max 3) | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ Wave 0 |
| ANL-04 | `detectedAmountSign` is `positive` / `negative` / `any` based on group amounts | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/pattern-suggestion-detector.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/pattern-suggestion-detector.test.ts` — covers all 8 requirements above
- [ ] `lib/utils/pattern-suggestions.ts` — the implementation under test (Wave 0 creates the stub/skeleton)

## Security Domain

This phase has no authentication, no DB access, no user input flowing to persistent storage, and no network calls. The only security-adjacent concern is regex injection from bank description metacharacters, which is addressed by SUG-06 (escaping). No ASVS categories apply beyond V5 input validation.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Partial | Regex escape (SUG-06) — applied before setting `pattern` |
| V6 Cryptography | No | — |

## Sources

### Primary (HIGH confidence)

- `docs/adr/0002-pattern-suggestion-detection.md` — Algorithm spec, scope, shape, cap, consequences
- `.planning/phases/33-pattern-suggestion-detector/33-CONTEXT.md` — All locked decisions (D-01 through D-06)
- `.planning/REQUIREMENTS.md` §Detection and §Analysis Contract — SUG-01 through SUG-06, ANL-02, ANL-04
- `lib/utils/import.ts` — `NormalizedTransactionRow`, `normalizeDescription` — types and normalization conventions
- `lib/services/categorization.ts` — `ActivePattern` type, `applyTier1Regex`, `amountSignMatches` — coverage check to replicate
- `tests/import-utils.test.ts` — Vitest describe/it/expect pattern, relative import path convention
- `tests/dashboard-utils.test.ts` — Inline data test pattern for pure utilities
- `lib/utils/dashboard.ts` — Type-and-function colocated file convention, no server-only
- `vitest.config.ts` — Test include pattern, `@` alias, exclude list
- `package.json` — Vitest version ^4.1.5 confirmed

### Secondary (MEDIUM confidence)

- None needed — all claims verified directly from codebase files.

### Tertiary (LOW confidence)

- None — no WebSearch required for this research domain.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from package.json and vitest.config.ts
- Algorithm: HIGH — fully specified in ADR and CONTEXT.md decisions
- Architecture: HIGH — confirmed from existing lib/utils/ and tests/ conventions
- Pitfalls: MEDIUM — Pitfall 3 (covered/CoveragePattern ambiguity) is a genuine open question requiring planner resolution; others are HIGH

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable — algorithm spec is locked in ADR; no external dependencies)

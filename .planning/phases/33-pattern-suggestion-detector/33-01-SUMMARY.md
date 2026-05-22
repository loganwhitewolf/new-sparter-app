---
plan: 33-01
phase: 33-pattern-suggestion-detector
status: complete
completed: 2026-05-22
requirements: [SUG-01, SUG-02, SUG-03, SUG-04, SUG-05, SUG-06, ANL-02, ANL-04]
---

## Summary

Phase 33 plan 01 delivered the pure deterministic pattern detector contract defined in `docs/adr/0002-pattern-suggestion-detection.md`.

## Files Created

| File | Purpose |
|------|---------|
| `lib/utils/pattern-suggestions.ts` | Pure utility — 4 exported symbols, no server-only, no services imports |
| `tests/pattern-suggestion-detector.test.ts` | 8 named Vitest cases mapped 1:1 to SUG-01..06, ANL-02, ANL-04 |

## Public Surface (4 exports)

```typescript
export interface PatternDetectorRow       // input row shape
export interface CoveragePattern          // existing regex pattern to exclude matches
export interface PatternSuggestion        // output suggestion shape
export function detectPatternSuggestions  // main entry point
```

## Algorithm Summary

**Bucket-by-first-token + longest common prefix per bucket:**

1. Filter eligible rows: `valid === true`, `covered === false`, not matched by any `CoveragePattern` (regex test with `'i'` flag + amount-sign check via `Decimal.js`)
2. Tokenize each eligible row's `normalizedDescription` by whitespace; strip purely numeric tokens (`/^\d+$/`)
3. Drop rows with `< 2` stripped tokens
4. Bucket remaining candidates by their first stripped token (efficiency: O(n) vs O(n²) pairwise)
5. For each bucket with `≥ 2` members: compute the longest prefix shared by ALL members (intersect down via pairwise LCP)
6. If the shared prefix has `≥ 2` tokens: emit one `PatternSuggestion` with:
   - `pattern`: joined prefix tokens with regex metacharacters escaped (`/[.*+?^${}()|[\]\\]/g`)
   - `matchCount`: bucket size
   - `detectedAmountSign`: `'positive'`/`'negative'`/`'any'` via Decimal.js sign inference
   - `sampleDescriptions`: first 3 `row.description` values (raw, not normalized)

## Test Results

**8/8 tests GREEN** — `npx vitest run tests/pattern-suggestion-detector.test.ts` exits 0

**Full suite: 551 passed, 0 failed** — no regressions introduced

## Design Ambiguity Resolved

The detector computes coverage internally from `CoveragePattern[]` by running regex tests itself. `PatternDetectorRow.covered` is an **additional caller-side exclusion hint** (used for dedup by the caller, e.g. a row already known to be covered without re-running regex). Both exclusion paths are applied: `covered === true` OR matched by any `CoveragePattern`.

## Open Issues / Deferred

None — phase is self-contained. The 5-suggestion cap (ANL-03) is deferred to Phase 34 scope per the plan.

## Integration Notes for Phase 34

Phase 34 (`import-analysis-suggestions`) should:

```typescript
import {
  detectPatternSuggestions,
  type PatternDetectorRow,
  type CoveragePattern,
} from '@/lib/utils/pattern-suggestions'
```

Call site in `analyzeFile` (or equivalent):
1. Map import rows to `PatternDetectorRow[]` (set `valid`, `covered`, `normalizedDescription` from existing row processing)
2. Load existing `CategorizationPattern[]` from DB, map to `CoveragePattern[]`
3. Call `detectPatternSuggestions(rows, coveragePatterns)`
4. Apply the 5-suggestion cap (ANL-03) at the call site — the detector returns all qualifying suggestions

## Self-Check: PASSED

---
status: complete
phase: 260524-pnk
plan: "01"
subsystem: pattern-detection
tags: [import, pattern-suggestions, tdd, bug-fix]
dependency_graph:
  requires: []
  provides: [partial-match-only guard in detectPatternSuggestions]
  affects: [lib/utils/pattern-suggestions.ts, tests/pattern-suggestion-detector.test.ts, docs/adr/0002-pattern-suggestion-detection.md]
tech_stack:
  added: []
  patterns: [hasExtension guard, Tier 2 categorization boundary]
key_files:
  created: []
  modified:
    - lib/utils/pattern-suggestions.ts
    - tests/pattern-suggestion-detector.test.ts
    - docs/adr/0002-pattern-suggestion-detection.md
decisions:
  - SUG-01 fixture updated to use non-numeric suffix tokens (supermercato/farmacia) since the original rows (pagamento pos 12345/67890) become fully identical after numeric strip — same as the SUG-07c exclusion case
  - SUG-02 fixture updated to add city suffixes (roma/milano) so the pair extends beyond the stripped shared prefix
  - ANL-04 fixture updated to use letter suffixes (alfa/beta) instead of numeric index (0/1) which stripped away
  - No fixture changes needed in import consumer test files (import-service, import-preview-ui, import-analyze-page, import-suggestions-page)
metrics:
  duration: "~10 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  files_modified: 3
---

# Phase 260524-pnk Plan 01: Partial-Match-Only Pattern Suggestions Summary

Restricted `detectPatternSuggestions` to emit suggestions only when at least one row in a bucket has stripped tokens extending beyond the shared prefix — buckets of fully identical normalized descriptions (after numeric stripping) produce no suggestion and are handled by Tier 2 history categorization.

## What was built

### hasExtension guard (`lib/utils/pattern-suggestions.ts`)

Added after the existing `prefix.length < 2` check, before the suggestion is emitted:

```ts
const hasExtension = group.some(g => g.tokens.length > prefix.length)
if (!hasExtension) continue
```

With an explanatory comment referencing ADR 0002 and Tier 2 categorization. The guard is the minimal change: one boolean + one continue, no restructuring of the internal pipeline.

### SUG-07 regression cases (`tests/pattern-suggestion-detector.test.ts`)

Three new `it(...)` blocks pinning the partial-match-only invariant:

| Case | Input | Expected | Notes |
|------|-------|----------|-------|
| SUG-07a | Two rows `'pagamento pos market'` (identical) | `[]` | Stripped tokens equal shared prefix for both |
| SUG-07b | `'netflix abbonamento'` × 2 + `'netflix abbonamento premium'` | 1 suggestion, matchCount 3 | "premium" extends the prefix → qualifies |
| SUG-07c | `'pagamento pos 12345'` + `'pagamento pos 67890'` | `[]` | Numeric tails stripped → both reduce to `['pagamento', 'pos']` → fully identical |

All three cases are GREEN after the guard lands. SUG-07a and SUG-07c were RED against the old implementation.

### Fixture alignment (TDD RED→GREEN, same test file)

Four existing fixtures relied on descriptions that, after numeric stripping, produce fully identical token lists — they would have broken with the new guard:

| Test | Change |
|------|--------|
| SUG-01 | `'pagamento pos 12345/67890'` → `'pagamento pos supermercato/farmacia'` (non-numeric suffixes create a genuine partial match) |
| SUG-02 | `'pagamento 2026/2025 supermercato'` → added city suffix `'roma'`/`'milano'` so rows extend beyond the stripped `['pagamento', 'supermercato']` prefix |
| SUG-05 | Row E: `'pagamento pos market'` → `'pagamento pos shop'` (as specified in the plan) |
| ANL-04 | `'pagamento pos ${i}'` (i=0,1 → numeric, stripped) → `'pagamento pos alfa/beta'` (letter suffixes, retained after strip) |

No changes needed in any import consumer test file (`import-service.test.ts`, `import-preview-ui.test.tsx`, `import-analyze-page.test.tsx`, `import-suggestions-page.test.tsx`) — their fixtures already used non-numeric differentiating tokens.

### ADR update (`docs/adr/0002-pattern-suggestion-detection.md`)

Added "Partial matches only." paragraph under the "Scope: uncategorized transactions only" section, explaining the Tier 2 boundary and the `hasExtension` requirement.

## Test results

| File | Tests | Result |
|------|-------|--------|
| tests/pattern-suggestion-detector.test.ts | 11/11 | PASS |
| tests/import-service.test.ts | included in 81 | PASS |
| tests/import-preview-ui.test.tsx | included in 81 | PASS |
| tests/import-suggestions-page.test.tsx | included in 81 | PASS |
| tests/import-analyze-page.test.tsx | included in 81 | PASS |
| **Total (5 files)** | **81/81** | **PASS** |

Full suite: 591 passed + 1 todo; pre-existing 5 failures in `tests/transactions-dal.test.ts` (`.limit()` mock issue from Phase 36 fix — existed before this task, confirmed by stash check).

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 49e2daa | test | add SUG-07 partial-match-only regression tests (RED) |
| e8be942 | feat | emit pattern suggestions only for partial matches (GREEN) |
| 889ae56 | docs | document partial-match-only rule in ADR 0002 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Fixture alignment] SUG-01, SUG-02, ANL-04 fixtures updated alongside SUG-05**

- **Found during:** Task 2 GREEN phase
- **Issue:** The plan specified aligning SUG-05 but three other existing tests (SUG-01, SUG-02, ANL-04) also used fixtures that become fully identical after numeric stripping — they broke when the `hasExtension` guard was added.
- **Fix:** Updated fixtures to use non-numeric differentiating suffix tokens preserving the original test intent (numeric stripping verification, 2-token prefix grouping, amount sign inference).
- **Files modified:** `tests/pattern-suggestion-detector.test.ts`
- **Commit:** e8be942

The plan acknowledged downstream fixture changes may be needed ("If any of them happen to use fully-identical fixtures...") — the same principle applied to the detector test file itself.

## Known Stubs

None.

## Self-Check: PASSED

- `lib/utils/pattern-suggestions.ts` — exists and contains `hasExtension` guard (2 occurrences)
- `tests/pattern-suggestion-detector.test.ts` — exists and contains SUG-07a, SUG-07b, SUG-07c
- `docs/adr/0002-pattern-suggestion-detection.md` — exists and contains "Partial matches only." paragraph
- Commits 49e2daa, e8be942, 889ae56 — all present in git log

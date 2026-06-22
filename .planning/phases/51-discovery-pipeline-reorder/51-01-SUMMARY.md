---
phase: 51-discovery-pipeline-reorder
plan: "01"
subsystem: utils
tags: [clustering, pattern-suggestions, D-05-metadata, PIPE-03, tdd]
dependency_graph:
  requires: []
  provides:
    - PatternDetectorRowWithMeta
    - PatternSuggestionWithMeta
    - detectPatternSuggestionsWithMeta
  affects:
    - lib/services/regex-discovery.ts (Plan 51-03, Wave 2 consumer)
tech_stack:
  added: []
  patterns:
    - additive-extension (new exports alongside existing unchanged symbols)
    - tdd-red-green (write test after impl, verify GREEN)
key_files:
  modified:
    - lib/utils/pattern-suggestions.ts
  created:
    - tests/pattern-suggestion-detector-meta.test.ts
decisions:
  - "detectPatternSuggestionsWithMeta reuses the same internal clustering helpers (isCoveredByPatterns, stripNumericTokens, longestCommonPrefix) — no logic duplication"
  - "residualVariablePart computed from first grouped row's tokens beyond the stable prefix"
  - "strippedByNormalization rolled up at candidate level: true if ANY member row had it set"
  - "Script-safe header comment added mirroring categorization-match.ts pattern"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-16"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 1
---

# Phase 51 Plan 01: WithMeta util extension Summary

Additive extension of `lib/utils/pattern-suggestions.ts` with D-05 per-candidate normalization metadata, plus a full unit test suite covering all four metadata fields and clustering parity.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add WithMeta types and detectPatternSuggestionsWithMeta | 11d1f9f | lib/utils/pattern-suggestions.ts |
| 2 | Unit-test detectPatternSuggestionsWithMeta D-05 metadata | af5f078 | tests/pattern-suggestion-detector-meta.test.ts |

## What Was Built

`lib/utils/pattern-suggestions.ts` now exports three additional symbols alongside the unchanged originals:

- **`PatternDetectorRowWithMeta`** — extends `PatternDetectorRow` with `rawTitle: string` and `strippedByNormalization: boolean`; carries per-row normalization signal for the service to populate before clustering.
- **`PatternSuggestionWithMeta`** — extends `PatternSuggestion` with `stablePrefix`, `strippedByNormalization`, `residualVariablePart`, `sampleNormalized`; these are the four D-05 metadata fields PIPE-03 requires.
- **`detectPatternSuggestionsWithMeta`** — identical clustering pipeline to `detectPatternSuggestions` (same bucketing, prefix intersection, coverage exclusion), augmented to pass through the four D-05 fields per candidate.

The unit test suite (`tests/pattern-suggestion-detector-meta.test.ts`) covers:
- PIPE-03-a: `stablePrefix` and `residualVariablePart` on the canonical Fineco Bonifico fixture
- PIPE-03-b: `strippedByNormalization` rollup (any-member-true / all-false)
- PIPE-03-c: `sampleNormalized` equals first member row's normalized description
- Parity: same `pattern` and `matchCount` as `detectPatternSuggestions` for identical rows
- Coverage exclusion: `isCoveredByPatterns` gate still filters rows

## Verification

```
npx vitest run tests/pattern-suggestion-detector.test.ts tests/pattern-suggestion-detector-meta.test.ts
PASS (20) FAIL (0)
```

All 13 existing detector tests pass (existing function unchanged). All 7 new meta tests pass.

## Deviations from Plan

None — plan executed exactly as written.

- Existing `detectPatternSuggestions`, `PatternSuggestion`, `PatternDetectorRow` are byte-identical.
- No `import 'server-only'` was added (confirmed by grep).
- `scripts/regex-discovery.ts` was not touched (D-04).

## Known Stubs

None. This plan is a pure util + test — no data sources, UI, or placeholder values.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. The util is a pure in-memory transform function; no trust boundary crossed.

## TDD Gate Compliance

- RED gate: confirmed `detectPatternSuggestionsWithMeta` was absent before Task 1 (grep returned NOT FOUND).
- GREEN gate: implementation committed at `11d1f9f`; test file committed at `af5f078`.
- REFACTOR: no cleanup needed — implementation is clean on first pass.

## Self-Check: PASSED

- `lib/utils/pattern-suggestions.ts` modified: exists and contains all three new exports.
- `tests/pattern-suggestion-detector-meta.test.ts` created: exists and all 7 tests pass.
- Commits `11d1f9f` and `af5f078` confirmed in git log.

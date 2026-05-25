---
phase: 34-import-analysis-suggestions
plan: "01"
subsystem: import-service
tags: [import, analyze, pattern-suggestions, test-scaffold, wave0, tdd]
dependency_graph:
  requires: []
  provides: [failing-test-scaffold-34-01]
  affects: [tests/import-service.test.ts]
tech_stack:
  added: []
  patterns: [vi.hoisted mock, vi.mock module isolation, TDD RED wave]
key_files:
  created: []
  modified:
    - tests/import-service.test.ts
decisions:
  - "Wave 0 test scaffold only — no implementation changes; RED state is the goal"
  - "Test case for ANL-03 uses exact matchCount values from the plan (10,7,5,3,3) — matchCount=3 appears twice in the sorted slice because d=3 and b=2 with f=1 sliced off"
  - "makeReadableStream + makeFormatCandidate reused in new describe block to match existing analyzeFile test patterns"
metrics:
  duration: "3m"
  completed_at: "2026-05-23T06:25:44Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 34 Plan 01: Wave 0 Test Scaffold — analyzeFile patternSuggestions Summary

Wave 0 TDD scaffold: failing test cases for `patternSuggestions` integration into `analyzeFile`, locking the behavioral contract (ANL-01, ANL-03, ANL-05, SCOP-01, SCOP-02, D-03, D-05, D-07) before Plan 02 implements the feature.

## Files Modified

| File | Change |
|------|--------|
| `tests/import-service.test.ts` | +116 lines: hoisted mock, vi.mock call, 6 failing test cases |

## Mock Additions

1. **`vi.hoisted` block** — added `detectPatternSuggestions: vi.fn()` alongside existing service mocks
2. **`vi.mock('@/lib/utils/pattern-suggestions', ...)`** — new module mock registering `mocks.detectPatternSuggestions`, placed after the categorization mock block

## Test Cases Added

All 6 cases are in `describe('analyzeFile — pattern suggestions', ...)`:

| # | Test Name | Requirements Pinned |
|---|-----------|---------------------|
| 1 | `includes patternSuggestions field in result even when empty` | ANL-01 |
| 2 | `includes patternSuggestions as [] when analysis produces errors` | ANL-01 + D-07 |
| 3 | `returns at most 5 suggestions sorted by matchCount descending` | ANL-03 |
| 4 | `returns patternSuggestions [] and logs a warning when detection throws` | ANL-05 + T-34-01 (security: URL/stack redaction) |
| 5 | `does not require subscriptionPlan — calls loadActivePatterns for all plans` | D-03 |
| 6 | `skips loadActivePatterns when no format is detected` | D-05 / SCOP-01 / SCOP-02 |

## Test Run Results

```
Tests  6 failed | 47 passed (53)
```

- **6 new cases: FAIL (RED)** — `analyzeFile` does not yet return `patternSuggestions`; all fail with assertion errors (not module-load errors)
- **47 pre-existing cases: PASS** — no regression introduced

## Source Files Untouched

- `lib/services/import.ts` — confirmed unchanged via `git diff --name-only HEAD lib/services/import.ts` (empty output)
- `lib/utils/pattern-suggestions.ts` — not modified
- `lib/services/categorization.ts` — not modified

## Deviations from Plan

None — plan executed exactly as written.

## Hand-off to Plan 02

Plan 02 will turn all 6 RED cases GREEN by:
1. Extending `ImportAnalysisResult` with `patternSuggestions: PatternSuggestion[]`
2. Adding import of `detectPatternSuggestions` + `PatternDetectorRow` + `PatternSuggestion` from `@/lib/utils/pattern-suggestions`
3. Inserting the suggestion detection block inside `analyzeFile` after `applyExistingHashesToStats`, guarded by `if (best)`
4. Routing errors through `safeImportErrorMessage` before `logger.warn` (ANL-05 / T-34-01)
5. Adding `patternSuggestions` to the return statement (always present, `[]` on error or no format)

## Known Stubs

None — this plan adds only test scaffolding. No UI, no data flow, no stubs.

## Threat Surface Scan

No new production surface introduced. All changes are confined to `tests/import-service.test.ts` (test-only, never reaches production runtime). T-34-02 disposition: accepted.

## Self-Check: PASSED

- `tests/import-service.test.ts` exists and contains all 6 new test cases
- Commit `85c2c84` verified: `git log --oneline -1` → `85c2c84 test(34-01): add failing test scaffold for analyzeFile patternSuggestions`
- `lib/services/import.ts` untouched (git diff empty)
- 47 pre-existing tests pass, 6 new tests fail (RED) — Wave 0 contract satisfied

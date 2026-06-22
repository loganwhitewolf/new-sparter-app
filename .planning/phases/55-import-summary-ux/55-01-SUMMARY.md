---
phase: 55-import-summary-ux
plan: 01
subsystem: import-pipeline
tags: [cleanup, legacy-removal, pattern-suggestions, typescript]
status: complete

dependency_graph:
  requires: [54-01, 54-02, 54-03]
  provides: [clean-analyzeFile-without-detectPatternSuggestions, ImportAnalysisResult-without-patternSuggestions]
  affects: [lib/services/import.ts, lib/utils/pattern-suggestions.ts, lib/actions/import.ts, components/import/import-preview.tsx]

tech_stack:
  added: []
  patterns: [dead-code-removal, test-suite-cleanup]

key_files:
  modified:
    - lib/services/import.ts
    - lib/utils/pattern-suggestions.ts
    - lib/actions/import.ts
    - components/import/import-preview.tsx
    - tests/import-service.test.ts
    - tests/pattern-suggestion-detector-meta.test.ts
    - tests/import-analyze-page.test.tsx
    - tests/import-actions.test.ts
    - tests/import-preview-ui.test.tsx
  deleted:
    - tests/pattern-suggestion-detector.test.ts

decisions:
  - "D-06: detectPatternSuggestions call and TODO block removed from analyzeFile in import.ts"
  - "D-07: patternSuggestions field removed from ImportAnalysisResult type and returned object"
  - "D-09: detectPatternSuggestions export removed from lib/utils/pattern-suggestions.ts; detectPatternSuggestionsWithMeta preserved intact"
  - "skipPatternSuggestions parameter removed from analyzeFile signature (no longer needed)"
  - "SuggestionSection removed from import-preview.tsx analyze step (pre-import UI was legacy)"
  - "import-preview-ui.test.tsx REV-01/REV-04 tests removed (tested removed UI section)"

metrics:
  duration: "~7min"
  completed: "2026-06-21"
  tasks: 2
  files_modified: 9
  files_deleted: 1
---

# Phase 55 Plan 01: Remove Legacy detectPatternSuggestions — Summary

**One-liner:** Removed `detectPatternSuggestions` from import analyze pipeline — legacy pre-import detection replaced by post-import `discoverRegexCandidates` (Phase 54); TypeScript clean, 1094 tests green.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Remove detectPatternSuggestions from import.ts and pattern-suggestions.ts (D-06, D-07, D-09) | 3743148 | lib/services/import.ts, lib/utils/pattern-suggestions.ts, lib/actions/import.ts, components/import/import-preview.tsx |
| 2 | Update tests referencing detectPatternSuggestions or patternSuggestions | 4935d0a | 5 test files modified, 1 deleted |

## Acceptance Criteria Verification

- `grep -n "detectPatternSuggestions\b" lib/services/import.ts` → 0 results: PASS
- `grep -n "patternSuggestions" lib/services/import.ts` → 0 results: PASS
- `grep -n "export function detectPatternSuggestions\b" lib/utils/pattern-suggestions.ts` → 0 results: PASS
- `grep -n "export function detectPatternSuggestionsWithMeta" lib/utils/pattern-suggestions.ts` → 1 result (line 128): PASS
- `grep -n "detectPatternSuggestionsWithMeta" lib/services/regex-discovery.ts` → line 10 (import): PASS
- `npx tsc --noEmit` → 0 errors related to this plan (6 pre-existing errors in unrelated test files): PASS
- `tests/pattern-suggestion-detector.test.ts` does not exist: PASS
- `yarn test` → 89 test files, 1094 tests passing: PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed lib/actions/import.ts skipPatternSuggestions**
- **Found during:** Task 1 — TypeScript check after removing analyzeFile parameter
- **Issue:** `lib/actions/import.ts` passed `skipPatternSuggestions: true` to `analyzeFile`, which was removed from the function signature
- **Fix:** Removed `skipPatternSuggestions: true` from the `analyzeFile` call in `completeOnboardingPrivateImportAction`
- **Files modified:** lib/actions/import.ts
- **Commit:** 3743148

**2. [Rule 3 - Blocking] Fixed components/import/import-preview.tsx patternSuggestions**
- **Found during:** Task 1 — TypeScript check revealed `result.patternSuggestions` access on updated type
- **Issue:** `import-preview.tsx` rendered `<SuggestionSection suggestions={result.patternSuggestions} ...>` — the legacy pre-import pattern suggestions UI, now removed from `ImportAnalysisResult`
- **Fix:** Removed the `SuggestionSection` import and render from `import-preview.tsx`; the analyze-step UI no longer shows pattern suggestions (discovery is now a separate post-import step)
- **Files modified:** components/import/import-preview.tsx
- **Commit:** 3743148

**3. [Rule 1 - Bug] Fixed tests/import-actions.test.ts skipPatternSuggestions assertion**
- **Found during:** Task 2 — test run revealed 1 failing test asserting `analyzeFile` was called with `skipPatternSuggestions: true`
- **Issue:** Test expected `skipPatternSuggestions: true` in analyzeFile call but parameter was removed
- **Fix:** Removed `skipPatternSuggestions: true` from the `expect(mocks.analyzeFile).toHaveBeenCalledWith(...)` assertion
- **Files modified:** tests/import-actions.test.ts
- **Commit:** 4935d0a

**4. [Rule 2 - Missing cleanup] Removed import-preview-ui.test.tsx REV-01/REV-04 tests**
- **Found during:** Task 2 — tests tested the `SuggestionSection` UI removed in Task 1
- **Issue:** Three tests (REV-01 ×2, REV-04) referenced `patternSuggestions` and `sampleSuggestion` variables, and tested a UI section no longer rendered
- **Fix:** Removed REV-01/REV-04 tests and `sampleSuggestion` variable; removed `patternSuggestions: []` from `baseResult` fixture
- **Files modified:** tests/import-preview-ui.test.tsx
- **Commit:** 4935d0a

## Known Stubs

None — this plan removes code, introduces no new stubs.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan only removes code.

## Self-Check: PASSED

- lib/services/import.ts: FOUND
- lib/utils/pattern-suggestions.ts: FOUND
- tests/pattern-suggestion-detector.test.ts: DELETED (confirmed)
- Commit 3743148: FOUND
- Commit 4935d0a: FOUND
- yarn test: 89 files, 1094 tests passing

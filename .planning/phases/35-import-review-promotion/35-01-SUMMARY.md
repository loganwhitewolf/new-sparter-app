---
phase: 35
plan: 01
subsystem: import-review-promotion
tags: [tdd, testing, red-phase, pattern-suggestions, wave-0]
dependency_graph:
  requires: []
  provides:
    - "RED test suite for promoteSuggestionAction (REV-03)"
    - "RED test suite for SuggestionCard (REV-02)"
    - "RED test suite for SuggestionPromoteForm (REV-03, REV-05)"
    - "RED tests for ImportPreview categories prop + SuggestionSection (REV-01, REV-04)"
    - "RED test for AnalyzePage getCategories wiring (REV-01)"
  affects:
    - "tests/pattern-actions.test.ts"
    - "tests/import-preview-ui.test.tsx"
    - "tests/import-analyze-page.test.tsx"
    - "tests/suggestion-card.test.tsx"
    - "tests/suggestion-promote-form.test.tsx"
tech_stack:
  added: []
  patterns:
    - "vi.hoisted + dynamic import for Server Action mocks (existing pattern)"
    - "renderToStaticMarkup for SSR component contract testing"
    - "beforeEach mock reset for test isolation"
key_files:
  created:
    - tests/suggestion-card.test.tsx
    - tests/suggestion-promote-form.test.tsx
  modified:
    - tests/pattern-actions.test.ts
    - tests/import-preview-ui.test.tsx
    - tests/import-analyze-page.test.tsx
decisions:
  - "Used double quotes for Italian string containing apostrophe (confirmDisabledReason) to avoid syntax error"
  - "sampleSuggestion fixture used in 2 tests instead of 4 — third test intentionally uses baseResult to verify absence of section"
metrics:
  duration: "6m 6s"
  completed: "2026-05-23"
  tasks_completed: 5
  files_modified: 5
---

# Phase 35 Plan 01: Wave 0 RED Test Scaffolding Summary

Wave 0 RED test scaffolding for phase 35 import-review-promotion: 3 test files extended + 2 new test files created, all in RED state with correct failure reasons (missing production code), covering REV-01 through REV-05 and security threats T-35-01/02/03.

## Test Files Modified / Created

| File | Action | Lines | New Tests |
|------|--------|-------|-----------|
| tests/pattern-actions.test.ts | Modified | +96 lines | 7 new (promoteSuggestionAction describe) |
| tests/import-preview-ui.test.tsx | Modified | +68 lines | 3 new (REV-01 x2, REV-04) |
| tests/import-analyze-page.test.tsx | Modified | +33 lines | 1 new (REV-01 wiring) |
| tests/suggestion-card.test.tsx | Created | 85 lines | 4 new (REV-02 x2, matchCount, no promoted badge) |
| tests/suggestion-promote-form.test.tsx | Created | 111 lines | 5 new (REV-03 x2, submit button, REV-05, no confidence) |

**Total new test cases: 20**

## RED State Verification

Command used:
```bash
node_modules/.bin/vitest run tests/pattern-actions.test.ts tests/import-preview-ui.test.tsx tests/import-analyze-page.test.tsx tests/suggestion-card.test.tsx tests/suggestion-promote-form.test.tsx
```

Result: `10 failed | 27 passed (37)` — all pre-existing tests pass, all new tests fail for correct reasons.

### Failure breakdown

| File | Tests Failing | Reason |
|------|--------------|--------|
| tests/pattern-actions.test.ts | 7 | `promoteSuggestionAction is not a function` (export missing from lib/actions/patterns.ts) |
| tests/import-preview-ui.test.tsx | 2 | `expected to contain 'Suggerimenti pattern (1)'` (ImportPreview not yet wired to SuggestionSection) |
| tests/import-analyze-page.test.tsx | 1 | `expected getCategories to be called 1 times, but got 0 times` (page does not yet call getCategories) |
| tests/suggestion-card.test.tsx | 4 | `Cannot find module '../components/import/suggestion-card'` |
| tests/suggestion-promote-form.test.tsx | 5 | `Cannot find module '../components/import/suggestion-promote-form'` |

## Requirement Coverage Map

| Requirement | Covered by | Turns GREEN in |
|-------------|-----------|----------------|
| REV-01 (SuggestionSection conditional render) | Tasks 2, 3 | Plan 04 |
| REV-02 (sample toggle default-hidden) | Task 4 | Plan 03 |
| REV-03 (hidden inputs, IDOR prevention, confidence hardcoded) | Tasks 1, 5 | Plan 02 (action), Plan 03 (form) |
| REV-04 (confirm unblocked by suggestions) | Task 2 | Plan 04 |
| REV-05 (error feedback via useActionState) | Task 5 | Plan 03 |
| T-35-01 (IDOR: userId from session not FormData) | Task 1 | Plan 02 |
| T-35-02 (input validation: subCategoryId, regex, confidence) | Task 1 | Plan 02 |
| T-35-03 (auth bypass: verifySession rejects propagates) | Task 1 | Plan 02 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Smart quote syntax error in import-preview-ui.test.tsx**
- **Found during:** Task 2
- **Issue:** The original file used curly/typographic apostrophes (U+2018/U+2019) as string delimiters in one location. When my Edit tool replicated these characters in the new fixture code, the TypeScript parser rejected them. Additionally, line 70's Italian string `l'importazione` used a straight apostrophe after a Python replacement script inadvertently converted the curly apostrophe to ASCII, breaking the string boundary.
- **Fix:** Replaced the single-quoted string on line 70 with double quotes (`"Configura un formato privato prima di confermare l'importazione."`) so the internal apostrophe is safe; rewrote new fixtures with consistent ASCII single quotes throughout.
- **Files modified:** tests/import-preview-ui.test.tsx
- **Commit:** 66f5e55

## Known Stubs

None — this plan only creates test files, no production code.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Test files only.

## Self-Check: PASSED

### Files verified
- tests/pattern-actions.test.ts: FOUND
- tests/import-preview-ui.test.tsx: FOUND
- tests/import-analyze-page.test.tsx: FOUND
- tests/suggestion-card.test.tsx: FOUND
- tests/suggestion-promote-form.test.tsx: FOUND

### Commits verified
- 01ab7fd (Task 1): FOUND
- 66f5e55 (Task 2): FOUND
- e0a7b9e (Task 3): FOUND
- a150728 (Task 4): FOUND
- 2f9068f (Task 5): FOUND

---
phase: 35
plan: 03
subsystem: import-review-promotion
tags: [tdd, green-phase, pattern-suggestions, wave-1, ui-components]
dependency_graph:
  requires:
    - "35-01 RED test scaffolding (suggestion-card.test.tsx, suggestion-promote-form.test.tsx)"
  provides:
    - "SuggestionPromoteForm — inline form component (REV-03 client, REV-05 client)"
    - "SuggestionCard — card with sample toggle and promoted state (REV-02)"
    - "SuggestionSection — conditional wrapper, null when empty (REV-01 partial)"
  affects:
    - "tests/suggestion-card.test.tsx (now GREEN)"
    - "tests/suggestion-promote-form.test.tsx (now GREEN)"
tech_stack:
  added: []
  patterns:
    - "useActionState + submittedRef guard (promoted callback, no toast/dialog)"
    - "useState(false) for promoted + showSamples independent booleans"
    - "Template literal toggle text: Mostra N esempi / Nascondi esempi"
    - "opacity-50 pointer-events-none wrapper for visually disabled form post-promotion"
    - "aria-expanded + aria-controls for sample toggle accessibility"
    - "Early return null for empty list (SuggestionSection)"
key_files:
  created:
    - components/import/suggestion-promote-form.tsx
    - components/import/suggestion-card.tsx
    - components/import/suggestion-section.tsx
  modified: []
decisions:
  - "No confidence hidden input in SuggestionPromoteForm — server hardcodes 0.85 (anti-tampering, T-35-02)"
  - "subCategoryId passed as hidden input value bound to state, not pre-filled"
  - "SuggestionCard uses opacity-50 pointer-events-none wrapper, not disabled prop, so form is visually disabled but card stays visible (D-02)"
  - "SuggestionSection key uses pattern+index concatenation to avoid key collisions"
  - "Tests executed from worktree root (yarn install required; worktree lacks symlinked node_modules)"
metrics:
  duration: "3m 54s"
  completed: "2026-05-23"
  tasks_completed: 3
  files_modified: 3
---

# Phase 35 Plan 03: UI Components for Suggestion Review Summary

Three new client components implementing the suggestion review UI: SuggestionPromoteForm (inline promotion form with useActionState + submittedRef pattern), SuggestionCard (sample toggle, promoted badge, embedded form), SuggestionSection (conditional list wrapper). Turns 9 RED tests GREEN.

## Files Created

| File | LOC | Exports |
|------|-----|---------|
| components/import/suggestion-promote-form.tsx | 118 | SuggestionPromoteForm |
| components/import/suggestion-card.tsx | 78 | SuggestionCard |
| components/import/suggestion-section.tsx | 31 | SuggestionSection |

## Component Tree

```
SuggestionSection (REV-01 conditional wrapper)
  └── SuggestionCard × N  (REV-02 sample toggle, promoted state)
        └── SuggestionPromoteForm  (REV-03 form, REV-05 error + success)
```

## State Ownership Map

| State | Owner | Default | Trigger |
|-------|-------|---------|---------|
| `promoted` | SuggestionCard | `false` | `onPromoted()` callback from SuggestionPromoteForm |
| `showSamples` | SuggestionCard | `false` | toggle button click |
| `categoryId` | SuggestionPromoteForm | `''` | Select onChange |
| `subCategoryId` | SuggestionPromoteForm | `''` | Select onChange; reset when category changes |
| `state` (ActionState) | SuggestionPromoteForm via `useActionState` | `{ error: null }` | form submission |
| `submittedRef` | SuggestionPromoteForm | `false` | set to `true` on form submit; guards `onPromoted()` call |

## Test Results

### Tests that turned GREEN (Plan 03 objective)

| Test File | Tests | Status |
|-----------|-------|--------|
| tests/suggestion-promote-form.test.tsx | 5/5 | GREEN |
| tests/suggestion-card.test.tsx | 4/4 | GREEN |
| **Total** | **9/9** | **GREEN** |

### Tests remaining RED (expected — require Plan 04)

| Test | File | Reason |
|------|------|--------|
| REV-01: renders Suggerimenti pattern section | tests/import-preview-ui.test.tsx | ImportPreview not yet wired to SuggestionSection |
| REV-04: confirm button visible alongside suggestions | tests/import-preview-ui.test.tsx | Same — ImportPreview wiring pending Plan 04 |
| REV-01 wiring: getCategories called in parallel | tests/import-analyze-page.test.tsx | analyze/page.tsx not yet modified |

### Tests remaining RED (expected — require Plan 02)

| Test | File | Reason |
|------|------|--------|
| promoteSuggestionAction × 7 | tests/pattern-actions.test.ts | Server action not yet exported from lib/actions/patterns.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tests required yarn install in worktree**
- **Found during:** Task 1 verification
- **Issue:** The `yarn test` command from the main project root does not resolve module paths from the worktree's `components/` directory. The test file uses `import('../components/import/suggestion-promote-form')` which resolves relative to the test runner's CWD, which was the main repo root during the plan's `<verify>` command. Tests had to be run from the worktree root (`node_modules/.bin/vitest run`) after running `yarn install` in the worktree.
- **Fix:** Ran `yarn install` in the worktree root to populate `node_modules`; ran vitest via `node_modules/.bin/vitest run` from the worktree directory for all verification steps.
- **Files modified:** None — worktree setup only.
- **Commit:** N/A (tooling setup, not a code change)

## Known Stubs

None — all components accept props and render based on them. `categories: []` is valid: the form renders with the subcategory select disabled, so the submit button is disabled (correct UX guard).

## Threat Flags

None — no new network endpoints or auth paths introduced. Components render from props passed server-side; hidden inputs (pattern, amountSign, subCategoryId) are validated by the Server Action (Plan 02).

## Self-Check: PASSED

### Files verified

- components/import/suggestion-promote-form.tsx: FOUND
- components/import/suggestion-card.tsx: FOUND
- components/import/suggestion-section.tsx: FOUND

### Commits verified

- ef926fb (Task 1 - SuggestionPromoteForm): in git log
- 93c1660 (Task 2 - SuggestionCard): in git log
- 22d7b08 (Task 3 - SuggestionSection): in git log

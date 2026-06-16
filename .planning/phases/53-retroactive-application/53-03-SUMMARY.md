---
phase: "53"
plan: "03"
subsystem: retroactive-application
tags: [suggestion-ui, inline-feedback, applyResult, fileId, platformId, APPLY-01, ROADMAP-SC-2]
dependency_graph:
  requires:
    - getPlatformIdForUserFile (lib/dal/files.ts) — Plan 01
    - PatternApplyResult (lib/validations/pattern.ts) — Plan 02
    - ActionState.applyResult (lib/validations/pattern.ts) — Plan 02
    - promoteSuggestionAction returning applyResult (lib/actions/patterns.ts) — Plan 02
  provides:
    - fileId/platformId threading: page → SuggestionSection → SuggestionCard → SuggestionPromoteForm
    - inline Italian apply count copy on SuggestionCard after promote
    - hidden fileId input in SuggestionPromoteForm (T-53-08 mitigation)
    - notFound when platformId cannot be resolved (page guard)
  affects:
    - app/(app)/import/[fileId]/suggestions/page.tsx
    - components/import/suggestion-section.tsx
    - components/import/suggestion-card.tsx
    - components/import/suggestion-promote-form.tsx
    - tests/suggestion-card.test.tsx
    - tests/suggestion-promote-form.test.tsx
    - tests/import-suggestions-page.test.tsx
tech_stack:
  added: []
  patterns:
    - RSC platformId resolution before rendering client components
    - test-only initialApplyResult prop for SSR snapshot testing of internal state
    - submittedRef + applyResult guard prevents useEffect false positive on mount (Pitfall 3)
    - Italian product copy (categorizzate / ancora senza match) on client component only
key_files:
  created: []
  modified:
    - app/(app)/import/[fileId]/suggestions/page.tsx
    - components/import/suggestion-section.tsx
    - components/import/suggestion-card.tsx
    - components/import/suggestion-promote-form.tsx
    - tests/suggestion-card.test.tsx
    - tests/suggestion-promote-form.test.tsx
    - tests/import-suggestions-page.test.tsx
decisions:
  - "platformId resolved server-side on RSC page (not from client FormData) — preserves T-53-07 accept disposition and APPLY-02 locked scope"
  - "initialApplyResult test-only prop added to SuggestionCard to enable SSR snapshot assertions without @testing-library/react (not installed in project)"
  - "platformId passed through SuggestionSection → SuggestionCard as named prop (available for Phase 54 surfaces); prefixed _platformId inside card to signal intentional non-use in this phase"
  - "useEffect guard requires state.applyResult before calling onPromoted (Pitfall 3 — avoids false positive when state.error is null at initial mount)"
metrics:
  duration: "10 minutes"
  completed_date: "2026-06-16"
  tasks: 3
  files: 7
---

# Phase 53 Plan 03: Suggestion UI Inline Apply Feedback Summary

Inline apply count feedback wired end-to-end: `fileId` and `platformId` now thread from the RSC suggestions page through `SuggestionSection` → `SuggestionCard` → `SuggestionPromoteForm`, and after promote the card renders persistent Italian count copy (`N categorizzate · M ancora senza match`) without removing the card or showing a toast (ROADMAP SC-2, APPLY-01 user-visible outcome).

## What Was Built

### `app/(app)/import/[fileId]/suggestions/page.tsx` — platformId resolution

After the existing `getFileForUser` guard, the page now calls `getPlatformIdForUserFile({ userId, fileId })`. When the result is `null` (file has no platform, ownership guard failed, or platform chain broken), the page calls `notFound()` — preventing the suggestions surface from rendering without a valid platform context (APPLY-02 locked scope).

`fileId` and `platformId` are passed to `SuggestionSection` as explicit props.

### `components/import/suggestion-section.tsx` — prop threading

Props extended with `fileId: string` and `platformId: number`. Both are forwarded to each `SuggestionCard` in the map. Section logic unchanged.

### `components/import/suggestion-card.tsx` — inline count display

- Added `fileId: string`, `platformId: number`, and `initialApplyResult?: PatternApplyResult | null` props.
- Internal state extended from `[promoted]` to `[promoted, applyResult]`.
- `handlePromoted` changed from `() => void` to `(result: PatternApplyResult) => void` — sets both `promoted` and `applyResult`.
- When `applyResult` is non-null, renders `<p className="text-sm text-muted-foreground">{updatedCount} categorizzate · {notUpdatedCount} ancora senza match</p>` above sample examples.
- Card remains visible with `opacity-50 pointer-events-none` on the form wrapper (rejected alternative: card removal).
- `initialApplyResult` prop pre-seeds state for SSR snapshot tests (test-only escape hatch — `@testing-library/react` not installed in project).

### `components/import/suggestion-promote-form.tsx` — fileId hidden input + applyResult callback

- Added `fileId: string` prop.
- Renders `<input type="hidden" name="fileId" value={fileId} />` between `subCategoryId` and the picker (T-53-08 mitigation).
- `onPromoted` signature changed to `(applyResult: PatternApplyResult) => void`.
- `useEffect` guard updated to require `submittedRef.current && state.error === null && state.applyResult` before calling `onPromoted(state.applyResult)` (Pitfall 3 — avoids false positive on initial mount where `state.error === null` is also the initial condition).

### Test extensions

**`tests/suggestion-promote-form.test.tsx`** — `fileId` prop added to all `createElement` calls; new `APPLY-01` test asserts hidden `fileId` input with expected value `file-abc`.

**`tests/suggestion-card.test.tsx`** — refactored to use `defaultProps` object with `fileId` and `platformId`; 4 new tests:
- Count copy absent in default (un-promoted) state.
- Italian count copy visible when `initialApplyResult` is set with non-zero values.
- Zero `updatedCount` renders correctly.
- `Pattern creato` badge present alongside counts when promoted.

**`tests/import-suggestions-page.test.tsx`** — `getPlatformIdForUserFile` added to `mocks` and to the `@/lib/dal/files` mock; default value `2`; `mockReset` in `beforeEach`; 3 new tests:
- `notFound` called when `getPlatformIdForUserFile` returns `null`.
- Called with `{ userId, fileId }` after file guard passes.
- Not called when file guard already throws `notFound` (status not `imported`).

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 — wiring | feat | 4406115 | Wire fileId/platformId threading through page → section → card → form |
| 2 — tests + counts | feat | ce3190b | Inline apply counts on card + UI/page test extensions |
| 3 — verification | — | (no files changed) | Phase 53 regression slice + language gate passed |

## Test Coverage

Phase 53 regression slice (Task 3 verification):
- `tests/pattern-application.test.ts` — service apply logic (Plan 01)
- `tests/pattern-actions.test.ts` — server action (Plan 02)
- `tests/suggestion-card.test.tsx` — card UI (Plan 03, 8 tests)
- `tests/suggestion-promote-form.test.tsx` — form hidden inputs (Plan 03, 6 tests)
- `tests/import-suggestions-page.test.tsx` — page guard + data flow (Plan 03, 11 tests)

Slice result: **67 tests passed / 5 test files**.
Full suite result: **1109 tests passed / 89 test files** (1 todo, 0 failures).

## Deviations from Plan

### Auto-resolved during implementation

**1. [Rule 2 - Missing critical functionality] `initialApplyResult` prop for test isolation**

- **Found during:** Task 2
- **Issue:** `@testing-library/react` is not installed in the project (confirmed: `node_modules/@testing-library/` missing). The plan listed it as a fallback for testing post-promote state; SSR snapshot testing with `renderToStaticMarkup` cannot observe internal state changes from callbacks.
- **Fix:** Added optional `initialApplyResult?: PatternApplyResult | null` test-only prop to `SuggestionCard`. When set, the component pre-seeds `promoted=true` and `applyResult=initialApplyResult` in initial state, allowing SSR snapshots to assert count copy visibility. The prop is clearly marked `@internal test-only` in JSDoc. This is the approach suggested by the plan itself ("export a minimal test-only prop `initialApplyResult` only if needed").
- **Files modified:** `components/import/suggestion-card.tsx`
- **Commit:** ce3190b

## Known Stubs

None — `SuggestionCard` renders real `applyResult` data from `promoteSuggestionAction` return value. `fileId` and `platformId` are real server-resolved values. No placeholder copy.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Mitigations from plan `<threat_model>`:

- **T-53-07** (platformId disclosure): accepted — platformId is non-secret taxonomy metadata; `platformId` in section/card props is SSR-rendered, not stored client-side.
- **T-53-08** (client omits fileId): mitigated — `<input type="hidden" name="fileId" value={fileId} />` is always rendered by `SuggestionPromoteForm` when the component mounts (fileId is a required prop). Server action (Plan 02) rejects missing fileId.

## Self-Check: PASSED

Files verified:
- `app/(app)/import/[fileId]/suggestions/page.tsx` — FOUND, contains `getPlatformIdForUserFile` and `platformId=`
- `components/import/suggestion-section.tsx` — FOUND, contains `fileId: string` and `platformId: number` in Props
- `components/import/suggestion-card.tsx` — FOUND, contains `categorizzate` and `initialApplyResult`
- `components/import/suggestion-promote-form.tsx` — FOUND, contains `name="fileId"` and `state.applyResult`
- `tests/suggestion-card.test.tsx` — FOUND, contains `categorizzate` assertion
- `tests/suggestion-promote-form.test.tsx` — FOUND, contains `name="fileId".*value="file-abc"` assertion
- `tests/import-suggestions-page.test.tsx` — FOUND, contains `getPlatformIdForUserFile` mock

Commits verified:
- `4406115` — FOUND in git log
- `ce3190b` — FOUND in git log

---
phase: "53"
plan: "02"
subsystem: retroactive-application
tags: [server-action, tdd, applyResult, platform-scope, APPLY-01, APPLY-02]
dependency_graph:
  requires:
    - getUncategorizedExpensesForPlatformApply (lib/dal/regex-discovery.ts) — Plan 01
    - getPlatformIdForUserFile (lib/dal/files.ts) — Plan 01
    - applyNewPatternToPlatformExpenses (lib/services/pattern-application.ts) — Plan 01
    - PatternApplyResult (lib/services/pattern-application.ts) — Plan 01
  provides:
    - ActionState.applyResult (lib/validations/pattern.ts)
    - PatternApplyResult re-export (lib/validations/pattern.ts)
    - promoteSuggestionAction wired to platform apply (lib/actions/patterns.ts)
  affects:
    - lib/validations/pattern.ts (extended ActionState)
    - lib/actions/patterns.ts (updated promote action)
    - tests/pattern-actions.test.ts (extended test suite)
    - .planning/REQUIREMENTS.md (APPLY-02 description locked)
tech_stack:
  added: []
  patterns:
    - Server-side platformId resolution from fileId (ownership guard T-53-04/05)
    - Non-fatal apply after pattern save (zero counts on throw)
    - ActionState extended for structured success payload (useActionState pattern)
    - TDD RED/GREEN commit gates
key_files:
  created: []
  modified:
    - lib/validations/pattern.ts
    - lib/actions/patterns.ts
    - tests/pattern-actions.test.ts
    - .planning/REQUIREMENTS.md
decisions:
  - "PatternApplyResult defined in lib/validations/pattern.ts as re-export point for client consumers (useActionState, SuggestionCard) — avoids importing from service layer in client components"
  - "fileId validated before getPlatformIdForUserFile call — null fileId returns Italian error before any DAL hit (T-53-04)"
  - "apply failure is non-fatal: applyResult returns { 0, 0 } so pattern save is still acknowledged; log preserved at error level (existing style)"
  - "createPatternAction untouched — still calls legacy applyNewPatternToExpenses for user-wide path"
  - "APPLY-02 description in REQUIREMENTS.md updated from open-decision phrasing to locked platform-history scope"
metrics:
  duration: "8 minutes"
  completed_date: "2026-06-16"
  tasks: 2
  files: 4
---

# Phase 53 Plan 02: promoteSuggestionAction Platform Apply Integration Summary

Server-action integration gap closed: `promoteSuggestionAction` now resolves `platformId` server-side from `fileId`, calls `applyNewPatternToPlatformExpenses`, and returns `{ error: null, applyResult: { updatedCount, notUpdatedCount } }` for inline card feedback (Plan 03 renders).

## What Was Built

### `lib/validations/pattern.ts` — extended ActionState

Added `PatternApplyResult` type (`{ updatedCount: number, notUpdatedCount: number }`) as the canonical re-export point for client consumers. Extended `ActionState` with optional `applyResult?: PatternApplyResult | null` — keeps backward compatibility (initial state `{ error: null }` is still valid).

### `lib/actions/patterns.ts` — updated `promoteSuggestionAction`

Integration sequence (Phase 53-02 additions):

1. Parse `fileId` from FormData; return `{ error: 'File di import non valido.' }` if missing/empty (T-53-04).
2. Resolve `platformId` via `getPlatformIdForUserFile({ userId, fileId })`; return `{ error: 'Impossibile determinare la piattaforma per questo file.' }` if null — never falls back to user-wide apply (APPLY-02 locked decision, T-53-05).
3. After `createPattern` success, call `applyNewPatternToPlatformExpenses(db, { userId, platformId, patternId, patternString, subCategoryId, confidence })`.
4. On success: capture result, `return { error: null, applyResult }`.
5. On apply throw: log with existing message style, `return { error: null, applyResult: { updatedCount: 0, notUpdatedCount: 0 } }`.

`createPatternAction` is unchanged — still calls legacy `applyNewPatternToExpenses` for user-wide path.

### `tests/pattern-actions.test.ts` — extended promoteSuggestionAction suite

Hoisted mocks added:
- `applyNewPatternToExpenses` (explicit, prevents accidental DB hits in `createPatternAction` tests)
- `applyNewPatternToPlatformExpenses` (default: `{ updatedCount: 3, notUpdatedCount: 12 }`)
- `getPlatformIdForUserFile` (default: `1`)

`validPromoteForm` now includes `fileId: 'file-abc'` by default.

Existing success assertions updated from `{ error: null }` to `{ error: null, applyResult: { updatedCount: 3, notUpdatedCount: 12 } }`.

New test cases (5):
- `resolves platformId server-side from fileId and calls applyNewPatternToPlatformExpenses`
- `does NOT call legacy applyNewPatternToExpenses on the promote path`
- `returns Italian error and does not create pattern when fileId is missing from FormData`
- `returns Italian error and does not create pattern when platformId cannot be resolved`
- `returns applyResult with zero counts when apply throws after pattern is saved (non-fatal)`

### `.planning/REQUIREMENTS.md` — APPLY-02 locked

Description updated from `*(Open decision — resolve in discuss/plan.)*` to the locked platform-history scope with ownership guard reference.

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 — RED | test | 893afc6 | Failing promoteSuggestion tests for applyResult and platform resolution |
| 2 — GREEN | feat | b3d25a6 | Wire promoteSuggestionAction to platform apply with applyResult |

## TDD Gate Compliance

- RED commit: `test(53-02): 893afc6` — 8 new/updated tests, all failing (applyResult missing, mocks not wired)
- GREEN commit: `feat(53-02): b3d25a6` — all 34 tests pass (12 promoteSuggestion + 22 others)

Gate sequence: RED → GREEN confirmed.

## Test Coverage

`tests/pattern-actions.test.ts` (12 promoteSuggestion tests total):
- Existing: userId tamper rejection, confidence hardcoded to 0.85, free user access (D-03), missing subCategoryId, malformed regex, DAL failure, auth failure
- New: platform resolution from fileId, legacy apply NOT called, missing fileId error, null platformId error, non-fatal apply throw with zero counts

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `promoteSuggestionAction` returns real `applyResult` from `applyNewPatternToPlatformExpenses`. Plan 03 renders the counts in the UI.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Threat mitigations from plan `<threat_model>`:

- **T-53-04** (cross-user fileId): mitigated — `getPlatformIdForUserFile` WHERE includes `eq(file.userId, userId)`; null → error, no pattern write
- **T-53-05** (forged client platformId): mitigated — `platformId` derived from `fileId` server-side; FormData `platformId` is never read as authority
- **T-53-06** (malformed regex blast radius): mitigated — `CreatePatternSchema` / `normalizePatternInput` blocks invalid regex before DAL; platform scope bounds blast radius

## Self-Check: PASSED

Files verified:
- `lib/validations/pattern.ts` — FOUND, contains `applyResult` and `PatternApplyResult`
- `lib/actions/patterns.ts` — FOUND, contains `applyNewPatternToPlatformExpenses`
- `tests/pattern-actions.test.ts` — FOUND, 34 tests all passing
- `.planning/REQUIREMENTS.md` — FOUND, APPLY-02 updated

Commits verified: `893afc6` (RED), `b3d25a6` (GREEN) — both confirmed.

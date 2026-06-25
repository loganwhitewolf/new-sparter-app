---
phase: 54-reusable-trigger
plan: 03
subsystem: import
tags: [regex-discovery, categorization, import, trig-02, per-row-action]

requires:
  - phase: 54-reusable-trigger/01
    provides: Suggestions page sourced from discoverRegexCandidates (platform-scoped, D-04)
  - phase: 53-retroactive-application
    provides: getPlatformIdForUserFile ownership guard, platform-scoped apply flow

provides:
  - recheckRegexAction thin server action over discoverRegexCandidates (TRIG-02)
  - Per-row 'Ricontrolla regex' menu item in ImportRowActions (D-01)
  - Client wiring in import-table: action call + toast + conditional navigation (D-03/D-06)
  - IDOR guard: platformId resolved exclusively via getPlatformIdForUserFile, userId from verifySession

affects: [55-import-summary-ux]

tech-stack:
  added: []
  patterns:
    - "Thin action over service: recheckRegexAction reads fileId, resolves userId via verifySession, resolves platformId via ownership guard, delegates to discoverRegexCandidates — no business logic in action"
    - "Conditional navigation: router.push on >0 total (D-03); neutral toast on zero total without navigation (D-06); toast.error on action error"
    - "recheckRegexAction called as plain async fn (not useActionState) so navigation runs after await"

key-files:
  modified:
    - lib/actions/import.ts
    - components/import/import-row-actions.tsx
    - components/import/import-table.tsx
    - tests/import-table-actions.test.tsx
  created:
    - tests/recheck-regex-action.test.ts

key-decisions:
  - "Plan 54-03: recheckRegexAction is a thin, ownership-guarded server action over discoverRegexCandidates — no second detector path (TRIG-02 SC-3 satisfied)"
  - "Plan 54-03: userId always from verifySession (T-54-09); platformId always from getPlatformIdForUserFile (T-54-08 IDOR guard)"
  - "Plan 54-03: recheckRegexAction called as plain async fn from client (not useActionState) so router.push can follow await"
  - "Plan 54-03: zero candidates → toast('Nessun pattern trovato per questa piattaforma'), no navigation (D-06); total > 0 → router.push to /import/[fileId]/suggestions (D-03)"

requirements-completed: [TRIG-02]

duration: 8min
completed: 2026-06-20
status: complete
---

# Phase 54 Plan 03: On-demand Re-check Entry Point (TRIG-02) Summary

**recheckRegexAction thin server action + per-row 'Ricontrolla regex' menu item in ImportRowActions, navigating to /import/[fileId]/suggestions on results (D-03) or toasting without navigating on zero candidates (D-06) — same unified discoverRegexCandidates service, no divergent path (TRIG-02)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-20T13:34:00Z
- **Completed:** 2026-06-20T13:47:01Z
- **Tasks:** 3 (Task 1 TDD RED+GREEN, Task 2 + Task 3)
- **Files modified/created:** 5

## Accomplishments

- Added `recheckRegexAction(formData: FormData)` to `lib/actions/import.ts`:
  - Reads `fileId` from FormData, validates non-empty
  - Resolves `userId` via `verifySession()` (server-side only, T-54-09)
  - Resolves `platformId` via `getPlatformIdForUserFile({ userId, fileId })` — null short-circuits before service call (IDOR guard, T-54-08)
  - Calls `discoverRegexCandidates({ userId, scope: { platformId } })` in try/catch
  - Returns `ImportActionState<{ candidatesCount; singleCount; platformId }>` — read-only, no `revalidatePath`
- Extended `ImportRowActions` Props with `onRecheckRegex` + `isRecheckPending?`; new clickable `DropdownMenuItem` (not a Link) for imported rows with pending/disabled state
- Wired client-side in `import-table.tsx`: `handleRecheckRegex` calls the action, branches on zero vs >0 total, toasts or navigates
- Fixed `tests/import-table-actions.test.tsx`: added required `onRecheckRegex` prop to render helper (Rule 1 deviation — broken test from added required prop)
- 6/6 TDD tests for `recheckRegexAction`, 88/88 total across affected test files

## Task Commits

1. **Task 1 RED+GREEN: recheckRegexAction + TDD tests** - `f4d9e8a` (feat)
2. **Task 2: per-row menu item + onRecheckRegex prop** - `4b939c1` (feat)
3. **Task 3: client wiring — action + toast + navigation** - `f00e74b` (feat)

## Files Created/Modified

- `lib/actions/import.ts` — `recheckRegexAction` added; `getPlatformIdForUserFile` + `discoverRegexCandidates` imports added
- `components/import/import-row-actions.tsx` — `onRecheckRegex` + `isRecheckPending?` props; 'Ricontrolla regex' DropdownMenuItem for imported rows
- `components/import/import-table.tsx` — `useRouter` + `recheckRegexAction` imports; `recheckPending` state; `handleRecheckRegex` async fn; props wired to `ImportRowActions`
- `tests/recheck-regex-action.test.ts` — 6 TDD tests (auth, IDOR, missing fileId, service throw, userId provenance)
- `tests/import-table-actions.test.tsx` — `onRecheckRegex` prop added to render helper (required by updated Props type)

## Decisions Made

- **recheckRegexAction as plain async fn:** The client calls it directly (not via `useActionState`) so `router.push` can run in the same async flow after `await`.
- **Single recheckPending boolean:** Acceptable since the menu item disables during the call; no per-row tracking needed at this stage.
- **'Ricontrolla regex' label:** Signals the user they are triggering a fresh scan; 'Ricerca in corso...' pending label makes the scope visible during wait.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] import-table-actions.test.tsx: onRecheckRegex required prop missing**
- **Found during:** Task 2 (tsc check after adding required prop to Props)
- **Issue:** `tests/import-table-actions.test.tsx` renders `ImportRowActions` without the newly-required `onRecheckRegex` prop, causing a TypeScript error.
- **Fix:** Added `const onRecheckRegex = vi.fn()` and passed it to `createElement(ImportRowActions, {...})` in the render helper.
- **Files modified:** `tests/import-table-actions.test.tsx`
- **Commit:** `4b939c1`

## Threat Surface Scan

No new network endpoints or auth paths introduced. IDOR mitigation T-54-08 implemented: `platformId` resolved exclusively via `getPlatformIdForUserFile({ userId, fileId })` where `userId` originates from `verifySession()` server-side; null short-circuits before calling `discoverRegexCandidates`; service is never called with a client-supplied userId or platformId. T-54-09 satisfied: `formData` is never checked for a userId field.

## Self-Check

- [x] `lib/actions/import.ts` — `recheckRegexAction` exists and returns `ImportActionState<{ candidatesCount: number; singleCount: number; platformId: number }>`
- [x] `lib/actions/import.ts` — calls `verifySession()` then `getPlatformIdForUserFile({ userId, fileId })` then `discoverRegexCandidates({ userId, scope: { platformId } })`
- [x] `components/import/import-row-actions.tsx` — Props includes `onRecheckRegex` and `isRecheckPending`
- [x] `components/import/import-row-actions.tsx` — clickable (non-Link) DropdownMenuItem for imported rows
- [x] `components/import/import-table.tsx` — imports `useRouter` and `recheckRegexAction`; defines `handleRecheckRegex`; passes `onRecheckRegex` + `isRecheckPending` to ImportRowActions
- [x] `components/import/import-table.tsx` — 'Nessun pattern trovato per questa piattaforma' toast present
- [x] `tests/recheck-regex-action.test.ts` — 6 tests pass
- [x] Commit `f4d9e8a` exists (Task 1)
- [x] Commit `4b939c1` exists (Task 2)
- [x] Commit `f00e74b` exists (Task 3)
- [x] `yarn vitest run tests/recheck-regex-action.test.ts` → 6 passed
- [x] `yarn tsc --noEmit` → 0 errors in non-test source files
- [x] `yarn check:language` → passed

## Self-Check: PASSED

---
*Phase: 54-reusable-trigger*
*Completed: 2026-06-20*

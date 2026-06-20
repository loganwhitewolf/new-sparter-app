---
phase: 54-reusable-trigger
plan: 02
subsystem: import
tags: [regex-discovery, categorization, import, post-commit, trig-01]

requires:
  - phase: 54-reusable-trigger/01
    provides: Suggestions page sourced from discoverRegexCandidates (platform-scoped, D-04)
  - phase: 53-retroactive-application
    provides: getPlatformIdForUserFile ownership guard

provides:
  - ImportFileResult.discoveryCount: number (0 when nothing found or discovery fails)
  - Post-commit discoverRegexCandidates call in importFile (non-fatal, outside db.transaction)
  - Import-result CTA + count linking to /import/[fileId]/suggestions when discoveryCount > 0
  - No auto-redirect to suggestions page (D-05)

affects: [54-03, 55-import-summary-ux]

tech-stack:
  added: []
  patterns:
    - "Post-commit non-fatal discovery: discoverRegexCandidates after db.transaction resolves, wrapped in try/catch, discoveryCount 0 on failure"
    - "Null platformId guard: getPlatformIdForUserFile returns null → skip discovery, discoveryCount 0"
    - "CTA with count: render discovery panel only when discoveryCount > 0; preserve returnTo redirect for onboarding"

key-files:
  modified:
    - lib/services/import.ts
    - components/import/import-preview.tsx
    - tests/import-service.test.ts

key-decisions:
  - "Plan 54-02: post-commit discovery synchronous (D-02) — no background jobs, try/catch non-fatal, logs post_import_discovery_failed on error"
  - "Plan 54-02: null platformId post-commit → discovery skipped, discoveryCount 0, import still succeeds (T-54-04 mitigation)"
  - "Plan 54-02: no auto-redirect to suggestions page (D-05) — CTA only; onboarding returnTo path preserved unchanged"
  - "Plan 54-02: pre-existing SuggestionSection fileId TS error fixed as Rule 1 deviation"

requirements-completed: [TRIG-01]

duration: 5min
completed: 2026-06-20
status: complete
---

# Phase 54 Plan 02: Post-commit Discovery Wire-up Summary

**discoverRegexCandidates wired as automatic post-import step (TRIG-01): non-fatal post-commit call in importFile, discoveryCount on ImportFileResult, import-result CTA linking to suggestions when count > 0 — no auto-redirect (D-05)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-20T13:28:28Z
- **Completed:** 2026-06-20T13:33:12Z
- **Tasks:** 2 (Task 1 TDD RED+GREEN, Task 2 implement)
- **Files modified:** 3

## Accomplishments

- Added `discoveryCount: number` to `ImportFileResult` type
- Imported `discoverRegexCandidates` from `lib/services/regex-discovery` and extended `getPlatformIdForUserFile` import in `lib/dal/files`
- In `importFile`, after `db.transaction` resolves: resolve platformId via ownership-guarded DAL, call `discoverRegexCandidates({ userId, scope: { platformId } })`, compute `discoveryCount = candidates.length + singleCategorizationSuggestions.length`; null platformId skips discovery; any exception logs `post_import_discovery_failed` warning and leaves `discoveryCount` at 0
- In `import-preview.tsx`: read `res.data?.discoveryCount` from `confirmImportAction`; on default path (no `returnTo`), if `discoveryCount > 0` show Italian CTA panel ("X pattern proposti — Rivedi suggerimenti") linking to `/import/[fileId]/suggestions` with no auto-redirect; if `discoveryCount === 0` redirect to expenses as before; onboarding `returnTo` path unchanged
- 4 TDD tests covering all behaviors pass (58/58 total)

## Task Commits

1. **Task 1 RED: failing tests** - `a40f61e` (test)
2. **Task 1 GREEN: post-commit discovery in importFile** - `f6089b6` (feat)
3. **Task 2: import-result CTA** - `7ca6628` (feat)

## Files Created/Modified

- `lib/services/import.ts` — `ImportFileResult.discoveryCount` field; `getPlatformIdForUserFile` + `discoverRegexCandidates` imports; post-commit TRIG-01 block in `importFile`; `analyzeFile` legacy `detectPatternSuggestions` block untouched
- `components/import/import-preview.tsx` — `discoveryCount` + `importedFileId` state; `handleConfirm` branching (returnTo vs count); discovery CTA panel; pre-existing `fileId` prop fix on `SuggestionSection`
- `tests/import-service.test.ts` — 4 new TDD tests in `importFile — post-commit discovery (TRIG-01)` suite; mocks for `getPlatformIdForUserFile` and `discoverRegexCandidates` added

## Decisions Made

- **Synchronous post-commit (D-02):** Discovery runs synchronously after `db.transaction` commits. Non-fatal: wrapped in try/catch, logs warning, never re-throws. Import already committed — user sees result regardless.
- **Null platformId → skip discovery:** `getPlatformIdForUserFile` returns null when file has no format/platform chain. Discovery is skipped and `discoveryCount` is 0. Mitigates IDOR risk (T-54-04).
- **No auto-redirect (D-05):** When `discoveryCount > 0`, the user sees an inline CTA panel with count and a link to `/import/[fileId]/suggestions`. The user navigates voluntarily. A secondary "Vai alle spese" button is provided.
- **Onboarding path unchanged:** If `returnTo` is set (e.g. `/onboarding?step=2`), the existing redirect runs immediately, before any discovery count check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing TypeScript error: SuggestionSection missing fileId prop**
- **Found during:** Task 2 (while modifying `import-preview.tsx`)
- **Issue:** `<SuggestionSection>` in `import-preview.tsx` was missing the required `fileId` prop (TS error already noted in 54-01 SUMMARY as out-of-scope). Since this file was modified in this plan, the error was in scope to fix.
- **Fix:** Added `fileId={result.fileId}` to the `SuggestionSection` call on line 214.
- **Files modified:** `components/import/import-preview.tsx`
- **Commit:** `7ca6628`

## Threat Surface Scan

No new network endpoints or auth paths introduced. IDOR mitigation T-54-04 implemented: `platformId` resolved exclusively via `getPlatformIdForUserFile({ userId: input.userId, fileId: input.fileId })` (ownership-guarded, `userId` originates from `verifySession()` in `confirmImportAction`); null → discovery skipped; service called with server-resolved platformId only, never client-supplied.

## Self-Check

- [x] `lib/services/import.ts` — `discoveryCount: number` on `ImportFileResult` — FOUND
- [x] `lib/services/import.ts` — `discoverRegexCandidates` called after `db.transaction` — FOUND
- [x] `lib/services/import.ts` — `post_import_discovery_failed` warning — FOUND
- [x] `lib/services/import.ts` — `analyzeFile` `detectPatternSuggestions` block untouched — FOUND
- [x] `components/import/import-preview.tsx` — reads `discoveryCount` — FOUND
- [x] `components/import/import-preview.tsx` — CTA links to `/suggestions` — FOUND
- [x] `tests/import-service.test.ts` — 4 new TRIG-01 tests pass — 58/58 PASS
- [x] Commit `a40f61e` exists (RED)
- [x] Commit `f6089b6` exists (GREEN)
- [x] Commit `7ca6628` exists (Task 2)
- [x] `yarn vitest run tests/import-service.test.ts` → 58 passed
- [x] `yarn check:language` → passed
- [x] `yarn tsc --noEmit` → no new errors in modified files

## Self-Check: PASSED

---
*Phase: 54-reusable-trigger*
*Completed: 2026-06-20*

---
phase: 54-reusable-trigger
plan: 01
subsystem: import
tags: [regex-discovery, categorization, suggestions, pattern-suggestions]

requires:
  - phase: 53-retroactive-application
    provides: getPlatformIdForUserFile ownership guard, platform-scoped apply flow
  - phase: 52-regex-validity-and-dedup
    provides: discoverRegexCandidates unified service with two-list output (candidates + singleCategorizationSuggestions)

provides:
  - Suggestions page sourced from discoverRegexCandidates (platform-scoped, D-04)
  - SuggestionSection renders both regex candidates and single-categorization suggestions
  - Legacy detectPatternSuggestions removed from UI/component layer (deferred deletion to Phase 55)
  - EUR-deposit bug fixed: 8 identical descriptions route to singleCategorizationSuggestions, not regex candidates

affects: [54-02, 54-03, 55-import-summary-ux]

tech-stack:
  added: []
  patterns:
    - "Platform-scoped discovery: discoverRegexCandidates({ userId, scope: { platformId } }) after getPlatformIdForUserFile ownership guard"
    - "Two-list rendering: regex candidates via SuggestionCard (promotable), single suggestions as plain read-only list (no promote form)"
    - "Early-return guard on both lists: return null only when candidates.length === 0 AND singleSuggestions?.length === 0"

key-files:
  modified:
    - app/(app)/import/[fileId]/suggestions/page.tsx
    - components/import/suggestion-section.tsx
    - tests/import-suggestions-page.test.tsx

key-decisions:
  - "Plan 54-01: suggestions page migrated to discoverRegexCandidates (D-04) — platform-scoped, consistent with apply path; notFound() guards preserved"
  - "Plan 54-01: detectPatternSuggestions removal deferred to Phase 55 — analyzeFile still consumes it; no UI/flow may call it from this plan onward"
  - "Plan 54-01: singleCategorizationSuggestions rendered as minimal read-only list (no SuggestionCard, no promote form) — polished separation is Phase 55"

requirements-completed: [TRIG-02]

duration: 3min
completed: 2026-06-20
status: complete
---

# Phase 54 Plan 01: Suggestions Page Migration Summary

**Suggestions page migrated from legacy detectPatternSuggestions to discoverRegexCandidates (platform-scoped); SuggestionSection now renders both regex candidates and single-categorization suggestions, fixing the EUR-deposit identical-cluster bug (RDISC-02)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-20T13:22:34Z
- **Completed:** 2026-06-20T13:25:43Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Replaced the legacy `detectPatternSuggestions()` / `getUncategorizedTransactionsByFileId()` / `loadActivePatterns()` data fetch with a single `discoverRegexCandidates({ userId, scope: { platformId } })` call
- Extended `SuggestionSection` with optional `singleSuggestions?: SingleCategorizationSuggestion[]` prop; single suggestions render as a plain read-only Italian list with count (no SuggestionCard, no promote form)
- Rewrote page tests: mocks updated to the unified service, EUR-deposit anchor test encodes the RDISC-02 fix (8 identical rows → 0 regex candidates, 1 single suggestion), Phase 55 deferral documented

## Task Commits

1. **Task 1+2: Migrate suggestions page + extend SuggestionSection** - `bd875de` (feat)
2. **Task 3: Update suggestions-page tests** - `6279d04` (test)

## Files Created/Modified

- `app/(app)/import/[fileId]/suggestions/page.tsx` — now calls `discoverRegexCandidates`; both `notFound()` guards preserved; empty-state checks both lists; passes `singleSuggestions` to SuggestionSection
- `components/import/suggestion-section.tsx` — new `singleSuggestions?: SingleCategorizationSuggestion[]` prop; early-return guard covers both lists; single list rendered as `<ul>` with Italian copy
- `tests/import-suggestions-page.test.tsx` — mocks replaced (legacy detector removed, unified service added); 11 tests pass; EUR-deposit anchor + service call assertion

## Decisions Made

- **detectPatternSuggestions retirement deferred to Phase 55:** `analyzeFile` in `lib/services/import.ts` still consumes it for the analyze-screen preview; the function and `tests/pattern-suggestion-detector.test.ts` are not deleted in this plan. No new UI/flow may call it.
- **Single suggestions: minimal read-only list:** D-04 specifies minimal presentation for Phase 54; polished visual separation (regex vs single) is Phase 55 (SUMUI-02). Single suggestions have no `pattern` field and therefore cannot use SuggestionCard / promote form.
- **Tasks 1+2 committed together:** The page and component are type-coupled (page passes `singleSuggestions`, component receives it); committing separately would introduce a transient TypeScript error mid-commit.

## Deviations from Plan

None — plan executed exactly as written.

**Note on pre-existing TypeScript error:** `components/import/import-preview.tsx` already called `SuggestionSection` without `fileId` (which was already a required prop in the committed version), causing a pre-existing `tsc` error. This file was not modified by this plan and the error is outside scope (Deviation Rule: scope boundary).

## Issues Encountered

None.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The page's IDOR mitigation (T-54-01) is preserved: `platformId` is resolved exclusively via `getPlatformIdForUserFile({ userId, fileId })` (ownership guard, userId from `verifySession`); `notFound()` on null; service is called with the server-resolved value, never a client-supplied one.

## Next Phase Readiness

- Foundation for Phase 54 entry points is complete: the unified suggestions page is ready to receive both TRIG-01 (post-import auto-run) and TRIG-02 (on-demand re-check from Files table) navigations
- Plan 54-02 can now add `recheckRegexAction` + Files-table row action (TRIG-02)
- Plan 54-03 can wire post-import discovery in `importFile` (TRIG-01)

## Self-Check

- [x] `app/(app)/import/[fileId]/suggestions/page.tsx` exists
- [x] `components/import/suggestion-section.tsx` exists
- [x] `tests/import-suggestions-page.test.tsx` exists
- [x] Commit `bd875de` exists (Task 1+2)
- [x] Commit `6279d04` exists (Task 3)
- [x] `yarn vitest run tests/import-suggestions-page.test.tsx` → 11 passed
- [x] `yarn check:language` → passed
- [x] `grep -rn "detectPatternSuggestions\b" app/ components/` → 0 matches

## Self-Check: PASSED

---
*Phase: 54-reusable-trigger*
*Completed: 2026-06-20*

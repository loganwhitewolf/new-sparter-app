---
phase: 36-post-import-reanalysis
plan: "02"
subsystem: ui
tags:
  - import
  - pattern-suggestions
  - server-component
  - ui

dependency_graph:
  requires:
    - lib/dal/transactions#getUncategorizedTransactionsByFileId (36-01)
    - lib/dal/files#getFileForUser
    - lib/dal/categories#getCategories
    - lib/services/categorization#loadActivePatterns
    - lib/utils/pattern-suggestions#detectPatternSuggestions
    - components/import/suggestion-section#SuggestionSection
    - lib/actions/patterns#promoteSuggestionAction (Phase 35)
  provides:
    - app/(app)/import/[fileId]/suggestions/page.tsx (server component page)
    - components/import/import-row-actions.tsx (Rivedi suggerimenti dropdown entry)
  affects:
    - Import history table: new dropdown item for status=imported rows

tech_stack:
  added: []
  patterns:
    - Server component parallel fetch via Promise.all (mirrors analyze page)
    - notFound() ownership + status guard at page entry (defense in depth over DAL join)
    - Adapter pattern: DAL rows → PatternDetectorRow (description=normalizedDescription, valid:true, covered:false)
    - Sort + cap-5: raw detector output sorted by matchCount desc then sliced to 5
    - Inline empty state (no card/illustration) per D-07

key_files:
  created:
    - app/(app)/import/[fileId]/suggestions/page.tsx
    - tests/import-suggestions-page.test.tsx
  modified:
    - components/import/import-row-actions.tsx
    - tests/import-table-actions.test.tsx

decisions:
  - No try/catch around detectPatternSuggestions — pure function; page is dedicated to this op; 500 is acceptable on unexpected throw (differs from analyzeFile catch in Phase 34)
  - getFileForUser null and wrong-status both produce identical notFound() — prevents enumeration (T-36-06)
  - Sparkles icon from lucide-react chosen for the dropdown item as per plan discretion
  - notFound mock reset added to beforeEach to fix double-call assertion failure (test infrastructure fix)
  - describe() uses single quotes to satisfy plan grep assertion (cosmetic)

metrics:
  duration: "~5 minutes"
  completed: "2026-05-23T18:08:37Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase 36 Plan 02: Post-Import Suggestions Page Summary

Post-import re-analysis user surface: dropdown entry in import history and a server-component page at `/import/[fileId]/suggestions` that runs `detectPatternSuggestions` on persisted uncategorized transactions using exact same algorithm and UI components as the pre-import analyze flow.

## What Was Built

### Route added: `/import/[fileId]/suggestions`

Server component at `app/(app)/import/[fileId]/suggestions/page.tsx`. Key behaviors:

- Calls `verifySession()` to get `userId`.
- Fetches `getFileForUser({ userId, fileId })` — returns `notFound()` if null or `status !== 'imported'`.
- Parallel-fetches `getUncategorizedTransactionsByFileId(db, fileId, userId)`, `loadActivePatterns(db, userId)`, and `getCategories()`.
- Adapts DAL rows to `PatternDetectorRow[]`: `{ description, normalizedDescription: description, amount, valid: true, covered: false }`.
- Runs `detectPatternSuggestions(detectorRows, activePatterns)`, sorts by `matchCount` desc, caps at 5.
- Renders `SuggestionSection` when suggestions exist, or an inline empty-state paragraph (D-07) when `patternSuggestions.length === 0`.

### Dropdown entry: `Rivedi suggerimenti`

Added to `components/import/import-row-actions.tsx` immediately after the existing `Vedi transazioni` item. Gated by `row.status === 'imported'`. Uses `Sparkles` icon from lucide-react. Link: `/import/${encodeURIComponent(row.id)}/suggestions`.

### Reused components (zero new wiring)

`SuggestionSection` → `SuggestionCard` → `SuggestionPromoteForm` → `promoteSuggestionAction` — all from Phase 35, untouched.

## Requirements Satisfied

| Requirement | Test that pins it |
|-------------|------------------|
| POST-01: trigger from import history | `shows "Rivedi suggerimenti" dropdown item only for status=imported` |
| POST-02: same algorithm and shape as pre-import | `POST-01/POST-02 data flow` + `D-04 sort+cap` |
| POST-03: ownership enforced | `POST-03 ownership: calls notFound when getFileForUser returns null` + `POST-03 ownership: calls notFound when file has status other than imported` |
| POST-04: excludes categorized transactions | Satisfied by Plan 36-01 (isNull(expenseId) in DAL); page passes no additional filter |
| POST-05: promotion works | SuggestionSection → promoteSuggestionAction reuse (no new wiring needed) |
| SCOP-03: forward-looking copy, no reclassification | `D-08 copy / SCOP-03` test + grep gate in acceptance criteria |

## TDD Gate Compliance

- RED commit `d5abcb1`: `test(36-02): pin "Rivedi suggerimenti" dropdown item for status=imported` — 1 test failing
- GREEN commit `77a9de0`: `feat(36-02): add "Rivedi suggerimenti" dropdown item for imported files (POST-01)` — 24 tests pass
- RED commit `ea976eb`: `test(36-02): scaffold suggestions page tests (POST-01..05, SCOP-03, D-02/D-04/D-07/D-08)` — 8 tests failing
- GREEN commit `772f6f9`: `feat(36-02): post-import suggestions page (POST-01..05, SCOP-03)` — 35 tests pass

## Deviations from Plan

### Auto-fix: notFound mock reset in beforeEach

**Rule:** Rule 1 (Bug)
**Found during:** Task 2 GREEN (test run after implementing the page)
**Issue:** `mocks.notFound` was not reset in `beforeEach`. The first test that called `notFound()` accumulated the call, causing the second `notFound` test to fail with "called 2 times instead of 1".
**Fix:** Added `mocks.notFound.mockReset()` and `mocks.notFound.mockImplementation(() => { throw new Error('notFound') })` to `beforeEach`.
**Files modified:** `tests/import-suggestions-page.test.tsx`
**Commit:** `772f6f9` (included in the same GREEN commit)

### Auto-fix: describe() quote style

**Rule:** Rule 1 (correctness — grep assertion)
**Found during:** Task 2 acceptance criteria check
**Issue:** Plan acceptance criterion greps for `describe('suggestions page'` (single quotes), but initial test used double quotes. Grep returned 0.
**Fix:** Changed double quotes to single quotes in the describe call.
**Files modified:** `tests/import-suggestions-page.test.tsx`
**Commit:** `772f6f9`

## Known Stubs

None — the page fully implements its goal. `SuggestionSection` receives real `patternSuggestions[]` and `categories[]`. No hardcoded empty arrays or placeholders flow to UI rendering.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's threat model already covers (T-36-06 through T-36-13). Existing mitigations hold:

- T-36-06: `getFileForUser` null/wrong-owner both produce identical `notFound()` — no enumeration.
- T-36-07: `status !== 'imported'` guard tested and pinned.
- T-36-11: React default escaping in SuggestionCard (pre-existing mitigation, unchanged).

## Milestone Close-Out Note

With Plan 36-02 shipped, REQUIREMENTS.md traceability table can flip POST-01, POST-02, POST-03, POST-04, POST-05, and SCOP-03 from "Pending" to "Complete".

## Self-Check: PASSED

- `app/(app)/import/[fileId]/suggestions/page.tsx` exists: FOUND
- `components/import/import-row-actions.tsx` contains Sparkles + Rivedi suggerimenti: FOUND
- `tests/import-suggestions-page.test.tsx` exists with 8 it() cases: FOUND
- `tests/import-table-actions.test.tsx` contains Rivedi suggerimenti assertions: FOUND
- Commit `d5abcb1` (RED Task 1): FOUND
- Commit `77a9de0` (GREEN Task 1): FOUND
- Commit `ea976eb` (RED Task 2): FOUND
- Commit `772f6f9` (GREEN Task 2): FOUND
- 35 tests pass across import-table-actions + import-analyze-page + import-suggestions-page: VERIFIED

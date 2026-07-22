---
phase: 64-file-detail-and-navigation
plan: 01
subsystem: database
tags: [drizzle, routes, dal, next.js]

# Dependency graph
requires:
  - phase: 63-detail-pages-tx-expense
    provides: transactionDetailHref/expenseDetailHref standalone-function convention; getTransactionsByExpenseId/getExpenseImportContext query shapes reused as direct analogs
provides:
  - importFileDetailHref route builder for `/import/[fileId]` hrefs
  - getTransactionsByFileId ownership-scoped DAL query (file transactions preview card)
  - getFileDetailForUser ownership-scoped DAL query (file row + platform name, one round-trip)
affects: [64-02, 64-03, 64-04, 64-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "importFileDetailHref follows the transactionDetailHref/expenseDetailHref standalone-function convention (not an APP_ROUTES key)"
    - "getTransactionsByFileId mirrors getTransactionsByExpenseId's cache()-wrapped, capped, ownership-scoped select shape"
    - "getFileDetailForUser folds the file->importFormatVersion->platform join chain (same as getPlatformIdForUserFile) into a single full-row query"

key-files:
  created:
    - tests/file-detail-dal.test.ts
  modified:
    - lib/routes.ts
    - lib/dal/transactions.ts
    - lib/dal/files.ts
    - tests/detail-page-shell.test.tsx
    - tests/transaction-detail-dal.test.ts

key-decisions:
  - "importFileDetailHref is a standalone function, not added to APP_ROUTES, per the Phase 63 precedent"
  - "getTransactionsByFileId defaults limit to 10 (D-01 'first ~10-20 transactions'); no join needed since ownership is enforced directly on transaction.userId"
  - "getFileDetailForUser supersedes getFileForUser for the file detail page; returns platformName: null (not an error) when importFormatVersionId is absent"

patterns-established:
  - "New DAL detail queries that need caller-supplied userId (not self-calling verifySession) take {userId, ...} as a single object param, matching getTransactionForDetail's Phase 63 convention"

requirements-completed: [DET-08, DET-09]

coverage:
  - id: D1
    description: "importFileDetailHref route builder mirrors transactionDetailHref/expenseDetailHref exactly (plain id, encodeURIComponent on special characters)"
    requirement: DET-08
    verification:
      - kind: unit
        ref: "tests/detail-page-shell.test.tsx#route builders > importFileDetailHref builds an encoded import file detail path"
        status: pass
      - kind: unit
        ref: "tests/detail-page-shell.test.tsx#route builders > importFileDetailHref encodes special characters in the id"
        status: pass
    human_judgment: false
  - id: D2
    description: "getTransactionsByFileId returns an ownership-scoped, capped (default 10), date-descending list of a file's transactions for the file detail page's preview card"
    requirement: DET-08
    verification:
      - kind: unit
        ref: "tests/transaction-detail-dal.test.ts#getTransactionsByFileId (5 tests: ordering, cross-user empty result, WHERE scoping, default limit, explicit limit)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getFileDetailForUser returns the full file row plus platformName in one round-trip, ownership-scoped, null-safe for pending uploads and non-owned/missing files"
    requirement: DET-09
    verification:
      - kind: unit
        ref: "tests/file-detail-dal.test.ts (5 tests: full row + platformName, null platformName when no importFormatVersionId, missing fileId, non-owned fileId, WHERE scoping)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-06
status: complete
---

# Phase 64 Plan 01: File Detail Foundations Summary

**Canonical `importFileDetailHref` route builder plus two ownership-scoped DAL queries (`getTransactionsByFileId`, `getFileDetailForUser`) that later Phase 64 plans build the file detail page and cross-references on.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-06T12:47:00+02:00 (approx.)
- **Completed:** 2026-07-06T12:50:18+02:00
- **Tasks:** 3 completed
- **Files modified:** 6 (5 modified, 1 created)

## Accomplishments
- Added `importFileDetailHref(fileId)` to `lib/routes.ts`, matching the `transactionDetailHref`/`expenseDetailHref` standalone-function shape exactly (template string, `encodeURIComponent`, no `APP_ROUTES` key).
- Added `getTransactionsByFileId` + `FileTransactionRow` to `lib/dal/transactions.ts`, modeled on `getTransactionsByExpenseId`: ownership-scoped WHERE (`fileId` AND `userId`), ordered by `occurredAt` descending, capped at a default limit of 10.
- Added `getFileDetailForUser` + `FileDetailContextRow` to `lib/dal/files.ts`, folding the `file -> importFormatVersion -> platform` join chain (same as `getPlatformIdForUserFile`) into a single full-row query so the file detail page needs no second round-trip for platform context.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add importFileDetailHref route builder** - `bdc16db` (feat, TDD red/green)
2. **Task 2: Add getTransactionsByFileId DAL query for the file preview card** - `fa566f1` (feat, TDD red/green)
3. **Task 3: Add getFileDetailForUser DAL query (file row + platform name in one round-trip)** - `f3955eb` (feat, TDD red/green)

_Note: each task followed RED (test added, confirmed failing) → GREEN (implementation, confirmed passing) inline before committing; no separate test-only commits were made per task since this plan's `type="auto" tdd="true"` tasks commit test+implementation together._

## Files Created/Modified
- `lib/routes.ts` - added `importFileDetailHref(fileId: string): string`
- `tests/detail-page-shell.test.tsx` - extended `route builders` describe block with 2 new `importFileDetailHref` tests
- `lib/dal/transactions.ts` - added `FileTransactionRow` type and `getTransactionsByFileId` cached query
- `tests/transaction-detail-dal.test.ts` - added `getTransactionsByFileId` describe block (5 tests)
- `lib/dal/files.ts` - added `cache` import, `FileDetailContextRow` type, and `getFileDetailForUser` cached query
- `tests/file-detail-dal.test.ts` - new test file, `getFileDetailForUser` describe block (5 tests)

## Decisions Made
- Followed the plan's explicit instruction not to add `importFileDetailHref` to `APP_ROUTES` (preserves the `as const` static-string shape, per STATE.md's Phase 63 decision).
- `getTransactionsByFileId` needs no join against `file` — ownership is fully determined by `transaction.userId`, same simplification the plan called out relative to `getTransactionsByExpenseId`'s double-guard style.
- `getFileDetailForUser` selects every `FileRow` column explicitly (rather than `select()` + join) to keep the return type exactly `FileRow & { platformName }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `getFileDetailForUser`'s explicit column list omitted `file.updatedAt`, breaking the `FileDetailContextRow` type**
- **Found during:** Task 3 (`yarn tsc --noEmit` verification step)
- **Issue:** The plan's action described selecting "every `FileRow` column" but the explicit select map I wrote initially omitted `updatedAt`, so the returned row's inferred type was missing a required `FileRow` field and failed to satisfy `FileDetailContextRow`.
- **Fix:** Added `updatedAt: file.updatedAt` to the select map, and added the corresponding field to the test file's mock schema and mock row so the test's shape matches the real `FileRow`.
- **Files modified:** `lib/dal/files.ts`, `tests/file-detail-dal.test.ts` (same commit as Task 3, not a separate commit)
- **Verification:** `yarn tsc --noEmit` — no errors on `lib/dal/files.ts`; `yarn vitest run tests/file-detail-dal.test.ts` — 5/5 pass
- **Committed in:** `f3955eb` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — type-correctness bug caught before commit).
**Impact on plan:** No scope creep; fix was required for `getFileDetailForUser` to type-check against its own declared return type.

## Issues Encountered
`yarn tsc --noEmit` surfaces a number of pre-existing type errors in unrelated test files (`tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/category-combobox.test.tsx`, `tests/overview-interactions.test.tsx`, `tests/cascade-options.test.ts`, `tests/file-download-api.test.ts`, `tests/transactions-dal.test.ts`). None of these files were touched by this plan and none are related to `lib/routes.ts`, `lib/dal/transactions.ts`, or `lib/dal/files.ts`. Per the scope-boundary rule, these are out of scope for this plan and are logged below rather than fixed.

## Deferred Items (out of scope for this plan)

| File | Error | Notes |
|------|-------|-------|
| tests/suggestion-card.test.tsx | `PatternSuggestion` missing `sampleAmounts` in test fixtures | Pre-existing, unrelated to Phase 64 |
| tests/suggestion-promote-form.test.tsx | Same `sampleAmounts` fixture gap | Pre-existing, unrelated to Phase 64 |
| tests/category-combobox.test.tsx | `"system"` not assignable to category type union | Pre-existing, unrelated to Phase 64 |
| tests/overview-interactions.test.tsx | `OverviewChartFiltersProps` missing `includedAllocation`/`onToggleAllocation` in test fixtures | Pre-existing, unrelated to Phase 64 |
| tests/cascade-options.test.ts | `null` used where not allowed (`TS18050`) | Pre-existing, unrelated to Phase 64 |
| tests/file-download-api.test.ts | Two structurally-identical but nominally-unrelated `FileRow`-shaped types (`TS2719`) | Pre-existing, unrelated to Phase 64 |
| tests/transactions-dal.test.ts | `SQL<string>` cast to mock shape (`TS2352`) | Pre-existing, unrelated to Phase 64 |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Wave 2 (Plans 64-02 through 64-05): `importFileDetailHref`, `getTransactionsByFileId`, and `getFileDetailForUser` are exported, tested, and match their Phase 63 analogs exactly. No blockers.

---
*Phase: 64-file-detail-and-navigation*
*Completed: 2026-07-06*

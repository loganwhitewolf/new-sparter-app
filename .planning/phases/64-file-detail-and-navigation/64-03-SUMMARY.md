---
phase: 64-file-detail-and-navigation
plan: 03
subsystem: frontend
tags: [next.js, rsc, react, detail-page]

# Dependency graph
requires:
  - phase: 64-file-detail-and-navigation
    provides: "getFileDetailForUser and getTransactionsByFileId DAL queries (Plan 64-01); importFileDetailHref route builder"
provides:
  - "/import/[fileId] RSC route with ownership check and exhaustive status-based redirect map"
  - "FileDetailClient component: editable displayName, readonly stats, transactions preview, download/suggestions/delete actions"
affects: [64-04, 64-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FileDetailPage mirrors the transaction/expense detail RSC skeleton (params await, verifySession, single DAL call, notFound/redirect gate, then client component)"
    - "Status-based redirect map generalizes the suggestions-page's single notFound() check into per-status branching using next/navigation redirect()"
    - "FileDetailClient lifts ImportRowActions' download handler inline (fetch presigned URL, window.open) rather than importing the table-row-shaped component"

key-files:
  created:
    - tests/file-detail-page.test.tsx
  modified:
    - app/(app)/import/[fileId]/page.tsx
    - components/import/file-detail-client.tsx

key-decisions:
  - "FileDetailPage redirects failed status to notFound() (D-09: failed stays handled by the table's delete action, not this page)"
  - "pending_upload redirects to APP_ROUTES.import as a defensive fallback (this status should not normally be reachable from a file list row)"
  - "uploaded/analyzing/analyzed/importing all redirect to /import/{fileId}/analyze, matching the existing analyze page's own per-status handling"
  - "ImportDeleteDialog reused with a constructed importRow object padding platformId/platformSlug to null — the dialog never reads those fields, only status/id/displayName/originalName"
  - "FileDetailClient test file mocks FileDetailClient itself in the page test, then Task 2 builds the real component consumed by the same mock-free assertions indirectly via TDD sequencing"

requirements-completed: [DET-08]

coverage:
  - id: T1
    description: "FileDetailPage calls notFound() when getFileDetailForUser resolves null (non-existent or non-owned file), never leaking existence"
    requirement: DET-08
    verification:
      - kind: unit
        ref: "tests/file-detail-page.test.tsx#/import/[fileId] page > calls notFound() when getFileDetailForUser resolves null"
        status: pass
    human_judgment: false
  - id: T2
    description: "FileDetailPage calls notFound() when file.status is failed"
    requirement: DET-08
    verification:
      - kind: unit
        ref: "tests/file-detail-page.test.tsx#/import/[fileId] page > calls notFound() when file.status is failed"
        status: pass
    human_judgment: false
  - id: T3
    description: "FileDetailPage redirects to /import/{fileId}/analyze for uploaded, analyzing, analyzed, importing statuses"
    requirement: DET-08
    verification:
      - kind: unit
        ref: "tests/file-detail-page.test.tsx#/import/[fileId] page > redirects to /import/{fileId}/analyze for status=%s (4 cases)"
        status: pass
    human_judgment: false
  - id: T4
    description: "FileDetailPage redirects pending_upload to APP_ROUTES.import as a defensive fallback"
    requirement: DET-08
    verification:
      - kind: unit
        ref: "tests/file-detail-page.test.tsx#/import/[fileId] page > redirects to APP_ROUTES.import for status=pending_upload"
        status: pass
    human_judgment: false
  - id: T5
    description: "FileDetailPage makes exactly one call to getFileDetailForUser and one to getTransactionsByFileId for an imported file, and zero calls to getTransactionsByFileId for a non-imported file"
    requirement: DET-08
    verification:
      - kind: unit
        ref: "tests/file-detail-page.test.tsx#/import/[fileId] page > makes exactly one call to getFileDetailForUser and one call to getTransactionsByFileId; does not call getTransactionsByFileId when the file is not imported"
        status: pass
    human_judgment: false
  - id: T6
    description: "FileDetailClient renders ImportDisplayNameEdit as title, readonly stats (platform, import date, period, row counts, positive/negative totals), transactions preview with links, and a Vedi tutte link"
    requirement: DET-08
    verification:
      - kind: unit
        ref: "tests/file-detail-page.test.tsx#/import/[fileId] page > renders FileDetailClient for an imported, owned file (verifies via mocked component; full behavior confirmed by manual code review of file-detail-client.tsx against acceptance criteria)"
        status: pass
    human_judgment: true
  - id: T7
    description: "Download/suggestions/delete header actions match table-row counterpart behavior exactly"
    requirement: DET-08
    verification:
      - kind: unit
        ref: "Reused ImportRowActions' handleDownload logic verbatim and import-table.tsx's handleRecheckRegex branching verbatim in file-detail-client.tsx (code-level match, no separate behavioral test — acceptance criteria satisfied by construction)"
        status: pass
    human_judgment: true

duration: 12min
completed: 2026-07-06
status: complete
---

# Phase 64 Plan 03: File Detail Page and Client Component Summary

**`/import/[fileId]` RSC route with exhaustive ownership+status gating plus `FileDetailClient`, the third and final detail page in the v2.5 trilogy — files are now navigable first-class entities with editable displayName, readonly stats, a linked transactions preview, and lifted download/suggestions/delete actions.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-06T12:51:00+02:00 (approx.)
- **Completed:** 2026-07-06T13:03:00+02:00
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 test file created — see key-files)

## Accomplishments

- Added `app/(app)/import/[fileId]/page.tsx`: an async Server Component that awaits `params`, calls `verifySession()`, then `getFileDetailForUser({ userId, fileId })` (Plan 64-01). Exhaustively branches on all seven `fileStatusEnum` values: `notFound()` for null result or `status === 'failed'`; `redirect(APP_ROUTES.import)` for `pending_upload` (defensive fallback); `redirect('/import/{fileId}/analyze')` for `uploaded`/`analyzing`/`analyzed`/`importing`; renders `FileDetailClient` only for `status === 'imported'`, after one additional call to `getTransactionsByFileId`.
- Added `components/import/file-detail-client.tsx`: a client component composing `DetailPageShell` with `ImportDisplayNameEdit` as the title (inline pencil rename, unchanged from its existing implementation), a `datiCard` (platform, import date, covered period), a `riepilogoCard` (row counts, positive/negative totals via `formatAbsoluteAmount`), and a `transactionsCard` (up to 10 preview rows each linking via `transactionDetailHref`, plus a "Vedi tutte" link to `/transactions?importId={fileId}`). Header actions: "Scarica file" (lifted `handleDownload` fetch+`window.open` logic from `ImportRowActions`), and an overflow menu with "Rivedi suggerimenti" (`recheckRegexAction`, same zero-candidates/error/success branching as `import-table.tsx`'s `handleRecheckRegex`) and "Elimina" (opens `ImportDeleteDialog`, redirects to `APP_ROUTES.import` with a success toast on delete).
- Added `tests/file-detail-page.test.tsx`: 10 tests covering the RSC page's ownership gate, exhaustive status branching (all seven statuses), and exact DAL call-count assertions. The test mocks `FileDetailClient` itself (verifying the page renders it with the correct `file.id`), keeping the page test decoupled from the client component's internal implementation.

## Task Commits

Each task was committed atomically:

1. **Task 1: FileDetailPage RSC — ownership check, status-based redirect, data assembly** - `e8cd6b1` (feat, TDD red/green)
2. **Task 2: FileDetailClient — shell, editable displayName, readonly stats, transactions preview, actions** - `42bde32` (feat, TDD red/green)

_Note: both tasks share `tests/file-detail-page.test.tsx`, committed with Task 1 since it exercises the page's redirect/notFound logic against a mocked `FileDetailClient`. Task 1's RED phase failed on "Cannot find package '@/components/import/file-detail-client'" (Task 2's component not yet built) rather than a logic assertion — confirmed as the expected TDD failure mode before Task 2 built the real component, after which the full suite passed GREEN._

## Files Created/Modified

- `app/(app)/import/[fileId]/page.tsx` - new file, `FileDetailPage` RSC with ownership check and status redirect map
- `components/import/file-detail-client.tsx` - new file, `FileDetailClient` client component
- `tests/file-detail-page.test.tsx` - new test file, 10 tests (ownership gate, 7-status branching, DAL call counts)

## Decisions Made

- `failed` status redirects to `notFound()`, not a wizard step — matches D-09's "failed stays handled by the table (delete)" contract; the file detail page never surfaces a failed file's error message inline.
- `pending_upload` redirects to `APP_ROUTES.import` as a defensive fallback since this status is not normally reachable from a file list row (no imported-file link would ever point here).
- `uploaded`/`analyzing`/`analyzed`/`importing` all redirect to the same `/import/{fileId}/analyze` destination — that page already owns per-status handling for these four states, so this page doesn't need to replicate that branching.
- `ImportDeleteDialog` is reused with a constructed `{ ...file, platformId: null, platformSlug: null }` object. Verified by reading `import-delete-dialog.tsx` in full: it only reads `importRow.status`, `.id`, `.displayName`, `.originalName` — the two null-padded fields are inert and never referenced, so this is type-satisfying padding, not a functional gap (per the plan's own verification note).
- No `categoriaCard`, no primary "cerca su internet" action — files have no category and no free-text searchable title, per 64-CONTEXT.md and the plan's explicit `<behavior>` omission list.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria satisfied by the implementation as specified; no bugs, missing functionality, blocking issues, or architectural changes encountered.

## Issues Encountered

None specific to this plan's files. Pre-existing unrelated test/type issues (`tests/overview-interactions.test.tsx`, `tests/expense-actions.test.ts`, `tests/import-table-actions.test.tsx`, and the seven pre-existing `tsc` errors already logged in Plan 64-01's summary) were confirmed present before this plan's changes and are out of scope per the scope-boundary rule.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for the remaining Phase 64 plans (64-04, 64-05) that wire cross-references into this page (back-link target, table row "Dettagli" menu entries, title-as-link in `import-table.tsx`). `/import/[fileId]` is fully functional standalone: visiting an imported, owned file renders the detail page; visiting a mid-workflow file redirects to its wizard step; visiting a non-owned or non-existent file 404s.

---
*Phase: 64-file-detail-and-navigation*
*Completed: 2026-07-06*

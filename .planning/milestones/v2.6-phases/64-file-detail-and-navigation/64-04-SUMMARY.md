---
phase: 64-file-detail-and-navigation
plan: 04
subsystem: ui
tags: [next-link, react, table-cell, navigation, routes]

# Dependency graph
requires:
  - phase: 64-01
    provides: importFileDetailHref route builder (lib/routes.ts) — used by every href in this plan
  - phase: 64-02
    provides: title-as-link + pencil split pattern (TransactionTitleEdit/ExpenseTitleEdit) — reused verbatim for ImportDisplayNameEdit
provides:
  - Import table file name is a real Link to /import/[fileId] for imported rows, with the pencil as an independent edit trigger
  - ImportRowActions overflow menu gains a "Dettagli" entry gated on row.status === 'imported'
  - Every remaining /import?fileId= cross-reference (transaction table's file column, transaction detail page, expense detail page) repointed to importFileDetailHref
affects: [64-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ImportDisplayNameEdit's linkHref?: string prop follows the same optional-link convention as TransactionTitleEdit/ExpenseTitleEdit: when provided, title wraps in <Link>; when omitted, renders as plain text with zero behavior change (used by FileDetailClient's own header, Plan 64-03)"

key-files:
  created: []
  modified:
    - components/import/import-display-name-edit.tsx
    - components/import/import-row-actions.tsx
    - components/import/import-table.tsx
    - components/transactions/transaction-table.tsx
    - components/transactions/transaction-detail-client.tsx
    - components/expenses/expense-detail-client.tsx
    - tests/import-table-actions.test.tsx
    - tests/import-display-name-edit.test.tsx
    - tests/transaction-table-menu.test.tsx

key-decisions:
  - "Removed the now-unused APP_ROUTES import from transaction-table.tsx after its only remaining use (the ?fileId= href construction) was replaced by importFileDetailHref — kept expense-detail-client.tsx and transaction-detail-client.tsx's APP_ROUTES imports since they still use it for router.push/backHref elsewhere"

patterns-established:
  - "Import table title-as-link + pencil split (D-04, D-09): ImportDisplayNameEdit now matches the same shape already used by TransactionTitleEdit/ExpenseTitleEdit"

requirements-completed: [DET-09]

coverage:
  - id: D1
    description: "Import table file name is a clickable link to /import/[fileId] for imported files, with the pencil remaining a separate edit trigger"
    requirement: DET-09
    verification:
      - kind: unit
        ref: "tests/import-display-name-edit.test.tsx#renders the title inside a Link when linkHref is provided"
        status: pass
      - kind: unit
        ref: "tests/import-display-name-edit.test.tsx#renders the title as plain (non-link) text when linkHref is omitted"
        status: pass
    human_judgment: false
  - id: D2
    description: "ImportRowActions overflow menu has a 'Dettagli' entry pointing to /import/[fileId], gated to imported files only"
    requirement: DET-09
    verification:
      - kind: unit
        ref: "tests/import-table-actions.test.tsx#ImportRowActions — Dettagli dropdown item (DET-09)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every remaining /import?fileId= cross-reference (transaction table file column, transaction detail page, expense detail page) repointed to importFileDetailHref, with zero remaining matches for the legacy query pattern"
    requirement: DET-09
    verification:
      - kind: unit
        ref: "tests/transaction-table-menu.test.tsx#TransactionTable — file column link (D-05/D-16 repoint)"
        status: pass
      - kind: other
        ref: "grep -rn '?fileId=' app/ components/ (exits zero matches)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-06
status: complete
---

# Phase 64 Plan 04: Import Navigation Wiring Summary

**Import table file names are now real links to `/import/[fileId]` with a "Dettagli" menu entry, and every remaining `/import?fileId=` cross-reference in the codebase (transaction table, transaction detail, expense detail) is repointed to `importFileDetailHref`.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-06T13:47:00Z (approx.)
- **Completed:** 2026-07-06T13:57:00Z (approx.)
- **Tasks:** 2 completed
- **Files modified:** 9 (6 components, 3 test files)

## Accomplishments
- `ImportDisplayNameEdit` gains an optional `linkHref?: string` prop; when provided, the title renders inside a `next/link` `Link` with the pencil split into an independent sibling `<button>` (mirrors Plan 64-02's `TransactionTitleEdit`/`ExpenseTitleEdit` pattern exactly); when omitted, the title renders as plain text with zero behavior change.
- `import-table.tsx` passes `linkHref={importFileDetailHref(row.id)}` only for `status === 'imported'` rows.
- `ImportRowActions` overflow menu gains a "Dettagli" `DropdownMenuItem`, gated identically to the existing `row.status === 'imported'` entries, positioned first in the menu.
- Repointed the three remaining `/import?fileId=` cross-references — `transaction-table.tsx`'s file column, `transaction-detail-client.tsx`'s and `expense-detail-client.tsx`'s "File di origine" cards — to `importFileDetailHref(...)`.
- `grep -rn '?fileId=' app/ components/` now exits with zero matches, closing 64-RESEARCH.md's "Pitfall 3" regression check.

## Task Commits

Each task was committed atomically:

1. **Task 1: ImportDisplayNameEdit optional link mode + Import table title-link + Dettagli menu entry** - `ffa356b` (feat, TDD red/green)
2. **Task 2: Repoint remaining ?fileId= cross-references to importFileDetailHref** - `1881f4c` (fix, TDD red/green)

## Files Created/Modified
- `components/import/import-display-name-edit.tsx` - added `linkHref?: string` prop; non-edit-mode branch split into a conditional `<Link>`/`<span>` title and an independent pencil `<button>`
- `components/import/import-row-actions.tsx` - added "Dettagli" `DropdownMenuItem` (imports `FileText` icon, `importFileDetailHref`), gated on `row.status === 'imported'`, positioned first
- `components/import/import-table.tsx` - passes `linkHref` to `ImportDisplayNameEdit`, imports `importFileDetailHref`
- `components/transactions/transaction-table.tsx` - file column href now `importFileDetailHref(transaction.fileId)`; removed now-unused `APP_ROUTES` import
- `components/transactions/transaction-detail-client.tsx` - "File di origine" cross-ref href now `importFileDetailHref(transaction.fileId)`
- `components/expenses/expense-detail-client.tsx` - "File di origine" cross-ref href now `importFileDetailHref(expense.sourceFile.id)`
- `tests/import-display-name-edit.test.tsx` - added 2 tests (link rendered when `linkHref` provided; plain text when omitted)
- `tests/import-table-actions.test.tsx` - added 2 tests for the "Dettagli" entry (gated + absent for non-imported statuses)
- `tests/transaction-table-menu.test.tsx` - added 1 test asserting the file column link uses `importFileDetailHref` and contains no `?fileId=`

## Decisions Made
- Removed the now-unused `APP_ROUTES` import from `transaction-table.tsx` once its only remaining use (`?fileId=` href construction) was replaced — avoids a dangling unused import. `transaction-detail-client.tsx` and `expense-detail-client.tsx` keep their `APP_ROUTES` imports since they use it elsewhere (`router.push`, `backHref`).
- Followed the plan's literal action for `ImportDisplayNameEdit`'s markup split byte-for-byte against the Plan 64-02 reference components (`TransactionTitleEdit`) rather than inventing new structure.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- One pre-existing test in `tests/import-table-actions.test.tsx` (`ImportRowActions — Rivedi suggerimenti dropdown item (POST-01) > shows "Rivedi suggerimenti" dropdown item only for status=imported`) fails independently of this plan: it asserts `href="/import/{id}/suggestions"` but the current implementation renders "Rivedi suggerimenti" as an `onClick` button, not a link. Confirmed via `git stash` that this failure pre-dates this plan's changes (this plan only added new `describe` blocks, touching zero lines of that test). Out of scope per the scope-boundary rule — not fixed, not investigated further.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- DET-09 is now fully wired: every place in the app that links to a file by `fileId` (Import table title+menu, transaction table, transaction detail, expense detail) points to `/import/[fileId]` via `importFileDetailHref`.
- No blockers for Plan 64-05.

## Deferred Items (out of scope for this plan)

| File | Issue | Notes |
|------|-------|-------|
| tests/import-table-actions.test.tsx | "Rivedi suggerimenti" test expects an `href` but current impl uses `onClick` | Pre-existing, unrelated to Phase 64-04 — confirmed via `git stash` to fail identically before this plan's changes |

---
*Phase: 64-file-detail-and-navigation*
*Completed: 2026-07-06*

## Self-Check: PASSED

All 10 claimed files/artifacts found on disk; both task commits (`ffa356b`, `1881f4c`) confirmed in `git log`.

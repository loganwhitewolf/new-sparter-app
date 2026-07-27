---
phase: 76-reimbursements-section
plan: 02
subsystem: ui
tags: [nextjs, react, data-table, decimal]

# Dependency graph
requires:
  - phase: 76-reimbursements-section (Plan 01)
    provides: getReimbursementList(userId) DAL, reimbursement-format.ts helpers, APP_ROUTES.reimbursements, the /reimbursements RSC tracer page
provides:
  - REIMBURSEMENTS_TABLE_CONFIG (lib/utils/reimbursements-table-config.ts) — search/status-filter/sort declarative config for the unified toolbar system
  - ReimbursementTable client component (components/reimbursements/reimbursement-table.tsx) — reuses DataTableToolbar/useToolbarSort/HeaderSortButton, filters/sorts the already-fetched row set in-memory
  - sortReimbursementRows(rows, sort, dir) — pure, unit-tested sort helper (Decimal-aware, stable)
  - /reimbursements now renders the full interactive table (search, status filter, sortable Titolo/Netto/Data columns)
affects: [76-05-per-reimbursement-page, 76-06-phase-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ReimbursementTable narrows the already-fetched row set client-side (q/status/sort read via useSearchParams + a local sortReimbursementRows), rather than a fresh server round-trip — same pattern as the tags-detail client filtering precedent, distinct from Expenses' server-fetched pagination"
    - "Pure sort/format helpers exported from a 'use client' component file for direct jsdom-free unit testing (mirrors computeMergeEligibility in expense-table.tsx and formatResidualLabel in reimbursement-panel.tsx)"

key-files:
  created:
    - lib/utils/reimbursements-table-config.ts
    - components/reimbursements/reimbursement-table.tsx
    - tests/reimbursement-table-sort.test.ts
  modified:
    - lib/utils/table-config.ts
    - app/(app)/reimbursements/page.tsx

key-decisions:
  - "requirements mark-complete: RMB-10 is fully delivered by this plan (search + status filter + sort + both EmptyState variants); RMB-11 remains Pending until Plan 76-05's per-reimbursement detail page lands."

patterns-established: []

requirements-completed: [RMB-10]

coverage:
  - id: D1
    description: "REIMBURSEMENTS_TABLE_CONFIG defines search (q), status filter (owed/settled/surplus, D-11), and sortable Titolo/Netto/Data columns with defaultSort anchorDate desc (D-02)"
    requirement: "RMB-10"
    verification:
      - kind: unit
        ref: "grep -c \"id: 'reimbursements'\" lib/utils/reimbursements-table-config.ts -> 1; yarn tsc --noEmit clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "sortReimbursementRows sorts residual via Decimal comparison (not string), anchorDate ties are stable, title uses localeCompare"
    requirement: "RMB-10"
    verification:
      - kind: unit
        ref: "tests/reimbursement-table-sort.test.ts (3 sort tests, all pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "formatResidualBadgeLabel('0.00', 'settled') returns exactly 'Saldato' — the exact-zero boundary never renders Dovuti/Surplus"
    requirement: "RMB-10"
    verification:
      - kind: unit
        ref: "tests/reimbursement-table-sort.test.ts#formatResidualBadgeLabel exact-zero boundary"
        status: pass
    human_judgment: false
  - id: D4
    description: "/reimbursements renders EmptyState('no-data') for a zero-reimbursement account, or the full ReimbursementTable (search/filter/sort) otherwise; filtered-to-zero renders EmptyState('no-result') inside the table"
    verification:
      - kind: manual_procedural
        ref: "Deferred to the Plan 76-06 phase checkpoint — this plan's own <verification> block scopes only to yarn vitest + yarn tsc --noEmit, per plan frontmatter"
        status: unknown
    human_judgment: true
    rationale: "Visual/interaction correctness (search debounce, filter popover, sort header clicks) cannot be proven by the Node-only Vitest suite (no jsdom in this repo) — the plan explicitly defers manual confirmation to the Plan 76-06 phase-level checkpoint rather than duplicating a per-plan human-verify gate."

duration: ~15min
completed: 2026-07-27
status: complete
---

# Phase 76 Plan 02: List UI Polish Summary

**REIMBURSEMENTS_TABLE_CONFIG + client ReimbursementTable reusing the unified DataTableToolbar/HeaderSortButton system for search, a 3-state status filter, and sortable Titolo/Netto/Data columns, all operating client-side over the already-fetched row set**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-27
- **Tasks:** 2
- **Files modified:** 5 (2 created new modules + 1 new test file + 2 modified)

## Accomplishments
- Widened `TableConfig['id']` (`lib/utils/table-config.ts`) to include `'reimbursements'`, the only change needed to onboard a new table onto the shared toolbar type vocabulary.
- Added `REIMBURSEMENTS_TABLE_CONFIG`: search on `q` (title/anchor), a `status` filter with the exact D-11 3-bucket vocabulary (owed/settled/surplus -> Dovuti/Saldato/Surplus), sortable Titolo/Netto (residual)/Data (anchorDate) columns, defaulting to anchorDate desc (D-02).
- Added `ReimbursementTable` (`'use client'`): reuses `DataTableToolbar`/`useToolbarSort`/`HeaderSortButton` — the SAME unified system Transactions/Expenses use — but reads `q`/`status` via its own `useSearchParams()` and filters/sorts the already-fetched `reimbursements` prop entirely in-memory (per D-01's "canonical, complete list, volume managed by filter/sort" and the tags-detail client-filtering precedent), never issuing a second server fetch.
- Extracted `sortReimbursementRows(rows, sort, dir)` as a standalone pure export, directly unit-tested without jsdom (this repo has none): residual sorts via `Decimal.comparedTo` (never a naive string compare, which would misorder `'-100.00'` before `'20.00'`), anchorDate ties preserve input order (native `Array.prototype.sort` stability — no bespoke tie-break needed since the DAL already delivers a deterministic order), title uses `localeCompare`.
- Verified `formatResidualBadgeLabel('0.00', 'settled')` returns exactly `'Saldato'` — confirming the RMB-10 exact-zero adjacency boundary the Plan 76-01 helper already implements.
- Replaced the Plan 76-01 tracer's inline `Table`/`TableRow` markup in `app/(app)/reimbursements/page.tsx` with a clean split: the page owns only the account-level `EmptyState('no-data')` for a zero-reimbursement user; `ReimbursementTable` owns everything else, including its own filtered-to-zero `EmptyState('no-result')`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Table config + ReimbursementTable client component** - `5f2ca92` (feat)
2. **Task 2: Wire ReimbursementTable into the /reimbursements page** - `54d5d83` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/utils/table-config.ts` - widened `TableConfig['id']` union to include `'reimbursements'`
- `lib/utils/reimbursements-table-config.ts` - new: `REIMBURSEMENTS_TABLE_CONFIG` (search, status filter D-11, sortable columns, default anchorDate desc D-02)
- `components/reimbursements/reimbursement-table.tsx` - new: `ReimbursementTable` client component + `sortReimbursementRows` pure export
- `tests/reimbursement-table-sort.test.ts` - new: 4 unit tests (Decimal sort, stable tie-break, localeCompare title sort, exact-zero badge boundary)
- `app/(app)/reimbursements/page.tsx` - replaced inline tracer table markup with `ReimbursementTable`, page retains only the account-level `EmptyState('no-data')` branch

## Decisions Made
- `requirements mark-complete RMB-10` run for this plan — search/status-filter/sort + both EmptyState variants (account-empty and filtered-to-zero) are all delivered here, completing the RMB-10 contract per the plan's frontmatter `requirements: [RMB-10]`. RMB-11 (per-reimbursement detail page) stays Pending until Plan 76-05.
- Manual in-browser confirmation of the search/filter/sort interactions (debounce timing, popover open/close, header click cycling) is explicitly deferred to the Plan 76-06 phase-level checkpoint, per this plan's own `<verification>` block — no per-plan `checkpoint:human-verify` task was added, matching the plan's `autonomous: true` frontmatter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ReimbursementTable` + `REIMBURSEMENTS_TABLE_CONFIG` are ready for Plan 76-05 to link from (per-reimbursement detail page) without any further changes to the list surface.
- The full list/search/filter/sort UX still needs one human-in-browser pass — scheduled at the Plan 76-06 phase checkpoint, alongside the other phase-level UAT items.

---
*Phase: 76-reimbursements-section*
*Completed: 2026-07-27*

## Self-Check: PASSED
- FOUND: lib/utils/reimbursements-table-config.ts
- FOUND: components/reimbursements/reimbursement-table.tsx
- FOUND: tests/reimbursement-table-sort.test.ts
- FOUND: commit 5f2ca92 (Task 1)
- FOUND: commit 54d5d83 (Task 2)

---
phase: 76-reimbursements-section
plan: 01
subsystem: reimbursements
tags: [drizzle, raw-sql, decimal, rsc, nextjs]

# Dependency graph
requires:
  - phase: 75-linking-surfaces-and-lifecycle
    provides: reimbursement/reimbursement_refund schema, computeReimbursementResidual, getReimbursementAggregates, Expense-anchor-only reimbursement lifecycle (create/edit/unlink/delete)
provides:
  - getReimbursementList(userId) DAL — Expense-anchor-only list query with the shared residual/state derivation
  - deriveResidualFromAggregates(aggregates) — pure residual/state formula extracted out of computeReimbursementResidual, single source of truth for both callers
  - lib/utils/reimbursement-format.ts — resolveReimbursementDisplayTitle (D-03 fallback), formatResidualBadgeLabel, residualBadgeClassName (D-10 badge copy/colors)
  - APP_ROUTES.reimbursements + reimbursementHref(id)
  - /reimbursements — first real (non-stubbed) RSC list page, verified end-to-end in-browser
affects: [76-02-list-ui-polish, 76-05-per-reimbursement-page, 76-06-phase-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "r-alias raw SQL convention (matches getReimbursementAggregates) reused for getReimbursementList to avoid ambiguous bare-column names in correlated subqueries"
    - "Residual/state arithmetic lives in exactly one pure function (deriveResidualFromAggregates); both the single-reimbursement and list-all DAL paths delegate to it, never re-implement it"

key-files:
  created:
    - lib/utils/reimbursement-format.ts
    - app/(app)/reimbursements/page.tsx
    - tests/reimbursement-list.test.ts
  modified:
    - lib/services/reimbursement.ts
    - lib/dal/reimbursement.ts
    - lib/routes.ts

key-decisions:
  - "requirements mark-complete NOT run for RMB-10/RMB-11 — this plan delivers only the DAL/tracer foundation (bare table, no search/filter/sort UI, no per-reimbursement detail page); RMB-10 completes in Plan 76-02 (unified table + toolbar), RMB-11 completes in Plan 76-05 (per-reimbursement detail page)."

patterns-established:
  - "Tracer feedback gate: task committed and verified via automated tests first, then a human-verify checkpoint confirmed the real page in-browser before any expansion work (76-02+) begins on top of it."

requirements-completed: []

coverage:
  - id: D1
    description: "getReimbursementList(userId) returns only Expense-anchored reimbursements (expense_id IS NOT NULL), ordered anchor-date DESC with a deterministic id-DESC tie-break, residual/state identical to computeReimbursementResidual"
    verification:
      - kind: integration
        ref: "tests/reimbursement-list.test.ts (4 tests: expense-anchor-only isolation, residual precision parity, deterministic ordering, D-03 title fallback)"
        status: pass
    human_judgment: false
  - id: D2
    description: "/reimbursements renders the real list end-to-end (DB -> DAL -> RSC page) for a signed-in user, with a working empty state"
    verification:
      - kind: manual_procedural
        ref: "human-verify checkpoint — user visually confirmed /reimbursements renders correctly in the browser"
        status: pass
    human_judgment: true
    rationale: "Visual/layout correctness of the rendered page cannot be proven by the Node-only Vitest suite (no jsdom in this repo) — required a human to view the running dev server."

duration: ~20min
completed: 2026-07-27
status: complete
---

# Phase 76 Plan 01: DAL Foundation + Tracer Summary

**getReimbursementList DAL (Expense-anchor-only, shared residual derivation) and the first real `/reimbursements` list page, proven end-to-end on seeded data**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-27
- **Tasks:** 1 (tracer)
- **Files modified:** 6

## Accomplishments
- Extracted `deriveResidualFromAggregates(aggregates)` as a pure function in `lib/services/reimbursement.ts`; `computeReimbursementResidual` now delegates to it — residual/state arithmetic lives in exactly one place, both the single-reimbursement and list-all code paths share it (RMB-11 precision, behavior-preserving refactor).
- Added `getReimbursementList(userId)` to `lib/dal/reimbursement.ts`: one raw SQL query (r-alias convention, matching `getReimbursementAggregates`), hard-filtered to `expense_id IS NOT NULL` at the DAL level (T-76-05 defense-in-depth against a Group-anchored reimbursement ever surfacing here), ordered by anchor date DESC with an id DESC tie-break (RMB-10 deterministic ordering).
- Added `lib/utils/reimbursement-format.ts` (pure, no server/DB imports): `resolveReimbursementDisplayTitle` (D-03 empty-title fallback to the anchor's own title), `formatResidualBadgeLabel` / `residualBadgeClassName` (D-10 Italian badge copy + amber/emerald/blue color convention).
- Added `APP_ROUTES.reimbursements` + `reimbursementHref(id)` to `lib/routes.ts`.
- Built `app/(app)/reimbursements/page.tsx`: RSC page, `verifySession -> getReimbursementList(userId) -> real table render or EmptyState`, deliberately the thinnest real rendering (no search/filter/sort toolbar — that's Plan 76-02).
- Proved the vertical slice with 4 real-Postgres integration tests (`tests/reimbursement-list.test.ts`) covering expense-anchor-only isolation, residual/state precision parity with `computeReimbursementResidual`, deterministic ordering, and the D-03 title fallback.
- Cleared the tracer feedback gate: the user visually confirmed `/reimbursements` renders correctly in a running dev server.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "list all reimbursements" — one real row, DB to page** - `270c273` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/services/reimbursement.ts` - extracted `deriveResidualFromAggregates`, `computeReimbursementResidual` now delegates to it
- `lib/dal/reimbursement.ts` - added `getReimbursementList(userId)` + `ReimbursementListRow` type
- `lib/routes.ts` - added `APP_ROUTES.reimbursements` + `reimbursementHref(id)`
- `lib/utils/reimbursement-format.ts` - new: title fallback, badge label/color helpers
- `app/(app)/reimbursements/page.tsx` - new: real RSC list page
- `tests/reimbursement-list.test.ts` - new: 4 integration tests via the real-Postgres harness

## Decisions Made
- Requirements `mark-complete` intentionally NOT run for RMB-10/RMB-11 in this plan. This tracer plan proves the DB→DAL→route→page slice on one real row but ships only a bare table (no search/filter/sort — Plan 76-02) and no per-reimbursement detail page (Plan 76-05). Both requirements stay `Pending` in REQUIREMENTS.md until their respective delivery plans land, per the established Phase 75 precedent for backend-only/foundation plans.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `getReimbursementList` and the shared format helpers are ready for Plan 76-02 to extract the table into a client `ReimbursementTable` component and add search/filter/sort on top.
- `/reimbursements` route + `reimbursementHref(id)` are ready for Plan 76-05's per-reimbursement detail page to link from.
- Tracer feedback gate cleared (human-verify checkpoint approved) — expansion work in 76-02+ can proceed on this proven foundation.

---
*Phase: 76-reimbursements-section*
*Completed: 2026-07-27*

## Self-Check: PASSED
- FOUND: .planning/phases/76-reimbursements-section/76-01-SUMMARY.md
- FOUND: commit 270c273 (Task 1)

---
phase: 76-reimbursements-section
plan: 04
subsystem: ui
tags: [react, next.js, reimbursements, transactions-detail]

# Dependency graph
requires:
  - phase: 76-reimbursements-section (Plan 76-01)
    provides: "/reimbursements list route, APP_ROUTES.reimbursements, reimbursementHref(id) helper"
provides:
  - "ReimbursementPanel variant prop ('summary' | 'management', default 'management')"
  - "Read-only reimbursement summary on /transactions/[id] once a link exists, linking to /reimbursements/[id]"
affects: [76-05, 76-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Component variant prop (default = pre-existing behavior) to split a read-only surface from a management surface without duplicating the component"

key-files:
  created: []
  modified:
    - components/transactions/reimbursement-panel.tsx
    - components/transactions/transaction-detail-client.tsx

key-decisions:
  - "variant defaults to 'management' so every pre-existing call site (and the future /reimbursements/[id] page in Plan 76-05) keeps the unchanged full body with zero code change required"
  - "Empty-state 'Aggiungi rimborso' CTA (data undefined) is identical in both variants — D-09 only reshapes the 'reimbursement already exists' branch, preserving the only bootstrap path on the tx page"

patterns-established:
  - "Summary vs. management variant split: one component, one variant prop, no duplicated JSX tree — reused by Plan 76-05's dedicated page"

requirements-completed: [RMB-11]

coverage:
  - id: D1
    description: "ReimbursementPanel gains an optional variant prop; 'summary' renders read-only refund list + 'Gestisci rimborso' link instead of add/remove/delete controls"
    requirement: RMB-11
    verification:
      - kind: unit
        ref: "tests/reimbursement-panel.test.ts#formatResidualLabel suite (unmodified pure-function coverage, confirms no signature break)"
        status: pass
      - kind: other
        ref: "yarn tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "No jsdom in this repo for render-branch assertions — visual confirmation that /transactions/[id] shows the compact summary (no destructive controls) once linked, and the unchanged CTA when unlinked, is deferred to the Plan 76-06 checkpoint per the plan's own <verification> section."
  - id: D2
    description: "/transactions/[id] activates variant=\"summary\" on the existing ReimbursementPanel call site; bootstrap CTA (RefundPickerDialog) stays mounted and unchanged"
    requirement: RMB-11
    verification:
      - kind: other
        ref: "grep -c 'variant=\"summary\"' components/transactions/transaction-detail-client.tsx == 1; grep -c 'RefundPickerDialog' unchanged at 2 (pre- and post-diff)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-27
status: complete
---

# Phase 76 Plan 04: ReimbursementPanel Summary Variant (D-09) Summary

**Split ReimbursementPanel into 'summary' (read-only, links to /reimbursements/[id]) and 'management' (unchanged full add/remove/delete) variants, activated on /transactions/[id]**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-27T13:19:00Z (approx.)
- **Completed:** 2026-07-27T13:31:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `ReimbursementPanel` gained an optional `variant?: 'summary' | 'management'` prop, defaulting to `'management'` — zero behavior change for any call site that doesn't pass it
- `variant='summary'`: same residual-label + status-Badge header, same refund `<ul>` (Link/date/amount) without the per-refund "Scollega" button, and a single "Gestisci rimborso" `Link`+`Button` to `reimbursementHref(data.reimbursementId)` in place of the add/remove/delete row and delete-confirm `Dialog`
- `variant='management'` (default): the exact pre-existing full-management body, verbatim — ready for reuse on `/reimbursements/[id]` in Plan 76-05
- The empty-state "Aggiungi rimborso" CTA (`!data` branch) is byte-identical in both variants — the only bootstrap path for creating the first link on the tx page is untouched
- `/transactions/[id]`'s `ReimbursementPanel` call site (outflow branch of `collegamentiCard`) now passes `variant="summary"` — a one-prop addition; `onAddRefund`, `refundPickerOpen` state, and the `RefundPickerDialog` mount are all unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: ReimbursementPanel gains a summary variant (D-09)** - `89269e1` (feat)
2. **Task 2: Activate the summary variant on /transactions/[id]** - `ba1b4b3` (feat)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `components/transactions/reimbursement-panel.tsx` - Added `variant` prop; summary rendering path (read-only refund list + "Gestisci rimborso" link); `RefundMembershipCard` export untouched
- `components/transactions/transaction-detail-client.tsx` - Added `variant="summary"` to the `ReimbursementPanel` call in the `!isInflow` branch of `collegamentiCard`

## Decisions Made
- `variant` defaults to `'management'` (not `'summary'`) so the default keeps every existing/future call site's exact current behavior unless explicitly opted into the read-only surface — Plan 76-05's dedicated page will mount `ReimbursementPanel` with no `variant` prop and inherit the full body for free.
- Wrapped the "Gestisci rimborso" `Button` in a `next/link` `Link` (matching the existing per-refund `Link` pattern in this file) rather than using `router.push` in an `onClick`, keeping the summary variant free of client-side navigation logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ReimbursementPanel`'s default (`management`) variant is unchanged and ready for Plan 76-05 to mount on `/reimbursements/[id]` without modification.
- Visual confirmation of both variants (compact summary once linked, unchanged CTA when unlinked) is deferred to the Plan 76-06 checkpoint per this plan's `<verification>` section (no jsdom in this repo for render-branch assertions).

---
*Phase: 76-reimbursements-section*
*Completed: 2026-07-27*

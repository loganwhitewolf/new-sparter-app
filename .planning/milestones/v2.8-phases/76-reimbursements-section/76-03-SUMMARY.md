---
phase: 76-reimbursements-section
plan: 03
subsystem: ui
tags: [drizzle, raw-sql, nextjs, next-link, sidebar]

# Dependency graph
requires:
  - phase: 76-01-dal-foundation-tracer
    provides: APP_ROUTES.reimbursements, reimbursementHref(id), getReimbursementList DAL
provides:
  - transactionListSelect/TransactionListRow reimbursementId field (resolved via the existing pairedReimbursementIdExpr())
  - ReimbursementRowIndicator as a Link to /reimbursements/[id] instead of a dead icon
  - "Rimborsi" top-level sidebar nav item
affects: [76-06-phase-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row-indicator badges that signal membership in a related entity should link directly to that entity's dedicated page rather than staying icon-only, once such a page exists (D-06)."

key-files:
  created: []
  modified:
    - lib/dal/transactions.ts
    - tests/transactions-dal.test.ts
    - components/transactions/reimbursement-row-indicator.tsx
    - components/transactions/transaction-table.tsx
    - components/layout/sidebar.tsx
    - tests/transaction-table-menu.test.tsx

key-decisions:
  - "reimbursementId reuses the existing pairedReimbursementIdExpr() SQL helper unchanged — no new SQL logic needed, only a new exposed field, since that helper already resolves the correct reimbursement id for both anchor and refund roles."
  - "Gate condition for rendering the row-indicator switched from the pairedNetAmount != null proxy check to the semantically-direct transaction.reimbursementId != null check."

patterns-established:
  - "Row-indicator link targets are server-resolved (never client-supplied), and re-validated for ownership on the destination page — no double-authorization logic needed at the link site itself (see threat_model T-76-07)."

requirements-completed: [RMB-10]

coverage:
  - id: D1
    description: "transactionListSelect/TransactionListRow expose a new reimbursementId field, resolved via the existing pairedReimbursementIdExpr(), proven by an extended select-shape contract test"
    requirement: "RMB-10"
    verification:
      - kind: unit
        ref: "tests/transactions-dal.test.ts -t \"reimbursementId\" (transaction pairing select-shape contract, Phase 76 RMB-10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ReimbursementRowIndicator accepts reimbursementId and renders a Link to /reimbursements/[id]; transaction-table.tsx gates on transaction.reimbursementId and passes it through"
    requirement: "RMB-10"
    verification:
      - kind: unit
        ref: "yarn tsc --noEmit (signature/call-site type-checked); tests/transaction-table-menu.test.tsx (101 passing, including the updated TransactionListRow mock factory)"
        status: pass
    human_judgment: true
    rationale: "This repo has no jsdom for sidebar/transaction-table render assertions — clicking the badge and confirming it navigates to the correct /reimbursements/[id] requires a human viewing the running dev server. Deferred to the Plan 76-06 checkpoint per the plan's own verification note."
  - id: D3
    description: "The sidebar exposes a top-level 'Rimborsi' nav item (peer of Tag/Spese) routing to APP_ROUTES.reimbursements, positioned after Spese"
    requirement: "RMB-10"
    verification:
      - kind: unit
        ref: "yarn tsc --noEmit; grep -c \"Rimborsi\" components/layout/sidebar.tsx == 1"
        status: pass
    human_judgment: true
    rationale: "Same jsdom gap as D2 — visual confirmation of sidebar rendering/position deferred to the Plan 76-06 checkpoint."

# Metrics
duration: ~15min
completed: 2026-07-27
status: complete
---

# Phase 76 Plan 03: Reachability — Row-Indicator Link + Sidebar Nav Summary

**The transactions-table reimbursement badge becomes a Link to /reimbursements/[id], and a "Rimborsi" sidebar item makes the section reachable without typing the URL**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added `reimbursementId: number | null` to `transactionListSelect`/`TransactionListRow` in `lib/dal/transactions.ts`, reusing the existing `pairedReimbursementIdExpr()` two-branch (anchor/refund) SQL helper — no new query logic, just a new exposed field.
- Extended the Phase 50 "transaction pairing select-shape contract" test block in `tests/transactions-dal.test.ts` with an assertion that `reimbursementId` is a sql fragment whose flattened text mentions `reimbursement` and never `transaction_pair`.
- Rewrote `ReimbursementRowIndicator` to accept a `reimbursementId: number` prop and wrap the existing `Badge` in a `next/link` `Link` to `reimbursementHref(reimbursementId)`, with `hover:bg-muted`/`cursor-pointer` and an updated `title` so it visually reads as interactive (D-06).
- Updated `transaction-table.tsx`'s call site to gate on `transaction.reimbursementId != null` (the semantically-direct signal) instead of the `pairedNetAmount != null` proxy check, and to pass `reimbursementId` through.
- Added a top-level "Rimborsi" nav item to `components/layout/sidebar.tsx`'s `topNavItems`, positioned immediately after "Spese", using the `Link2` icon (matching `ReimbursementPanel`'s existing iconography) routing to `APP_ROUTES.reimbursements`.
- Rule 1 auto-fix: `handleUnpair`'s optimistic local-state clear (in `transaction-table.tsx`) now also resets `reimbursementId` to `null` on both legs of an unpaired transaction — without this, gating on `reimbursementId` instead of `pairedNetAmount` would have left the badge linking to a stale reimbursement id immediately after an unpair, since only the old proxy field was being cleared before.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose reimbursementId on the transactions list DAL** - `a9bf2e2` (feat)
2. **Task 2: ReimbursementRowIndicator becomes a link to the dedicated page** - `cbaa41d` (feat)
3. **Task 3: "Rimborsi" sidebar nav item** - `a0469c0` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/dal/transactions.ts` - added `reimbursementId` field to `transactionListSelect`/`TransactionListRow`
- `tests/transactions-dal.test.ts` - extended the select-shape contract test with a `reimbursementId` assertion
- `components/transactions/reimbursement-row-indicator.tsx` - now a `next/link` `Link`-wrapped Badge taking `reimbursementId`
- `components/transactions/transaction-table.tsx` - call site gates on `reimbursementId`, passes it through; `handleUnpair` also clears it optimistically
- `components/layout/sidebar.tsx` - new "Rimborsi" `topNavItems` entry with `Link2` icon
- `tests/transaction-table-menu.test.tsx` - mock `TransactionListRow` factory updated with the new required field

## Decisions Made
- Reused `pairedReimbursementIdExpr()` verbatim rather than writing a new SQL expression — it already resolves the correct reimbursement id for both roles, matching the plan's explicit instruction.
- Switched the row-indicator's render gate from `pairedNetAmount != null` to `reimbursementId != null` per the plan, which surfaced the stale-state bug documented below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale reimbursementId after optimistic unpair**
- **Found during:** Task 2 (ReimbursementRowIndicator becomes a link to the dedicated page)
- **Issue:** `handleUnpair`'s optimistic local-state update cleared `pairedWithId`/`pairedNetAmount`/`pairedDescription`/`pairedOccurredAt` on both legs of an unpaired transaction, but not `reimbursementId`. Since Task 2 changes the row-indicator's render gate to `reimbursementId != null`, an unpaired transaction would keep showing a clickable badge linking to the now-stale (or reassigned) reimbursement id until the next server re-render.
- **Fix:** Added `reimbursementId: null` to the same optimistic-clear object spread in `handleUnpair`.
- **Files modified:** `components/transactions/transaction-table.tsx`
- **Verification:** `yarn tsc --noEmit` passes; existing `tests/transaction-table-menu.test.tsx` suite (101 tests) still passes.
- **Committed in:** `cbaa41d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was a direct correctness requirement of the plan's own gate-condition change (Task 2) — without it, Task 2 would have introduced a regression in the already-shipped unpair flow. No scope creep.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both D-05 (sidebar entry) and D-06 (row-indicator link) entry points into `/reimbursements` are now live in code; visual/click-through confirmation is deferred to the Plan 76-06 checkpoint per this plan's own `<verification>` note (this repo has no jsdom for sidebar/transaction-table render assertions).
- `reimbursementId` on `TransactionListRow` is now available for any future transactions-table feature that needs the direct reimbursement id without going through `pairedWithId`/`pairedNetAmount`.

---
*Phase: 76-reimbursements-section*
*Completed: 2026-07-27*

## Self-Check: PASSED
- FOUND: lib/dal/transactions.ts
- FOUND: tests/transactions-dal.test.ts
- FOUND: components/transactions/reimbursement-row-indicator.tsx
- FOUND: components/transactions/transaction-table.tsx
- FOUND: components/layout/sidebar.tsx
- FOUND: tests/transaction-table-menu.test.tsx
- FOUND: commit a9bf2e2 (Task 1)
- FOUND: commit cbaa41d (Task 2)
- FOUND: commit a0469c0 (Task 3)

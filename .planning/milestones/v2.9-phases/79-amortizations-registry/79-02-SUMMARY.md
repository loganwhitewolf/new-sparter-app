---
phase: 79-amortizations-registry
plan: 02
subsystem: ui
tags: [nextjs, rsc, drizzle, decimal.js, data-table]

# Dependency graph
requires:
  - phase: 79-01 (this phase, wave 1)
    provides: getAmortizationPlanList DAL query, /amortizations RSC page, AmortizationTable client component (without row actions), AmortizationSummaryHeader, AMORTIZATIONS_TABLE_CONFIG, route/nav
  - phase: 78-plan-lifecycle-and-reconciliation
    provides: closePlanTx/realizePlanTx/reducePlanTx lifecycle services, CloseAmortizationDialog component, closePlanAction server action
provides:
  - resolveRowActions(row) — open-only action-visibility gate + unconditional realizeHref (D-A1/D-A2/D-A3)
  - AmortizationTable "Chiudi" row action wired to the existing CloseAmortizationDialog + router.refresh()
  - AmortizationTable "Realizza con vendita" row action — deep-link Link to transactionDetailHref
  - A real-Postgres proof that getAmortizationPlanList's read path and closePlanTx's write path never numerically diverge
affects: [80-dashboard-accrual-lens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveRowActions(row) as the single exported pure predicate gating both row-action visibility and href generation — unit-testable without jsdom, mirrors resolveEffectiveStatusFilter's Plan 79-01 precedent"
    - "Conditional-mount dialog + router.refresh() on success — exact shape reused from transaction-table.tsx's closeAmortizeTarget pattern, no new state-management approach introduced"

key-files:
  created: []
  modified:
    - components/amortizations/amortization-table.tsx
    - tests/amortization-registry-table.test.ts
    - tests/amortization-registry-dal.test.ts

key-decisions:
  - "resolveRowActions returns realizeHref unconditionally (regardless of status) — only showActions gates rendering; matches the plan's explicit <behavior> contract"
  - "DAL/lifecycle consistency test asserts remainingMonths is EITHER 0 or 1 after closePlanTx (never a hardcoded value), since the closure instalment's classification against Postgres's CURRENT_DATE depends on real wall-clock timing at test run — then asserts consumedAmount/netValue against both possible branches using the known past-instalment sum and closePlanTx's own returned remainingValue"

patterns-established:
  - "resolveRowActions(row: Pick<Row, 'id'|'transactionId'|'status'>): { showActions, realizeHref } as the row-action gate pattern for status-conditional table actions"

requirements-completed: [REG-02]

coverage:
  - id: D1
    description: "An open plan's registry row shows 'Chiudi' (opens the existing CloseAmortizationDialog, scrap-close only, no inline sale value) and 'Realizza con vendita' (navigates to the transaction detail page's existing realization flow); a closed plan's row shows neither"
    requirement: "REG-02"
    verification:
      - kind: unit
        ref: "tests/amortization-registry-table.test.ts#resolveRowActions (D-A1/D-A2/D-A3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Closing a plan from the registry (Chiudi -> CloseAmortizationDialog -> closePlanAction -> router.refresh()) updates the row's status/remainingMonths/netValue without a full page reload"
    requirement: "REG-02"
    verification:
      - kind: integration
        ref: "tests/amortization-registry-dal.test.ts#getAmortizationPlanList reflects a plan closed via closePlanTx"
        status: pass
    human_judgment: true
    rationale: "The dialog->action->router.refresh() client-side round-trip is not exercised by an automated test in this phase (no jsdom in this repo) — the DAL-level consistency proof covers the read/write numerical correctness, but the actual click-to-refresh UI flow is a held-out backstop per the plan's must_haves, left for human/manual verification."
  - id: D3
    description: "getAmortizationPlanList's read path and closePlanTx's write path never numerically diverge — status, remainingMonths, consumedAmount, and netValue all reconcile after a direct closePlanTx call"
    requirement: "REG-02"
    verification:
      - kind: integration
        ref: "tests/amortization-registry-dal.test.ts#getAmortizationPlanList reflects a plan closed via closePlanTx"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full test suite, including tests/reimbursement-regression.test.ts's LENS-03 byte-identical cash-lens assertions, stays green — this plan introduces no new write path"
    requirement: "REG-02"
    verification:
      - kind: integration
        ref: "yarn vitest run (156 files, 1915 tests, 1 todo)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts (26 tests, LENS-03)"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-07-28
status: complete
---

# Phase 79 Plan 2: Row actions — Chiudi / Realizza con vendita (REG-02) Summary

**Wired "Chiudi" (reuses the existing `CloseAmortizationDialog` verbatim, scrap-close only) and "Realizza con vendita" (deep-link to the transaction detail page) row actions onto the `/amortizations` registry table, gated to open plans only via a single exported `resolveRowActions(row)` predicate, plus a real-Postgres proof that the registry's read path and Phase 78's `closePlanTx` write path never numerically diverge.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-28
- **Tasks:** 2
- **Files modified:** 3 (0 new)

## Accomplishments
- `resolveRowActions(row)` — the single exported pure predicate gating row-action visibility (`showActions: row.status === 'open'`) and generating the realize target (`realizeHref: transactionDetailHref(row.transactionId)`, computed unconditionally regardless of status)
- New "Azioni" column in `AmortizationTable`: an open plan's row renders "Chiudi" (opens `CloseAmortizationDialog`, mirroring `transaction-table.tsx`'s exact conditional-mount + `onSuccess -> router.refresh()` shape) and "Realizza con vendita" (a plain `Link` to the transaction detail page); a closed plan's row renders an empty actions cell
- No new backend mechanics — every mutation this plan can trigger (`closePlanAction` → `closePlanTx`) already existed and was already regression-proven from Phase 78; this plan only adds a new UI call site
- Real-Postgres consistency proof: seeds an open plan, calls `getAmortizationPlanList` (status `'open'`), calls `closePlanTx` directly against the harness db, calls `getAmortizationPlanList` again, and asserts status flips to `'closed'`, `remainingMonths` collapses correctly, and `consumedAmount`/`netValue` recompute consistently with the known past-instalment sum plus `closePlanTx`'s own returned `remainingValue`

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire "Chiudi" + "Realizza con vendita" row actions (D-A1/D-A2/D-A3)** - `a28000fa` (feat)
2. **Task 2: DAL/lifecycle consistency proof + full-suite regression gate** - `6833f1be` (test)

## Files Created/Modified
- `components/amortizations/amortization-table.tsx` - `resolveRowActions(row)`, new "Azioni" `TableHead`/`TableCell`, `closeTarget` state + `CloseAmortizationDialog` conditional mount, `router.refresh()` on close success
- `tests/amortization-registry-table.test.ts` - 3 new `resolveRowActions` unit tests (open→true, closed→false, `realizeHref` unconditional)
- `tests/amortization-registry-dal.test.ts` - 1 new integration test proving `getAmortizationPlanList` ↔ `closePlanTx` numerical consistency

## Decisions Made
- `resolveRowActions`'s `realizeHref` is computed unconditionally (not gated on `showActions`) — the caller decides whether to render it, matching the plan's `<behavior>` contract literally (a closed row's `resolveRowActions(...).realizeHref` is still a valid href, it is simply never rendered).
- The DAL/lifecycle consistency test asserts `remainingMonths` is either `0` or `1` after `closePlanTx` (never a hardcoded single value) since the collapsed closure instalment's classification against Postgres's `CURRENT_DATE` boundary depends on real wall-clock timing at test-run time — the plan's own `<action>` text anticipated this ambiguity. Both branches are then checked against the same two known-good quantities (the untouched past-instalment sum + `closePlanTx`'s own returned `remainingValue`), so the proof holds regardless of which branch fires.

## Deviations from Plan

None — plan executed exactly as written. No new backend mechanics were needed; every mutation this plan's UI can trigger was already built and regression-proven in Phase 78.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- REG-02 fully delivered: a user can close a plan directly from the registry (scrap-close only, reusing the existing dialog) and can reach the realize-via-sale flow via a deep link to the transaction detail page; both actions are visible only on open plans.
- REG-01, REG-02, and REG-03 are now ALL delivered — Phase 79 (amortizations-registry) is complete.
- Full suite (156 files, 1915 tests, 1 pre-existing todo), `yarn tsc --noEmit`, and `yarn check:language` all clean. LENS-03 (`tests/reimbursement-regression.test.ts`, 26 tests) stays green — this plan introduced zero new write paths.
- Held-out UI-state checks (pending/disabled button state during the close action, overflow at narrow/mobile layouts, action-group presentation edge cases — flagged `backstop` in this plan's `must_haves`) are not exercised by an automated test in this phase and are left for human/manual verification, same convention as Plan 79-01.
- Phase 80 (dashboard-accrual-lens) can now build on a complete, verified registry surface.

## Self-Check: PASSED

Modified file `components/amortizations/amortization-table.tsx` verified present on disk with the new "Azioni" column and `resolveRowActions` export; both task commits (`a28000fa`, `6833f1be`) verified in `git log`.

---
*Phase: 79-amortizations-registry*
*Completed: 2026-07-28*

---
phase: 78-plan-lifecycle-and-reconciliation
plan: 01
subsystem: payments
tags: [amortization, decimal.js, drizzle, postgres, next.js-server-actions]

# Dependency graph
requires:
  - phase: 77-amortization-schema-and-activation
    provides: amortization_plan/amortization_instalment schema, activatePlanTx, materializeInstalments, ledger_entry_cash/ledger_entry_accrual seam
provides:
  - closePlanTx (D-01 close/collapse write path, reused by 78-02's realize-via-sale)
  - closePlanAction + ClosePlanSchema (server action + Zod boundary)
  - transactionListSelect.amortizationPlanStatus (correlated subquery, threads into TransactionListRow/TransactionDetailRow)
  - CloseAmortizationDialog (row action + detail page entry points)
affects: [78-02-realize-and-reimburse, 78-03-edit-invariant, 79-amortizations-registry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AmortizationLifecycleError mirrors ActivatePlanError's name/code/message shape exactly"
    - "loadOpenPlanForOwner/loadFutureInstalments as private module helpers, not exported DAL functions — service-layer-local, mirrors amortization-activation.ts's own inline SELECT style"
    - "closureInstalmentNumber = MIN(instalmentNumber) among just-deleted rows — deterministic slot reclaim, no extra query"

key-files:
  created:
    - lib/services/amortization-lifecycle.ts
    - lib/actions/amortization-lifecycle.ts
    - components/transactions/close-amortization-dialog.tsx
    - tests/amortization-lifecycle.test.ts
  modified:
    - lib/validations/amortization.ts
    - lib/dal/transactions.ts
    - components/transactions/transaction-table.tsx
    - components/transactions/transaction-detail-client.tsx
    - tests/transaction-table-menu.test.tsx
    - tests/reimbursement-regression.test.ts

key-decisions:
  - "closePlanTx never reads plan.expenseId (no such column) — the closure instalment's expenseId is taken from the first deleted future instalment, since every instalment of one plan shares the SAME Standalone Expense id (Phase 77 D-13)"
  - "loadFutureInstalments uses gte (inclusive) on occurredAt >= closure-month start — an instalment scheduled exactly in the closure month is collapsed, not preserved (adjacency edge)"
  - "closePlanAction's closureMonth is always new Date() (the action's own moment) — no client-supplied date in this minimal surface; realize-via-sale (78-02) supplies its own closureMonth = the linked sale's occurredAt"

patterns-established:
  - "Close/collapse write pattern: load-scoped-plan -> compute closureMonthStart -> load future set (gte) -> branch on empty -> delete+insert+update inside the SAME tx — the exact shape 78-02's realizePlanTx composes closePlanTx on top of"

requirements-completed: [AMORT-04]

coverage:
  - id: D1
    description: "closePlanTx collapses every remaining (future) instalment onto ONE closure-month instalment holding their Decimal-summed value; past instalments are never touched"
    requirement: "AMORT-04"
    verification:
      - kind: integration
        ref: "tests/amortization-lifecycle.test.ts#collapses every future instalment onto ONE closure-month instalment, past instalments untouched"
        status: pass
    human_judgment: false
  - id: D2
    description: "Closure month equal to a scheduled instalment's own month collapses that instalment too (inclusive adjacency boundary)"
    requirement: "AMORT-04"
    verification:
      - kind: integration
        ref: "tests/amortization-lifecycle.test.ts#closure month equal to a scheduled instalment's own month collapses that instalment too (inclusive adjacency edge)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Closing a plan whose every instalment already occurred before the closure month sets status='closed' and writes NO new instalment row"
    requirement: "AMORT-04"
    verification:
      - kind: integration
        ref: "tests/amortization-lifecycle.test.ts#every instalment already occurred before the closure month: status closed, zero new instalment rows (empty-input edge)"
        status: pass
    human_judgment: false
  - id: D4
    description: "closePlanTx on an already-closed plan throws PLAN_NOT_OPEN; on a foreign-owned or nonexistent planId throws the SAME generic PLAN_NOT_FOUND message (no ownership-enumeration signal)"
    requirement: "AMORT-04"
    verification:
      - kind: integration
        ref: "tests/amortization-lifecycle.test.ts#an already-closed plan throws PLAN_NOT_OPEN"
        status: pass
      - kind: integration
        ref: "tests/amortization-lifecycle.test.ts#a foreign-owned or nonexistent planId throws the SAME generic PLAN_NOT_FOUND message"
        status: pass
    human_judgment: false
  - id: D5
    description: "closePlanTx runs entirely inside one db.transaction (DbOrTx-typed) — every write goes through the passed-in tx, never a direct db call"
    requirement: "AMORT-04"
    verification:
      - kind: unit
        ref: "grep -c 'effectiveAmount()\\|isNotSecondary()' lib/services/amortization-lifecycle.ts == 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Boundary/edge hardening: EXACTLY ONE remaining instalment carries forward with no rounding drift; closing one plan does not affect an unrelated plan for the same user"
    requirement: "AMORT-04"
    verification:
      - kind: integration
        ref: "tests/amortization-lifecycle.test.ts#closing with EXACTLY ONE remaining future instalment carries its amount forward unchanged (Decimal identity, no rounding drift)"
        status: pass
      - kind: integration
        ref: "tests/amortization-lifecycle.test.ts#does not affect an unrelated plan for the SAME user (ownership/scoping regression, not just a single-plan happy path)"
        status: pass
    human_judgment: false
  - id: D7
    description: "LENS-03 stays green: the cash lens (totalOut/getCategoriesBreakdown/getTagTotals) is byte-identical before/after a real closePlanTx write; the accrual lens's closure-month row faithfully reflects the materialized amount with zero live netting"
    requirement: "AMORT-04"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#closePlanTx leaves the cash lens byte-identical and the accrual lens reflects the materialized closure instalment"
        status: pass
    human_judgment: false
  - id: D8
    description: "The Chiudi ammortamento action is reachable from both the transaction row menu and the detail page, gated on (amortizationPlanId != null && amortizationPlanStatus === 'open')"
    human_judgment: true
    rationale: "Visual/interactive UI gating (dropdown item visibility, dialog copy, toast feedback) requires a human to click through the app; automated tests only prove the underlying grep/type-level wiring, not the rendered experience"

# Metrics
duration: 20min
completed: 2026-07-28
status: complete
---

# Phase 78 Plan 01: Close & Collapse an Amortization Plan Summary

**closePlanTx collapses every remaining instalment of an open amortization plan onto one Decimal-summed closure-month row, wired end-to-end from a "Chiudi ammortamento" dialog on both the transaction row and detail page, real-Postgres-proven not to disturb the cash lens.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-28T16:23:06+02:00 (prior commit reference)
- **Completed:** 2026-07-28T16:33:16+02:00
- **Tasks:** 2
- **Files modified:** 11 (4 created, 7 modified)

## Accomplishments

- `closePlanTx` (`lib/services/amortization-lifecycle.ts`): the tracer write path for the entire
  Phase 78 lifecycle. Loads the plan ownership-scoped, computes the closure-month boundary,
  deletes every instalment with `occurredAt >= closure-month start` (inclusive — collapses an
  instalment scheduled exactly in the closure month, not just strictly-future ones), sums their
  Decimal amounts, inserts ONE new instalment at the closure month reclaiming the first freed
  instalment number, and flips `plan.status` to `closed` — all inside the caller's `db.transaction`.
  The empty-future-set edge closes the plan with zero new rows (no phantom zero-amount instalment).
- `AmortizationLifecycleError` (`PLAN_NOT_FOUND` | `PLAN_NOT_OPEN`) mirrors `ActivatePlanError`'s
  exact shape; a foreign-owned or nonexistent `planId` resolves to the SAME generic message
  (T-78-01, no ownership-enumeration signal).
- `closePlanAction` (`lib/actions/amortization-lifecycle.ts`): Zod-validates via `ClosePlanSchema`,
  `verifySession()`s, wraps `closePlanTx` in `db.transaction`, `closureMonth` always defaults to
  the action's own moment (D-02a's scrap rule — no client-supplied date in this minimal surface),
  and calls `revalidateCategorizationSurfaces()` on success.
- `transactionListSelect.amortizationPlanStatus`: a new correlated-subquery column (same style as
  `amortizationPlanId`), threaded into `TransactionListRow`, `TransactionDetailRow`, and
  `getTransactionForDetail`.
- `CloseAmortizationDialog`: structurally identical to `RemoveAmortizationDialog` but a
  neutral/outline (non-destructive) confirm variant — closing collapses instalments, it never
  deletes the plan. Wired into the transaction row's dropdown menu and the detail page's action
  list, both gated on `amortizationPlanId != null && amortizationPlanStatus === 'open'`.
- `tests/amortization-lifecycle.test.ts`: 7 real-Postgres integration scenarios (the 5 required by
  `<behavior>` plus 2 boundary-hardening cases from Task 2) — all green against the local
  `sparter_test` harness.
- `tests/reimbursement-regression.test.ts`: a new LENS-03 regression block proves the cash lens
  (`totalOut`, `getCategoriesBreakdown`, `getTagTotals`) is byte-identical before/after a REAL
  `closePlanTx` call (not a fixture stand-in), plus a direct-SQL probe against
  `ledger_entry_accrual` confirming the closure-month row's materialized amount matches
  `closePlanTx`'s returned `remainingValue` exactly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Close & collapse an amortization plan end-to-end (D-01, AMORT-04)** - `18a40fb` (feat)
2. **Task 2: LENS-03 regression proof for close/collapse + edge-case hardening** - `f4c3542` (test)

_Note: Task 1 is `type="tracer"` — service, action, DAL, dialog, and 5 test scenarios landed in
one atomic commit as a real, wired-for-real vertical slice (not a throwaway), per the tracer
feedback gate the executor re-ran `tests/amortization-lifecycle.test.ts` end-to-end before
expanding into Task 2._

## Files Created/Modified

- `lib/services/amortization-lifecycle.ts` - `closePlanTx` + `AmortizationLifecycleError` +
  `loadOpenPlanForOwner`/`loadFutureInstalments` helpers
- `lib/actions/amortization-lifecycle.ts` - `closePlanAction` (Zod + verifySession + db.transaction
  + Italian error passthrough)
- `lib/validations/amortization.ts` - added `ClosePlanSchema`
- `lib/dal/transactions.ts` - added `amortizationPlanStatus` to `transactionListSelect`,
  `TransactionListRow`, `TransactionDetailRow`, `getTransactionForDetail`
- `components/transactions/close-amortization-dialog.tsx` - `CloseAmortizationDialog` (new)
- `components/transactions/transaction-table.tsx` - `closeAmortizeTarget` state,
  `markAmortizationClosed`, "Chiudi ammortamento" `DropdownMenuItem`, dialog render
- `components/transactions/transaction-detail-client.tsx` - `closeAmortizeOpen` state, "Chiudi
  ammortamento" button, dialog render
- `tests/amortization-lifecycle.test.ts` - 7 real-Postgres scenarios covering `closePlanTx`
- `tests/reimbursement-regression.test.ts` - new LENS-03 close/collapse regression block
- `tests/transaction-table-menu.test.tsx` - added `amortizationPlanStatus: null` to the
  `makeTransaction` fixture builder (required field, Rule 1 type-error fix)

## Decisions Made

- `plan.expenseId` does not exist as a column — the closure instalment's `expenseId` is taken from
  the first deleted future instalment (every instalment of one plan shares the same Standalone
  Expense id per Phase 77 D-13). Documented inline in `closePlanTx`.
- The "Rimuovi ammortamento" gate stays unchanged (gated only on `amortizationPlanId`, not status)
  — this plan doesn't touch D-09's undo scope; a closed plan can still be undone if the escape
  hatch is ever exercised, which is out of scope to re-decide here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/transaction-table-menu.test.tsx`'s `makeTransaction` fixture missing the new required field**
- **Found during:** Task 1 (`yarn tsc --noEmit` after adding `amortizationPlanStatus` to
  `TransactionListRow`)
- **Issue:** The existing test fixture builder in `tests/transaction-table-menu.test.tsx` builds a
  full `TransactionListRow` object; adding a new required field to the type broke it with a
  `Type 'string | null | undefined' is not assignable to type 'string | null'` compile error.
- **Fix:** Added `amortizationPlanStatus: null` to the fixture's default field list, alongside the
  existing `amortizationPlanId: null`.
- **Files modified:** `tests/transaction-table-menu.test.tsx`
- **Verification:** `yarn tsc --noEmit` clean; `vitest run tests/transaction-table-menu.test.tsx`
  green (5/5).
- **Committed in:** `18a40fb` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the type change to compile; zero behavior change, no scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `closePlanTx` is the exact write pattern `78-02-PLAN.md`'s `realizePlanTx` composes on top of
  (close-for-sale calls `closePlanTx` then links the sale via `createPairTx`) — the tracer proved
  this pattern end-to-end before any expansion, per the plan's own stated purpose.
- `transactionListSelect.amortizationPlanStatus` is now available for 78-02/78-03's own gating
  needs (e.g. distinguishing "chiudi per vendita" vs "rimborso parziale" only applies to an OPEN
  plan) without any further DAL work.
- No blockers. LENS-03 (`tests/reimbursement-regression.test.ts`) stays green; full suite green
  (154 files, 1875 passed / 1 todo); `yarn tsc --noEmit` and `yarn check:language` both clean.

---
*Phase: 78-plan-lifecycle-and-reconciliation*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: lib/services/amortization-lifecycle.ts
- FOUND: lib/actions/amortization-lifecycle.ts
- FOUND: components/transactions/close-amortization-dialog.tsx
- FOUND: tests/amortization-lifecycle.test.ts
- FOUND: 18a40fb (Task 1 commit)
- FOUND: f4c3542 (Task 2 commit)

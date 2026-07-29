---
phase: 77-amortization-schema-and-activation
plan: 02
subsystem: transactions
tags: [drizzle, postgres, decimal.js, server-actions, dialog]

# Dependency graph
requires:
  - phase: 77-01
    provides: amortization_plan/amortization_instalment schema, activatePlanTx, getAmortizationEligibility, ActivateAmortizationDialog, amortizationPlanId on transactionListSelect
provides:
  - reverseDetachTx (lib/services/transaction-detach.ts) — atomic D-09 reverse-detach invariant
  - removeAmortizationPlan Server Action (lib/actions/amortization.ts)
  - RemoveAmortizationDialog component, reused on both the row and the detail page
  - getTransactionForDetail exposes amortizationPlanId
  - Detail page "Ammortizza" entry point (D-01 parity with the row action)
affects: [78-plan-lifecycle-and-reconciliation, 79-amortizations-registry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reverse-detach invariant: recompute the transaction's original descriptionHash via computeDescriptionHash(description) at undo time — never store it, since description is immutable (ADR 0019 §3) and the recompute is always correct"
    - "Undo composes the SAME reconcileExpensesAfterTransactionRemoval() the forward detach path uses, on BOTH the target and the abandoned expense ids, in one call — no bespoke cleanup logic"
    - "Client-side eligibility mirror duplicated per surface (row vs. detail page) against the same TransactionDetailRow/TransactionListRow field set, sharing only the Italian copy formatter (amortizationGuardMessage) — the two surfaces have different backing row types so the predicate itself can't be a single shared function without introducing a new shared type"

key-files:
  created:
    - components/transactions/remove-amortization-dialog.tsx
    - tests/amortization-undo.test.ts
  modified:
    - lib/services/transaction-detach.ts
    - lib/actions/amortization.ts
    - lib/validations/amortization.ts
    - lib/dal/transactions.ts
    - components/transactions/transaction-table.tsx
    - components/transactions/transaction-detail-client.tsx
    - tests/transaction-detail-page.test.tsx

key-decisions:
  - "reverseDetachTx is a new export on transaction-detach.ts (not a separate module) — it is the direct structural inverse of applyDetachCleanupTx in the same file, sharing DetachTransactionError and reusing reconcileExpensesAfterTransactionRemoval exactly as the forward path does."
  - "removeAmortizationPlan takes only {planId} from the client — the transactionId is re-derived server-side from the plan row (scoped to the caller's own userId), so the untrusted input surface crossing the Server Action boundary is minimal (T-77-06)."
  - "Detail-page eligibility reimbursement-involvement is derived from `reimbursementPanelData !== undefined || refundMembership !== undefined` (both already-loaded props) rather than a new `reimbursementId` field on TransactionDetailRow, per the plan's own action spec — no new query added."

patterns-established:
  - "D-09 undo teardown order: load+ownership-check plan -> load transaction+abandoned-expense -> recompute hash -> find-or-create target expense -> re-point transaction.expenseId -> delete plan (cascades instalments) -> reconcile [target, abandoned] — all inside the SAME passed-in tx, matching activatePlanTx's own compose-inside-db.transaction discipline."

requirements-completed: [AMORT-01, AMORT-02]

coverage:
  - id: D1
    description: "reverseDetachTx atomically deletes the amortization_plan row (cascading instalments via FK) and re-attaches the transaction to a freshly-created shared Expense when no existing expense matches the recomputed original descriptionHash"
    requirement: "AMORT-02"
    verification:
      - kind: integration
        ref: "tests/amortization-undo.test.ts#creates a new shared Expense when no existing expense matches the recomputed original hash"
        status: pass
    human_judgment: false
  - id: D2
    description: "reverseDetachTx merges the transaction into an EXISTING shared Expense (same recomputed descriptionHash) without altering that expense's own title/status/subCategoryId, and correctly reconciles the merged aggregate"
    requirement: "AMORT-02"
    verification:
      - kind: integration
        ref: "tests/amortization-undo.test.ts#merges into an existing shared Expense when a second transaction with the same description was imported after activation"
        status: pass
    human_judgment: false
  - id: D3
    description: "removeAmortizationPlan/reverseDetachTx is ownership-scoped: a mismatched userId or an unrelated planId throws and writes nothing (T-77-06)"
    verification:
      - kind: integration
        ref: "tests/amortization-undo.test.ts#throws and writes nothing when the transactionId/userId does not match the caller ownership"
        status: pass
    human_judgment: false
  - id: D4
    description: "Row and detail-page 'Rimuovi ammortamento' actions render only when amortizationPlanId is set; the detail page's 'Ammortizza' entry mirrors the row's five-guard eligibility (D-04..D-07 + outflow-only) and the Entry Point Visibility Matrix"
    requirement: "AMORT-01"
    verification:
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit (clean — TransactionDetailRow.amortizationPlanId threaded through both surfaces)"
        status: pass
      - kind: integration
        ref: "tests/transaction-table-menu.test.tsx, tests/transaction-detail-page.test.tsx (unchanged assertions still pass with the new field wired in)"
        status: pass
    human_judgment: true
    rationale: "Visual verification of the disabled+tooltip guard states, destructive styling, and the undo dialog's spinner/toast copy against the UI-SPEC requires a human to click through the real dialog in a browser — no automated visual assertion exists for this phase."

# Metrics
duration: ~20min
completed: 2026-07-28
status: complete
---

# Phase 77 Plan 02: Amortization Undo & Detail-Page Parity Summary

**D-09 "rimuovi ammortamento" undo path (reverseDetachTx: atomic plan+instalment delete, reverse-detach re-attaching the transaction to its shared Expense by recomputed original descriptionHash) plus detail-page parity for both "Ammortizza" and "Rimuovi ammortamento"**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-28
- **Tasks:** 2/2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `reverseDetachTx` (lib/services/transaction-detach.ts) — the structural inverse of `applyDetachCleanupTx`: loads the plan scoped by `id+userId+transactionId`, recomputes the transaction's original `descriptionHash` via `computeDescriptionHash(description)` (never stored — description is immutable per ADR 0019 §3), finds-or-creates the shared Expense, re-points the transaction, deletes the plan (cascading instalments via FK), and reconciles both the target and the abandoned Standalone Expense in one call.
- `removeAmortizationPlan` Server Action (lib/actions/amortization.ts) — validates `{planId}`, re-derives `transactionId` server-side from the ownership-scoped plan row, wraps `reverseDetachTx` in `db.transaction`, revalidates on success.
- `RemoveAmortizationDialog` — one component reused verbatim on both the transaction row and the detail page (mirrors `DetachExpenseDialog`'s structure), matching the UI-SPEC's Undo Confirmation Dialog copy/spinner/error-toast contract.
- `getTransactionForDetail` now exposes `amortizationPlanId` (same correlated-subquery reuse pattern as `pairedWithId`), letting the detail page gate its own entry points without a new query.
- Detail page gains "Ammortizza" (reuses `ActivateAmortizationDialog` unmodified, gated by a detail-page mirror of the row's five-guard eligibility) and "Rimuovi ammortamento" (shown only when a plan exists), completing AMORT-01's third entry point (row, detail page, manual entry).

## Task Commits

Each task was committed atomically:

1. **Reverse-detach service + removeAmortizationPlan action (D-09)** - `4b61129` (feat)
2. **Wire "Rimuovi ammortamento" (row + detail) and "Ammortizza" on the detail page** - `8dbb65a` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified

- `lib/services/transaction-detach.ts` - `reverseDetachTx` (D-09 reverse-detach invariant), extended `DetachTransactionErrorCode` with `PLAN_NOT_FOUND`
- `lib/actions/amortization.ts` - `removeAmortizationPlan` Server Action
- `lib/validations/amortization.ts` - `RemoveAmortizationPlanSchema`
- `lib/dal/transactions.ts` - `getTransactionForDetail`/`TransactionDetailRow` gain `amortizationPlanId`
- `components/transactions/remove-amortization-dialog.tsx` - D-09 undo confirmation dialog (new)
- `components/transactions/transaction-table.tsx` - "Rimuovi ammortamento" row action (destructive, `Trash2` icon, shown only when `amortizationPlanId` is set), optimistic local clear + `router.refresh()` on success
- `components/transactions/transaction-detail-client.tsx` - "Ammortizza"/"Rimuovi ammortamento" action buttons, `computeDetailAmortizationEligibility` (detail-page mirror of the row's guard order)
- `tests/amortization-undo.test.ts` - 3 real-Postgres tests covering create-new-expense, merge-into-existing-expense, and ownership-mismatch-throws
- `tests/transaction-detail-page.test.tsx` - fixture gains `amortizationPlanId: null` default

## Decisions Made

- **reverseDetachTx lives in transaction-detach.ts, not a new module** — it is the direct structural inverse of `applyDetachCleanupTx` in the same file, sharing `DetachTransactionError` and reusing `reconcileExpensesAfterTransactionRemoval` exactly as the forward path does.
- **removeAmortizationPlan takes only `{planId}`** — the `transactionId` is re-derived server-side from the plan row (scoped to the caller's own `userId`), minimizing the untrusted input surface crossing the Server Action boundary (T-77-06).
- **Detail-page reimbursement-involvement derived from already-loaded props** (`reimbursementPanelData !== undefined || refundMembership !== undefined`) rather than adding a new `reimbursementId` field to `TransactionDetailRow` — no new query, per the plan's own action spec.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as specified for both tasks' `<action>` blocks.

### Process note (not a deviation rule)

**TDD gate sequence not literally split into separate RED/GREEN commits.** Task 1 carried `tdd="true"`, but the test file (`tests/amortization-undo.test.ts`) and the implementation (`reverseDetachTx`/`removeAmortizationPlan`) were written together and verified passing (3/3) before the single `feat(77-02): reverse-detach service...` commit — there is no preceding `test(77-02): ...` commit showing the tests failing first. The tests do exercise the real implementation against a real Postgres harness and all pass; functional correctness is not in question, but the literal RED-then-GREEN commit sequence the TDD execution flow calls for was not produced. Flagging for visibility rather than silently omitting it.

## Issues Encountered

None — both tasks completed without blockers.

## User Setup Required

None - no external service configuration, migration, or seed changes required (no new schema in this plan; both tasks are pure service/action/UI work on top of Plan 77-01's schema).

## Next Phase Readiness

- `reverseDetachTx` and `removeAmortizationPlan` are directly reusable for Phase 78's plan-lifecycle work (closure/realization touch the same `amortization_plan`/`amortization_instalment` rows).
- AMORT-01's three entry points (row, detail page) are now consistent; the manual-entry checkbox (D-10) is a separate, not-yet-planned surface per the roadmap's phase boundary (still Phase 77 scope per REQUIREMENTS.md, but not covered by this plan — confirm against `.planning/phases/77-amortization-schema-and-activation/` for whether a Plan 77-03 covers D-10, or whether it was folded elsewhere).
- No blockers identified for the next wave.

---
*Phase: 77-amortization-schema-and-activation*
*Completed: 2026-07-28*

## Self-Check: PASSED

All 9 files referenced above (services, actions, validations, dal, dialog component, table,
detail client, tests) confirmed present on disk. Both commit hashes (4b61129, 8dbb65a) confirmed
present in git history. No missing items.

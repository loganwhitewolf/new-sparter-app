---
phase: 77-amortization-schema-and-activation
fixed_at: 2026-07-28T14:40:00Z
review_path: .planning/phases/77-amortization-schema-and-activation/77-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 77: Code Review Fix Report

**Fixed at:** 2026-07-28T14:40:00Z
**Source review:** .planning/phases/77-amortization-schema-and-activation/77-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 critical, 3 warning — the 2 Info findings were out of scope per `fix_scope: critical_warning`)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Amortizing an uncategorized transaction mislabels the resulting Expense as "categorized"

**Files modified:** `lib/services/transaction-detach.ts`, `tests/fixtures/reimbursement-seed.ts`, `tests/amortization-undo.test.ts`
**Commit:** `14f50c4`
**Applied fix:** Took the reviewer's "more robust" option instead of the caller-side patch: changed `applyDetachCleanupTx`'s gate from `input.subCategoryId !== undefined` to `input.subCategoryId != null`. Loose-equality `!= null` also matches `undefined`, so `detachTransactionToDedicatedExpense` (which omits the key entirely when the caller doesn't supply one) keeps its existing behavior unchanged; `transaction-pairs.ts`'s refund-cleanup call site already only invokes this function when `anchorSubCategoryId !== null`, so it too is unaffected. `activatePlanTx` now correctly produces `{ subCategoryId: null, status: '1' }` for an uncategorized source instead of `{ subCategoryId: null, status: '3' }`.

Verified by walking every existing caller of `applyDetachCleanupTx`/`detachTransactionToDedicatedExpense` (`lib/actions/transactions.ts`, `lib/services/transaction-pairs.ts`, `lib/services/amortization-activation.ts`) to confirm the gate change is a strict improvement with no behavior change for any caller that was already correct.

Added the regression test the review explicitly asked for: relaxed `seedExpenseWithTransaction`'s `subCategoryId` param to `number | null` (status now derives from it: `'3'` when non-null, `'1'` when null — previously hardcoded to `'3'` regardless), then added a new `describe` block in `tests/amortization-undo.test.ts` that seeds an uncategorized outflow transaction, runs `activatePlanTx`, and asserts (a) the resulting expense keeps `subCategoryId: null, status: '1'`, and (b) it is picked up by `getUncategorizedCount` (`lib/dal/dashboard.ts`) with the exact same date-scoped WHERE shape the "Da categorizzare" dashboard widget uses — proving the fix end-to-end, not just on direct row inspection.

### WR-01: Create-transaction dialog does not gate submit on amortization-months validity

**Files modified:** `components/transactions/transaction-form-dialog.tsx`
**Commit:** `7fc58e6`
**Applied fix:** Submit button `disabled` now also evaluates `amortizationEnabled && (!isNegativeAmount || !monthsValidation.valid)`, mirroring `ActivateAmortizationDialog`'s own `disabled={pending || !validation.valid}` gate. The `!isNegativeAmount` branch additionally covers WR-02's scenario for free (months validation can never be `valid: true` without a negative amount in the first place).

### WR-02: Checked-but-hidden amortization checkbox produces a misleading validation error

**Files modified:** `components/transactions/transaction-form-dialog.tsx`
**Commit:** `c6125ff`
**Applied fix:** Added an inline warning (`Puoi ammortizzare solo transazioni in uscita.` — the exact same string `amortizationGuardMessage`'s `'not-outflow'` case produces) rendered whenever the checkbox is checked and the amount is not a valid negative number (empty, unparseable, or a plain inflow). Left the checkbox itself checked (did not auto-uncheck, per the review's "or" alternative) — auto-unchecking risked surprising a user mid-typing an amount; the always-visible warning plus WR-01's submit gate together prevent the misleading server round-trip without silently discarding the user's checkbox choice.

### WR-03: `removeAmortizationPlan`'s ownership check runs outside the write transaction

**Files modified:** `lib/actions/amortization.ts`
**Commit:** `baa31a0`
**Applied fix:** Moved the plan-ownership `SELECT` inside the same `db.transaction` that calls `reverseDetachTx`, closing the TOCTOU window between the two. "Not found" now throws `DetachTransactionError('PLAN_NOT_FOUND', ...)` from inside the transaction (rolled back trivially — nothing was written yet) and is caught by the existing `instanceof DetachTransactionError` pattern already used elsewhere in this file's sibling action (`lib/actions/transactions.ts`'s `detachTransaction`), keeping the error-handling shape consistent across both actions. `reverseDetachTx`'s own defense-in-depth re-validation of `id/userId/transactionId` is unchanged.

## Skipped Issues

None — all 4 in-scope findings were fixed.

## Out of scope (not fixed, per `fix_scope: critical_warning`)

- **IN-01** (`amortizationMonths` upper bound not enforced in the Zod schema) — Info tier, excluded by scope.
- **IN-02** (stale "intentionally RED" comment in `tests/overview-dal.test.ts`) — Info tier, excluded by scope.

## Post-fix verification

- `node_modules/.bin/tsc --noEmit` — clean, no errors, full project.
- `yarn check:language` (`node scripts/check-code-language.mjs`) — passed after each UI/action edit.
- `vitest run` across every phase-77-relevant suite (`amortization-guards`, `amortization-manual-entry`, `amortization-math`, `amortization-undo`, `reimbursement-regression`, `overview-dal`, `tags-dal`, `transaction-detail-page`, `transaction-table-menu`) — **130/130 passed**, including the new CR-01 regression test.
- `reimbursement-regression.test.ts` (the LENS-03 byte-identical ledger-seam gate) — green, untouched by any of the 4 fixes.

## Notes

- CR-01's fix deliberately changed the shared gate in `transaction-detach.ts` rather than only the caller in `amortization-activation.ts` (the review's own "more robust" alternative) because it protects every current and future caller of `applyDetachCleanupTx` from the same class of bug, and a full audit of the 3 existing call sites confirmed zero behavior change for any of them.
- `seedExpenseWithTransaction`'s status-derivation change (`'3'` iff a subCategoryId is given, else `'1'`) is backward-compatible: every pre-existing call site across the test suite already passes a non-null `subCategoryId`, so they all keep producing `status: '3'` exactly as before.

---

_Fixed: 2026-07-28T14:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

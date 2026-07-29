---
phase: 77-amortization-schema-and-activation
reviewed: 2026-07-28T11:43:34Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - components/transactions/activate-amortization-dialog.tsx
  - components/transactions/remove-amortization-dialog.tsx
  - components/transactions/transaction-detail-client.tsx
  - components/transactions/transaction-form-dialog.tsx
  - components/transactions/transaction-table.tsx
  - components/ui/checkbox.tsx
  - drizzle/migrations/0033_loud_layla_miller.sql
  - lib/actions/amortization.ts
  - lib/actions/transactions.ts
  - lib/dal/dashboard-filters.ts
  - lib/dal/dashboard.ts
  - lib/dal/overview.ts
  - lib/dal/tags.ts
  - lib/dal/transactions.ts
  - lib/db/schema.ts
  - lib/services/amortization-activation.ts
  - lib/services/amortization-guards.ts
  - lib/services/amortization-math.ts
  - lib/services/transaction-detach.ts
  - lib/utils/amortization-guard-messages.ts
  - lib/validations/amortization.ts
  - lib/validations/transactions.ts
  - tests/amortization-guards.test.ts
  - tests/amortization-manual-entry.test.ts
  - tests/amortization-math.test.ts
  - tests/amortization-undo.test.ts
  - tests/fixtures/reimbursement-seed.ts
  - tests/helpers/reimbursement-test-db.ts
  - tests/overview-dal.test.ts
  - tests/reimbursement-regression.test.ts
  - tests/tags-dal.test.ts
  - tests/transaction-detail-page.test.tsx
  - tests/transaction-table-menu.test.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 77: Code Review Report

**Reviewed:** 2026-07-28T11:43:34Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

The amortization money math (`amortization-math.ts`), the atomic activation/undo write paths
(`amortization-activation.ts`, `transaction-detach.ts`), the auth/ownership checks in
`lib/actions/amortization.ts` and `lib/actions/transactions.ts`, and the `ledger_entry_cash`
DAL seam (`dashboard.ts`/`overview.ts`/`tags.ts`) are all sound: every monetary operation goes
through `Decimal.js`, every write path is composed inside a single `db.transaction`, every
Server Action verifies session + scopes queries to `userId`, the D-09 reverse-detach hash
recomputation is correct, and the ledger-seam migration is proven byte-identical by a thorough
real-Postgres regression suite (`tests/reimbursement-regression.test.ts`).

However, tracing the actual value passed from `activatePlanTx` into `applyDetachCleanupTx`
surfaces one concrete, reachable data-integrity bug (CR-01 below): amortizing an **uncategorized**
outflow transaction silently marks the resulting Standalone Expense as "categorized" (`status:
'3'`) while leaving `subCategoryId` `null` — an invariant violation that hides the expense from
the "Da categorizzare" nudges and the uncategorized-count dashboard widget. This exact scenario
(amortizing a transaction whose expense has no subcategory) is not covered by any of the phase's
tests, which is why it slipped through — every fixture in `tests/fixtures/reimbursement-seed.ts`'s
`seedExpenseWithTransaction` requires a non-null `subCategoryId`.

Beyond that, a few client-side UX gaps around the create-transaction inline amortization checkbox
are worth tightening (WR-01/WR-02), and the Zod schema's months upper bound is only enforced at
the service layer rather than in `lib/validations/amortization.ts` as the stated convention
implies (IN-01) — functionally safe today, but worth reconciling with the convention or updating
the convention's wording.

## Critical Issues

### CR-01: Amortizing an uncategorized transaction mislabels the resulting Expense as "categorized"

**File:** `lib/services/amortization-activation.ts:99-104` (root cause), interacting with
`lib/services/transaction-detach.ts:103,116-119,132,138`

**Issue:**

`activatePlanTx` always calls `applyDetachCleanupTx` with an explicit `subCategoryId` key:

```ts
const detachResult = await applyDetachCleanupTx(tx, {
  userId: input.userId,
  transactionId: input.transactionId,
  title: row.customTitle?.trim() || row.description,
  subCategoryId: row.subCategoryId,   // <-- always present, value may be `null`
})
```

`row.subCategoryId` comes straight from `expense.subCategoryId` (line 74), which is a nullable
DB column: for an **uncategorized** transaction this is SQL `NULL`, deserialized by
node-postgres/Drizzle as JS `null` — not `undefined`.

`applyDetachCleanupTx`'s contract, however, gates on `undefined` specifically:

```ts
const hasSubCategoryId = input.subCategoryId !== undefined   // transaction-detach.ts:103
```

Because the caller always supplies the key (even with value `null`), `null !== undefined` is
`true`, so `hasSubCategoryId` is **always true** when called from `activatePlanTx` — regardless
of whether the original expense actually had a category. Both branches of
`applyDetachCleanupTx` then unconditionally write:

```ts
// single-transaction-source branch (line 116-119)
...(hasSubCategoryId ? { subCategoryId: input.subCategoryId, status: '3' as const } : {})
// -> { subCategoryId: null, status: '3' }  when the original expense was uncategorized

// multi-transaction-source branch (line 132, 138)
subCategoryId: hasSubCategoryId ? input.subCategoryId : null,   // null
status: hasSubCategoryId ? '3' : '1',                            // '3'  <-- wrong
```

The resulting Standalone Expense ends up with `subCategoryId: null, status: '3'` — an
inconsistent state that the rest of the codebase does not expect:

- `getUncategorizedCount` (`lib/dal/dashboard.ts`) filters on `status = '1' AND subCategoryId IS
  NULL` — this expense is silently excluded from the "uncategorized" dashboard widget even
  though it genuinely has no category.
- `isExpenseCategorized()` in `transaction-table.tsx` (`status === '2' || status === '3'`)
  returns `true`, so the row renders as already categorized (fallback text "Categorizzata" with
  no actual subcategory/category name shown, since both are `null`), and the amber "Da
  categorizzare" badge / "Categorizza spesa" menu entry (both gated on `expenseStatus === '1'`)
  never appear for this row.

This is reachable through the ordinary UI: create (or import) an outflow transaction without
picking a subcategory, then use the row's "Ammortizza" action — nothing in the D-04..D-07
eligibility guard requires the transaction to already be categorized.

This exact scenario is untested: every call site in
`tests/fixtures/reimbursement-seed.ts::seedExpenseWithTransaction` requires a non-null
`subCategoryId` argument, and `tests/amortization-undo.test.ts`'s only assertion on the resulting
status (`expect(newExpenseRows[0]?.status).toBe('3')`) is explicitly annotated "because a
subCategoryId was preserved" — i.e. it only proves the categorized path.

**Fix:** only pass `subCategoryId` through when it is actually set, e.g. in
`lib/services/amortization-activation.ts`:

```ts
const detachResult = await applyDetachCleanupTx(tx, {
  userId: input.userId,
  transactionId: input.transactionId,
  title: row.customTitle?.trim() || row.description,
  ...(row.subCategoryId != null ? { subCategoryId: row.subCategoryId } : {}),
})
```

(or, more robustly, change `applyDetachCleanupTx`'s gate to `input.subCategoryId != null` if no
caller ever needs to distinguish "omitted" from "explicitly null".) Add a regression test that
seeds an uncategorized outflow transaction (`subCategoryId: null`, `status: '1'`) and asserts the
resulting Standalone Expense keeps `subCategoryId: null, status: '1'` after `activatePlanTx`.

## Warnings

### WR-01: Create-transaction dialog does not gate submit on amortization-months validity

**File:** `components/transactions/transaction-form-dialog.tsx:335-338`

**Issue:** `ActivateAmortizationDialog`'s confirm button is disabled when
`!validation.valid` (`activate-amortization-dialog.tsx:196`), but the inline "Ammortizza questa
transazione" flow in the create-transaction dialog does not apply the same gate — the submit
button is only disabled by `isPending`:

```tsx
<Button type="submit" disabled={isPending}>
```

A user can check the amortization checkbox, leave the months field empty (or type an invalid
value), and submit; the request always round-trips to the server, which correctly rejects it via
`CreateTransactionSchema`'s `superRefine`, but the UX is inconsistent with the other amortization
entry point and wastes a request/response cycle per invalid attempt.

**Fix:** disable submit when `amortizationEnabled && isNegativeAmount && !monthsValidation.valid`,
mirroring `ActivateAmortizationDialog`'s own gate.

### WR-02: Checked-but-hidden amortization checkbox produces a misleading validation error

**File:** `components/transactions/transaction-form-dialog.tsx:120,269-288`

**Issue:** The months input (and its validation message) is only rendered when
`amortizationEnabled && isNegativeAmount` (line 269). If the user checks "Ammortizza questa
transazione" while the amount field is empty, unparseable, or non-negative (a plain inflow), the
months UI never appears, yet the hidden input `amortizationEnabled=on` still submits. Server-side,
`CreateTransactionSchema`'s `superRefine` only checks "did you supply `amortizationMonths`?", so
the user gets a generic "Minimo 2 mesi." error with no visible months field to explain it —
instead of the more accurate "Puoi ammortizzare solo transazioni in uscita." guard message that
`activatePlanTx`'s eligibility check would eventually produce anyway (after wastefully writing and
then rolling back the transaction insert).

**Fix:** surface an inline warning under the checkbox (or auto-uncheck it) when the amount is not
a valid negative number, instead of silently hiding the whole sub-form while leaving the checkbox
checked.

### WR-03: `removeAmortizationPlan`'s ownership check runs outside the write transaction

**File:** `lib/actions/amortization.ts:86-103`

**Issue:** The plan-ownership lookup (`db.select(...).where(planId, userId)`) executes as a
standalone query before the separate `db.transaction(...)` that calls `reverseDetachTx`. Between
the two, another request could delete the same plan (e.g. a duplicate "Rimuovi ammortamento"
click from a second tab), and the ownership check itself provides no atomicity guarantee — it is
purely an early-exit optimization. This is **not exploitable** as a security or correctness bug
because `reverseDetachTx` re-validates `id/userId/transactionId` inside the same transaction and
throws `PLAN_NOT_FOUND` if the row is gone by then (caught and turned into the generic error
message) — but the redundant round-trip and the split responsibility are worth tightening for
clarity.

**Fix:** either drop the standalone lookup and let `reverseDetachTx`'s own scoped lookup be the
single source of truth, or move both queries inside the same `db.transaction`.

## Info

### IN-01: `amortizationMonths` upper bound is not enforced in the Zod schema

**File:** `lib/validations/amortization.ts:7-10`, `lib/validations/transactions.ts:30-33`

**Issue:** Per project convention, "months field must be integer ≥ 2 and ≤ amount-in-cents;
Zod schemas in lib/validations/amortization.ts." Both `CreateAmortizationPlanSchema` and
`CreateTransactionSchema` only enforce `int().min(2)` — the upper bound (data-dependent, since it
requires the transaction amount) is enforced at runtime by `validateMonthsForAmount` inside
`activatePlanTx`, which is a legitimate design (the bound can't be a static Zod constraint without
also passing the amount into the schema), and defense-in-depth is real (server always
re-validates). Flagging only because the convention's wording suggests the bound should live in
the Zod schema — worth either encoding it via a schema-level `.refine()` that takes the amount, or
updating the convention's wording to describe the actual (safe) split of responsibilities.

### IN-02: Stale "intentionally RED" comment in overview-dal test file

**File:** `tests/overview-dal.test.ts:74-75`

**Issue:** `// These tests target lib/dal/overview.ts which does not exist yet. They are
intentionally RED (module not found) and will turn GREEN in plan 42-03.` — this is a leftover
TDD-scaffolding comment from Phase 42; `lib/dal/overview.ts` has existed and been actively
maintained (including this phase's own D-11 ledger-seam migration) for many phases since. Harmless
but misleading to a future reader.

**Fix:** delete the stale comment.

---

_Reviewed: 2026-07-28T11:43:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

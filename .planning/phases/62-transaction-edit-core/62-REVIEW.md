---
phase: 62-transaction-edit-core
reviewed: 2026-07-05T15:03:17Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - lib/actions/transaction-edit.ts
  - lib/dal/expenses.ts
  - lib/services/transaction-edit.ts
  - lib/validations/transaction-edit.ts
  - tests/expense-edit.test.ts
  - tests/transaction-edit.test.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 62: Code Review Report

**Reviewed:** 2026-07-05T15:03:17Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the transaction-edit vertical slice (action → service → validation) and the modified `updateExpense` DAL function, plus their test files. Core invariants claimed in the code's own docstrings — immutability of `transactionHash`/`descriptionHash`/`description`, ownership scoping, and the pair-guard — are implemented correctly and are well covered by tests.

No Critical/blocker-level defects were found: there is no active security vulnerability, data-loss path, or crash reachable through this diff given the current invariants elsewhere in the codebase (e.g. `transaction_pair` rows are guaranteed same-user by insert-time checks in `transaction-pairs.ts`). The issues found are real correctness/robustness gaps that degrade quality: an amount-validation regex gap lets malformed input reach `Decimal.js`/Postgres and leak a raw technical error message to the end user instead of the promised Italian message, a defense-in-depth ownership gap on the pair-counterpart lookup, a silent DAL failure with no logging, and a test coverage gap for a documented reconciliation path.

## Warnings

### WR-01: Amount validation accepts input that fails at Decimal/DB layer instead of at the Zod boundary

**File:** `lib/validations/transaction-edit.ts:6-16` (validated), `lib/actions/transaction-edit.ts:39` (fails)
**Issue:** The `amount` refine only checks `!Number.isNaN(Number(normalized)) && Number.isFinite(Number(normalized))`. `Number()` is more permissive than the Italian-decimal format the app intends to accept:
- Whitespace-padded strings pass `Number()` (which trims) but throw inside `new Decimal()`, e.g. `Number("  5  ")` is `5`, but `new Decimal("  5  ")` throws `DecimalError: Invalid argument`.
- Scientific notation passes, e.g. `"5e10"` → `Number("5e10")` is finite → `toDecimal("5e10")` → `toDbDecimal` produces `"50000000000.00"`, which overflows the `numeric(12,2)` `amount` column (max ~9,999,999,999.99) and will fail at the DB with a raw Postgres error.

Both failures happen inside the action's `try` block (`lib/actions/transaction-edit.ts:33-49`), whose `catch` is explicitly documented as existing to "reach the caller verbatim" the *service's* curated Italian messages (pair-guard/not-found/ownership). Because the same catch-all also swallows `DecimalError`s and Postgres overflow errors, malformed input results in a non-localized, technical error string being shown to the end user instead of a "Importo non valido." message — inconsistent with the file's own stated contract and with the product's language convention (user-facing messages must be Italian).
**Fix:** Tighten the refine to a strict numeric pattern that also normalizes/trims before checking, e.g.:
```ts
.refine(
  (v) => /^-?\d+([.,]\d{1,2})?$/.test(v.trim()),
  { message: 'Importo non valido.' },
)
```
and trim before `.replace(',', '.')` in the action. This rejects scientific notation, multi-comma inputs, and whitespace-only garbage at the validation boundary where the Italian message is actually shown.

### WR-02: Pair counterpart amount lookup is not scoped by userId

**File:** `lib/services/transaction-edit.ts:91-95`
**Issue:** The counterpart transaction lookup used by the pair guard queries by `transaction.id` only:
```ts
const counterRows = await tx
  .select({ amount: transaction.amount })
  .from(transaction)
  .where(eq(transaction.id, counterId))
  .limit(1)
```
This is inconsistent with the file's own documented invariant ("Ownership … is enforced by scoping the initial SELECT to both id and userId"). It is not currently exploitable as a cross-user read because `transaction_pair` has no `userId` column and pair creation (`lib/services/transaction-pairs.ts:103`) verifies both legs belong to the same user before insert — so `counterId` is guaranteed to belong to `input.userId` today. But this is an invariant borrowed from a different module; if pair-creation logic ever changes (e.g. an admin tool, a migration, a future bulk-pairing feature) this lookup silently starts reading another user's transaction amount with no defense-in-depth to catch it.
**Fix:** Scope defensively even though it's currently redundant:
```ts
const counterRows = await tx
  .select({ amount: transaction.amount })
  .from(transaction)
  .where(and(eq(transaction.id, counterId), eq(transaction.userId, input.userId)))
  .limit(1)
```

### WR-03: Amount value of exactly `0` always fails the pair guard with a possibly-confusing message

**File:** `lib/services/transaction-edit.ts:97-104`
**Issue:** `oppositeSign` requires strictly `gt(0)`/`lt(0)` on both sides. If a user edits a paired transaction's amount to `"0"` (or `"0,00"`), `newAmount.gt(0)` and `newAmount.lt(0)` are both `false`, so `oppositeSign` is `false` and the edit is rejected with "Scollega prima il rimborso" — even though the real problem is "amount can't be zero", not "unpair first". The Zod schema (`lib/validations/transaction-edit.ts:6-16`) does not reject `"0"` as an amount, so this is reachable.
**Fix:** Either reject a zero amount explicitly before the pair-guard check with a dedicated message ("L'importo non può essere zero."), or special-case zero inside the guard to surface a clearer error rather than reusing the unpair message.

### WR-04: Classification-history write failure in `updateExpense` is swallowed with no logging

**File:** `lib/dal/expenses.ts:387-401`
**Issue:**
```ts
if (typeof data.subCategoryId === 'number') {
  try {
    await writeClassificationHistory(tx, { ... })
  } catch {
    // history write failure is non-fatal
  }
}
```
The empty catch discards the error entirely — no `console.error`, no telemetry, nothing. If `writeClassificationHistory` starts failing systematically (e.g. a schema drift, a constraint violation), the categorization-history audit trail silently goes empty with zero operational signal, while the primary expense update still succeeds and reports success to the caller.
**Fix:** At minimum log the swallowed error so it's observable:
```ts
} catch (error) {
  console.error('writeClassificationHistory failed (non-fatal)', error)
}
```

## Info

### IN-01: No test coverage for `occurredAt`-only edits reconciling a linked expense

**File:** `tests/transaction-edit.test.ts:188-245` (DET-02 block)
**Issue:** The service explicitly reconciles the linked expense when `input.amount !== undefined || input.occurredAt !== undefined` (`lib/services/transaction-edit.ts:127`), but every DET-02 test in this file only exercises the `amount`-changed branch. No test verifies that editing `occurredAt` alone (no amount change) on a transaction linked to an expense triggers `loadAggregatesForExpenses`/`applyExpenseReconciliation` — relevant because `firstTransactionAt`/`lastTransactionAt` on the expense should track date edits too.
**Fix:** Add a case mirroring the existing "reconciles the linked expense aggregates after an amount edit" test but only supplying `occurredAt`, asserting the expense update chain still runs.

### IN-02: No dedicated schema test for `UpdateTransactionSchema` malformed-amount inputs

**File:** `lib/validations/transaction-edit.ts`, `tests/transaction-edit.test.ts`
**Issue:** There is no test file directly exercising `UpdateTransactionSchema.safeParse` with edge-case strings (whitespace, scientific notation, multiple separators, leading/trailing junk) — the only test coverage of "amount" is through the service layer with already-clean strings like `'-75.00'`. This gap is what let WR-01 go undetected.
**Fix:** Add a small schema-level test file (or a section in `transaction-edit.test.ts`) asserting `safeParse` fails for `"5e10"`, `"  5  "`, `"1,2,3"`, `"1.234,56"`, and passes only for the intended Italian-decimal shapes.

---

_Reviewed: 2026-07-05T15:03:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

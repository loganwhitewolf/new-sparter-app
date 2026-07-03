---
quick_id: 260703-gwa
slug: pairing-a-refund-cleans-up-its-expense-i
branch: gsd/quick-refund-pair-cleanup
type: quick
status: complete
completed: 2026-07-03
tasks_completed: 4
commits:
  - 1ac70b2  # Task 1 — extract applyDetachCleanupTx core
  - 7d4fdcb  # Task 2 — wire refund cleanup into createPair
  - 27804d6  # Task 3 — repaint refund row after pairing
  - 3816800  # Task 4 — service tests + regression guards
key-files:
  modified:
    - lib/services/transaction-detach.ts
    - lib/services/transaction-pairs.ts
    - lib/actions/transaction-pairs.ts
    - components/transactions/counterpart-picker-dialog.tsx
    - components/transactions/transaction-table.tsx
    - tests/transaction-detach-service.test.ts
    - tests/transaction-pairs-service.test.ts
---

# Quick Task 260703-gwa: Pairing a refund cleans up its expense — Summary

Pairing a transaction as a refund now categorizes and isolates the refund's expense under the refunded spend's subcategory (synthetic descriptionHash, status '3'), reusing the v2.4 detach cleanup logic inside `createPair`'s transaction — and the refund row repaints as categorized without a manual reload.

## What shipped

- **Task 1 (`1ac70b2`)** — Extracted `applyDetachCleanupTx(tx, input)` from `detachTransactionToDedicatedExpense`: a `DbOrTx`-accepting core holding the title guard, the 1:1 re-hash-in-place branch, and the multi-transaction new-expense + reconcile branch. The public function is now a thin `db.transaction` wrapper. Pure extraction — result shape, error codes, hash/status logic, and the reconcile call are unchanged.
- **Task 2 (`7d4fdcb`)** — `createPair` now selects each leg's `expenseId` and, after the pair insert and inside the same transaction, loads the primary (refunded spend) expense. When the primary is categorized (`subCategoryId` not null) and the secondary has its own distinct expense, it calls `applyDetachCleanupTx` with the primary's title + subCategoryId targeting the secondary (refund). Donor-uncategorized, same-expense, and missing-secondary-expense cases skip cleanup (decision 2). Primary/secondary resolution, opposite-sign, ownership, and 23505 handling are untouched.
- **Task 3 (`27804d6`)** — UI repaint fix (see below).
- **Task 4 (`3816800`)** — Added refund-cleanup service tests and regression guards (see Verification).

## Task 3: the refund row did NOT repaint — fix was needed

Traced from the code (dev server out of scope). Confirmed the plan's hypothesis:

- `TransactionTable` holds `loadedTransactions` via `useState(transactions)` with no prop-sync effect (its only `useEffect` is the infinite-scroll `IntersectionObserver`).
- Pair creation had no optimistic path: `CounterpartPickerDialog` was rendered without any success callback, and `createTransactionPairAction` returned only `{ error: null }`, then closed the dialog with a toast.
- `revalidatePath('/transactions')` does not reset the client component's local `useState`, so the refund row stayed "Da categorizzare" until a full reload.

**Fix applied (server as source of truth for resolution):**
1. `createPair` now returns `{ secondaryTransactionId, inheritedSubCategoryId? }` (`inheritedSubCategoryId` is `undefined` when the gate skipped).
2. `createTransactionPairAction` surfaces those via an `ActionState`-compatible `CreatePairActionState` (`pairedSecondaryId`, `pairedSubCategoryId` — optional, so existing callers and the `{ error: null }` initial state still type-check).
3. `CounterpartPickerDialog` gained an optional `onPaired` callback, fired on successful submit with the server payload.
4. `TransactionTable` wires `onPaired` -> `markExpenseCategorized(secondaryTransactionId, String(subCategoryId))` on the refund leg, only when a subcategory was inherited. When the donor was uncategorized, the refund row is left untouched.

This mirrors the existing detach flow's `markExpensesCategorized` (subCategoryId -> category/subcategory chip names).

## Verification

Full gate run at completion:

- `yarn test tests/transaction-pairs-service.test.ts tests/transaction-detach-service.test.ts` -> 45 passed.
- `yarn test` (full suite) -> 1222 passed, 7 failed — all 7 in pre-existing unrelated files: `expense-actions`, `import-table-actions`, `overview-interactions` (in the known pre-existing list; untouched by this work).
- `npx tsc --noEmit` -> 27 errors, all in unrelated pre-existing files (`suggestion-promote-form`, `transactions-dal`, `overview-interactions`, `cascade-options`, `category-combobox`, `file-download-api`, `suggestion-card`). Zero errors in any file touched here.
- `yarn lint` -> 5 errors, all in untouched files (`overview-nudge`, `expense-transactions-dialog`, `sidebar-provider(.test)`, `detach-expense-dialog`), confirmed unchanged vs base. The only warnings on touched files are pre-existing (`getAmountFormatter` unused, `_payload` unused).
- `yarn check:language` -> 4 failures, all in untouched pre-existing files (`bulk-categorize-dialog`, `expense-uncategorized-cta`, `expenses.ts`, `transactions.ts`).

### New test coverage (Task 4)
- **pairs-service:** 1:1 inherit path asserts `applyDetachCleanupTx` called once with `{ userId, transactionId: secondaryId, title, subCategoryId }`; not called for donor-uncategorized (pair still inserted), same-expense, and missing-secondary-expense; resolution still targets the refund (secondary) when initiated from the smaller-|amount| leg and on an |amount| tie (earlier `occurredAt` primary); opposite-sign and ownership guards skip cleanup.
- **detach-service:** `applyDetachCleanupTx` exercised directly with a mock tx handle — 1:1 re-hash in place (synthetic hash + subCategoryId + status '3', no insert/reconcile); multi-tx inserts a new dedicated expense (status '3', synthetic hash, count 1) and reconciles the source; empty title rejects before any write.
- **unpair regression:** `deletePairByTransactionId` never invokes the detach cleanup (decision 4 — no revert).

## Deviations from plan

**One deviation, resolved inline (deviation Rule 3 — language gate as a blocking issue):**
The two new English code comments embedded the Italian domain phrase "spesa a sé", which `scripts/check-code-language.mjs` flags (Italian term "spesa" + accented "é" in a developer comment — the checker has no domain-term allowlist for comments). Rephrased both comments to the English domain term "standalone expense". No behavioral change.

No other deviations. All four locked decisions honored: isolate + inherit (1), donor-uncategorized skips (2), title inherits from the spend's expense (3), unpair does not revert (4). No backfill of existing pairs — future pairings only.

## Constraints honored

- Monetary comparisons in `createPair` continue to use `Decimal.js` (`toDecimal`) — no native arithmetic added.
- The refund cleanup runs inside `createPair`'s existing `db.transaction`; `applyDetachCleanupTx` accepts a `DbOrTx`.
- DAL / services / actions layering preserved; server resolves primary/secondary.
- Developer strings/comments English; Italian only in product/UI copy.

## Self-Check: PASSED
- All modified files present on disk.
- All 4 task commits exist in git log (`1ac70b2`, `7d4fdcb`, `27804d6`, `3816800`).

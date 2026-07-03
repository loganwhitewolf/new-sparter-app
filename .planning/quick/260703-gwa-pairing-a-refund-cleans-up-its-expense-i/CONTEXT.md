# Quick Task Context — Pairing a refund cleans up its expense

## Problem
When the user links a transaction as a **refund** (`transaction_pair`, Phase 50),
the refund transaction's Expense stays `status '1'` → "da categorizzare",
cluttering the UI. `createPair` only inserts the 1:1 link + drives `effectiveAmount`
netting; it does **not** categorize. Per CONTEXT.md:113 a refund is categorized
under the **same subcategory as the spend it offsets** (ADR 0004 netting-by-subcategory).

## Domain (CONTEXT.md)
- **Refund** = a credit that cancels a specific spend → not income; inherits the
  spend's subcategory and nets by algebraic sum. The 1:1 pairing is optional, "un
  di più sopra il netting", not the categorization mechanism.
- **Standalone Expense ("spesa a sé")** cleanup = give a 1-transaction expense a
  synthetic `descriptionHash` (`sha256("detached:{id}")`) so it's excluded from
  descriptionHash aggregation and Tier 2 learning. Exactly the cleanup wanted here.

## Locked decisions (user, 2026-07-03)
1. **Mechanism — isolate + inherit (like "spesa a sé").** On pairing, run the
   detach-style cleanup on the **refund** expense: synthetic hash + inherit the
   **refunded spend's subcategory** + `status '3'` (categorized). 1:1 → re-hash in
   place; multi-transaction → new dedicated expense. Reuse the v2.4 detach logic.
2. **Donor uncategorized → skip.** Only auto-categorize when the refunded spend
   (the primary) has a `subCategoryId`. If it's null, leave the refund untouched
   (no isolation, no status change) — no worse than today.
3. **Title — inherit the refunded spend's expense title.**
4. **Unpair — no revert.** `deletePairByTransactionId` stays as-is: unlinking only
   restores netting/effectiveAmount (v2.0). The inherited subcategory + synthetic
   hash persist.

## Donor / receiver identification
`createPair` resolves **primary = larger |amount|, tie-break earlier `occurredAt`**;
secondary otherwise. For a refund-of-spend this makes:
- **primary = the refunded spend** (donor of the subcategory + title),
- **secondary = the refund** (receiver of the cleanup).
This holds because a refund never exceeds the spend it offsets (full refund → equal
amount → earlier date = the spend = primary). Cleanup targets `secondaryId`,
inheriting from `primaryId`'s expense.

## Implementation shape
- **Refactor `lib/services/transaction-detach.ts`**: extract a tx-accepting core,
  e.g. `applyDetachCleanupTx(tx, { userId, transactionId, title, subCategoryId })`,
  containing the current 1:1-in-place / multi-new-expense + reconcile logic. The
  public `detachTransactionToDedicatedExpense` wraps it in `db.transaction`. Project
  hard rule: ownership-validating writes run inside `db.transaction`; helpers accept
  a tx.
- **`lib/services/transaction-pairs.ts` → `createPair`**: after resolving
  `primaryId`/`secondaryId`, inside the SAME `db.transaction`, load the primary's
  expense (`subCategoryId`, `title`) via join transaction→expense on `primaryId`.
  If `subCategoryId !== null` AND `secondary.expenseId !== primary.expenseId`
  (defensive), call `applyDetachCleanupTx(tx, { userId, transactionId: secondaryId,
  title: primaryExpenseTitle, subCategoryId: primaryExpenseSubCategoryId })`.
  Otherwise skip (decision 2).
- **UI**: verify the pairing success path (`lib/actions/transaction-pairs.ts` +
  `components/transactions/counterpart-picker-dialog.tsx` /
  `transaction-pair-popover.tsx` / `transaction-table.tsx`) reflects the refund
  row's now-categorized status. If it relies on `revalidatePath`/`router.refresh`,
  confirm it repaints; if it uses optimistic local state, update the refund row's
  status/subcategory chip (mirror the detach flow's `markExpensesCategorized`).

## Verification
- Unit/service tests mirroring `tests/transaction-detach-*.test.ts` +
  `tests/transaction-pairs*.test.ts`:
  - 1:1 refund → refund expense gets primary's subcategory, synthetic hash, status '3'.
  - multi-transaction refund expense → new dedicated expense with the subcategory,
    source reconciled.
  - primary (spend) uncategorized → refund expense untouched (status/hash unchanged).
  - primary/secondary resolution unchanged; opposite-sign + ownership guards intact.
  - unpair leaves the inherited subcategory in place.
- `yarn test`, `npx tsc --noEmit` (no `typecheck` script), `yarn lint`, `yarn check:language`.

## Constraints
- Monetary values via `Decimal.js`; all writes inside `db.transaction`.
- Layers: DAL / services / actions. Dev strings English; Italian only for product copy.
- Do NOT change the netting/aggregation math or the unpair baseline behavior.

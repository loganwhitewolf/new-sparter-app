---
phase: 76-reimbursements-section
reviewed: 2026-07-27T12:50:19Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - app/(app)/reimbursements/[id]/page.tsx
  - app/(app)/reimbursements/page.tsx
  - components/layout/sidebar.tsx
  - components/reimbursements/reimbursement-detail-client.tsx
  - components/reimbursements/reimbursement-table.tsx
  - components/reimbursements/reimbursement-title-edit.tsx
  - components/transactions/reimbursement-panel.tsx
  - components/transactions/reimbursement-row-indicator.tsx
  - components/transactions/transaction-detail-client.tsx
  - components/transactions/transaction-table.tsx
  - lib/actions/reimbursement.ts
  - lib/dal/reimbursement.ts
  - lib/dal/transactions.ts
  - lib/routes.ts
  - lib/services/reimbursement.ts
  - lib/services/transaction-pairs.ts
  - lib/utils/reimbursement-format.ts
  - lib/utils/reimbursements-table-config.ts
  - lib/utils/table-config.ts
  - lib/validations/reimbursement.ts
  - tests/reimbursement-detail-dal.test.ts
  - tests/reimbursement-list.test.ts
  - tests/reimbursement-table-sort.test.ts
  - tests/transaction-pairs-service.test.ts
  - tests/transaction-table-menu.test.tsx
  - tests/transactions-dal.test.ts
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 76: Code Review Report

**Reviewed:** 2026-07-27T12:50:19Z
**Depth:** standard
**Files Reviewed:** 24 (of 25 listed — `tests/transactions-dal.test.ts` spot-checked for the reimbursement-relevant assertions only, not read in full given its size)
**Status:** issues_found

## Summary

The `/reimbursements` list + detail surfaces, the transactions-table row indicator, and the panel/service layer underneath them are well-factored: money math consistently goes through `Decimal.js` (`deriveResidualFromAggregates`, `sortReimbursementRows`, the invariant module), every read/write path is IDOR-scoped on `userId` in the same query (never a post-fetch check), and `updateReimbursementTitle` correctly re-validates ownership inside its own `UPDATE ... WHERE` clause. `getReimbursementPanelDataById` sharing its assembly tail with `getReimbursementPanelData` (RMB-11 "can never numerically diverge") is a good design choice and is proven by a real-Postgres equality test.

The two UAT-gap fixes called out for verification are each **half-fixed**:

- **Gap #2** (refund title no longer rewritten at link time) is correct and well-tested — `createPairTx`'s cleanup branch now keeps `refundExpenseSnapshot?.title ?? ''` verbatim and the service test asserts the exact title passed to `applyDetachCleanupTx`. No issue found here.
- **Gap #1** (`onGone` navigates to `/reimbursements` instead of `router.refresh()`-ing into a 404) fixes the 404 but introduces a new correctness gap: none of the mutation actions the new `onGone` path depends on (`deleteReimbursementAction`, `removeRefundAction`/`deleteTransactionPairAction`, `createMultiRefundAction`) revalidate `/reimbursements` or `/reimbursements/[id]`, unlike `updateReimbursementTitleAction`, which does both. See CR-01 below.

Separately, tracing `deletePairByTransactionId`'s anchor-side unlink branch against its own doc comment surfaced a genuine data-loss bug predating this phase but living in a file under review (`lib/services/transaction-pairs.ts`): unlinking the *anchor* transaction never restores any linked refund's pre-link baseline, unlike every other removal path in the same file. See CR-02 below.

## Critical Issues

### CR-01: Deleting/removing a refund or reimbursement never revalidates `/reimbursements` — the UAT-gap-#1 fix can land the user on a stale list

**File:** `lib/actions/transaction-pairs.ts:136-163` (`deleteTransactionPairAction`, aliased as `removeRefundAction`), `:184-211` (`deleteReimbursementAction`), `:227-261` (`createMultiRefundAction`), `:52-86` (`createTransactionPairAction`)

**Issue:** All four mutation actions call `revalidatePath('/transactions')` and `revalidatePath('/overview')` only. None of them revalidate `APP_ROUTES.reimbursements` (`/reimbursements`) or the per-id `reimbursementHref(id)` route — even though every one of them writes to the `reimbursement` / `reimbursement_refund` tables that back those two pages. Compare with `lib/actions/reimbursement.ts:49-50`, which correctly calls both:
```ts
revalidatePath(reimbursementHref(parsed.data.reimbursementId))
revalidatePath(APP_ROUTES.reimbursements)
```
`revalidatePath` is what purges Next.js's **client-side Router Cache** for a path (not just the server Full Route Cache) — per Next.js's own actions/mutating-data guidance, every action that changes data shown on a route must revalidate that route. Because the sidebar (`components/layout/sidebar.tsx:48`) renders a `<Link href={APP_ROUTES.reimbursements}>` on literally every authenticated page — including `/reimbursements/[id]` itself — Next.js's default `<Link>` prefetch means `/reimbursements` is very likely already sitting in the client Router Cache by the time a user is on the detail page.

Concretely, this reproduces the exact flow UAT gap #1 was meant to fix:
1. User opens `/reimbursements/[id]` (sidebar link to `/reimbursements` prefetches in the background).
2. User clicks "Elimina rimborso" → `deleteReimbursementAction` succeeds → `onGone()` fires → `router.push(APP_ROUTES.reimbursements)`.
3. `deleteReimbursementAction` never revalidated `/reimbursements`, so the push can be satisfied from the stale prefetched Router Cache entry — the just-deleted reimbursement is still rendered in the list the user was just redirected to.

The same gap applies to `removeRefundAction` (unlinking the last refund, the other `onGone` trigger) and to `createMultiRefundAction` (adding a refund from `/reimbursements/[id]` via `RefundPickerDialog` — the residual/refund-list on `/reimbursements/[id]` itself self-heals via `router.refresh()`, but the `/reimbursements` list row's residual/state goes stale until the cache naturally expires or another mutation happens to revalidate it), and to `createTransactionPairAction` (the "Collega rimborso" quick action in the transactions table, which can create a brand-new reimbursement that never appears — or appears with stale data — on `/reimbursements` until something else revalidates it).

**Fix:** Add the two missing `revalidatePath` calls to every mutation in `lib/actions/transaction-pairs.ts` that can affect `reimbursement`/`reimbursement_refund` state, mirroring `lib/actions/reimbursement.ts`:
```ts
import { APP_ROUTES, reimbursementHref } from '@/lib/routes'

// inside deleteTransactionPairAction / deleteReimbursementAction / createMultiRefundAction / createTransactionPairAction,
// after the existing revalidatePath('/transactions') / revalidatePath('/overview'):
revalidatePath(APP_ROUTES.reimbursements)
// deleteReimbursementAction / createMultiRefundAction / deleteTransactionPairAction additionally know the
// reimbursementId (or can resolve it from the result) — revalidate the specific detail route too where available:
revalidatePath(reimbursementHref(reimbursementId))
```

---

### CR-02: Unlinking the anchor transaction never restores linked refunds' pre-link baseline — contradicts this function's own doc comment and permanently discards the restore snapshot

**File:** `lib/services/transaction-pairs.ts:615-628` (`deletePairByTransactionId`, anchor-side branch)

**Issue:** The function's doc comment (lines 546-557) states:

> Restores baseline regardless of whether the transaction is the anchor or a refund side (PAIR-03 unlink-restores-baseline): [...] Unlinking the anchor removes the reimbursement row (cascades its reimbursement_refund rows via ON DELETE CASCADE).

But the anchor-side branch does exactly that and nothing more:
```ts
if (row.expenseId) {
  const anchorRows = await tx
    .select({ id: reimbursement.id })
    .from(reimbursement)
    .where(eq(reimbursement.expenseId, row.expenseId))
    .limit(1)

  const anchorRow = anchorRows[0]
  if (anchorRow) {
    // Anchor side: removing the reimbursement cascades its
    // reimbursement_refund rows via ON DELETE CASCADE (D-03 FK).
    await tx.delete(reimbursement).where(eq(reimbursement.id, anchorRow.id))
  }
}
```
There is no loop over the reimbursement's linked refunds and no call to `restoreRefundBaseline` before the delete — unlike the sibling "delete the whole reimbursement" action (`deleteReimbursementForAnchor`, `lib/services/transaction-pairs.ts:644-675`), which explicitly does:
```ts
for (const { transactionId } of refundRows) {
  await restoreRefundBaseline(tx, { refundTransactionId: transactionId, userId: input.userId })
}
await tx.delete(reimbursement).where(...)
```
Because `reimbursement_refund` cascades on `reimbursement` delete, and `reimbursement_refund_snapshot` cascades on `reimbursement_refund` delete (`lib/db/schema.ts:622-625`), the `DELETE FROM reimbursement` in the anchor-side branch destroys every linked refund's D-10 pre-link snapshot **before it is ever applied**. Every refund transaction that had its expense recategorized/isolated by `applyDetachCleanupTx` at link time (decision 2) is left permanently stuck in that recategorized state — with no snapshot left to restore from, ever — even though the reimbursement itself no longer exists.

This is reachable in production: the transactions-table row menu's "Scollega" item (`components/transactions/transaction-table.tsx:628-639`, wired to `handleUnpair` → `deleteTransactionPairAction` → `deletePairByTransactionId`) is shown for **any** row with `pairedWithId` set — including the anchor's own row, not just refund rows. Clicking "Scollega" on the anchor row of a reimbursement with N>1 linked refunds silently and permanently strands all N refund expenses in their post-cleanup categorization, with the reimbursement gone and no audit trail.

The existing test suite doesn't catch this: `tests/transaction-pairs-service.test.ts`'s anchor-side-unlink tests (`describe('unlink-restores-baseline — anchor side', ...)`, lines ~1007-1076) only assert `deletedTables` has length 1 — they never seed a refund with a snapshot and assert it gets restored, so the gap between the doc comment's guarantee and the actual code is untested.

**Fix:** Mirror `deleteReimbursementForAnchor`'s restore loop in the anchor-side branch, before the delete:
```ts
if (row.expenseId) {
  const anchorRows = await tx
    .select({ id: reimbursement.id })
    .from(reimbursement)
    .where(eq(reimbursement.expenseId, row.expenseId))
    .limit(1)

  const anchorRow = anchorRows[0]
  if (anchorRow) {
    const linkedRefundRows = await tx
      .select({ transactionId: reimbursementRefund.transactionId })
      .from(reimbursementRefund)
      .where(eq(reimbursementRefund.reimbursementId, anchorRow.id))

    for (const { transactionId } of linkedRefundRows) {
      await restoreRefundBaseline(tx, { refundTransactionId: transactionId, userId: input.userId })
    }

    await tx.delete(reimbursement).where(eq(reimbursement.id, anchorRow.id))
  }
}
```
(Alternatively, have `deletePairByTransactionId`'s anchor branch delegate to `deleteReimbursementForAnchor`'s restore-then-delete core directly, so the two callers can never drift again.)

## Warnings

### WR-01: Residual/status label text duplicated across two files with divergent copy

**File:** `components/transactions/reimbursement-panel.tsx:75-87` (`formatResidualLabel`, `stateBadgeLabel`) vs. `lib/utils/reimbursement-format.ts:23-45` (`formatResidualBadgeLabel`, `residualBadgeClassName`)

**Issue:** Two near-identical formatters compute the same `residual + state → Italian label` mapping but with different wording: `formatResidualLabel` → `"Ancora dovuti €N"` / `"Surplus di €N"`, while `formatResidualBadgeLabel` → `"Dovuti €N"` / `"Surplus €N"`. `reimbursement-panel.tsx` additionally has its own local `stateBadgeLabel` (`"Da saldare"` / `"Saldato"` / `"Surplus"`) that duplicates `formatResidualBadgeLabel`'s badge text a third time with yet another wording (`"Da saldare"` vs `"Dovuti €N"`). If the product copy for one state changes, three call sites in two files need to change in lockstep, and nothing enforces that.

**Fix:** Consolidate on the `lib/utils/reimbursement-format.ts` helpers (already imported and used by `reimbursement-table.tsx` and `reimbursement-detail-client.tsx`) and delete the two local duplicates in `reimbursement-panel.tsx`, or — if the different wording per surface is intentional — leave an explicit comment in both files cross-referencing the other so a future edit doesn't silently diverge.

### WR-02: `updateReimbursementTitleAction` stores an untrimmed title verbatim

**File:** `lib/validations/reimbursement.ts:8-11`, `lib/actions/reimbursement.ts:38-42`

**Issue:** `UpdateReimbursementTitleSchema.title` is `z.string().max(255)` with no `.trim()`, and `updateReimbursementTitleAction` passes `parsed.data.title` straight to `updateReimbursementTitle` unmodified. A user who submits `"   "` (whitespace-only) gets that literal string persisted to `reimbursement.title` in the DB. Every current read path happens to trim before display (`resolveReimbursementDisplayTitle`'s `title.trim() || anchorTitle`), so this is currently invisible in the UI, but it leaves the raw column holding non-canonical data that any future direct read of `reimbursement.title` (an export, an admin view, a different formatter) would surface as visible whitespace instead of falling back to the anchor title.

**Fix:** Either `.trim()` in the Zod schema (`z.string().trim().max(255)`) or trim explicitly in the action before the DAL call, so the stored value and the D-03 fallback semantics stay in sync at the source of truth, not only at every read site.

### WR-03: `formatSignedAmount` silently coerces a non-finite residual to €0.00 instead of surfacing it

**File:** `components/reimbursements/reimbursement-table.tsx:28-31`

**Issue:**
```ts
function formatSignedAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0)
}
```
If `row.residual` (a server-computed Decimal-string) were ever malformed, this renders `"0,00 €"` — which reads as a legitimately settled reimbursement — rather than surfacing the bad value. The project's own shared `formatAbsoluteAmount` (`lib/utils/format-amount.ts:34-40`) takes the opposite, more debuggable stance on the same class of input: it returns the raw string back (`` `${amount} ${currency}` ``) so a malformed value is visibly wrong rather than silently masked as zero.

**Fix:** Match `formatAbsoluteAmount`'s fallback convention (return the raw string, or at minimum log/report) instead of defaulting to `0`, so a genuine upstream bug in residual computation doesn't get hidden behind a plausible-looking "Saldato"-shaped amount.

## Info

### IN-01: `pairedNetAmount`'s anchor amount and `getReimbursementAggregates`'s `outflowSum` can diverge for a multi-transaction anchor Expense

**File:** `lib/dal/transactions.ts:212-229` (`pairedNetAmount` subquery) vs. `lib/dal/reimbursement.ts:57-89` (`getReimbursementAggregates`)

**Issue:** `pairedNetAmount` sums `t_anchor.amount` — the single earliest transaction of the anchor Expense — plus the refund sum, while `getReimbursementAggregates`/`computeReimbursementResidual`/`getReimbursementList` (the values actually shown on the new `/reimbursements` surfaces) sum the anchor Expense's own `total_amount` (the aggregate across every transaction under that Expense, per `expense.transactionCount`) plus the refund sum. For an anchor Expense with `transactionCount > 1` these two are not the same number. This predates Phase 76 (the field existed since Phase 73) and is not rendered anywhere in the files under review in this phase (`pairedNetAmount` is only threaded through client-side optimistic-update plumbing in `transaction-table.tsx`, not displayed), so it's out of scope to fix here — noted for awareness in case a future surface starts rendering `pairedNetAmount` directly.

---

_Reviewed: 2026-07-27T12:50:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

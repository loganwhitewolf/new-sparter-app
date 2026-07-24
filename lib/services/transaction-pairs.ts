import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  expense,
  reimbursement,
  reimbursementAnchorTransaction,
  reimbursementRefund,
  transaction,
} from '@/lib/db/schema'
import {
  assertInflowRefundAmount,
  assertOutflowAnchorAmount,
} from '@/lib/services/reimbursement-invariant'
import { applyDetachCleanupTx } from '@/lib/services/transaction-detach'
import { toDecimal } from '@/lib/utils/decimal'

/**
 * Extract the Postgres SQLSTATE error code from a Drizzle/pg error's `cause`.
 * Returns '' when no code is present. Used to detect unique-constraint
 * violations (23505) and surface a localized message (WR-03).
 */
function errorCauseCode(error: unknown): string {
  const cause =
    typeof error === 'object' && error !== null && 'cause' in error
      ? (error as { cause?: unknown }).cause
      : undefined

  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return ''
  }

  const code = (cause as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

/**
 * Create a reimbursement link between two transactions (e.g. expense ↔ refund).
 *
 * Security (D-01 / T-50-01): reimbursement/reimbursement_refund carry no
 * per-row ownership check of their own beyond the `userId` column on
 * `reimbursement` itself. This function is the sole ownership gate: it
 * verifies BOTH transactions belong to `input.userId` before any insert.
 *
 * Anchor resolution (D-02, Phase 73, ADR 0018 — repoints Phase 50's D-10):
 * the transaction with the NEGATIVE amount is always the anchor (the outflow
 * being refunded); the positive-amount transaction is always the refund. This
 * is a SIGN-based resolution, not the old magnitude-based (`|amount|`)
 * primary/secondary tie-break — that old rule could pick the wrong side under
 * D-02 (e.g. a refund larger than its spend would have been "primary").
 * `assertOutflowAnchorAmount`/`assertInflowRefundAmount` (73-02) are enforced
 * as defense-in-depth on top of the sign-based resolution itself.
 */
export type CreatePairResult = {
  /** The resolved secondary (refund) transaction id — used by the UI to repaint the row. */
  secondaryTransactionId: string
  /** The subcategory inherited by the refund expense, or undefined when the refund
   *  cleanup was skipped (donor uncategorized / defensive skip — decision 2). */
  inheritedSubCategoryId?: number
}

export async function createPair(input: {
  userId: string
  transactionId: string
  counterpartId: string
}): Promise<CreatePairResult> {
  // 0. Self-pair guard (CR-01): a transaction cannot be paired with itself.
  //    The picker UI excludes self, but the action reads counterpartId from raw
  //    FormData, so the only reliable enforcement point is here. A (X, X) pair
  //    would pass both unique constraints and then double X's own amount in
  //    every netting aggregation.
  if (input.transactionId === input.counterpartId) {
    throw new Error('Non puoi collegare una transazione a se stessa.')
  }

  // The full read-then-write must be atomic (project hard rule: ownership-validating
  // writes run inside db.transaction). reimbursement/reimbursement_refund carry no
  // per-row ownership column beyond reimbursement.userId, so the read-then-write
  // relies on the ownership read — that read and the write must not be separated
  // by a window in which another request mutates the rows (CR-02).
  return db.transaction(async (tx): Promise<CreatePairResult> => {
    // 1. Load both transaction rows — select only the columns needed for ownership
    //    check, sign validation, and anchor/refund resolution.
    const [rowsA, rowsB] = await Promise.all([
      tx
        .select({
          id: transaction.id,
          amount: transaction.amount,
          occurredAt: transaction.occurredAt,
          userId: transaction.userId,
          expenseId: transaction.expenseId,
        })
        .from(transaction)
        .where(eq(transaction.id, input.transactionId))
        .limit(1),
      tx
        .select({
          id: transaction.id,
          amount: transaction.amount,
          occurredAt: transaction.occurredAt,
          userId: transaction.userId,
          expenseId: transaction.expenseId,
        })
        .from(transaction)
        .where(eq(transaction.id, input.counterpartId))
        .limit(1),
    ])

    const t1 = rowsA[0]
    const t2 = rowsB[0]

    if (!t1 || !t2) {
      throw new Error('Transazione non trovata.')
    }

    // 2. Ownership check — IDOR block (T-50-01).
    //    Both transactions must belong to the session user.
    if (t1.userId !== input.userId || t2.userId !== input.userId) {
      throw new Error('Non sei autorizzato a collegare queste transazioni.')
    }

    // 3. Opposite-sign enforcement (CR-03): a pair only makes economic sense when the
    //    two legs net against each other (e.g. expense ↔ reimbursement). Same-sign or
    //    zero-amount legs would inflate totals instead of netting. Decimal.js comparison
    //    (gt/lt 0) treats 0 as neither positive nor negative, so a €0 leg is rejected.
    const d1 = toDecimal(t1.amount)
    const d2 = toDecimal(t2.amount)
    const oppositeSign = (d1.gt(0) && d2.lt(0)) || (d1.lt(0) && d2.gt(0))
    if (!oppositeSign) {
      throw new Error('Le transazioni da collegare devono avere segno opposto.')
    }

    // 4. Resolve anchor/refund by SIGN, not |amount| magnitude (D-02, Phase 73):
    //    the negative leg is always the anchor (outflow), the positive leg is
    //    always the refund (inflow) — this retires the old magnitude-based
    //    primary/secondary tie-break, which could pick the wrong side under D-02.
    //    Steps 2-3 already guarantee exactly one leg is negative and one positive.
    const anchor = d1.lt(0) ? t1 : t2
    const refund = d1.lt(0) ? t2 : t1

    // Defense-in-depth (73-02's D-02 invariant module) on top of the sign
    // resolution above — never re-implement these checks inline.
    assertOutflowAnchorAmount(anchor.amount)
    assertInflowRefundAmount(refund.amount)

    // 5. Look up the anchor's Expense — required both to populate the
    //    reimbursement's title/expenseId (D-03 anchor XOR requires a non-null
    //    expenseId; Expense-Group anchors are Phase 74 scope) and, further below,
    //    to drive the refund-cleanup categorization inherit (decision 2, unrelated
    //    to this task's behavior change).
    const anchorExpenseRows = await tx
      .select({
        expenseId: expense.id,
        subCategoryId: expense.subCategoryId,
        title: expense.title,
      })
      .from(transaction)
      .innerJoin(expense, eq(transaction.expenseId, expense.id))
      .where(
        and(
          eq(transaction.id, anchor.id),
          eq(transaction.userId, input.userId),
          eq(expense.userId, input.userId),
        ),
      )
      .limit(1)

    const anchorExpense = anchorExpenseRows[0]

    if (!anchorExpense) {
      // A reimbursement cannot exist without a non-null anchor (D-03 XOR CHECK);
      // an orphaned transaction (expenseId set null via a prior expense deletion,
      // per 73-01-SUMMARY.md's known limitation) can never anchor one.
      throw new Error('La transazione da rimborsare non è associata a nessuna spesa.')
    }

    // 6. Insert the reimbursement (anchor) + reimbursement_refund (refund) rows.
    //    Unique constraints on reimbursement.expenseId (partial, non-null) and
    //    reimbursement_refund.transactionId enforce D-02/D-03 cardinality and
    //    surface a thrown error for T-50-02. The raw Postgres unique-violation
    //    (code 23505) leaks internal constraint names in English; translate it
    //    to a localized message (WR-03) so the Italian UI never shows DB internals.
    try {
      const insertedReimbursement = await tx
        .insert(reimbursement)
        .values({
          userId: input.userId,
          title: anchorExpense.title,
          expenseId: anchorExpense.expenseId,
        })
        .returning({ id: reimbursement.id })

      await tx.insert(reimbursementRefund).values({
        reimbursementId: insertedReimbursement[0].id,
        transactionId: refund.id,
      })

      // D-08 (Phase 75) — freeze the anchor transaction into the frozen anchored-transaction
      // set UNCONDITIONALLY, on every createPair call (Pitfall 3: never skip this because
      // "there's only one transaction anyway" — that's exactly how N=1 misses the fix).
      // effectiveAmount()'s Expense-anchor branch resolves its member set EXCLUSIVELY from this
      // table, so a later same-merchant import reusing anchor.expenseId is never recorded here
      // and can never inherit a share of this reimbursement's refunds.
      await tx.insert(reimbursementAnchorTransaction).values({
        reimbursementId: insertedReimbursement[0].id,
        transactionId: anchor.id,
      })
    } catch (e) {
      if (errorCauseCode(e) === '23505') {
        throw new Error('Una delle transazioni è già collegata a un’altra.')
      }
      throw e
    }

    // 7. Refund cleanup (decision 2, UNRELATED to this task's behavior change —
    //    kept exactly as-is): categorize the refund expense under the refunded
    //    spend's subcategory, isolating it as a standalone expense via the
    //    detach cleanup core — inside this same transaction. Only when the
    //    anchor has a categorized expense (subCategoryId not null) and the
    //    refund has its own distinct expense. If the anchor is uncategorized,
    //    the refund is left untouched.
    const refundExpenseId = refund.expenseId

    if (
      anchorExpense.subCategoryId !== null &&
      refundExpenseId &&
      refundExpenseId !== anchorExpense.expenseId
    ) {
      // Compose the refund title as "{refund's own title} — rimborso {spend title}"
      // so the refund row keeps the sender's name and reads as a refund of that
      // specific spend, instead of looking like a duplicate of the original spend.
      const refundExpenseRows = await tx
        .select({ title: expense.title })
        .from(transaction)
        .innerJoin(expense, eq(transaction.expenseId, expense.id))
        .where(
          and(
            eq(transaction.id, refund.id),
            eq(transaction.userId, input.userId),
            eq(expense.userId, input.userId),
          ),
        )
        .limit(1)

      const refundOwnTitle = refundExpenseRows[0]?.title?.trim() ?? ''
      const refundTitle = refundOwnTitle
        ? `${refundOwnTitle} — rimborso ${anchorExpense.title}`
        : `Rimborso ${anchorExpense.title}`

      await applyDetachCleanupTx(tx, {
        userId: input.userId,
        transactionId: refund.id,
        title: refundTitle,
        subCategoryId: anchorExpense.subCategoryId,
      })

      return {
        secondaryTransactionId: refund.id,
        inheritedSubCategoryId: anchorExpense.subCategoryId,
      }
    }

    return { secondaryTransactionId: refund.id }
  })
}

/**
 * Remove a reimbursement link by either transaction in it (anchor or refund).
 *
 * Security (D-01 / T-50-01): verifies the transaction belongs to `input.userId`
 * before deleting. Restores baseline regardless of whether the transaction is
 * the anchor or a refund side (PAIR-03 unlink-restores-baseline):
 *  - Unlinking a refund removes its reimbursement_refund row; if it was the
 *    reimbursement's only refund, also removes the now-empty reimbursement row.
 *  - Unlinking the anchor removes the reimbursement row (cascades its
 *    reimbursement_refund rows via ON DELETE CASCADE).
 */
export async function deletePairByTransactionId(input: {
  userId: string
  transactionId: string
}): Promise<void> {
  // Ownership read and the delete must be atomic (CR-02): reimbursement/
  // reimbursement_refund carry no per-row ownership column beyond
  // reimbursement.userId, so the unscoped delete is only safe when no other
  // request can mutate the row between the ownership check and the delete.
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ userId: transaction.userId, expenseId: transaction.expenseId })
      .from(transaction)
      .where(eq(transaction.id, input.transactionId))
      .limit(1)

    const row = rows[0]
    if (!row || row.userId !== input.userId) {
      throw new Error('Non sei autorizzato a scollegare questa transazione.')
    }

    // Resolve role: is this transaction a refund (reimbursement_refund), or does
    // it resolve to an anchor (its expense_id matches some reimbursement's
    // expenseId)? A transaction can only ever be one or the other (or unpaired).
    const refundRows = await tx
      .select({
        id: reimbursementRefund.id,
        reimbursementId: reimbursementRefund.reimbursementId,
      })
      .from(reimbursementRefund)
      .where(eq(reimbursementRefund.transactionId, input.transactionId))
      .limit(1)

    const refundRow = refundRows[0]

    if (refundRow) {
      // Refund side: remove this refund row.
      await tx.delete(reimbursementRefund).where(eq(reimbursementRefund.id, refundRow.id))

      // If this was the reimbursement's ONLY refund, remove the now-empty
      // reimbursement row too (unlink-restores-baseline, PAIR-03).
      const remainingRows = await tx
        .select({ id: reimbursementRefund.id })
        .from(reimbursementRefund)
        .where(eq(reimbursementRefund.reimbursementId, refundRow.reimbursementId))
        .limit(1)

      if (remainingRows.length === 0) {
        await tx.delete(reimbursement).where(eq(reimbursement.id, refundRow.reimbursementId))
      }

      return
    }

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
  })
}

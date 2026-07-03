import 'server-only'

import { and, eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expense, transaction, transactionPair } from '@/lib/db/schema'
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
 * Create a 1:1 transaction pair (e.g. expense ↔ reimbursement).
 *
 * Security (D-01 / T-50-01): transaction_pair has no userId column.
 * This function is the sole ownership gate: it verifies BOTH transactions
 * belong to `input.userId` before any insert.
 *
 * Primary resolution (D-10): the transaction with the larger |amount| becomes
 * transactionAId (primary). On equal |amount|, earlier occurredAt is primary.
 * The silent swap handles the case where the user initiates from the
 * smaller-amount side.
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
  // writes run inside db.transaction). transaction_pair has no userId column, so the
  // delete/insert relies on the ownership read — that read and the write must not be
  // separated by a window in which another request mutates the rows (CR-02).
  return db.transaction(async (tx): Promise<CreatePairResult> => {
    // 1. Load both transaction rows — select only the columns needed for ownership
    //    check, sign validation, and primary resolution.
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

    // 4. Determine primary by |amount| via Decimal.js — never native arithmetic.
    //    Larger |amount| = primary. Tie-break: earlier occurredAt = primary.
    const abs1 = d1.abs()
    const abs2 = d2.abs()

    let primaryId: string
    let secondaryId: string

    if (abs1.gt(abs2)) {
      primaryId = t1.id
      secondaryId = t2.id
    } else if (abs2.gt(abs1)) {
      primaryId = t2.id
      secondaryId = t1.id
    } else {
      // Equal |amounts|: earlier occurredAt is primary (the order precedes the refund).
      const date1 = new Date(t1.occurredAt)
      const date2 = new Date(t2.occurredAt)
      if (date1 <= date2) {
        primaryId = t1.id
        secondaryId = t2.id
      } else {
        primaryId = t2.id
        secondaryId = t1.id
      }
    }

    // 5. Insert pair. Unique constraints on transactionAId and transactionBId
    //    enforce D-02 (1:1 cardinality) and surface a thrown error for T-50-02.
    //    The raw Postgres unique-violation (code 23505) leaks internal constraint
    //    names in English; translate it to a localized message (WR-03) so the
    //    Italian UI never shows DB internals.
    try {
      await tx.insert(transactionPair).values({
        transactionAId: primaryId,
        transactionBId: secondaryId,
      })
    } catch (e) {
      if (errorCauseCode(e) === '23505') {
        throw new Error('Una delle transazioni è già collegata a un’altra.')
      }
      throw e
    }

    // 6. Refund cleanup (decision 2): categorize the refund (secondary) expense
    //    under the refunded spend's (primary's) subcategory, isolating it as a
    //    standalone expense via the detach cleanup core — inside this same
    //    transaction. Only when the primary has a categorized expense
    //    (subCategoryId not null) and the secondary has its own distinct expense.
    //    If the primary is uncategorized, the refund is left untouched.
    const secondaryExpenseId = secondaryId === t1.id ? t1.expenseId : t2.expenseId

    const primaryExpenseRows = await tx
      .select({
        expenseId: expense.id,
        subCategoryId: expense.subCategoryId,
        title: expense.title,
      })
      .from(transaction)
      .innerJoin(expense, eq(transaction.expenseId, expense.id))
      .where(
        and(
          eq(transaction.id, primaryId),
          eq(transaction.userId, input.userId),
          eq(expense.userId, input.userId),
        ),
      )
      .limit(1)

    const primaryExpense = primaryExpenseRows[0]

    if (
      primaryExpense &&
      primaryExpense.subCategoryId !== null &&
      secondaryExpenseId &&
      secondaryExpenseId !== primaryExpense.expenseId
    ) {
      // Compose the refund title as "{refund's own title} — rimborso {spend title}"
      // so the refund row keeps the sender's name and reads as a refund of that
      // specific spend, instead of looking like a duplicate of the original spend.
      const secondaryExpenseRows = await tx
        .select({ title: expense.title })
        .from(transaction)
        .innerJoin(expense, eq(transaction.expenseId, expense.id))
        .where(
          and(
            eq(transaction.id, secondaryId),
            eq(transaction.userId, input.userId),
            eq(expense.userId, input.userId),
          ),
        )
        .limit(1)

      const refundOwnTitle = secondaryExpenseRows[0]?.title?.trim() ?? ''
      const refundTitle = refundOwnTitle
        ? `${refundOwnTitle} — rimborso ${primaryExpense.title}`
        : `Rimborso ${primaryExpense.title}`

      await applyDetachCleanupTx(tx, {
        userId: input.userId,
        transactionId: secondaryId,
        title: refundTitle,
        subCategoryId: primaryExpense.subCategoryId,
      })

      return {
        secondaryTransactionId: secondaryId,
        inheritedSubCategoryId: primaryExpense.subCategoryId,
      }
    }

    return { secondaryTransactionId: secondaryId }
  })
}

/**
 * Remove a transaction pair by either transaction in the pair.
 *
 * Security (D-01 / T-50-01): verifies the transaction belongs to `input.userId`
 * before deleting. Removes the pair regardless of whether the transaction is
 * the primary (A) or secondary (B) side (PAIR-03 unlink-restores-baseline).
 */
export async function deletePairByTransactionId(input: {
  userId: string
  transactionId: string
}): Promise<void> {
  // Ownership read and the delete must be atomic (CR-02): transaction_pair has no
  // userId column, so the unscoped delete is only safe when no other request can
  // mutate the row between the ownership check and the delete.
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ userId: transaction.userId })
      .from(transaction)
      .where(eq(transaction.id, input.transactionId))
      .limit(1)

    const row = rows[0]
    if (!row || row.userId !== input.userId) {
      throw new Error('Non sei autorizzato a scollegare questa transazione.')
    }

    // Delete the pair on whichever FK side this transaction appears.
    await tx
      .delete(transactionPair)
      .where(
        or(
          eq(transactionPair.transactionAId, input.transactionId),
          eq(transactionPair.transactionBId, input.transactionId),
        ),
      )
  })
}

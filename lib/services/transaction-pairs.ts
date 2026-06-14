import 'server-only'

import { eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transaction, transactionPair } from '@/lib/db/schema'
import { toDecimal } from '@/lib/utils/decimal'

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
export async function createPair(input: {
  userId: string
  transactionId: string
  counterpartId: string
}): Promise<void> {
  // 1. Load both transaction rows — select only the columns needed for ownership
  //    check and primary resolution.
  const [rowsA, rowsB] = await Promise.all([
    db
      .select({
        id: transaction.id,
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
        userId: transaction.userId,
      })
      .from(transaction)
      .where(eq(transaction.id, input.transactionId))
      .limit(1),
    db
      .select({
        id: transaction.id,
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
        userId: transaction.userId,
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

  // 3. Determine primary by |amount| via Decimal.js — never native arithmetic.
  //    Larger |amount| = primary. Tie-break: earlier occurredAt = primary.
  const abs1 = toDecimal(t1.amount).abs()
  const abs2 = toDecimal(t2.amount).abs()

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

  // 4. Insert pair. Unique constraints on transactionAId and transactionBId
  //    enforce D-02 (1:1 cardinality) and surface a thrown error for T-50-02.
  await db.insert(transactionPair).values({
    transactionAId: primaryId,
    transactionBId: secondaryId,
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
  // Ownership check before delete.
  const rows = await db
    .select({ userId: transaction.userId })
    .from(transaction)
    .where(eq(transaction.id, input.transactionId))
    .limit(1)

  const tx = rows[0]
  if (!tx || tx.userId !== input.userId) {
    throw new Error('Non sei autorizzato a scollegare questa transazione.')
  }

  // Delete the pair on whichever FK side this transaction appears.
  await db
    .delete(transactionPair)
    .where(
      or(
        eq(transactionPair.transactionAId, input.transactionId),
        eq(transactionPair.transactionBId, input.transactionId),
      ),
    )
}

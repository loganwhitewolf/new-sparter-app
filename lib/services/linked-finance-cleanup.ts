import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import {
  amortizationPlan,
  reimbursement,
  reimbursementAnchorTransaction,
  reimbursementRefund,
} from '@/lib/db/schema'
import { reverseOpenPlanReduceForRefundUnlinkTx } from '@/lib/services/amortization-plan-amount'
import { restoreRefundsAndDeleteReimbursement } from '@/lib/services/transaction-pairs'

/**
 * Before hard-deleting transactions: tear down amortization plans and reimbursements that
 * would otherwise orphan.
 *
 * Why application-level (not only FK):
 * - `amortization_plan` cascades from transaction, but deleting an *expense* while keeping
 *   its transactions leaves the plan alive (instalments may cascade via expenseId).
 * - `reimbursement` is keyed on expense/group, not the anchor transaction — deleting the
 *   anchor tx removes `reimbursement_anchor_transaction` rows but leaves the reimbursement.
 * - Partial-refund reduce must be reversed when only the refund disappears and the plan stays.
 */
export async function cleanupFinanceLinksForTransactions(
  database: DbOrTx,
  input: { userId: string; transactionIds: string[] },
): Promise<void> {
  const transactionIds = [...new Set(input.transactionIds)]
  if (transactionIds.length === 0) return

  // Whole reimbursements anchored by any of these transactions (restore baselines + delete).
  const anchored = await database
    .select({ reimbursementId: reimbursementAnchorTransaction.reimbursementId })
    .from(reimbursementAnchorTransaction)
    .innerJoin(reimbursement, eq(reimbursement.id, reimbursementAnchorTransaction.reimbursementId))
    .where(
      and(
        eq(reimbursement.userId, input.userId),
        inArray(reimbursementAnchorTransaction.transactionId, transactionIds),
      ),
    )

  const anchoredReimbursementIds = [...new Set(anchored.map((row) => row.reimbursementId))]
  for (const reimbursementId of anchoredReimbursementIds) {
    await restoreRefundsAndDeleteReimbursement(database, {
      reimbursementId,
      userId: input.userId,
    })
  }

  // Refund-only deletes: reverse open-plan reduce for refunds still linked (not already
  // removed with their reimbursement above).
  const remainingRefunds = await database
    .select({ transactionId: reimbursementRefund.transactionId })
    .from(reimbursementRefund)
    .where(inArray(reimbursementRefund.transactionId, transactionIds))

  for (const { transactionId } of remainingRefunds) {
    await reverseOpenPlanReduceForRefundUnlinkTx(database, {
      userId: input.userId,
      refundTransactionId: transactionId,
    })
  }

  // Plans on these transactions (explicit — also covers expense-kept orphans via the expense helper).
  await database
    .delete(amortizationPlan)
    .where(
      and(
        eq(amortizationPlan.userId, input.userId),
        inArray(amortizationPlan.transactionId, transactionIds),
      ),
    )
}

/**
 * Before hard-deleting expenses: remove reimbursements on those expenses and amortization
 * plans for still-linked transactions (even when transactions are kept with expenseId null).
 */
export async function cleanupFinanceLinksForExpenses(
  database: DbOrTx,
  input: { userId: string; expenseIds: string[]; linkedTransactionIds: string[] },
): Promise<void> {
  const expenseIds = [...new Set(input.expenseIds)]
  if (expenseIds.length === 0) return

  const reimbursementRows = await database
    .select({ id: reimbursement.id })
    .from(reimbursement)
    .where(and(eq(reimbursement.userId, input.userId), inArray(reimbursement.expenseId, expenseIds)))

  for (const { id } of reimbursementRows) {
    await restoreRefundsAndDeleteReimbursement(database, {
      reimbursementId: id,
      userId: input.userId,
    })
  }

  // Plans live on transactions — drop them whenever the expense side is removed.
  if (input.linkedTransactionIds.length > 0) {
    await database
      .delete(amortizationPlan)
      .where(
        and(
          eq(amortizationPlan.userId, input.userId),
          inArray(amortizationPlan.transactionId, input.linkedTransactionIds),
        ),
      )
  }
}

/** After deletes: remove reimbursements that no longer have any refund row. */
export async function deleteEmptyReimbursementsForUser(
  database: DbOrTx,
  userId: string,
): Promise<void> {
  await database.execute(sql`
    DELETE FROM reimbursement r
    WHERE r.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM reimbursement_refund rr WHERE rr.reimbursement_id = r.id
      )
  `)
}

import 'server-only'

import { randomUUID } from 'node:crypto'
import type Decimal from 'decimal.js'
import { and, asc, eq, gte, sql } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import {
  amortizationInstalment,
  amortizationPlan,
  reimbursementAnchorTransaction,
  reimbursementRefund,
  transaction,
} from '@/lib/db/schema'
import { materializeInstalments } from '@/lib/services/amortization-math'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

type OpenPlanAmount = {
  id: string
  totalAmount: string
}

/** Start (local midnight, day 1) of the calendar month containing `now()`. */
function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

async function loadFutureInstalments(
  tx: DbOrTx,
  input: { planId: string; boundaryMonthStart: Date },
) {
  return tx
    .select({
      id: amortizationInstalment.id,
      instalmentNumber: amortizationInstalment.instalmentNumber,
      amount: amortizationInstalment.amount,
      occurredAt: amortizationInstalment.occurredAt,
      expenseId: amortizationInstalment.expenseId,
    })
    .from(amortizationInstalment)
    .where(
      and(
        eq(amortizationInstalment.planId, input.planId),
        gte(amortizationInstalment.occurredAt, input.boundaryMonthStart),
      ),
    )
    .orderBy(asc(amortizationInstalment.occurredAt))
}

/**
 * Applies a signed Decimal delta to an open plan's totalAmount and re-spreads future
 * instalments (current calendar month onward). Used by:
 * - `reducePlanTx` with the refund's signed amount (inflow positive → shrinks outflow base)
 * - unlink reverse with the negated refund amount (restores the pre-reduce schedule)
 *
 * Does NOT create/delete reimbursement rows — callers own pairing.
 */
export async function applySignedDeltaToOpenPlanTx(
  tx: DbOrTx,
  input: {
    userId: string
    plan: OpenPlanAmount
    signedDelta: Decimal
    boundaryMonthStart?: Date
  },
): Promise<{
  newTotalAmount: string
  reSpreadInstalments: Array<{ id: string; instalmentNumber: number; amount: string; occurredAt: Date }>
}> {
  const boundaryMonthStart = input.boundaryMonthStart ?? startOfCurrentMonth()
  const newTotalAmount = toDecimal(input.plan.totalAmount).plus(input.signedDelta)

  const futureInstalments = await loadFutureInstalments(tx, {
    planId: input.plan.id,
    boundaryMonthStart,
  })

  if (futureInstalments.length === 0) {
    await tx
      .update(amortizationPlan)
      .set({ totalAmount: toDbDecimal(newTotalAmount), updatedAt: new Date() })
      .where(eq(amortizationPlan.id, input.plan.id))

    return { newTotalAmount: toDbDecimal(newTotalAmount), reSpreadInstalments: [] }
  }

  const remainingSumSigned = futureInstalments.reduce(
    (acc, instalment) => acc.plus(toDecimal(instalment.amount)),
    toDecimal('0'),
  )
  const newFutureSum = remainingSumSigned.plus(input.signedDelta)

  await tx
    .delete(amortizationInstalment)
    .where(
      and(
        eq(amortizationInstalment.planId, input.plan.id),
        gte(amortizationInstalment.occurredAt, boundaryMonthStart),
      ),
    )

  const cancelledCount = futureInstalments.length
  const earliestCancelled = futureInstalments[0]!
  const minInstalmentNumber = Math.min(
    ...futureInstalments.map((instalment) => instalment.instalmentNumber),
  )

  const reSpread = materializeInstalments(
    toDbDecimal(newFutureSum),
    earliestCancelled.occurredAt,
    cancelledCount,
  )

  const rowsToInsert = reSpread.map((instalment, index) => ({
    id: randomUUID(),
    userId: input.userId,
    planId: input.plan.id,
    instalmentNumber: minInstalmentNumber + index,
    expenseId: earliestCancelled.expenseId,
    amount: instalment.amount,
    occurredAt: instalment.date,
  }))

  await tx.insert(amortizationInstalment).values(rowsToInsert)

  await tx
    .update(amortizationPlan)
    .set({ totalAmount: toDbDecimal(newTotalAmount), updatedAt: new Date() })
    .where(eq(amortizationPlan.id, input.plan.id))

  return {
    newTotalAmount: toDbDecimal(newTotalAmount),
    reSpreadInstalments: rowsToInsert.map((row) => ({
      id: row.id,
      instalmentNumber: row.instalmentNumber,
      amount: row.amount,
      occurredAt: row.occurredAt,
    })),
  }
}

/**
 * When unlinking a refund that was applied via `reducePlanTx`, restore the open plan's
 * totalAmount + future instalments. No-op when:
 * - the refund is not linked
 * - the anchor has no open amortization plan
 * - plan.totalAmount still equals the original outflow (manual pair without reduce — don't
 *   invent a reverse that would inflate the schedule)
 *
 * Closed plans (realize/close) are intentionally left alone — reversing a collapse needs a
 * dedicated undo path.
 */
export async function reverseOpenPlanReduceForRefundUnlinkTx(
  tx: DbOrTx,
  input: { userId: string; refundTransactionId: string },
): Promise<boolean> {
  const refundRows = await tx
    .select({
      amount: transaction.amount,
      reimbursementId: reimbursementRefund.reimbursementId,
      ownerId: transaction.userId,
    })
    .from(reimbursementRefund)
    .innerJoin(transaction, eq(transaction.id, reimbursementRefund.transactionId))
    .where(eq(reimbursementRefund.transactionId, input.refundTransactionId))
    .limit(1)

  const refund = refundRows[0]
  if (!refund || refund.ownerId !== input.userId) return false

  const anchorRows = await tx
    .select({ transactionId: reimbursementAnchorTransaction.transactionId })
    .from(reimbursementAnchorTransaction)
    .where(eq(reimbursementAnchorTransaction.reimbursementId, refund.reimbursementId))

  for (const anchor of anchorRows) {
    const planRows = await tx
      .select({
        id: amortizationPlan.id,
        totalAmount: amortizationPlan.totalAmount,
        transactionId: amortizationPlan.transactionId,
      })
      .from(amortizationPlan)
      .where(
        and(
          eq(amortizationPlan.transactionId, anchor.transactionId),
          eq(amortizationPlan.userId, input.userId),
          eq(amortizationPlan.status, 'open'),
        ),
      )
      .limit(1)

    const plan = planRows[0]
    if (!plan) continue

    const originalTxRows = await tx
      .select({ amount: transaction.amount })
      .from(transaction)
      .where(eq(transaction.id, plan.transactionId))
      .limit(1)

    const originalAmount = originalTxRows[0]?.amount
    // Manual pair without reducePlanTx leaves plan.totalAmount === original outflow.
    if (originalAmount !== undefined && toDecimal(plan.totalAmount).equals(toDecimal(originalAmount))) {
      return false
    }

    await applySignedDeltaToOpenPlanTx(tx, {
      userId: input.userId,
      plan: { id: plan.id, totalAmount: plan.totalAmount },
      signedDelta: toDecimal(refund.amount).negated(),
    })
    return true
  }

  return false
}

/**
 * Repairs open plans left in a reduced state after a pre-fix unlink (reimbursement gone,
 * instalments still netted). Safe heuristic: open plan whose totalAmount diverges from the
 * original outflow AND has no live reimbursement on the anchor. Returns how many plans healed.
 */
export async function healOrphanedOpenPlanReduceDriftsForUser(
  database: DbOrTx,
  userId: string,
): Promise<number> {
  const drifted = await database.execute(sql`
    SELECT
      p.id AS plan_id,
      p.total_amount AS plan_total,
      t.amount AS original_amount
    FROM amortization_plan p
    INNER JOIN transaction t ON t.id = p.transaction_id
    WHERE p.user_id = ${userId}
      AND p.status = 'open'
      AND p.total_amount::numeric <> t.amount::numeric
      AND NOT EXISTS (
        SELECT 1
        FROM reimbursement_anchor_transaction rat
        WHERE rat.transaction_id = p.transaction_id
      )
  `)

  const rows = drifted.rows as Array<{
    plan_id: string
    plan_total: string
    original_amount: string
  }>

  let healed = 0
  for (const row of rows) {
    const signedDelta = toDecimal(row.original_amount).minus(toDecimal(row.plan_total))
    if (signedDelta.isZero()) continue

    await applySignedDeltaToOpenPlanTx(database, {
      userId,
      plan: { id: row.plan_id, totalAmount: row.plan_total },
      signedDelta,
    })
    healed += 1
  }

  return healed
}

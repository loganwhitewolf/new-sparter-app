import 'server-only'

import { and, eq } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import {
  amortizationPlan,
  expenseGroupMembership,
  reimbursement,
  reimbursementRefund,
  transaction as transactionTable,
} from '@/lib/db/schema'
import { minimumTwoMonthInstalment, validateMonthsForAmount } from '@/lib/services/amortization-math'
import { toDecimal } from '@/lib/utils/decimal'
import type { AmortizationGuardFailure } from '@/lib/utils/amortization-guard-messages'

export type AmortizationEligibility =
  | { eligible: true }
  | ({ eligible: false } & AmortizationGuardFailure)

/**
 * D-04..D-07 + outflow-only eligibility guard (Phase 77). Checks run in a fixed order —
 * reimbursement -> already-amortized -> expense-group -> not-outflow -> too-small —
 * short-circuiting on the first failure, matching the UI-SPEC's "one specific reason each"
 * tooltip contract. When the transaction itself cannot be found for this user, returns
 * `{ eligible: true }` — "not found" is a distinct failure mode surfaced by the caller's own
 * transaction load (activatePlanTx / applyDetachCleanupTx), not an eligibility concern.
 */
export async function getAmortizationEligibility(
  tx: DbOrTx,
  input: { userId: string; transactionId: string },
): Promise<AmortizationEligibility> {
  const rows = await tx
    .select({
      amount: transactionTable.amount,
      expenseId: transactionTable.expenseId,
    })
    .from(transactionTable)
    .where(
      and(eq(transactionTable.id, input.transactionId), eq(transactionTable.userId, input.userId)),
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    return { eligible: true }
  }

  // reimbursement (D-04): the transaction IS a refund row, or its expense is a reimbursement
  // anchor (expenseId match — Group-anchor reimbursements resolve via expenseGroupId, which an
  // individual transaction's expenseId never matches directly, so no separate check is needed
  // here beyond D-06's own expense-group guard below).
  const refundRows = await tx
    .select({ id: reimbursementRefund.id })
    .from(reimbursementRefund)
    .where(eq(reimbursementRefund.transactionId, input.transactionId))
    .limit(1)
  if (refundRows.length > 0) {
    return { eligible: false, reason: 'reimbursement' }
  }

  if (row.expenseId) {
    const anchorRows = await tx
      .select({ id: reimbursement.id })
      .from(reimbursement)
      .where(eq(reimbursement.expenseId, row.expenseId))
      .limit(1)
    if (anchorRows.length > 0) {
      return { eligible: false, reason: 'reimbursement' }
    }
  }

  // already-amortized (D-05)
  const planRows = await tx
    .select({ id: amortizationPlan.id })
    .from(amortizationPlan)
    .where(eq(amortizationPlan.transactionId, input.transactionId))
    .limit(1)
  if (planRows.length > 0) {
    return { eligible: false, reason: 'already-amortized' }
  }

  // expense-group (D-06)
  if (row.expenseId) {
    const membershipRows = await tx
      .select({ id: expenseGroupMembership.id })
      .from(expenseGroupMembership)
      .where(eq(expenseGroupMembership.expenseId, row.expenseId))
      .limit(1)
    if (membershipRows.length > 0) {
      return { eligible: false, reason: 'expense-group' }
    }
  }

  // not-outflow (ADR 0019 SS2, Claude's discretion — see 77-01-PLAN.md task 3 <action> rationale):
  // the transaction's own signed amount is the authoritative, always-available outflow signal —
  // no subCategory->nature->direction join, so an uncategorized transaction is never silently
  // blocked from a check that requires categorization it does not yet have.
  if (!toDecimal(row.amount).isNegative()) {
    return { eligible: false, reason: 'not-outflow' }
  }

  // too-small (D-07): even the minimum accepted plan duration (N=2) must be possible.
  const minValidation = validateMonthsForAmount(row.amount, 2)
  if (!minValidation.valid) {
    return {
      eligible: false,
      reason: 'too-small',
      requiredPerMonth: minimumTwoMonthInstalment(row.amount),
    }
  }

  return { eligible: true }
}

import 'server-only'

import { getReimbursementAggregates } from '@/lib/dal/reimbursement'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

export type ReimbursementResidualState = 'owed' | 'settled' | 'surplus'

export type ReimbursementResidual = {
  residual: string
  state: ReimbursementResidualState
}

/**
 * Computes a reimbursement's residual (D-03, RMB-06): `Σoutflow + Σ(refunds linked so far)`,
 * derived on the fly from `getReimbursementAggregates()` — NEVER a stored column, no schema
 * footprint, no write-back of the computed value into any table.
 *
 * Sign convention (D-03):
 *  - negative -> `state: 'owed'` — money still owed ("ancora dovuti €N").
 *  - zero     -> `state: 'settled'` — saldato, the exact boundary.
 *  - positive -> `state: 'surplus'` — refunds exceeded the outflow. Never blocked, never throws
 *    — surplus is a real, surfaced state, not an error (D-03 adds no magnitude guard; the
 *    sign-only invariant in lib/services/reimbursement-invariant.ts is unaffected).
 *
 * All arithmetic goes through toDecimal()/toDbDecimal() (Decimal.js) — never native +/- on the
 * DECIMAL-as-string values Drizzle returns (CLAUDE.md).
 *
 * Returns `undefined` when the reimbursement doesn't exist or is not owned by `userId` (IDOR-safe
 * by construction, inherited from getReimbursementAggregates()'s WHERE-clause scoping).
 */
export async function computeReimbursementResidual(input: {
  reimbursementId: number
  userId: string
}): Promise<ReimbursementResidual | undefined> {
  const aggregates = await getReimbursementAggregates(input)
  if (!aggregates) {
    return undefined
  }

  const residual = toDecimal(aggregates.outflowSum).plus(toDecimal(aggregates.refundSum))
  const state: ReimbursementResidualState = residual.lt(0)
    ? 'owed'
    : residual.eq(0)
      ? 'settled'
      : 'surplus'

  return { residual: toDbDecimal(residual), state }
}

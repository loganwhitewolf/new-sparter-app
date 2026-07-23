import 'server-only'

import { toDecimal } from '@/lib/utils/decimal'

/**
 * D-02 invariant enforcement (RMB-03, Phase 73, ADR 0018): a reimbursement's anchor must
 * always be an outflow (a negative amount) — a reimbursement group is defined by its spend,
 * never by an inflow. Zero is rejected too: it is neither an outflow nor an inflow, same
 * CR-03 convention as the existing opposite-sign check in lib/services/transaction-pairs.ts.
 *
 * Pure validation — no DB access, no side effects. This module is consumed by Plan 73-04's
 * repointed `createPair` as defense-in-depth alongside the DB-level XOR/uniqueness
 * constraints; do not duplicate this check elsewhere, reuse it.
 */
export function assertOutflowAnchorAmount(amount: string): void {
  if (!toDecimal(amount).lt(0)) {
    throw new Error('L’importo della spesa da rimborsare deve essere un’uscita.')
  }
}

/**
 * D-02 invariant enforcement (RMB-03): every transaction linked as a reimbursement refund
 * must be an inflow (a positive amount). Zero is rejected — same CR-03 convention.
 */
export function assertInflowRefundAmount(amount: string): void {
  if (!toDecimal(amount).gt(0)) {
    throw new Error('L’importo del rimborso deve essere un’entrata.')
  }
}

/**
 * Validates a full reimbursement input shape in one call: the anchor's amount and every
 * linked refund's amount. Any single bad refund in a multi-refund set is rejected outright —
 * never silently dropped from the set.
 */
export function assertReimbursementAmounts(input: {
  anchorAmount: string
  refundAmounts: string[]
}): void {
  assertOutflowAnchorAmount(input.anchorAmount)
  for (const refundAmount of input.refundAmounts) {
    assertInflowRefundAmount(refundAmount)
  }
}

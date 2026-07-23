// D-02 invariant enforcement unit tests (Phase 73 Plan 02, RMB-03).
//
// Pure, dependency-free module — no DB, no mocks needed. Mirrors the opposite-sign convention
// in lib/services/transaction-pairs.ts (Decimal.js gt/lt(0), zero rejected per CR-03).
import { describe, expect, it } from 'vitest'
import {
  assertInflowRefundAmount,
  assertOutflowAnchorAmount,
  assertReimbursementAmounts,
} from '@/lib/services/reimbursement-invariant'

describe('assertOutflowAnchorAmount', () => {
  it('does not throw for a negative (outflow) amount', () => {
    expect(() => assertOutflowAnchorAmount('-100.00')).not.toThrow()
  })

  it('throws with an Italian anchor/outflow message for a positive amount', () => {
    expect(() => assertOutflowAnchorAmount('50.00')).toThrow(/uscita/i)
  })

  it('throws for a zero amount (CR-03: zero is neither outflow nor inflow)', () => {
    expect(() => assertOutflowAnchorAmount('0.00')).toThrow()
  })
})

describe('assertInflowRefundAmount', () => {
  it('does not throw for a positive (inflow) amount', () => {
    expect(() => assertInflowRefundAmount('50.00')).not.toThrow()
  })

  it('throws with an Italian refund/inflow message for a negative amount', () => {
    expect(() => assertInflowRefundAmount('-30.00')).toThrow(/entrata/i)
  })

  it('throws for a zero amount (CR-03: zero is neither outflow nor inflow)', () => {
    expect(() => assertInflowRefundAmount('0.00')).toThrow()
  })
})

describe('assertReimbursementAmounts', () => {
  it('does not throw for a dinner-shaped input (one outflow anchor, N inflow refunds)', () => {
    expect(() =>
      assertReimbursementAmounts({ anchorAmount: '-100.00', refundAmounts: ['30.00', '20.00'] }),
    ).not.toThrow()
  })

  it('throws when one refund in a multi-refund set has the wrong sign (not silently dropped)', () => {
    expect(() =>
      assertReimbursementAmounts({ anchorAmount: '-100.00', refundAmounts: ['30.00', '-20.00'] }),
    ).toThrow()
  })
})

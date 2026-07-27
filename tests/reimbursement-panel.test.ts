// Unit test for formatResidualLabel — the pure Italian-label mapping ReimbursementPanel
// (components/transactions/reimbursement-panel.tsx) renders inline (D-04). Extracted as a
// standalone function precisely so it is testable without jsdom (this repo has none) — mirrors
// the formatAbsoluteAmount precedent (tests/format-amount.test.ts).
import { describe, expect, it } from 'vitest'
import { formatResidualLabel } from '@/components/transactions/reimbursement-panel'

describe('formatResidualLabel', () => {
  it('owed (negative residual): "Ancora dovuti €N" with the absolute value, no leading minus', () => {
    const result = formatResidualLabel('-25.00', 'owed')
    expect(result).toContain('Ancora dovuti')
    expect(result).not.toContain('-')
  })

  it('settled (zero residual): "Saldato", independent of the residual value passed', () => {
    expect(formatResidualLabel('0.00', 'settled')).toBe('Saldato')
  })

  it('surplus (positive residual): "Surplus di €N"', () => {
    const result = formatResidualLabel('20.00', 'surplus')
    expect(result).toContain('Surplus di')
  })
})

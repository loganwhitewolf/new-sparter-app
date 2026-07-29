// Unit tests for instalment materialisation math (Phase 77, AMORT-03, D-02/D-07).
// Pure Decimal.js logic — no database, no server-only imports.
import { describe, expect, it } from 'vitest'
import {
  materializeInstalments,
  maxMonthsForAmount,
  validateMonthsForAmount,
} from '@/lib/services/amortization-math'
import { toDecimal } from '@/lib/utils/decimal'

function expectDate(actual: Date, year: number, monthIndex: number, day: number) {
  expect(actual.getFullYear()).toBe(year)
  expect(actual.getMonth()).toBe(monthIndex)
  expect(actual.getDate()).toBe(day)
}

describe('materializeInstalments', () => {
  it('spreads €1000.00 over 3 months with the rounding remainder on the first instalment', () => {
    const result = materializeInstalments('1000.00', new Date(2026, 7, 14), 3)

    expect(result).toHaveLength(3)
    expect(result[0].amount).toBe('333.34')
    expect(result[1].amount).toBe('333.33')
    expect(result[2].amount).toBe('333.33')
    expectDate(result[0].date, 2026, 7, 14)
    expectDate(result[1].date, 2026, 8, 14)
    expectDate(result[2].date, 2026, 9, 14)
  })

  it('spreads €1000.00 over 4 months evenly (exact division, no remainder)', () => {
    const result = materializeInstalments('1000.00', new Date(2026, 7, 14), 4)

    expect(result).toHaveLength(4)
    for (const instalment of result) {
      expect(instalment.amount).toBe('250.00')
    }
    expectDate(result[0].date, 2026, 7, 14)
    expectDate(result[1].date, 2026, 8, 14)
    expectDate(result[2].date, 2026, 9, 14)
    expectDate(result[3].date, 2026, 10, 14)
  })

  it('clamps a 31/1 purchase date to 28/2 (non-leap year) without rolling into March', () => {
    const result = materializeInstalments('1000.00', new Date(2026, 0, 31), 3)

    expectDate(result[0].date, 2026, 0, 31)
    expectDate(result[1].date, 2026, 1, 28)
    expectDate(result[2].date, 2026, 2, 31)
  })

  it('clamps a 31/1 purchase date to 29/2 on a leap year (2028)', () => {
    const result = materializeInstalments('1000.00', new Date(2028, 0, 31), 2)

    expectDate(result[0].date, 2028, 0, 31)
    expectDate(result[1].date, 2028, 1, 29)
  })

  it('splits €0.02 over 2 months into two €0.01 instalments', () => {
    const result = materializeInstalments('0.02', new Date(2026, 7, 14), 2)

    expect(result[0].amount).toBe('0.01')
    expect(result[1].amount).toBe('0.01')
  })

  it.each([
    ['1000.00', 3],
    ['1000.00', 4],
    ['0.02', 2],
    ['999.99', 7],
    ['123.45', 11],
  ] as const)('sums back to the original amount exactly for %s over %i months', (amount, months) => {
    const result = materializeInstalments(amount, new Date(2026, 7, 14), months)
    const sum = result.reduce((acc, instalment) => acc.plus(instalment.amount), toDecimal('0'))
    expect(sum.equals(toDecimal(amount))).toBe(true)
  })

  it('is sign-agnostic — a negative (outflow) amount sums back to the original negative total', () => {
    const result = materializeInstalments('-1000.00', new Date(2026, 7, 14), 3)
    expect(result[0].amount).toBe('-333.34')
    expect(result[1].amount).toBe('-333.33')
    expect(result[2].amount).toBe('-333.33')
    const sum = result.reduce((acc, instalment) => acc.plus(instalment.amount), toDecimal('0'))
    expect(sum.equals(toDecimal('-1000.00'))).toBe(true)
  })
})

describe('validateMonthsForAmount', () => {
  it('rejects N=1 with the minimum-months message', () => {
    const result = validateMonthsForAmount('1000.00', 1)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Minimo 2 mesi.')
  })

  it('rejects €0.01 over 2 months (base instalment rounds to €0.00)', () => {
    const result = validateMonthsForAmount('0.01', 2)
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('accepts €1000.00 over 3 months', () => {
    const result = validateMonthsForAmount('1000.00', 3)
    expect(result.valid).toBe(true)
  })
})

describe('maxMonthsForAmount', () => {
  it('returns the amount in cents as the natural cap', () => {
    expect(maxMonthsForAmount('1000.00')).toBe(100000)
  })
})

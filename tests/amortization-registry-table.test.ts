// Unit tests for sortAmortizationRows / resolveEffectiveStatusFilter
// (components/amortizations/amortization-table.tsx), computeTotalOpenResidual
// (components/amortizations/amortization-summary-header.tsx), and a lightweight amountToneClass
// regression proof for this feature's own zero-tone usage (Phase 79 Plan 01, REG-01/REG-03/D-B1).
// Extracted as standalone exports precisely so they are testable without jsdom (this repo has
// none) — mirrors the sortReimbursementRows / tests/reimbursement-table-sort.test.ts precedent.
import { describe, expect, it } from 'vitest'
import {
  resolveEffectiveStatusFilter,
  sortAmortizationRows,
} from '@/components/amortizations/amortization-table'
import { computeTotalOpenResidual } from '@/components/amortizations/amortization-summary-header'
import { AMOUNT_TONE_CLASS, amountToneClass } from '@/lib/utils/amount-tone'
import type { AmortizationPlanListRow } from '@/lib/dal/amortization'

function makeRow(overrides: Partial<AmortizationPlanListRow>): AmortizationPlanListRow {
  return {
    id: 'plan-1',
    transactionId: 'tx-1',
    description: 'Row',
    displayTitle: 'Row',
    transactionDate: new Date('2026-01-01'),
    initialAmount: '0.00',
    consumedAmount: '0.00',
    netValue: '0.00',
    remainingMonths: 0,
    totalMonths: 0,
    status: 'open',
    ...overrides,
  }
}

describe('sortAmortizationRows', () => {
  it('sorts netValue via Decimal comparison, not string comparison', () => {
    // A naive string sort would misorder '-100.00' vs '20.00' (string compare: '-' < '2').
    const rows = [
      makeRow({ id: 'a', netValue: '20.00' }),
      makeRow({ id: 'b', netValue: '-100.00' }),
    ]

    const sorted = sortAmortizationRows(rows, 'netValue', 'asc')

    expect(sorted.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('sorts remainingMonths numerically', () => {
    const rows = [
      makeRow({ id: 'a', remainingMonths: 12 }),
      makeRow({ id: 'b', remainingMonths: 3 }),
      makeRow({ id: 'c', remainingMonths: 9 }),
    ]

    const sorted = sortAmortizationRows(rows, 'remainingMonths', 'asc')

    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts description via localeCompare', () => {
    const rows = [
      makeRow({ id: 'a', description: 'Zaino' }),
      makeRow({ id: 'b', description: 'Alfa' }),
    ]

    const sorted = sortAmortizationRows(rows, 'description', 'asc')

    expect(sorted.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('ties preserve input order (stable sort)', () => {
    const rows = [
      makeRow({ id: 'a', remainingMonths: 5 }),
      makeRow({ id: 'b', remainingMonths: 5 }),
      makeRow({ id: 'c', remainingMonths: 5 }),
    ]

    const sorted = sortAmortizationRows(rows, 'remainingMonths', 'asc')

    expect(sorted.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('resolveEffectiveStatusFilter (D-C1)', () => {
  it('resolves null to "open" (default-to-open override)', () => {
    expect(resolveEffectiveStatusFilter(null)).toBe('open')
  })

  it('resolves "open" to "open"', () => {
    expect(resolveEffectiveStatusFilter('open')).toBe('open')
  })

  it('resolves "closed" to "closed"', () => {
    expect(resolveEffectiveStatusFilter('closed')).toBe('closed')
  })

  it('resolves any unrecognized value to "open"', () => {
    expect(resolveEffectiveStatusFilter('bogus')).toBe('open')
  })
})

describe('amountToneClass zero-boundary regression (REG-01 adjacency edge)', () => {
  it('resolves "0.00" to the neutral/zero tone, never positive/negative', () => {
    const toneClass = amountToneClass('0.00')

    expect(toneClass).toBe(AMOUNT_TONE_CLASS.zero)
    expect(toneClass).not.toBe(AMOUNT_TONE_CLASS.positive)
    expect(toneClass).not.toBe(AMOUNT_TONE_CLASS.negative)
  })
})

describe('computeTotalOpenResidual (D-B1)', () => {
  it('sums netValue across OPEN plans only, excluding closed plans, with Decimal precision', () => {
    const plans = [
      makeRow({ id: 'a', status: 'open', netValue: '-33.33' }),
      makeRow({ id: 'b', status: 'open', netValue: '-33.33' }),
      makeRow({ id: 'c', status: 'open', netValue: '-33.34' }),
      makeRow({ id: 'd', status: 'closed', netValue: '-500.00' }),
    ]

    expect(computeTotalOpenResidual(plans)).toBe('-100.00')
  })

  it('resolves to exactly "0.00" (never NaN or an empty string) when there are zero open plans', () => {
    const allClosed = [makeRow({ id: 'a', status: 'closed', netValue: '-500.00' })]
    expect(computeTotalOpenResidual(allClosed)).toBe('0.00')

    expect(computeTotalOpenResidual([])).toBe('0.00')
  })
})

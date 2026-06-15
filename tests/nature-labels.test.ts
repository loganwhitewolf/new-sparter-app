import { describe, it, expect } from 'vitest'
import {
  FlowNature,
  NATURE_LABELS,
  NATURE_ORDER,
  NATURE_COLORS,
} from '@/lib/utils/nature-labels'

// Phase 46: FlowNature v2.0 — 8 codes (operational dissolved, financial→investment, extraordinary→savings)
const ALL_NATURE_KEYS: Array<FlowNature | 'unclassified'> = [
  'essential',
  'discretionary',
  'income',
  'income_extraordinary',
  'debt',
  'transfer',
  'savings',
  'investment',
  'unclassified',
]

const EXPECTED_LABELS: Record<FlowNature | 'unclassified', string> = {
  essential: 'Essenziale',
  discretionary: 'Discrezionale',
  income: 'Entrate ricorrenti',
  income_extraordinary: 'Straordinaria',
  debt: 'Debiti',
  transfer: 'Trasferimento',
  savings: 'Risparmio',
  investment: 'Investimento',
  unclassified: 'Non classificato',
}

describe('NATURE_LABELS', () => {
  it('has all 9 expected keys (8 FlowNature + unclassified)', () => {
    expect(Object.keys(NATURE_LABELS)).toHaveLength(9)
  })

  it.each(ALL_NATURE_KEYS)('has correct Italian label for %s', (key) => {
    expect(NATURE_LABELS[key]).toBe(EXPECTED_LABELS[key])
  })
})

describe('NATURE_ORDER', () => {
  it('has length 9 (8 natures + 1 null slot)', () => {
    expect(NATURE_ORDER).toHaveLength(9)
  })

  it('has null as last element (unclassified slot)', () => {
    expect(NATURE_ORDER[NATURE_ORDER.length - 1]).toBeNull()
  })

  it('has 8 non-null nature values before null', () => {
    const nonNull = NATURE_ORDER.filter((n) => n !== null)
    expect(nonNull).toHaveLength(8)
  })
})

describe('NATURE_COLORS', () => {
  it('has all 9 keys (8 FlowNature + unclassified)', () => {
    expect(Object.keys(NATURE_COLORS)).toHaveLength(9)
  })

  it.each(ALL_NATURE_KEYS)('has non-empty color for %s', (key) => {
    expect(NATURE_COLORS[key]).toBeTruthy()
    expect(typeof NATURE_COLORS[key]).toBe('string')
  })

  it('uses neutral gray for unclassified', () => {
    expect(NATURE_COLORS['unclassified']).toBe('#a1a1aa')
  })
})

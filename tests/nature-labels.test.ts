import { describe, it, expect } from 'vitest'
import {
  FlowNature,
  NATURE_LABELS,
  NATURE_ORDER,
  NATURE_COLORS,
} from '@/lib/utils/nature-labels'

const ALL_NATURE_KEYS: Array<FlowNature | 'unclassified'> = [
  'essential',
  'discretionary',
  'operational',
  'financial',
  'income',
  'debt',
  'extraordinary',
  'unclassified',
]

const EXPECTED_LABELS: Record<FlowNature | 'unclassified', string> = {
  essential: 'Essenziale',
  discretionary: 'Discrezionale',
  operational: 'Operativo',
  financial: 'Finanziario',
  income: 'Entrate',
  debt: 'Debiti',
  extraordinary: 'Straordinario',
  unclassified: 'Non classificato',
}

describe('NATURE_LABELS', () => {
  it('has all 8 expected keys', () => {
    expect(Object.keys(NATURE_LABELS)).toHaveLength(8)
  })

  it.each(ALL_NATURE_KEYS)('has correct Italian label for %s', (key) => {
    expect(NATURE_LABELS[key]).toBe(EXPECTED_LABELS[key])
  })
})

describe('NATURE_ORDER', () => {
  it('has length 8', () => {
    expect(NATURE_ORDER).toHaveLength(8)
  })

  it('has null as last element (unclassified slot)', () => {
    expect(NATURE_ORDER[NATURE_ORDER.length - 1]).toBeNull()
  })

  it('has 7 non-null nature values before null', () => {
    const nonNull = NATURE_ORDER.filter((n) => n !== null)
    expect(nonNull).toHaveLength(7)
  })
})

describe('NATURE_COLORS', () => {
  it('has all 8 keys', () => {
    expect(Object.keys(NATURE_COLORS)).toHaveLength(8)
  })

  it.each(ALL_NATURE_KEYS)('has non-empty color for %s', (key) => {
    expect(NATURE_COLORS[key]).toBeTruthy()
    expect(typeof NATURE_COLORS[key]).toBe('string')
  })

  it('uses neutral gray for unclassified', () => {
    expect(NATURE_COLORS['unclassified']).toBe('#a1a1aa')
  })
})

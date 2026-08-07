import { describe, expect, it } from 'vitest'
import { parseTransactionFilters } from '@/lib/validations/transactions'
import { parseExpenseFilters } from '@/lib/validations/expense'

// Hardcoded literal — deliberately NOT imported from NATURE_FILTER_VALUES, so a bug in the
// derivation itself (e.g. a typo inside FLOW_NATURE_MEMBERS) cannot make this test
// self-referentially pass.
const LIVE_NATURE_VALUES = [
  'essential',
  'discretionary',
  'income',
  'income_extraordinary',
  'debt',
  'transfer',
  'savings',
  'investment',
  'unclassified',
] as const

// v2.0-dead codes (renamed/dissolved, see lib/utils/nature-labels.ts:1-2) plus one garbage
// value — all must still be silently dropped by parseStatus's total-function contract.
const REJECTED_NATURE_VALUES = ['operational', 'financial', 'extraordinary', 'not-a-real-nature'] as const

describe('nature filter allowlist — full FlowNature matrix', () => {
  it.each(LIVE_NATURE_VALUES)('parseTransactionFilters accepts nature=%s', (value) => {
    expect(parseTransactionFilters({ nature: value }).nature).toBe(value)
  })

  it.each(LIVE_NATURE_VALUES)('parseExpenseFilters accepts nature=%s', (value) => {
    expect(parseExpenseFilters({ nature: value }).nature).toBe(value)
  })
})

describe('nature filter allowlist — dead codes and garbage rejected', () => {
  it.each(REJECTED_NATURE_VALUES)('parseTransactionFilters drops nature=%s', (value) => {
    expect(parseTransactionFilters({ nature: value }).nature).toBeUndefined()
  })

  it.each(REJECTED_NATURE_VALUES)('parseExpenseFilters drops nature=%s', (value) => {
    expect(parseExpenseFilters({ nature: value }).nature).toBeUndefined()
  })
})

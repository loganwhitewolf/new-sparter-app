import { describe, expect, it } from 'vitest'
import { parseTransactionFilters } from '@/lib/validations/transactions'
import {
  DEFAULT_TRANSACTION_DIRECTIONS,
  parseDirectionTokens,
  resolveTransactionDirections,
  sameDirectionSet,
} from '@/lib/utils/transaction-directions'

describe('parseDirectionTokens', () => {
  it('parses CSV, drops unknown, dedupes', () => {
    expect(parseDirectionTokens('in,transfer,bogus,in')).toEqual(['in', 'transfer'])
  })

  it('returns [] for empty / undefined', () => {
    expect(parseDirectionTokens(undefined)).toEqual([])
    expect(parseDirectionTokens('')).toEqual([])
    expect(parseDirectionTokens('  , , ')).toEqual([])
  })
})

describe('resolveTransactionDirections', () => {
  it('absent param → default without transfer', () => {
    expect(resolveTransactionDirections(undefined)).toEqual({
      directions: [...DEFAULT_TRANSACTION_DIRECTIONS],
      explicit: false,
    })
    expect(resolveTransactionDirections(undefined).directions).not.toContain('transfer')
  })

  it('explicit empty → []', () => {
    expect(resolveTransactionDirections('')).toEqual({ directions: [], explicit: true })
  })

  it('explicit transfer only', () => {
    expect(resolveTransactionDirections('transfer')).toEqual({
      directions: ['transfer'],
      explicit: true,
    })
  })

  it('legacy type when direction absent', () => {
    expect(resolveTransactionDirections(undefined, 'out')).toEqual({
      directions: ['out'],
      explicit: true,
    })
  })
})

describe('sameDirectionSet', () => {
  it('order-independent equality', () => {
    expect(sameDirectionSet(['in', 'out'], ['out', 'in'])).toBe(true)
    expect(sameDirectionSet(['in'], ['in', 'out'])).toBe(false)
  })
})

describe('parseTransactionFilters directions', () => {
  it('bare params → default directions (no transfer)', () => {
    const parsed = parseTransactionFilters({})
    expect(parsed.directions).toEqual([...DEFAULT_TRANSACTION_DIRECTIONS])
    expect(parsed.directions).not.toContain('transfer')
  })

  it('direction=transfer → only transfer', () => {
    expect(parseTransactionFilters({ direction: 'transfer' }).directions).toEqual(['transfer'])
  })

  it('direction=in,out,allocation,unclassified equals default set', () => {
    const parsed = parseTransactionFilters({
      direction: 'in,out,allocation,unclassified',
    })
    expect(sameDirectionSet(parsed.directions, DEFAULT_TRANSACTION_DIRECTIONS)).toBe(true)
  })

  it('direction= (empty) → match-nothing list', () => {
    expect(parseTransactionFilters({ direction: '' }).directions).toEqual([])
  })

  it('legacy type=out when direction absent', () => {
    expect(parseTransactionFilters({ type: 'out' }).directions).toEqual(['out'])
  })
})

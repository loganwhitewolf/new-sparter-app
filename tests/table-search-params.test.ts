import { describe, expect, it } from 'vitest'
import {
  YEAR_MONTH_RE,
  parseAmount,
  parseMonths,
  parseSortDir,
  parseStatus,
} from '../lib/utils/search-params'

describe('YEAR_MONTH_RE', () => {
  it('matches valid YYYY-MM values', () => {
    expect(YEAR_MONTH_RE.test('2026-01')).toBe(true)
    expect(YEAR_MONTH_RE.test('2026-12')).toBe(true)
    expect(YEAR_MONTH_RE.test('2000-06')).toBe(true)
  })

  it('rejects invalid YYYY-MM values', () => {
    expect(YEAR_MONTH_RE.test('2026-13')).toBe(false)
    expect(YEAR_MONTH_RE.test('2026-00')).toBe(false)
    expect(YEAR_MONTH_RE.test('foo')).toBe(false)
    expect(YEAR_MONTH_RE.test('2026-5')).toBe(false)
  })
})

describe('parseMonths', () => {
  it('returns an array of valid months from a comma-separated string', () => {
    expect(parseMonths('2026-04,2026-05')).toEqual(['2026-04', '2026-05'])
  })

  it('drops invalid month values and keeps only valid ones', () => {
    expect(parseMonths('2026-13,foo,2026-05')).toEqual(['2026-05'])
  })

  it('returns empty array for undefined', () => {
    expect(parseMonths(undefined)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseMonths('')).toEqual([])
  })

  it('handles a single valid month', () => {
    expect(parseMonths('2026-04')).toEqual(['2026-04'])
  })

  it('trims whitespace around month tokens', () => {
    expect(parseMonths(' 2026-04 , 2026-05 ')).toEqual(['2026-04', '2026-05'])
  })

  it('returns only the first element when an array is passed (first-trimmed semantics)', () => {
    // String arrays from searchParams: only the first element is used
    expect(parseMonths(['2026-04,2026-05', '2026-06'])).toEqual(['2026-04', '2026-05'])
  })

  it('never throws on any input', () => {
    expect(() => parseMonths('garbage!')).not.toThrow()
    expect(() => parseMonths(undefined)).not.toThrow()
    expect(() => parseMonths(['a', 'b'])).not.toThrow()
  })
})

describe('parseAmount', () => {
  it('returns the value as string for valid non-negative integer', () => {
    expect(parseAmount('10')).toBe('10')
  })

  it('returns the value as string for valid decimal', () => {
    expect(parseAmount('10.50')).toBe('10.50')
  })

  it('returns undefined for negative values', () => {
    expect(parseAmount('-5')).toBeUndefined()
  })

  it('returns undefined for non-numeric strings', () => {
    expect(parseAmount('abc')).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(parseAmount(undefined)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(parseAmount('')).toBeUndefined()
  })

  it('returns undefined for values with leading sign', () => {
    expect(parseAmount('+5')).toBeUndefined()
  })

  it('handles array input by using the first element', () => {
    expect(parseAmount(['10.50', '99'])).toBe('10.50')
    expect(parseAmount(['-5', '10'])).toBeUndefined()
  })

  it('never throws on any input', () => {
    expect(() => parseAmount('garbage!')).not.toThrow()
    expect(() => parseAmount(undefined)).not.toThrow()
  })
})

describe('parseStatus', () => {
  const allowed = ['categorized', 'uncategorized'] as const

  it('returns the value if it is in the allowed list', () => {
    expect(parseStatus('categorized', allowed)).toBe('categorized')
    expect(parseStatus('uncategorized', allowed)).toBe('uncategorized')
  })

  it('returns undefined for values not in the allowed list', () => {
    expect(parseStatus('bogus', allowed)).toBeUndefined()
    expect(parseStatus('CATEGORIZED', allowed)).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(parseStatus(undefined, allowed)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(parseStatus('', allowed)).toBeUndefined()
  })

  it('trims whitespace before checking the allowed list', () => {
    expect(parseStatus(' categorized ', allowed)).toBe('categorized')
  })

  it('handles array input by using the first element', () => {
    expect(parseStatus(['categorized', 'bogus'], allowed)).toBe('categorized')
  })

  it('never throws on any input', () => {
    expect(() => parseStatus('garbage', allowed)).not.toThrow()
    expect(() => parseStatus(undefined, allowed)).not.toThrow()
  })
})

describe('parseSortDir', () => {
  const allowed = ['amount', 'occurredAt'] as const

  it('returns sort and dir when both are valid', () => {
    expect(parseSortDir('amount', 'asc', allowed)).toEqual({ sort: 'amount', dir: 'asc' })
    expect(parseSortDir('occurredAt', 'desc', allowed)).toEqual({ sort: 'occurredAt', dir: 'desc' })
  })

  it('returns undefined sort when sort key is not in the allowlist', () => {
    expect(parseSortDir('bogus', 'asc', allowed)).toEqual({ sort: undefined, dir: 'asc' })
  })

  it('defaults dir to desc when dir value is not exactly "asc"', () => {
    expect(parseSortDir('amount', 'DESC', allowed)).toEqual({ sort: 'amount', dir: 'desc' })
    expect(parseSortDir('amount', 'random', allowed)).toEqual({ sort: 'amount', dir: 'desc' })
    expect(parseSortDir('amount', undefined, allowed)).toEqual({ sort: 'amount', dir: 'desc' })
  })

  it('returns undefined sort and default dir when both are invalid', () => {
    expect(parseSortDir('bogus', 'random', allowed)).toEqual({ sort: undefined, dir: 'desc' })
  })

  it('handles undefined sort', () => {
    expect(parseSortDir(undefined, 'asc', allowed)).toEqual({ sort: undefined, dir: 'asc' })
  })

  it('never throws on any input', () => {
    expect(() => parseSortDir('garbage', 'garbage', allowed)).not.toThrow()
    expect(() => parseSortDir(undefined, undefined, allowed)).not.toThrow()
  })
})

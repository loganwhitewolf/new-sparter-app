import { describe, expect, it } from 'vitest'
import { parseExpenseFilters } from '@/lib/validations/expense'

describe('parseExpenseFilters months (260731-hhv 3.5)', () => {
  it('parses comma-separated YYYY-MM months', () => {
    expect(parseExpenseFilters({ months: '2026-04,2026-05' }).months).toEqual(['2026-04', '2026-05'])
  })

  it('drops invalid month tokens silently', () => {
    expect(parseExpenseFilters({ months: '2026-13,foo,2026-05' }).months).toEqual(['2026-05'])
  })

  it('omits months when absent or empty (all-time default)', () => {
    expect(parseExpenseFilters({}).months).toBeUndefined()
    expect(parseExpenseFilters({ months: '' }).months).toBeUndefined()
    expect(parseExpenseFilters({ months: 'bogus' }).months).toBeUndefined()
  })
})

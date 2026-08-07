import { describe, expect, it } from 'vitest'
import { parseTransactionFilters } from '@/lib/validations/transactions'
import { parseExpenseFilters } from '@/lib/validations/expense'

describe('nature filter allowlist — savings/investment fix', () => {
  it('parseTransactionFilters accepts nature=savings', () => {
    expect(parseTransactionFilters({ nature: 'savings' }).nature).toBe('savings')
  })

  it('parseTransactionFilters accepts nature=investment', () => {
    expect(parseTransactionFilters({ nature: 'investment' }).nature).toBe('investment')
  })

  it('parseExpenseFilters accepts nature=savings', () => {
    expect(parseExpenseFilters({ nature: 'savings' }).nature).toBe('savings')
  })

  it('parseExpenseFilters accepts nature=investment', () => {
    expect(parseExpenseFilters({ nature: 'investment' }).nature).toBe('investment')
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values }),
    {},
  ),
}))
vi.mock('@/lib/db/schema', () => ({
  transaction: {
    id: 'transaction.id',
  },
}))

const { tagScopedTransactions } = await import('@/lib/dal/transaction-tags-sql')

describe('tagScopedTransactions', () => {
  it('returns undefined when tagId is undefined (caller and(...) drops it)', () => {
    expect(tagScopedTransactions(undefined)).toBeUndefined()
  })

  it('returns undefined when tagId is 0 (falsy guard, not just === undefined)', () => {
    expect(tagScopedTransactions(0)).toBeUndefined()
  })

  it('returns a truthy EXISTS sql fragment referencing transaction.id and the given tagId', () => {
    const fragment = tagScopedTransactions(5) as {
      op: string
      strings: string[]
      values: unknown[]
    }

    expect(fragment).toBeTruthy()
    expect(fragment.op).toBe('sql')
    const text = fragment.strings.join('?')
    expect(text).toContain('EXISTS')
    expect(text).toContain('transaction_tag')
    expect(text).not.toMatch(/LEFT JOIN|INNER JOIN|JOIN/i)
    expect(fragment.values).toContain('transaction.id')
    expect(fragment.values).toContain(5)
  })
})

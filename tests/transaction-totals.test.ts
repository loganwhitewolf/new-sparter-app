/**
 * Tests for computeTransactionTotals — pure per-currency totals computation for the
 * transactions table footer (D-01–D-08). RED phase: fails until the implementation exists.
 */
import { describe, it, expect } from 'vitest'
import { computeTransactionTotals, type TransactionTotalsRow } from '@/lib/utils/transaction-totals'

function row(overrides: Partial<TransactionTotalsRow>): TransactionTotalsRow {
  return {
    amount: '0',
    pairedNetAmount: null,
    currency: 'EUR',
    ...overrides,
  }
}

describe('computeTransactionTotals', () => {
  it('returns totalCount 0 and an empty buckets array for empty input (D-02, D-04)', () => {
    const result = computeTransactionTotals([])
    expect(result.totalCount).toBe(0)
    expect(result.buckets).toEqual([])
  })

  it('splits rows by sign of amount within a bucket: positive nets sum into totalIn, negative into totalOut (D-04, D-05)', () => {
    const result = computeTransactionTotals([
      row({ amount: '100.00' }),
      row({ amount: '-40.00' }),
      row({ amount: '-10.50' }),
    ])
    expect(result.buckets).toHaveLength(1)
    const bucket = result.buckets[0]
    expect(bucket.totalIn.toFixed(2)).toBe('100.00')
    expect(bucket.totalOut.toFixed(2)).toBe('50.50')
    expect(bucket.difference.toFixed(2)).toBe('49.50')
  })

  it('a net of exactly zero increments count but contributes to neither total (D-05)', () => {
    const result = computeTransactionTotals([row({ amount: '0' }), row({ amount: '50.00' })])
    const bucket = result.buckets[0]
    expect(bucket.count).toBe(2)
    expect(bucket.totalIn.toFixed(2)).toBe('50.00')
    expect(bucket.totalOut.toFixed(2)).toBe('0.00')
  })

  it('uses pairedNetAmount instead of amount when non-null, even when signs differ (D-04)', () => {
    const result = computeTransactionTotals([
      row({ amount: '-133.00', pairedNetAmount: '33.00' }),
    ])
    const bucket = result.buckets[0]
    expect(bucket.totalIn.toFixed(2)).toBe('33.00')
    expect(bucket.totalOut.toFixed(2)).toBe('0.00')
  })

  it("each bucket's difference always equals totalIn minus totalOut (D-05)", () => {
    const result = computeTransactionTotals([
      row({ amount: '200.00' }),
      row({ amount: '-75.25' }),
      row({ amount: '-15.00' }),
    ])
    const bucket = result.buckets[0]
    expect(bucket.difference.toFixed(2)).toBe(bucket.totalIn.minus(bucket.totalOut).toFixed(2))
    expect(bucket.difference.toFixed(2)).toBe('109.75')
  })

  it('buckets rows by currency, normalizing falsy/empty to EUR, with zero cross-contamination (D-08)', () => {
    const result = computeTransactionTotals([
      row({ amount: '100.00', currency: 'EUR' }),
      row({ amount: '-25.00', currency: 'EUR' }),
      row({ amount: '50.00', currency: 'USD' }),
      row({ amount: '-10.00', currency: 'USD' }),
    ])
    expect(result.buckets).toHaveLength(2)
    const eur = result.buckets.find((b) => b.currency === 'EUR')!
    const usd = result.buckets.find((b) => b.currency === 'USD')!
    expect(eur.totalIn.toFixed(2)).toBe('100.00')
    expect(eur.totalOut.toFixed(2)).toBe('25.00')
    expect(usd.totalIn.toFixed(2)).toBe('50.00')
    expect(usd.totalOut.toFixed(2)).toBe('10.00')
  })

  it('normalizes an empty-string or missing currency to EUR (D-08)', () => {
    const result = computeTransactionTotals([
      row({ amount: '10.00', currency: '' }),
      row({ amount: '5.00', currency: 'EUR' }),
    ])
    expect(result.buckets).toHaveLength(1)
    expect(result.buckets[0].currency).toBe('EUR')
    expect(result.buckets[0].totalIn.toFixed(2)).toBe('15.00')
  })

  it('orders buckets by count descending, then currency code ascending as a stable tiebreaker (D-08)', () => {
    const result = computeTransactionTotals([
      row({ amount: '1.00', currency: 'USD' }),
      row({ amount: '1.00', currency: 'EUR' }),
      row({ amount: '1.00', currency: 'GBP' }),
      row({ amount: '1.00', currency: 'GBP' }),
    ])
    // GBP has count 2, EUR and USD tie at count 1 -> ascending currency code
    expect(result.buckets.map((b) => b.currency)).toEqual(['GBP', 'EUR', 'USD'])
  })

  it('counts a malformed amount string without throwing and without polluting the totals', () => {
    const result = computeTransactionTotals([
      row({ amount: '10.00' }),
      row({ amount: 'not-a-number' }),
      row({ amount: '-4.00' }),
    ])

    expect(result.totalCount).toBe(3)
    expect(result.buckets).toHaveLength(1)
    expect(result.buckets[0].count).toBe(3)
    expect(result.buckets[0].totalIn.toFixed(2)).toBe('10.00')
    expect(result.buckets[0].totalOut.toFixed(2)).toBe('4.00')
    expect(result.buckets[0].difference.toFixed(2)).toBe('6.00')
  })

  it('totalCount always equals rows.length regardless of bucket count (D-08)', () => {
    const result = computeTransactionTotals([
      row({ amount: '1.00', currency: 'EUR' }),
      row({ amount: '1.00', currency: 'USD' }),
      row({ amount: '1.00', currency: 'GBP' }),
    ])
    expect(result.totalCount).toBe(3)
  })
})

/**
 * Pure computation of footer totals for the transactions table (D-01–D-08).
 *
 * Not an approximation: the caller only feeds this the fully-loaded set (hasMore === false),
 * so "current view" and "full filter set" are identical at call time (D-02).
 *
 * All arithmetic goes through Decimal.js — never native JS operators on amount strings.
 */
import Decimal from 'decimal.js'
import { toDecimal } from '@/lib/utils/decimal'

/** Minimal structural shape — deliberately not TransactionListRow, to keep this helper DAL-free. */
export type TransactionTotalsRow = {
  amount: string
  pairedNetAmount: string | null
  currency: string
}

export type CurrencyTotals = {
  currency: string
  count: number
  totalIn: Decimal
  totalOut: Decimal
  difference: Decimal
}

export type TransactionTotals = {
  totalCount: number
  buckets: CurrencyTotals[]
}

/**
 * Groups rows by currency (falsy/empty normalized to 'EUR', mirroring the existing
 * `currency || 'EUR'` normalization in getAmountFormatter/formatAbsoluteAmount — D-08),
 * then within each bucket splits pairedNetAmount ?? amount by sign (D-04, D-05):
 * positive nets accumulate into totalIn, negative nets accumulate (as |value|) into totalOut,
 * a net of exactly zero counts toward the bucket's count but neither total.
 *
 * Buckets are ordered deterministically: count descending, then currency code ascending as a
 * stable tiebreaker (D-08). totalCount is always rows.length, regardless of bucket count.
 */
export function computeTransactionTotals(rows: TransactionTotalsRow[]): TransactionTotals {
  const bucketsByCurrency = new Map<string, CurrencyTotals>()

  for (const row of rows) {
    const currency = row.currency || 'EUR'
    let bucket = bucketsByCurrency.get(currency)
    if (!bucket) {
      bucket = {
        currency,
        count: 0,
        totalIn: new Decimal(0),
        totalOut: new Decimal(0),
        difference: new Decimal(0),
      }
      bucketsByCurrency.set(currency, bucket)
    }

    const net = toDecimal(row.pairedNetAmount ?? row.amount)
    bucket.count += 1

    if (net.isPositive()) {
      bucket.totalIn = bucket.totalIn.plus(net)
    } else if (net.isNegative()) {
      bucket.totalOut = bucket.totalOut.plus(net.abs())
    }
    // net.isZero(): counted, contributes to neither side (D-05)
  }

  const buckets = [...bucketsByCurrency.values()]
    .map((bucket) => ({ ...bucket, difference: bucket.totalIn.minus(bucket.totalOut) }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.currency.localeCompare(b.currency)
    })

  return { totalCount: rows.length, buckets }
}

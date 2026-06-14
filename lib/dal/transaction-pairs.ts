import 'server-only'

import { cache } from 'react'
import { and, eq, gte, lte, lt, gt, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transaction } from '@/lib/db/schema'
import { verifySession } from '@/lib/dal/auth'
import { toDecimal } from '@/lib/utils/decimal'

/**
 * A single row returned by getEligibleCounterparts.
 * Carries the fields the CounterpartPickerDialog needs to render each option.
 */
export type CounterpartRow = {
  id: string
  description: string
  customTitle: string | null
  amount: string
  occurredAt: Date
}

/**
 * Return transactions eligible as counterparts for the given reference transaction.
 *
 * Filters applied (D-13 / D-14 / T-50-01):
 *  - eq(transaction.userId, userId)        — session-scoped; no cross-user enumeration
 *  - opposite sign                          — if referenceAmount < 0 → amount > 0, and vice versa
 *  - gte(occurredAt, dateFrom)              — configurable ±90-day window
 *  - lte(occurredAt, dateTo)
 *  - ne(transaction.id, referenceId)        — self-exclusion
 *  - NOT EXISTS transaction_pair            — already-paired exclusion (D-14)
 *
 * Wrapped in `cache` because this query is session-scoped and called from RSC context.
 * The sign decision uses Decimal.js — never native JS comparison on DECIMAL strings.
 */
export const getEligibleCounterparts = cache(
  async (params: {
    referenceId: string
    referenceAmount: string
    dateFrom: Date
    dateTo: Date
  }): Promise<CounterpartRow[]> => {
    const { userId } = await verifySession()

    // Determine sign filter via Decimal.js (project hard rule — never native comparison
    // on DECIMAL string values returned by Drizzle).
    const refDecimal = toDecimal(params.referenceAmount)
    const signFilter = refDecimal.isNegative()
      ? gt(transaction.amount, '0')
      : lt(transaction.amount, '0')

    // Already-paired exclusion (D-14): exclude any transaction already in a pair
    // as either the primary (A) or secondary (B).
    const notAlreadyPaired = sql`NOT EXISTS (
      SELECT 1 FROM transaction_pair tp
      WHERE tp.transaction_a_id = ${transaction.id}
         OR tp.transaction_b_id = ${transaction.id}
    )`

    return db
      .select({
        id: transaction.id,
        description: transaction.description,
        customTitle: transaction.customTitle,
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, userId),
          ne(transaction.id, params.referenceId),
          signFilter,
          gte(transaction.occurredAt, params.dateFrom),
          lte(transaction.occurredAt, params.dateTo),
          notAlreadyPaired,
        ),
      ) as Promise<CounterpartRow[]>
  },
)

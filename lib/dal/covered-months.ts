import 'server-only'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'

/**
 * A calendar month (YYYY-MM) that contains at least one Transaction for the signed-in user,
 * anywhere in their account (D-01). The from/to boundary is the min/max `occurredAt` timestamp
 * observed for that month — informational only, not used by the pace/projection engine itself.
 */
export type CoveredMonth = { yearMonth: string; from: Date; to: Date }

/**
 * Returns every Covered Month (D-01) in `year` for the signed-in user, ascending by yearMonth.
 *
 * Deliberately reads the raw `transaction` table — never `ledgerEntryCash`/`ledgerEntryAccrual`
 * — because coverage is a property of the account, not of a lens (D-12): whether a month "has
 * data" cannot depend on which dashboard lens is currently selected. `year` is the ONLY scoping
 * parameter (D-04) — this function has no window/date-range argument, so Ritmo's denominator can
 * never be accidentally narrowed to less than the full selected year.
 *
 * Scoped to the authenticated user via verifySession(); userId/year are parameterized through the
 * drizzle sql template (never string-concatenated) — T-82-01 mitigation.
 *
 * Returns [] (never throws, never null) when the user has zero transactions in `year`, mirroring
 * getMonthsWithData's error-swallow convention.
 */
export const getCoveredMonthsInYear = cache(async (year: number): Promise<CoveredMonth[]> => {
  const { userId } = await verifySession()

  try {
    const result = await db.execute(sql`
      SELECT
        TO_CHAR(occurred_at, 'YYYY-MM') AS year_month,
        MIN(occurred_at)::date AS from_date,
        MAX(occurred_at)::date AS to_date
      FROM transaction
      WHERE user_id = ${userId}
        AND EXTRACT(YEAR FROM occurred_at)::integer = ${year}
      GROUP BY TO_CHAR(occurred_at, 'YYYY-MM')
      ORDER BY year_month ASC
    `)

    const rows = result.rows as { year_month: string; from_date: string; to_date: string }[]
    return rows.map((row) => ({
      yearMonth: row.year_month,
      from: new Date(row.from_date),
      to: new Date(row.to_date),
    }))
  } catch {
    return []
  }
})

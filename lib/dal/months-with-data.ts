import 'server-only'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import type { Lens } from '@/lib/utils/search-params'

/**
 * Returns the distinct calendar months (YYYY-MM, DESC) that contain data for
 * the signed-in user in the given table.
 *
 * `lens` (default `'cassa'`) only affects the `'transactions'` branch (D-09): under
 * `'competenza'` it also unions distinct months from `amortization_instalment`, so a
 * plan's future-only instalment month is not hidden from the month selector. The `'files'`
 * branch ignores `lens` entirely — no amortization concept applies to files.
 *
 * Scoped to the authenticated user via verifySession() — T-40-06 mitigated.
 * userId is parameterized via the sql template; column/format strings are static.
 */
export const getMonthsWithData = cache(
  async (table: 'transactions' | 'files' | 'expenses', lens: Lens = 'cassa'): Promise<string[]> => {
    const { userId } = await verifySession()

    if (table === 'transactions') {
      if (lens === 'competenza') {
        const result = await db.execute(sql`
          SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym
          FROM (
            SELECT occurred_at FROM transaction WHERE user_id = ${userId}
            UNION ALL
            SELECT occurred_at FROM amortization_instalment WHERE user_id = ${userId}
          ) combined
          ORDER BY ym DESC
        `)
        const rows = result.rows as { ym: string }[]
        return rows.map((row) => row.ym)
      }

      const result = await db.execute(sql`
        SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym
        FROM transaction
        WHERE user_id = ${userId}
        ORDER BY ym DESC
      `)
      const rows = result.rows as { ym: string }[]
      return rows.map((row) => row.ym)
    }

    if (table === 'expenses') {
      // Months that have at least one expense-linked transaction — matches getExpenses months filter.
      const result = await db.execute(sql`
        SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym
        FROM transaction
        WHERE user_id = ${userId}
          AND expense_id IS NOT NULL
        ORDER BY ym DESC
      `)
      const rows = result.rows as { ym: string }[]
      return rows.map((row) => row.ym)
    }

    // table === 'files'
    const result = await db.execute(sql`
      SELECT DISTINCT TO_CHAR(reference_started_at, 'YYYY-MM') AS ym
      FROM file
      WHERE user_id = ${userId}
        AND reference_started_at IS NOT NULL
      ORDER BY ym DESC
    `)
    const rows = result.rows as { ym: string }[]
    return rows.map((row) => row.ym)
  },
)

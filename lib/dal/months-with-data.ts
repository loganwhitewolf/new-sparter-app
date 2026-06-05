import 'server-only'
import { cache } from 'react'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'

/**
 * Returns the distinct calendar months (YYYY-MM, DESC) that contain data for
 * the signed-in user in the given table.
 *
 * Scoped to the authenticated user via verifySession() — T-40-06 mitigated.
 * userId is parameterized via the sql template; column/format strings are static.
 */
export const getMonthsWithData = cache(
  async (table: 'transactions' | 'files'): Promise<string[]> => {
    const { userId } = await verifySession()

    if (table === 'transactions') {
      const result = await db.execute(sql`
        SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym
        FROM transaction
        WHERE user_id = ${userId}
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

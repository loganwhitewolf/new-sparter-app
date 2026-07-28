import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/** One row of the `/amortizations` list (Phase 79 REG-01/REG-03). */
export type AmortizationPlanListRow = {
  id: string
  transactionId: string
  description: string
  displayTitle: string
  transactionDate: Date
  initialAmount: string
  consumedAmount: string
  netValue: string
  remainingMonths: number
  totalMonths: number
  status: 'open' | 'closed'
}

/**
 * Lists every amortization plan for `userId` — open AND closed (D-C1's open-only default is a
 * CLIENT-side filter in AmortizationTable, never a DAL-level one). Written as one raw SQL
 * statement aliased `p` (amortization_plan) / `t` (transaction), mirroring
 * getReimbursementList's alias convention (lib/dal/reimbursement.ts) to avoid ambiguous
 * bare-column-name bugs across tables that share `id`/`user_id` columns.
 *
 * `consumed_amount` is an explicit SUM(amortization_instalment.amount WHERE occurred_at <
 * CURRENT_DATE) — never derived as initial minus net — so a partially-reimbursed-and-re-spread
 * plan (Phase 78 reducePlanTx) stays historically accurate. `net_value` is computed in the SAME
 * statement as total_amount minus that same consumed sum (SQL-side numeric arithmetic, mirroring
 * the getReimbursementAggregates precedent — distinct from the JS-layer Decimal.js rule, which
 * governs application code operating on already-fetched DECIMAL-as-string values).
 * `remaining_months` is a separate correlated COUNT(*) of future instalments.
 *
 * ORDER BY remaining_months ASC (D-C2 default), p.id ASC (deterministic tie-break for two plans
 * sharing the identical remaining_months value).
 *
 * IDOR-safe by construction: the WHERE clause scopes exclusively on p.user_id = userId, resolved
 * server-side from verifySession(), never from a client-supplied filter — this is the query's
 * ONLY WHERE predicate.
 */
export async function getAmortizationPlanList(userId: string): Promise<AmortizationPlanListRow[]> {
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.transaction_id AS transaction_id,
      t.description,
      t.custom_title AS custom_title,
      t.occurred_at AS transaction_date,
      p.total_amount AS initial_amount,
      p.months AS total_months,
      p.status,
      COALESCE(
        (
          SELECT SUM(ai.amount::numeric)::text
          FROM amortization_instalment ai
          WHERE ai.plan_id = p.id AND ai.occurred_at < CURRENT_DATE
        ),
        '0.00'
      ) AS consumed_amount,
      (
        p.total_amount::numeric -
        COALESCE(
          (
            SELECT SUM(ai2.amount::numeric)
            FROM amortization_instalment ai2
            WHERE ai2.plan_id = p.id AND ai2.occurred_at < CURRENT_DATE
          ),
          0
        )
      )::text AS net_value,
      (
        SELECT COUNT(*)
        FROM amortization_instalment ai3
        WHERE ai3.plan_id = p.id AND ai3.occurred_at >= CURRENT_DATE
      ) AS remaining_months
    FROM amortization_plan p
    INNER JOIN transaction t ON t.id = p.transaction_id
    WHERE p.user_id = ${userId}
    ORDER BY
      (
        SELECT COUNT(*)
        FROM amortization_instalment ai4
        WHERE ai4.plan_id = p.id AND ai4.occurred_at >= CURRENT_DATE
      ) ASC,
      p.id ASC
  `)

  const rows = result.rows as {
    id: string
    transaction_id: string
    description: string
    custom_title: string | null
    transaction_date: string
    initial_amount: string
    total_months: number
    status: string
    consumed_amount: string
    net_value: string
    // COUNT(*) returns bigint — the node-postgres driver returns it as a string to avoid
    // silent precision loss above Number.MAX_SAFE_INTEGER; a plan's remaining-months count
    // never approaches that range, so Number() is safe here.
    remaining_months: string
  }[]

  return rows.map((row) => ({
    id: row.id,
    transactionId: row.transaction_id,
    description: row.description,
    displayTitle: (row.custom_title ?? '').trim() || row.description,
    transactionDate: new Date(row.transaction_date),
    initialAmount: row.initial_amount,
    consumedAmount: row.consumed_amount,
    netValue: row.net_value,
    remainingMonths: Number(row.remaining_months),
    totalMonths: row.total_months,
    status: row.status as 'open' | 'closed',
  }))
}

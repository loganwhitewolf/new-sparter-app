import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/**
 * Raw Decimal-safe aggregates for one reimbursement: the anchor's own outflow sum and the sum
 * of every linked refund transaction. Both are DECIMAL-as-string (Drizzle convention) — callers
 * must go through toDecimal() before doing arithmetic (CLAUDE.md — Decimal.js for money).
 */
export type ReimbursementAggregates = {
  outflowSum: string
  refundSum: string
}

/**
 * Resolves the two raw sums `computeReimbursementResidual()` (lib/services/reimbursement.ts)
 * needs to derive the residual: `outflowSum` (the anchor's own spend) and `refundSum` (every
 * refund linked to it so far).
 *
 * IDOR-safe by construction (T-74-05): the WHERE clause scopes BOTH `r.id` and `r.userId`
 * together in the same query, not as a separate post-fetch check. A mismatched id/userId pair
 * (missing id OR a foreign-owned id) returns `undefined` — the same generic "not found" shape as
 * `updateTransaction`'s ownership check, so a caller can never distinguish "doesn't exist" from
 * "belongs to someone else" (no user enumeration).
 *
 * `outflowSum` (D-01/D-02, Phase 74, RMB-02, RMB-06):
 *  - Expense-anchored reimbursement (`expenseId IS NOT NULL`): the single Expense's own
 *    `totalAmount`.
 *  - Group-anchored reimbursement (`expenseGroupId` set): the SUM of `totalAmount` across every
 *    member Expense of the group, resolved via `expense_group_membership`.
 *
 * `refundSum`: the SUM of every linked refund transaction's `amount`, resolved by
 * `reimbursement_id` (not `expense_id` directly) so it covers Group anchors identically to
 * Expense anchors. `COALESCE(..., 0)` makes a reimbursement with zero linked refunds resolve to
 * `'0.00'`, never NULL (RMB-04/RMB-06 empty-refund case).
 */
export async function getReimbursementAggregates(input: {
  reimbursementId: number
  userId: string
}): Promise<ReimbursementAggregates | undefined> {
  // Written as one raw SQL statement with an explicit `r` alias for the outer `reimbursement`
  // row (same convention as effectiveAmount() in lib/dal/transaction-pairs-sql.ts) rather than
  // Drizzle's typed column proxies: `${reimbursement.id}`/`${reimbursement.expenseId}` render as
  // BARE quoted column names ("id", "expense_id"), not table-qualified — inside the correlated
  // subqueries below (which join tables that also have "id"/"expense_id" columns of their own,
  // e.g. reimbursement_refund + transaction both have "id"), that bare reference is ambiguous to
  // Postgres. An explicit `r.` prefix on every outer-row reference resolves it unambiguously.
  const result = await db.execute(sql`
    SELECT
      (
        CASE
          WHEN r.expense_id IS NOT NULL THEN (
            SELECT e.total_amount::text FROM expense e WHERE e.id = r.expense_id
          )
          ELSE (
            SELECT COALESCE(SUM(e2.total_amount::numeric), 0)::text
            FROM expense_group_membership egm
            INNER JOIN expense e2 ON e2.id = egm.expense_id
            WHERE egm.group_id = r.expense_group_id
          )
        END
      ) AS outflow_sum,
      (
        SELECT COALESCE(SUM(rt.amount::numeric), 0)::text
        FROM reimbursement_refund rr
        INNER JOIN transaction rt ON rt.id = rr.transaction_id
        WHERE rr.reimbursement_id = r.id
      ) AS refund_sum
    FROM reimbursement r
    WHERE r.id = ${input.reimbursementId} AND r.user_id = ${input.userId}
    LIMIT 1
  `)

  const row = result.rows[0] as { outflow_sum: string; refund_sum: string } | undefined
  if (!row) {
    return undefined
  }

  return { outflowSum: row.outflow_sum, refundSum: row.refund_sum }
}

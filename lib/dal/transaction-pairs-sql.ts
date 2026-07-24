import 'server-only'

import { sql } from 'drizzle-orm'

import { transaction as transactionTable } from '@/lib/db/schema'

/**
 * WHERE clause fragment: exclude transactions that are a linked REFUND of a reimbursement.
 *
 * A refund is a row where reimbursement_refund.transaction_id = transaction.id exists.
 * Anchor transactions are kept. Transactions not linked to any reimbursement are kept.
 *
 * Generalizes the Phase 50 1:1 legacy-pair-table fragment (D-05/D-06, Phase 73, ADR 0018):
 * the single secondary becomes the set of linked refunds in `reimbursement_refund`.
 *
 * Usage: add to the `and(...)` in every aggregation query WHERE clause alongside
 * dateScopedTransactions() and expenseStatusIncludedInDashboardTotals().
 *
 * IMPORTANT: Always apply together with effectiveAmount() — never one without the other.
 * See 50-RESEARCH.md Pitfalls 1 and 2 for the failure modes when they are decoupled.
 */
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM reimbursement_refund rr
    WHERE rr.transaction_id = ${transactionTable.id}
  )`
}

/**
 * Amount expression: every member transaction of a reimbursement's anchor (an Expense OR an
 * Expense Group) absorbs a PROPORTIONAL SHARE of the linked refunds' net, weighted by that
 * member's own amount (D-01/D-02, Phase 74, ADR 0018, RMB-02). One uniform mechanism applies to
 * both anchor shapes — there is no separate Expense-vs-Group branch:
 *
 *   memberShare = ROUND(refundNet * memberAmount / SUM(memberAmount over the whole anchor), 2)
 *
 * The fractional-cent remainder left after rounding every member's share is assigned by
 * largest-remainder to the largest-magnitude member (tie-broken by occurredAt ASC, then id ASC —
 * the same deterministic tie-break Phase 73's Q3 scenario established), so per-transaction shares
 * always sum back to the exact refund net at the centesimo (RMB-02/precision, RMB-02/ordering).
 *
 * This supersedes Phase 73's "earliest transaction gets the whole net" resolution: that rule is
 * the correct-by-construction N=1 degenerate case of this same formula (a single member absorbs
 * 100% of the share by definition), so every N=1 regression scenario stays numerically inert.
 *
 * Zero-sum guard (RMB-02/empty): NULLIF on the member-amount-sum denominator turns a member set
 * that sums to exactly zero into SQL NULL instead of a division error; every member's share then
 * degenerates to NULL, and the COALESCE at the very end of this expression (and on each
 * intermediate share) falls back to the member's own raw amount, unchanged — never a crash.
 *
 * Anchor + member-set resolution: a correlated `anchor` CTE finds at most one reimbursement whose
 * expense_id OR expense_group_id (via expense_group_membership) contains the outer row's
 * expense — at most one match given the existing reimbursement_expenseId_unique /
 * reimbursement_expenseGroupId_unique / expense_group_membership_expense_unique constraints.
 * `member_expense_ids` resolves the anchor's member Expense id(s): exactly `{anchor.expense_id}`
 * for an Expense-shaped anchor, or every member's expense_id for a Group-shaped anchor.
 * `refund_total` resolves by reimbursement id (not expense_id directly) so it covers Group
 * anchors identically to Expense anchors.
 *
 * A transaction with no anchor at all resolves an empty `anchor` CTE, so every downstream CTE is
 * empty too, and the outer COALESCE falls back to 0 — identical to today's ELSE branch, now
 * reached structurally (an empty spread) rather than via a second CASE arm.
 *
 * Usage: replace `${transactionTable.amount}` with effectiveAmount() inside SUM()
 * CASE expressions in every aggregation query.
 *
 * Example:
 *   sql`coalesce(sum(case when ${direction.code} = 'in' then ${effectiveAmount()} else 0 end), 0)::text`
 *
 * IMPORTANT: Always apply together with isNotSecondary() in the WHERE clause.
 */
export function effectiveAmount() {
  return sql`(
    ${transactionTable.amount}::numeric + COALESCE((
      WITH anchor AS (
        SELECT r.id AS reimbursement_id, r.expense_id, r.expense_group_id
        FROM reimbursement r
        WHERE r.expense_id = ${transactionTable.expenseId}
           OR r.expense_group_id = (
             SELECT egm.group_id FROM expense_group_membership egm
             WHERE egm.expense_id = ${transactionTable.expenseId}
           )
        LIMIT 1
      ),
      member_expense_ids AS (
        SELECT COALESCE(a.expense_id, egm2.expense_id) AS expense_id
        FROM anchor a
        LEFT JOIN expense_group_membership egm2 ON egm2.group_id = a.expense_group_id
      ),
      member_transactions AS (
        SELECT m.id, m.amount::numeric AS amount, m.occurred_at
        FROM transaction m
        WHERE m.expense_id IN (SELECT expense_id FROM member_expense_ids)
          AND NOT EXISTS (
            SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id
          )
      ),
      refund_total AS (
        SELECT COALESCE(SUM(rt.amount::numeric), 0) AS total
        FROM reimbursement_refund rr
        INNER JOIN transaction rt ON rt.id = rr.transaction_id, anchor a
        WHERE rr.reimbursement_id = a.reimbursement_id
      ),
      raw_shares AS (
        SELECT
          mt.id,
          ROUND(
            (SELECT total FROM refund_total) * mt.amount
              / NULLIF((SELECT SUM(amount) FROM member_transactions), 0),
            2
          ) AS raw_share,
          ROW_NUMBER() OVER (
            ORDER BY ABS(mt.amount) DESC, mt.occurred_at ASC, mt.id ASC
          ) AS rn
        FROM member_transactions mt
      ),
      member_shares AS (
        SELECT
          id,
          COALESCE(raw_share, 0) + CASE
            WHEN rn = 1 THEN (SELECT total FROM refund_total) - SUM(raw_share) OVER ()
            ELSE 0
          END AS final_share
        FROM raw_shares
      )
      SELECT final_share FROM member_shares WHERE id = ${transactionTable.id}
    ), 0)
  )`
}

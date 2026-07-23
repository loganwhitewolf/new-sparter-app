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
 * Amount expression: for a reimbursement ANCHOR transaction, returns the algebraic net
 * (anchor.amount + SUM of every linked refund transaction's amount). For every other
 * transaction (unlinked, or a linked refund itself), returns the row's own amount.
 *
 * Generalizes the Phase 50 1:1 legacy-pair-table fragment (D-05/D-06, Phase 73, ADR 0018):
 * "the one secondary" becomes "the set of linked refunds."
 *
 * Anchor resolution (Q3, 73-CONTEXT.md Claude's Discretion): D-03's `reimbursement.expenseId`
 * FK is Expense-level, not transaction-level, but netting must still resolve to one specific
 * transaction row. A transaction T is the anchor of a reimbursement when a `reimbursement` row's
 * expense_id equals T's expense_id AND T is the earliest transaction of that expense
 * (ORDER BY occurred_at ASC, id ASC LIMIT 1 — deterministic tie-break). This is the concrete,
 * tested resolution for a multi-transaction Expense anchor; verified against the N=1 case in
 * Task 3.
 *
 * The expense_group_id branch is intentionally NOT netted here: no code path creates
 * expenseGroupId-anchored reimbursement rows until Phase 74 (RMB-02), so a Group-anchored
 * reimbursement is a documented, not silent, gap — Phase 74 adds group-level netting.
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
    CASE
      WHEN EXISTS (
        SELECT 1 FROM reimbursement r
        WHERE r.expense_id = ${transactionTable.expenseId}
        AND ${transactionTable.id} = (
          SELECT t2.id FROM transaction t2
          WHERE t2.expense_id = ${transactionTable.expenseId}
          ORDER BY t2.occurred_at ASC, t2.id ASC
          LIMIT 1
        )
      )
      THEN ${transactionTable.amount}::numeric + COALESCE((
        SELECT SUM(rt.amount::numeric)
        FROM reimbursement r2
        INNER JOIN reimbursement_refund rr ON rr.reimbursement_id = r2.id
        INNER JOIN transaction rt ON rt.id = rr.transaction_id
        WHERE r2.expense_id = ${transactionTable.expenseId}
      ), 0)
      ELSE ${transactionTable.amount}::numeric
    END
  )`
}

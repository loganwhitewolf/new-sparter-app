import 'server-only'

import { sql } from 'drizzle-orm'

import { transaction as transactionTable } from '@/lib/db/schema'

/**
 * WHERE clause fragment: exclude transactions that are the SECONDARY (B) in a pair.
 *
 * A secondary is a row where transaction_pair.transaction_b_id = transaction.id exists.
 * Primary transactions (A) are kept. Unpaired transactions are kept.
 *
 * Usage: add to the `and(...)` in every aggregation query WHERE clause alongside
 * dateScopedTransactions() and expenseStatusIncludedInDashboardTotals().
 *
 * IMPORTANT: Always apply together with effectiveAmount() — never one without the other.
 * See 50-RESEARCH.md Pitfalls 1 and 2 for the failure modes when they are decoupled.
 */
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM transaction_pair tp
    WHERE tp.transaction_b_id = ${transactionTable.id}
  )`
}

/**
 * Amount expression: for primary (A) transactions, returns the algebraic net
 * (A.amount + B.amount). For unpaired transactions, returns the row's own amount.
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
        SELECT 1 FROM transaction_pair tp WHERE tp.transaction_a_id = ${transactionTable.id}
      )
      THEN ${transactionTable.amount}::numeric + (
        SELECT t2.amount::numeric
        FROM transaction_pair tp2
        INNER JOIN transaction t2 ON t2.id = tp2.transaction_b_id
        WHERE tp2.transaction_a_id = ${transactionTable.id}
      )
      ELSE ${transactionTable.amount}::numeric
    END
  )`
}

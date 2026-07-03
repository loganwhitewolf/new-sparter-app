import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expense, transaction as transactionTable } from '@/lib/db/schema'
import { reconcileExpensesAfterTransactionRemoval } from '@/lib/services/expense-reconciliation'

export type DeleteTransactionsResult = {
  deletedTransactionIds: string[]
}

/**
 * Deletes transactions owned by the user and reconciles linked expenses (totals / removal),
 * matching the rules used when removing an import (manual/override expenses preserved as empty).
 */
export async function deleteTransactionsAndReconcileExpenses(input: {
  userId: string
  transactionIds: string[]
  /** When true, also deletes expenses that had exactly one linked transaction among those removed. */
  deleteLinkedExpenses?: boolean
}): Promise<DeleteTransactionsResult> {
  const uniqueIds = [...new Set(input.transactionIds)]
  if (uniqueIds.length === 0) {
    return { deletedTransactionIds: [] }
  }

  return db.transaction(async (tx) => {
    const targets = await tx
      .select({
        id: transactionTable.id,
        expenseId: transactionTable.expenseId,
      })
      .from(transactionTable)
      .where(
        and(eq(transactionTable.userId, input.userId), inArray(transactionTable.id, uniqueIds)),
      )

    if (targets.length === 0) {
      return { deletedTransactionIds: [] }
    }

    const idsToDelete = targets.map((row) => row.id)
    const affectedExpenseIds = [
      ...new Set(targets.map((row) => row.expenseId).filter(Boolean) as string[]),
    ]

    const oneToOneExpenseIds = new Set<string>()
    if (input.deleteLinkedExpenses && affectedExpenseIds.length > 0) {
      const counts = await tx
        .select({
          expenseId: transactionTable.expenseId,
          transactionCount: sql<number>`count(${transactionTable.id})::int`,
        })
        .from(transactionTable)
        .where(
          and(
            eq(transactionTable.userId, input.userId),
            inArray(transactionTable.expenseId, affectedExpenseIds),
          ),
        )
        .groupBy(transactionTable.expenseId)

      const countByExpenseId = new Map(
        counts
          .filter((row): row is { expenseId: string; transactionCount: number } =>
            Boolean(row.expenseId),
          )
          .map((row) => [row.expenseId, row.transactionCount]),
      )

      for (const target of targets) {
        if (!target.expenseId) continue
        if (countByExpenseId.get(target.expenseId) === 1) {
          oneToOneExpenseIds.add(target.expenseId)
        }
      }
    }

    await tx
      .delete(transactionTable)
      .where(
        and(eq(transactionTable.userId, input.userId), inArray(transactionTable.id, idsToDelete)),
      )

    if (affectedExpenseIds.length === 0) {
      return { deletedTransactionIds: idsToDelete }
    }

    const expenseIdsToReconcile = affectedExpenseIds.filter((id) => !oneToOneExpenseIds.has(id))

    if (expenseIdsToReconcile.length > 0) {
      await reconcileExpensesAfterTransactionRemoval(tx, {
        userId: input.userId,
        affectedExpenseIds: expenseIdsToReconcile,
      })
    }

    if (oneToOneExpenseIds.size > 0) {
      await tx
        .delete(expense)
        .where(
          and(
            eq(expense.userId, input.userId),
            inArray(expense.id, [...oneToOneExpenseIds]),
          ),
        )
    }

    return { deletedTransactionIds: idsToDelete }
  })
}

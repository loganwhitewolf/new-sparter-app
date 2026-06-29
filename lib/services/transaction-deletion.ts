import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transaction as transactionTable } from '@/lib/db/schema'
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

    await tx
      .delete(transactionTable)
      .where(
        and(eq(transactionTable.userId, input.userId), inArray(transactionTable.id, idsToDelete)),
      )

    if (affectedExpenseIds.length === 0) {
      return { deletedTransactionIds: idsToDelete }
    }

    await reconcileExpensesAfterTransactionRemoval(tx, {
      userId: input.userId,
      affectedExpenseIds,
    })

    return { deletedTransactionIds: idsToDelete }
  })
}

import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expense, expenseGroupMembership, transaction as transactionTable } from '@/lib/db/schema'
import {
  cleanupFinanceLinksForExpenses,
  deleteEmptyReimbursementsForUser,
} from '@/lib/services/linked-finance-cleanup'

export type DeleteExpensesResult = {
  deletedExpenseIds: string[]
  deletedTransactionIds: string[]
}

/**
 * Deletes expenses owned by the user. Optionally deletes linked transactions first.
 * When deleteLinkedTransactions is false, transactions keep their row with expenseId set null (FK).
 */
export async function deleteExpensesWithOptions(input: {
  userId: string
  expenseIds: string[]
  deleteLinkedTransactions?: boolean
}): Promise<DeleteExpensesResult> {
  const uniqueExpenseIds = [...new Set(input.expenseIds)]
  if (uniqueExpenseIds.length === 0) {
    return { deletedExpenseIds: [], deletedTransactionIds: [] }
  }

  return db.transaction(async (tx) => {
    const ownedExpenses = await tx
      .select({ id: expense.id })
      .from(expense)
      .where(and(eq(expense.userId, input.userId), inArray(expense.id, uniqueExpenseIds)))

    const expenseIdsToDelete = ownedExpenses.map((row) => row.id)
    if (expenseIdsToDelete.length === 0) {
      return { deletedExpenseIds: [], deletedTransactionIds: [] }
    }

    // D-03 defense-in-depth: a grouped expense's category/lifecycle is owned by the
    // group (ADR 0017) — deleting a member directly would silently shrink or orphan
    // its expense_group via ON DELETE CASCADE with zero warning to the user. Reject
    // before any delete runs; nothing is written.
    const groupedMemberships = await tx
      .select({ expenseId: expenseGroupMembership.expenseId })
      .from(expenseGroupMembership)
      .where(inArray(expenseGroupMembership.expenseId, expenseIdsToDelete))

    if (groupedMemberships.length > 0) {
      throw new Error(
        'Una o più spese fanno parte di un gruppo: rimuovile dal gruppo prima di eliminarle.',
      )
    }

    const linkedTransactions = await tx
      .select({ id: transactionTable.id })
      .from(transactionTable)
      .where(
        and(
          eq(transactionTable.userId, input.userId),
          inArray(transactionTable.expenseId, expenseIdsToDelete),
        ),
      )

    const linkedTransactionIds = linkedTransactions.map((row) => row.id)

    // Always drop plans + reimbursements tied to this expense / its txs (even if txs are kept).
    await cleanupFinanceLinksForExpenses(tx, {
      userId: input.userId,
      expenseIds: expenseIdsToDelete,
      linkedTransactionIds,
    })

    let deletedTransactionIds: string[] = []

    if (input.deleteLinkedTransactions) {
      deletedTransactionIds = linkedTransactionIds

      if (deletedTransactionIds.length > 0) {
        await tx
          .delete(transactionTable)
          .where(
            and(
              eq(transactionTable.userId, input.userId),
              inArray(transactionTable.id, deletedTransactionIds),
            ),
          )
      }
    }

    await tx
      .delete(expense)
      .where(and(eq(expense.userId, input.userId), inArray(expense.id, expenseIdsToDelete)))

    await deleteEmptyReimbursementsForUser(tx, input.userId)

    return { deletedExpenseIds: expenseIdsToDelete, deletedTransactionIds }
  })
}

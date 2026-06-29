import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expense, transaction as transactionTable } from '@/lib/db/schema'
import { reconcileExpensesAfterTransactionRemoval } from '@/lib/services/expense-reconciliation'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

export type DetachTransactionErrorCode =
  | 'TRANSACTION_NOT_FOUND'
  | 'NO_EXPENSE_LINKED'
  | 'SINGLE_TRANSACTION_EXPENSE'

export class DetachTransactionError extends Error {
  readonly code: DetachTransactionErrorCode

  constructor(code: DetachTransactionErrorCode, message: string) {
    super(message)
    this.name = 'DetachTransactionError'
    this.code = code
  }
}

function syntheticDescriptionHash(transactionId: string): string {
  return createHash('sha256').update(`detached:${transactionId}`).digest('hex')
}

export type DetachTransactionResult = {
  newExpenseId: string
  newExpenseTitle: string
}

export async function detachTransactionToDedicatedExpense(input: {
  userId: string
  transactionId: string
  title: string
}): Promise<DetachTransactionResult> {
  const trimmedTitle = input.title.trim().slice(0, 120)
  if (!trimmedTitle) {
    throw new DetachTransactionError('TRANSACTION_NOT_FOUND', 'Titolo spesa obbligatorio.')
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        transactionId: transactionTable.id,
        transactionUserId: transactionTable.userId,
        transactionAmount: transactionTable.amount,
        transactionOccurredAt: transactionTable.occurredAt,
        expenseId: transactionTable.expenseId,
        expenseUserId: expense.userId,
        expenseTransactionCount: expense.transactionCount,
      })
      .from(transactionTable)
      .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
      .where(
        and(
          eq(transactionTable.id, input.transactionId),
          eq(transactionTable.userId, input.userId),
          eq(expense.userId, input.userId),
        ),
      )
      .limit(1)

    const row = rows[0]
    if (!row) {
      throw new DetachTransactionError(
        'TRANSACTION_NOT_FOUND',
        'Transazione non trovata.',
      )
    }

    if (!row.expenseId) {
      throw new DetachTransactionError(
        'NO_EXPENSE_LINKED',
        'La transazione non è collegata a una spesa.',
      )
    }

    if ((row.expenseTransactionCount ?? 0) <= 1) {
      throw new DetachTransactionError(
        'SINGLE_TRANSACTION_EXPENSE',
        'Non è possibile separare l\'unica transazione della spesa.',
      )
    }

    const sourceExpenseId = row.expenseId
    const newExpenseId = crypto.randomUUID()
    const descriptionHash = syntheticDescriptionHash(input.transactionId)

    await tx.insert(expense).values({
      id: newExpenseId,
      userId: input.userId,
      title: trimmedTitle,
      descriptionHash,
      subCategoryId: null,
      totalAmount: toDbDecimal(toDecimal(row.transactionAmount)),
      transactionCount: 1,
      importedFromFileId: null,
      firstTransactionAt: row.transactionOccurredAt,
      lastTransactionAt: row.transactionOccurredAt,
      status: '1',
    })

    await tx
      .update(transactionTable)
      .set({ expenseId: newExpenseId })
      .where(
        and(
          eq(transactionTable.id, input.transactionId),
          eq(transactionTable.userId, input.userId),
        ),
      )

    await reconcileExpensesAfterTransactionRemoval(tx, {
      userId: input.userId,
      affectedExpenseIds: [sourceExpenseId],
    })

    return { newExpenseId, newExpenseTitle: trimmedTitle }
  })
}

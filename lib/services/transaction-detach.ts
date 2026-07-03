import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { expense, transaction as transactionTable } from '@/lib/db/schema'
import { reconcileExpensesAfterTransactionRemoval } from '@/lib/services/expense-reconciliation'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

export type DetachTransactionErrorCode = 'TRANSACTION_NOT_FOUND' | 'NO_EXPENSE_LINKED'

export class DetachTransactionError extends Error {
  readonly code: DetachTransactionErrorCode

  constructor(code: DetachTransactionErrorCode, message: string) {
    super(message)
    this.name = 'DetachTransactionError'
    this.code = code
  }
}

export function syntheticDescriptionHash(transactionId: string): string {
  return createHash('sha256').update(`detached:${transactionId}`).digest('hex')
}

export type DetachTransactionResult = {
  newExpenseId: string
  newExpenseTitle: string
}

export type DetachCleanupInput = {
  userId: string
  transactionId: string
  title: string
  subCategoryId?: number | null
}

/**
 * Tx-accepting core of the "spesa a sé" cleanup. Runs against a passed-in tx
 * handle so callers can compose it inside a larger db.transaction (project hard
 * rule: ownership-validating writes run inside db.transaction; helpers accept a tx).
 *
 * Behavior (unchanged from the original inline body):
 *  - Trims/validates the title (empty after trim throws before any write).
 *  - 1:1 source expense (transactionCount ≤ 1): re-hash in place with a synthetic
 *    descriptionHash + title, and — when subCategoryId is provided — subCategoryId
 *    + status '3'. No insert, no reconcile.
 *  - multi-transaction source: insert a new dedicated expense, repoint the
 *    transaction, and reconcile the source.
 */
export async function applyDetachCleanupTx(
  tx: DbOrTx,
  input: DetachCleanupInput,
): Promise<DetachTransactionResult> {
  const trimmedTitle = input.title.trim().slice(0, 120)
  if (!trimmedTitle) {
    throw new DetachTransactionError('TRANSACTION_NOT_FOUND', 'Titolo spesa obbligatorio.')
  }

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

  const sourceExpenseId = row.expenseId
  const descriptionHash = syntheticDescriptionHash(input.transactionId)
  const hasSubCategoryId = input.subCategoryId !== undefined

  if ((row.expenseTransactionCount ?? 0) <= 1) {
    // Single-transaction source: re-hash the existing expense row in place.
    // No new expense is created and no reconcile is needed — the transaction
    // already points at this expense id, so there is no separate source to
    // clean up (ADR 0016 decision 4).
    await tx
      .update(expense)
      .set({
        descriptionHash,
        title: trimmedTitle,
        updatedAt: new Date(),
        ...(hasSubCategoryId
          ? { subCategoryId: input.subCategoryId, status: '3' as const }
          : {}),
      })
      .where(and(eq(expense.id, sourceExpenseId), eq(expense.userId, input.userId)))

    return { newExpenseId: sourceExpenseId, newExpenseTitle: trimmedTitle }
  }

  const newExpenseId = crypto.randomUUID()

  await tx.insert(expense).values({
    id: newExpenseId,
    userId: input.userId,
    title: trimmedTitle,
    descriptionHash,
    subCategoryId: hasSubCategoryId ? input.subCategoryId : null,
    totalAmount: toDbDecimal(toDecimal(row.transactionAmount)),
    transactionCount: 1,
    importedFromFileId: null,
    firstTransactionAt: row.transactionOccurredAt,
    lastTransactionAt: row.transactionOccurredAt,
    status: hasSubCategoryId ? '3' : '1',
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
}

export async function detachTransactionToDedicatedExpense(
  input: DetachCleanupInput,
): Promise<DetachTransactionResult> {
  return db.transaction(async (tx) => applyDetachCleanupTx(tx, input))
}

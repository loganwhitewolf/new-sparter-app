import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { amortizationPlan, expense, transaction as transactionTable } from '@/lib/db/schema'
import { reconcileExpensesAfterTransactionRemoval } from '@/lib/services/expense-reconciliation'
import { computeDescriptionHash } from '@/lib/utils/import'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

export type DetachTransactionErrorCode =
  | 'TRANSACTION_NOT_FOUND'
  | 'NO_EXPENSE_LINKED'
  | 'PLAN_NOT_FOUND'

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
 * Tx-accepting core of the standalone-expense (detach) cleanup. Runs against a
 * passed-in tx handle so callers can compose it inside a larger db.transaction
 * (project hard rule: ownership-validating writes run inside db.transaction;
 * helpers accept a tx).
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
  const trimmedTitle = input.title.trim()
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
  // CR-01 fix: gate on "actually has a category" (non-null), not merely "key was supplied".
  // Callers such as activatePlanTx always pass the `subCategoryId` key — including an explicit
  // `null` when the source expense was uncategorized — so gating on `!== undefined` treated an
  // uncategorized source as categorized. `!= null` also matches `undefined` (loose equality), so
  // callers that omit the key entirely (detachTransactionToDedicatedExpense) keep their existing
  // behavior unchanged.
  const hasSubCategoryId = input.subCategoryId != null

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

export type ReverseDetachInput = {
  userId: string
  transactionId: string
  planId: string
}

export type ReverseDetachResult = {
  expenseId: string
}

/**
 * D-09 undo: the inverse of applyDetachCleanupTx's forced detach. Deletes the amortization plan
 * (cascading its instalments via the FK) and re-attaches the transaction to its shared Expense —
 * recomputing the transaction's ORIGINAL descriptionHash via computeDescriptionHash(description)
 * (description is immutable, ADR 0019 §3), never reading it from a stored snapshot since none
 * exists. Merges into an existing shared Expense with that hash when one exists, or creates a
 * fresh one carrying forward the abandoned Standalone Expense's current subCategoryId/status.
 *
 * Ownership (T-77-06): the plan lookup is scoped `id=planId AND userId=userId AND
 * transactionId=transactionId` — a foreign planId/transactionId combination resolves to "not
 * found" and throws before any write, never another user's plan.
 *
 * Atomicity (T-77-07): every write here (expenseId re-point, plan delete, both reconcile calls)
 * runs against the SAME passed-in `tx` — no nested db.transaction — so callers compose this
 * inside a larger db.transaction and a failure anywhere rolls back the whole operation.
 */
export async function reverseDetachTx(
  tx: DbOrTx,
  input: ReverseDetachInput,
): Promise<ReverseDetachResult> {
  const planRows = await tx
    .select({ id: amortizationPlan.id })
    .from(amortizationPlan)
    .where(
      and(
        eq(amortizationPlan.id, input.planId),
        eq(amortizationPlan.userId, input.userId),
        eq(amortizationPlan.transactionId, input.transactionId),
      ),
    )
    .limit(1)

  if (!planRows[0]) {
    throw new DetachTransactionError('PLAN_NOT_FOUND', 'Pianificazione non trovata.')
  }

  const rows = await tx
    .select({
      description: transactionTable.description,
      amount: transactionTable.amount,
      occurredAt: transactionTable.occurredAt,
      standaloneExpenseId: transactionTable.expenseId,
      subCategoryId: expense.subCategoryId,
      status: expense.status,
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
  if (!row || !row.standaloneExpenseId) {
    throw new DetachTransactionError('TRANSACTION_NOT_FOUND', 'Transazione non trovata.')
  }

  const standaloneExpenseId = row.standaloneExpenseId
  const originalDescriptionHash = computeDescriptionHash(row.description)

  const existingRows = await tx
    .select({ id: expense.id })
    .from(expense)
    .where(
      and(
        eq(expense.userId, input.userId),
        eq(expense.descriptionHash, originalDescriptionHash),
        ne(expense.id, standaloneExpenseId),
      ),
    )
    .limit(1)

  let targetExpenseId: string
  if (existingRows[0]) {
    targetExpenseId = existingRows[0].id
  } else {
    targetExpenseId = crypto.randomUUID()
    await tx.insert(expense).values({
      id: targetExpenseId,
      userId: input.userId,
      title: row.description,
      descriptionHash: originalDescriptionHash,
      subCategoryId: row.subCategoryId,
      status: row.status,
      totalAmount: toDbDecimal(toDecimal(row.amount)),
      transactionCount: 1,
      importedFromFileId: null,
      firstTransactionAt: row.occurredAt,
      lastTransactionAt: row.occurredAt,
    })
  }

  await tx
    .update(transactionTable)
    .set({ expenseId: targetExpenseId })
    .where(
      and(
        eq(transactionTable.id, input.transactionId),
        eq(transactionTable.userId, input.userId),
      ),
    )

  // Cascades amortization_instalment automatically via its plan_id FK (onDelete: 'cascade').
  await tx.delete(amortizationPlan).where(eq(amortizationPlan.id, input.planId))

  await reconcileExpensesAfterTransactionRemoval(tx, {
    userId: input.userId,
    affectedExpenseIds: [targetExpenseId, standaloneExpenseId],
  })

  return { expenseId: targetExpenseId }
}

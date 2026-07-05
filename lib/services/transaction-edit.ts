import 'server-only'

import { and, eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transaction, transactionPair } from '@/lib/db/schema'
import {
  applyExpenseReconciliation,
  buildReconcilePlan,
  loadAggregatesForExpenses,
  loadManualOrOverrideExpenseIds,
} from '@/lib/services/expense-reconciliation'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

/**
 * Service-level input — distinct from the Zod-inferred action-level type.
 * The action converts occurredAt (string) to Date and normalizes amount via
 * Decimal before calling this service, exactly as createTransaction does for
 * CreateTransactionSchema.
 */
export type UpdateTransactionInput = {
  userId: string
  transactionId: string
  amount?: string
  occurredAt?: Date
  customTitle?: string | null
}

/**
 * Edits a transaction's amount, occurredAt, and/or customTitle atomically.
 *
 * Immutability (T-62-02): transactionHash, descriptionHash, and description
 * are never part of the allowlisted `.set()` payload — no code path in this
 * function can assign those columns.
 *
 * Reconciliation (DET-02 / T-62-04): when amount or occurredAt changes and the
 * transaction is linked to an expense, the expense's derived aggregates are
 * recomputed via the same reconciliation helpers used elsewhere, inside this
 * same db.transaction (tx, never db).
 *
 * Pair guard (DET-03 / T-62-03, T-62-01): an amount edit on a paired
 * transaction that would break the pair's opposite-sign/nonzero invariant is
 * rejected with the Italian message "Scollega prima il rimborso" before any
 * write runs. Ownership (T-62-01) is enforced by scoping the initial SELECT
 * to both id and userId — an absent or foreign-owned row throws the same
 * generic "Transazione non trovata." message (no user enumeration).
 */
export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<{ success: true }> {
  if (input.amount === undefined && input.occurredAt === undefined && input.customTitle === undefined) {
    throw new Error('Nessun campo da modificare.')
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: transaction.id,
        userId: transaction.userId,
        amount: transaction.amount,
        expenseId: transaction.expenseId,
      })
      .from(transaction)
      .where(and(eq(transaction.id, input.transactionId), eq(transaction.userId, input.userId)))
      .limit(1)

    const row = rows[0]
    if (!row) {
      throw new Error('Transazione non trovata.')
    }

    if (input.amount !== undefined) {
      const pairRows = await tx
        .select({
          transactionAId: transactionPair.transactionAId,
          transactionBId: transactionPair.transactionBId,
        })
        .from(transactionPair)
        .where(
          or(
            eq(transactionPair.transactionAId, input.transactionId),
            eq(transactionPair.transactionBId, input.transactionId),
          ),
        )
        .limit(1)

      const pair = pairRows[0]
      if (pair) {
        const counterId =
          pair.transactionAId === input.transactionId ? pair.transactionBId : pair.transactionAId

        const counterRows = await tx
          .select({ amount: transaction.amount })
          .from(transaction)
          .where(eq(transaction.id, counterId))
          .limit(1)

        const newAmount = toDecimal(input.amount)
        const counterAmount = toDecimal(counterRows[0]?.amount ?? '0')
        const oppositeSign =
          (newAmount.gt(0) && counterAmount.lt(0)) || (newAmount.lt(0) && counterAmount.gt(0))

        if (!oppositeSign) {
          throw new Error('Scollega prima il rimborso')
        }
      }
    }

    // The transaction table has no updatedAt column (schema.ts) — only
    // createdAt. The allowlist below is the only source of truth for what
    // this function can write; hashes/description are structurally absent.
    const updateSet: Record<string, unknown> = {}
    if (input.amount !== undefined) {
      updateSet.amount = toDbDecimal(toDecimal(input.amount))
    }
    if (input.occurredAt !== undefined) {
      updateSet.occurredAt = input.occurredAt
    }
    if (input.customTitle !== undefined) {
      updateSet.customTitle = input.customTitle
    }

    await tx
      .update(transaction)
      .set(updateSet)
      .where(and(eq(transaction.id, input.transactionId), eq(transaction.userId, input.userId)))

    if ((input.amount !== undefined || input.occurredAt !== undefined) && row.expenseId) {
      const expenseId = row.expenseId
      const aggregates = await loadAggregatesForExpenses(tx, {
        userId: input.userId,
        expenseIds: [expenseId],
      })
      const manualIds = await loadManualOrOverrideExpenseIds(tx, {
        userId: input.userId,
        affectedExpenseIds: [expenseId],
      })
      const plan = buildReconcilePlan([expenseId], aggregates, manualIds)
      await applyExpenseReconciliation(tx, plan, input.userId)
    }

    return { success: true }
  })
}

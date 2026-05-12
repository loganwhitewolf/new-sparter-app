import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import {
  expense,
  expenseClassificationHistory,
  transaction as transactionTable,
} from '@/lib/db/schema'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

const MANUAL_PRESERVE_SOURCES = ['manual', 'override'] as const
const ZERO_AMOUNT = '0.00'

type ExpenseAggregateRow = {
  expenseId: string | null
  totalAmount: string | null
  transactionCount: number | string | bigint
  firstTransactionAt: Date | string | null
  lastTransactionAt: Date | string | null
}

type ReconcilePlan = {
  recalculatedExpenseIds: string[]
  deletedExpenseIds: string[]
  preservedExpenseIds: string[]
  remainingByExpenseId: Map<string, ExpenseAggregateRow>
}

function numericCount(value: number | string | bigint | null | undefined) {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0
  return value ?? 0
}

function timestampForExpenseColumn(value: Date | string | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

async function loadAggregatesForExpenses(
  database: DbOrTx,
  input: { userId: string; expenseIds: string[] },
) {
  if (input.expenseIds.length === 0) return []

  return database
    .select({
      expenseId: transactionTable.expenseId,
      totalAmount: sql<string>`coalesce(sum(${transactionTable.amount}), 0)::text`,
      transactionCount: sql<number>`count(${transactionTable.id})::int`,
      firstTransactionAt: sql<Date | null>`min(${transactionTable.occurredAt})`,
      lastTransactionAt: sql<Date | null>`max(${transactionTable.occurredAt})`,
    })
    .from(transactionTable)
    .where(
      and(
        eq(transactionTable.userId, input.userId),
        inArray(transactionTable.expenseId, input.expenseIds),
      ),
    )
    .groupBy(transactionTable.expenseId) as Promise<ExpenseAggregateRow[]>
}

async function loadManualOrOverrideExpenseIds(
  database: DbOrTx,
  input: { userId: string; affectedExpenseIds: string[] },
) {
  if (input.affectedExpenseIds.length === 0) return new Set<string>()

  const rows = await database
    .select({ expenseId: expenseClassificationHistory.expenseId })
    .from(expenseClassificationHistory)
    .where(
      and(
        eq(expenseClassificationHistory.userId, input.userId),
        inArray(expenseClassificationHistory.expenseId, input.affectedExpenseIds),
        inArray(expenseClassificationHistory.source, [...MANUAL_PRESERVE_SOURCES]),
      ),
    )

  return new Set(rows.map((row) => row.expenseId))
}

function buildReconcilePlan(
  affectedExpenseIds: string[],
  aggregates: ExpenseAggregateRow[],
  manuallyPreservedExpenseIds: Set<string>,
): ReconcilePlan {
  const remainingByExpenseId = new Map(
    aggregates
      .filter((row): row is ExpenseAggregateRow & { expenseId: string } => Boolean(row.expenseId))
      .map((row) => [row.expenseId, row]),
  )

  const recalculatedExpenseIds: string[] = []
  const deletedExpenseIds: string[] = []
  const preservedExpenseIds: string[] = []

  for (const expenseId of affectedExpenseIds) {
    const remaining = remainingByExpenseId.get(expenseId)
    if (remaining && numericCount(remaining.transactionCount) > 0) {
      recalculatedExpenseIds.push(expenseId)
    } else if (manuallyPreservedExpenseIds.has(expenseId)) {
      preservedExpenseIds.push(expenseId)
    } else {
      deletedExpenseIds.push(expenseId)
    }
  }

  return {
    recalculatedExpenseIds,
    deletedExpenseIds,
    preservedExpenseIds,
    remainingByExpenseId,
  }
}

async function applyExpenseReconciliation(
  database: DbOrTx,
  plan: ReconcilePlan,
  userId: string,
) {
  for (const expenseId of plan.recalculatedExpenseIds) {
    const aggregate = plan.remainingByExpenseId.get(expenseId)
    if (!aggregate) continue

    await database
      .update(expense)
      .set({
        totalAmount: toDbDecimal(toDecimal(aggregate.totalAmount ?? ZERO_AMOUNT)),
        transactionCount: numericCount(aggregate.transactionCount),
        firstTransactionAt: timestampForExpenseColumn(aggregate.firstTransactionAt),
        lastTransactionAt: timestampForExpenseColumn(aggregate.lastTransactionAt),
        importedFromFileId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, expenseId), eq(expense.userId, userId)))
  }

  for (const expenseId of plan.preservedExpenseIds) {
    await database
      .update(expense)
      .set({
        totalAmount: ZERO_AMOUNT,
        transactionCount: 0,
        firstTransactionAt: null,
        lastTransactionAt: null,
        importedFromFileId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, expenseId), eq(expense.userId, userId)))
  }

  if (plan.deletedExpenseIds.length > 0) {
    await database
      .delete(expense)
      .where(and(eq(expense.userId, userId), inArray(expense.id, plan.deletedExpenseIds)))
  }
}

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

    const aggregates = await loadAggregatesForExpenses(tx, {
      userId: input.userId,
      expenseIds: affectedExpenseIds,
    })
    const manualIds = await loadManualOrOverrideExpenseIds(tx, {
      userId: input.userId,
      affectedExpenseIds,
    })
    const plan = buildReconcilePlan(affectedExpenseIds, aggregates, manualIds)
    await applyExpenseReconciliation(tx, plan, input.userId)

    return { deletedTransactionIds: idsToDelete }
  })
}

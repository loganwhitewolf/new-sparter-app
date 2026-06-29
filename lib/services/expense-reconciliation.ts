import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import {
  expense,
  expenseClassificationHistory,
  transaction as transactionTable,
} from '@/lib/db/schema'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

const MANUAL_PRESERVE_SOURCES = ['manual', 'override'] as const
const ZERO_AMOUNT = '0.00'

export type ExpenseAggregateRow = {
  expenseId: string | null
  totalAmount: string | null
  transactionCount: number | string | bigint
  firstTransactionAt: Date | string | null
  lastTransactionAt: Date | string | null
}

export type ReconcilePlan = {
  recalculatedExpenseIds: string[]
  deletedExpenseIds: string[]
  preservedExpenseIds: string[]
  remainingByExpenseId: Map<string, ExpenseAggregateRow>
}

export function numericCount(value: number | string | bigint | null | undefined) {
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

export async function loadAggregatesForExpenses(
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

export async function loadManualOrOverrideExpenseIds(
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

export function buildReconcilePlan(
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

export async function applyExpenseReconciliation(
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

/**
 * Reconciles expense aggregates after transactions are removed or moved away.
 * Manual/override expenses with zero remaining transactions are preserved as empty.
 */
export async function reconcileExpensesAfterTransactionRemoval(
  database: DbOrTx,
  input: { userId: string; affectedExpenseIds: string[] },
) {
  const uniqueExpenseIds = [...new Set(input.affectedExpenseIds)]
  if (uniqueExpenseIds.length === 0) return

  const aggregates = await loadAggregatesForExpenses(database, {
    userId: input.userId,
    expenseIds: uniqueExpenseIds,
  })
  const manualIds = await loadManualOrOverrideExpenseIds(database, {
    userId: input.userId,
    affectedExpenseIds: uniqueExpenseIds,
  })
  const plan = buildReconcilePlan(uniqueExpenseIds, aggregates, manualIds)
  await applyExpenseReconciliation(database, plan, input.userId)
}

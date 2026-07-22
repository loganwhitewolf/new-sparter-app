import 'server-only'
import { db } from '@/lib/db'
import { transaction } from '@/lib/db/schema'
import { and, asc, eq, gte, lte } from 'drizzle-orm'

// Display fields (not just id/occurredAt) are included here because Plans 67-08/67-09 render
// each suggested transaction as a recognizable checklist row ("12/07/2026 — Hotel Roma, -120,00
// €"), not a bare id.
export type TransactionForSuggestion = {
  id: string
  occurredAt: Date
  description: string
  customTitle: string | null
  amount: string
  currency: string
}

// D-09: inclusive boundary — gte/lte, never gt/lt. A transaction dated exactly at `start` or
// `end` is included. Empty result set resolves to [], not an error.
export async function getTransactionsInDateRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<TransactionForSuggestion[]> {
  return db
    .select({
      id: transaction.id,
      occurredAt: transaction.occurredAt,
      description: transaction.description,
      customTitle: transaction.customTitle,
      amount: transaction.amount,
      currency: transaction.currency,
    })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), gte(transaction.occurredAt, start), lte(transaction.occurredAt, end)))
    .orderBy(asc(transaction.occurredAt), asc(transaction.id))
}

import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { transaction } from '@/lib/db/schema'

export type TransactionInsertData = {
  id: string
  userId: string
  fileId: string
  expenseId: string | null
  transactionHash: string
  description: string
  descriptionHash: string
  amount: string
  currency?: string
  occurredAt: Date
  rowIndex: number
  rawRow?: Record<string, string | number | null>
}

export type TransactionRow = typeof transaction.$inferSelect

export async function insertTransaction(
  database: DbOrTx,
  data: TransactionInsertData,
): Promise<TransactionRow> {
  const rows = await database
    .insert(transaction)
    .values({
      id: data.id,
      userId: data.userId,
      fileId: data.fileId,
      expenseId: data.expenseId,
      transactionHash: data.transactionHash,
      description: data.description,
      descriptionHash: data.descriptionHash,
      amount: data.amount,
      currency: data.currency ?? 'EUR',
      occurredAt: data.occurredAt,
      rowIndex: data.rowIndex,
      rawRow: data.rawRow ?? null,
    })
    .returning()

  const created = rows[0]
  if (!created) throw new Error('Failed to insert transaction')
  return created
}

export async function getDuplicateHashes(
  database: DbOrTx,
  userId: string,
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()

  const existing = await database
    .select({ transactionHash: transaction.transactionHash })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        inArray(transaction.transactionHash, hashes),
      ),
    )

  return new Set(existing.map((r) => r.transactionHash))
}

export async function insertTransactionBatch(
  database: DbOrTx,
  rows: TransactionInsertData[],
): Promise<TransactionRow[]> {
  if (rows.length === 0) return []
  const inserted = await database
    .insert(transaction)
    .values(
      rows.map((data) => ({
        id: data.id,
        userId: data.userId,
        fileId: data.fileId,
        expenseId: data.expenseId,
        transactionHash: data.transactionHash,
        description: data.description,
        descriptionHash: data.descriptionHash,
        amount: data.amount,
        currency: data.currency ?? 'EUR',
        occurredAt: data.occurredAt,
        rowIndex: data.rowIndex,
        rawRow: data.rawRow ?? null,
      })),
    )
    .returning()
  return inserted
}

export { db }

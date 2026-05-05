import 'server-only'
import { cache } from 'react'
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import {
  expense,
  file as importFile,
  importFormatVersion,
  platform,
  transaction,
} from '@/lib/db/schema'
import type {
  TransactionSort,
  TransactionSortDirection,
} from '@/lib/validations/transactions'

export const TRANSACTION_LIST_LIMIT = 200

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

export type TransactionFilters = {
  fromDate?: Date
  toDate?: Date
  platform?: string
  sort?: TransactionSort
  dir?: TransactionSortDirection
}

export const transactionListSelect = {
  id: transaction.id,
  description: transaction.description,
  customTitle: transaction.customTitle,
  amount: transaction.amount,
  currency: transaction.currency,
  occurredAt: transaction.occurredAt,
  rowIndex: transaction.rowIndex,
  expenseId: expense.id,
  expenseTitle: expense.title,
  expenseStatus: expense.status,
  fileId: importFile.id,
  fileName: importFile.originalName,
  importedAt: importFile.importedAt,
  platformId: platform.id,
  platformName: platform.name,
  platformSlug: platform.slug,
}

export const transactionPlatformSelect = {
  id: platform.id,
  name: platform.name,
  slug: platform.slug,
}

export type TransactionListRow = {
  id: string
  description: string
  customTitle: string | null
  amount: string
  currency: string
  occurredAt: Date
  rowIndex: number
  expenseId: string | null
  expenseTitle: string | null
  expenseStatus: (typeof expense.$inferSelect)['status'] | null
  fileId: string | null
  fileName: string | null
  importedAt: Date | null
  platformId: number | null
  platformName: string | null
  platformSlug: string | null
}

export type TransactionPlatformOption = {
  id: number
  name: string
  slug: string
}

export type TransactionRow = typeof transaction.$inferSelect

export function getTransactionSortColumn(sort: TransactionSort) {
  switch (sort) {
    case 'amount':
      return transaction.amount
    case 'occurredAt':
    default:
      return transaction.occurredAt
  }
}

export function buildTransactionOrderBy({
  sort = 'occurredAt',
  dir = 'desc',
}: Pick<TransactionFilters, 'sort' | 'dir'> = {}) {
  const column = getTransactionSortColumn(sort)

  return dir === 'asc' ? asc(column) : desc(column)
}

export const getTransactions = cache(
  async (filters: TransactionFilters = {}): Promise<TransactionListRow[]> => {
    const { userId } = await verifySession()

    // Always scope by both transaction.userId and the owning file userId. The
    // second predicate preserves ownership even if a historical row points to an
    // unexpected file record.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [
      eq(transaction.userId, userId),
      eq(importFile.userId, userId),
    ]

    if (filters.fromDate) {
      conditions.push(gte(transaction.occurredAt, filters.fromDate))
    }

    if (filters.toDate) {
      conditions.push(lte(transaction.occurredAt, filters.toDate))
    }

    if (filters.platform) {
      conditions.push(eq(platform.slug, filters.platform))
    }

    return db
      .select(transactionListSelect)
      .from(transaction)
      .leftJoin(importFile, eq(transaction.fileId, importFile.id))
      .leftJoin(
        importFormatVersion,
        eq(importFile.importFormatVersionId, importFormatVersion.id),
      )
      .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
      .leftJoin(expense, eq(transaction.expenseId, expense.id))
      .where(and(...conditions))
      .orderBy(buildTransactionOrderBy(filters))
      .limit(TRANSACTION_LIST_LIMIT)
  },
)

export const getTransactionPlatforms = cache(
  async (): Promise<TransactionPlatformOption[]> => {
    const { userId } = await verifySession()

    return db
      .selectDistinct(transactionPlatformSelect)
      .from(transaction)
      .leftJoin(importFile, eq(transaction.fileId, importFile.id))
      .leftJoin(
        importFormatVersion,
        eq(importFile.importFormatVersionId, importFormatVersion.id),
      )
      .innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
      .where(and(eq(transaction.userId, userId), eq(importFile.userId, userId)))
      .orderBy(asc(platform.name))
  },
)

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
    .onConflictDoNothing()
    .returning()
  return inserted
}

export async function updateTransactionCustomTitle(
  database: DbOrTx,
  id: string,
  userId: string,
  customTitle: string | null,
): Promise<void> {
  await database
    .update(transaction)
    .set({ customTitle, updatedAt: new Date() })
    .where(and(eq(transaction.id, id), eq(transaction.userId, userId)))
}

export { db }

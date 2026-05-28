import 'server-only'
import { cache } from 'react'
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import {
  category,
  expense,
  file as importFile,
  importFormatVersion,
  platform,
  subCategory,
  transaction,
  userSubcategoryOverride,
} from '@/lib/db/schema'
import type {
  TransactionSort,
  TransactionSortDirection,
} from '@/lib/validations/transactions'

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

export const TRANSACTION_LIST_LIMIT = 50

export type TransactionPagination = {
  limit?: number
  offset?: number
}

export type TransactionInsertData = {
  id: string
  userId: string
  fileId: string | null
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
  importId?: string
  name?: string
  categorySlug?: string
  subCategoryId?: number
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
  expenseCategoryName: category.name,
  expenseSubCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
  fileId: importFile.id,
  /** Prefer user-facing display name; fall back to upload file name. */
  fileName: sql<string | null>`coalesce(nullif(trim(coalesce(${importFile.displayName}, '')), ''), ${importFile.originalName})`,
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
  expenseCategoryName: string | null
  expenseSubCategoryName: string | null
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
  async (
    filters: TransactionFilters = {},
    pagination: TransactionPagination = {},
  ): Promise<TransactionListRow[]> => {
    const { userId } = await verifySession()
    const limit = pagination.limit ?? TRANSACTION_LIST_LIMIT
    const offset = pagination.offset ?? 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [
      eq(transaction.userId, userId),
      or(isNull(transaction.fileId), eq(importFile.userId, userId)),
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

    if (filters.importId) {
      conditions.push(eq(transaction.fileId, filters.importId))
    }

    if (filters.name) {
      const pattern = `%${escapeLikePattern(filters.name)}%`
      conditions.push(
        or(
          ilike(transaction.description, pattern),
          ilike(transaction.customTitle, pattern),
        ),
      )
    }

    if (filters.categorySlug) {
      conditions.push(eq(category.slug, filters.categorySlug))
    }

    if (filters.subCategoryId) {
      conditions.push(eq(subCategory.id, filters.subCategoryId))
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
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .leftJoin(
        userSubcategoryOverride,
        and(
          eq(userSubcategoryOverride.subCategoryId, subCategory.id),
          eq(userSubcategoryOverride.userId, userId),
        ),
      )
      .where(and(...conditions))
      .orderBy(buildTransactionOrderBy(filters))
      .limit(limit)
      .offset(offset)
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

export type ManualTransactionData = {
  userId: string
  description: string
  amount: string
  currency: string
  occurredAt: Date
  subCategoryId?: number
}

export async function insertManualTransaction(
  data: ManualTransactionData,
): Promise<{ transactionId: string; expenseId: string }> {
  const { computeDescriptionHash, computeTransactionHash } = await import(
    '@/lib/utils/import'
  )

  const descriptionHash = computeDescriptionHash(data.description)
  const transactionId = crypto.randomUUID()
  const expenseId = crypto.randomUUID()
  const transactionHash = computeTransactionHash({
    userId: data.userId,
    occurredAt: data.occurredAt,
    amount: data.amount,
    description: data.description,
  })

  await db.transaction(async (tx) => {
    await tx.insert(expense).values({
      id: expenseId,
      userId: data.userId,
      title: data.description,
      descriptionHash,
      subCategoryId: data.subCategoryId ?? null,
      totalAmount: data.amount,
      transactionCount: 1,
      firstTransactionAt: data.occurredAt,
      lastTransactionAt: data.occurredAt,
      status: data.subCategoryId ? '3' : '1',
    })

    await tx.insert(transaction).values({
      id: transactionId,
      userId: data.userId,
      fileId: null,
      expenseId,
      transactionHash,
      description: data.description,
      descriptionHash,
      amount: data.amount,
      currency: data.currency,
      occurredAt: data.occurredAt,
      rowIndex: 0,
    })
  })

  return { transactionId, expenseId }
}

export async function updateTransactionCustomTitle(
  database: DbOrTx,
  id: string,
  userId: string,
  customTitle: string | null,
): Promise<void> {
  await database
    .update(transaction)
    .set({ customTitle })
    .where(and(eq(transaction.id, id), eq(transaction.userId, userId)))
}

export type ExpenseTransactionRow = {
  id: string
  description: string
  customTitle: string | null
  amount: string
  currency: string
  occurredAt: Date
}

export const getTransactionsByExpenseId = cache(
  async (expenseId: string): Promise<ExpenseTransactionRow[]> => {
    const { userId } = await verifySession()

    return db
      .select({
        id: transaction.id,
        description: transaction.description,
        customTitle: transaction.customTitle,
        amount: transaction.amount,
        currency: transaction.currency,
        occurredAt: transaction.occurredAt,
      })
      .from(transaction)
      .innerJoin(expense, eq(transaction.expenseId, expense.id))
      .where(
        and(
          eq(transaction.expenseId, expenseId),
          eq(transaction.userId, userId),
          eq(expense.userId, userId),
        ),
      )
      .orderBy(desc(transaction.occurredAt))
  },
)

const UNCATEGORIZED_TX_LIMIT = 2000

export async function getUncategorizedTransactionsByFileId(
  database: DbOrTx,
  fileId: string,
  userId: string,
): Promise<Array<{ description: string; amount: string }>> {
  return database
    .select({
      description: transaction.description,
      amount: transaction.amount,
    })
    .from(transaction)
    .innerJoin(importFile, eq(transaction.fileId, importFile.id))
    .innerJoin(expense, eq(transaction.expenseId, expense.id))
    .where(
      and(
        eq(transaction.fileId, fileId),
        eq(importFile.userId, userId),
        isNull(expense.subCategoryId),
      ),
    )
    .limit(UNCATEGORIZED_TX_LIMIT)
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding gate queries (R-OB-02, R-OB-07) — Phase 38 Plan 01
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the total number of transactions for the given userId.
 * Does NOT call verifySession — caller (RSC layout guard) provides a verified userId.
 * Wrapped in react cache() per DAL convention for RSC deduplication.
 */
export const getTransactionCount = cache(
  async (userId: string): Promise<number> => {
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(transaction)
      .where(eq(transaction.userId, userId))

    return Number(rows[0]?.c ?? 0)
  },
)

/** Row shape returned by getTopUncategorizedExpenses (R-OB-07) */
export type TopUncategorizedExpenseRow = {
  id: string
  title: string
  descriptionHash: string
  totalAmount: string
}

/**
 * Returns up to `limit` uncategorized expense rows for the given userId.
 * Filtering: subCategoryId IS NULL AND totalAmount < 0.
 * Deduplication: DISTINCT ON (description_hash) keeping highest |amount| per hash.
 * Result is sorted client-side by |totalAmount| DESC.
 *
 * Security: userId bound from session (T-38-03). Limit hard-capped at 100 (T-38-05).
 */
export const getTopUncategorizedExpenses = cache(
  async (userId: string, limit = 15): Promise<TopUncategorizedExpenseRow[]> => {
    // T-38-05: hard cap to prevent DoS from large limit values
    const safeLimitValue = Math.min(limit, 100)

    const result = await db.execute(sql`
      SELECT DISTINCT ON (description_hash)
        id,
        title,
        description_hash AS "descriptionHash",
        total_amount AS "totalAmount"
      FROM expense
      WHERE user_id = ${userId}
        AND sub_category_id IS NULL
        AND total_amount::numeric < 0
      ORDER BY description_hash, ABS(total_amount::numeric) DESC
      LIMIT ${safeLimitValue}
    `)

    const rows = result.rows as TopUncategorizedExpenseRow[]

    // JS-side sort by |totalAmount| DESC because DISTINCT ON orders by description_hash
    return rows.sort(
      (a, b) => Math.abs(parseFloat(b.totalAmount)) - Math.abs(parseFloat(a.totalAmount)),
    )
  },
)

export { db }

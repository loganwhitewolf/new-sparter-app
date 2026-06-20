import 'server-only'
import { cache } from 'react'
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { toDecimal } from '@/lib/utils/decimal'
import { verifySession } from '@/lib/dal/auth'
import {
  category,
  direction,
  expense,
  file as importFile,
  importFormatVersion,
  nature,
  platform,
  subCategory,
  transaction,
  userSubcategoryOverride,
} from '@/lib/db/schema'
import type {
  ParsedTransactionFilters,
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
  // Wave 4 filter conditions (D-19..D-25):
  months?: string[]
  amountMin?: string
  amountMax?: string
  status?: 'uncategorized' | 'categorized'
  // Category-derived filters: nature via nature.code, direction via direction.code
  nature?: string
  direction?: string
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
  // Direction code from the nature→direction join (replaces the category.id placeholder)
  categoryType: direction.code,
  // Phase 50: pairing fields — correlated subqueries (no LEFT JOIN to preserve buildTransactionOrderBy)
  pairedWithId: sql<string | null>`(
    SELECT CASE
      WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
      ELSE tp.transaction_a_id
    END
    FROM transaction_pair tp
    WHERE tp.transaction_a_id = ${transaction.id}
       OR tp.transaction_b_id = ${transaction.id}
    LIMIT 1
  )`,
  pairedNetAmount: sql<string | null>`(
    SELECT (${transaction.amount}::numeric + t2.amount::numeric)::text
    FROM transaction_pair tp
    JOIN transaction t2 ON t2.id = CASE
      WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
      ELSE tp.transaction_a_id
    END
    WHERE tp.transaction_a_id = ${transaction.id}
       OR tp.transaction_b_id = ${transaction.id}
    LIMIT 1
  )`,
  // Counterpart's OWN original amount (not the net) — shown as "Importo" in the pair popover.
  pairedAmount: sql<string | null>`(
    SELECT t2.amount::text
    FROM transaction_pair tp
    JOIN transaction t2 ON t2.id = CASE
      WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
      ELSE tp.transaction_a_id
    END
    WHERE tp.transaction_a_id = ${transaction.id}
       OR tp.transaction_b_id = ${transaction.id}
    LIMIT 1
  )`,
  pairedDescription: sql<string | null>`(
    SELECT t2.description
    FROM transaction_pair tp
    JOIN transaction t2 ON t2.id = CASE
      WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
      ELSE tp.transaction_a_id
    END
    WHERE tp.transaction_a_id = ${transaction.id}
       OR tp.transaction_b_id = ${transaction.id}
    LIMIT 1
  )`,
  pairedOccurredAt: sql<Date | null>`(
    SELECT t2.occurred_at
    FROM transaction_pair tp
    JOIN transaction t2 ON t2.id = CASE
      WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
      ELSE tp.transaction_a_id
    END
    WHERE tp.transaction_a_id = ${transaction.id}
       OR tp.transaction_b_id = ${transaction.id}
    LIMIT 1
  )`,
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
  // Direction code from the nature→direction join
  categoryType: string | null
  // Phase 50: pairing fields (nullable — null when transaction is unpaired)
  pairedWithId: string | null
  pairedNetAmount: string | null
  pairedAmount: string | null
  pairedDescription: string | null
  pairedOccurredAt: Date | null
}

export type TransactionPlatformOption = {
  id: number
  name: string
  slug: string
}

export type TransactionRow = typeof transaction.$inferSelect

/** Matches table display label: customTitle when set, else bank description. */
export const transactionDisplayTitleSortKey = sql<string>`LOWER(COALESCE(NULLIF(TRIM(${transaction.customTitle}), ''), ${transaction.description}))`

/** Amount column is rendered with formatAbsoluteAmount — sort by magnitude, not sign (D-20). */
export const transactionAmountAbsSortKey = sql`ABS(${transaction.amount}::numeric)`

/** Matches "Spesa collegata" cell labels (categorized / da categorizzare / nessuna spesa). */
export const transactionLinkedExpenseCategorySortKey = sql<string>`LOWER(
  CASE
    WHEN ${expense.id} IS NULL THEN 'nessuna spesa collegata'
    WHEN ${expense.status} NOT IN ('2', '3') THEN 'da categorizzare'
    WHEN ${category.name} IS NULL
      OR COALESCE(
        NULLIF(TRIM(${userSubcategoryOverride.customName}), ''),
        NULLIF(TRIM(${subCategory.name}), '')
      ) IS NULL THEN 'categorizzata'
    ELSE CONCAT(
      ${category.name},
      ' → ',
      COALESCE(NULLIF(TRIM(${userSubcategoryOverride.customName}), ''), ${subCategory.name})
    )
  END
)`

/** Matches primary "Sorgente" label (platform name, manual, or fallback). */
export const transactionPlatformSortKey = sql<string>`LOWER(
  CASE
    WHEN ${transaction.fileId} IS NULL THEN 'manuale'
    ELSE COALESCE(${platform.name}, 'piattaforma non disponibile')
  END
)`

export function getTransactionSortColumn(sort: TransactionSort) {
  switch (sort) {
    case 'amount':
      return transactionAmountAbsSortKey
    case 'description':
      return transactionDisplayTitleSortKey
    case 'category':
      return transactionLinkedExpenseCategorySortKey
    case 'platform':
      return transactionPlatformSortKey
    case 'occurredAt':
      return transaction.occurredAt
    default: {
      const _exhaustive: never = sort
      return _exhaustive
    }
  }
}

export function mapParsedTransactionFiltersToDal(
  parsed: ParsedTransactionFilters,
): TransactionFilters {
  const { type, ...rest } = parsed
  return {
    ...rest,
    ...(type ? { direction: type } : {}),
  }
}

export function buildTransactionOrderBy({
  sort = 'occurredAt',
  dir = 'desc',
}: Pick<TransactionFilters, 'sort' | 'dir'> = {}) {
  const column = getTransactionSortColumn(sort)
  // Tiebreaker on id as LAST element so OFFSET pagination never returns duplicate or
  // missing rows when multiple rows share the same sort column value (D-06).
  return dir === 'asc'
    ? [asc(column), asc(transaction.id)]
    : [desc(column), desc(transaction.id)]
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

    // Wave 4: months filter — OR across TO_CHAR(occurredAt, 'YYYY-MM') = ym (D-07/D-08)
    if (filters.months && filters.months.length > 0) {
      conditions.push(
        or(...filters.months.map((ym) => sql`TO_CHAR(${transaction.occurredAt}, 'YYYY-MM') = ${ym}`)),
      )
    }

    // Wave 4: amount range — absolute value (D-20)
    if (filters.amountMin !== undefined) {
      conditions.push(sql`ABS(${transaction.amount}::numeric) >= ${filters.amountMin}::numeric`)
    }
    if (filters.amountMax !== undefined) {
      conditions.push(sql`ABS(${transaction.amount}::numeric) <= ${filters.amountMax}::numeric`)
    }

    // Wave 4: categorization status (D-21/D-23)
    if (filters.status === 'uncategorized') {
      conditions.push(isNull(expense.subCategoryId))
    }
    if (filters.status === 'categorized') {
      conditions.push(isNotNull(expense.subCategoryId))
    }

    // Nature filter — cascade child via subCategory.natureId → nature.code join
    if (filters.nature === 'unclassified') {
      conditions.push(or(isNull(expense.subCategoryId), isNull(subCategory.natureId)))
    } else if (filters.nature) {
      conditions.push(eq(nature.code, filters.nature))
    }

    // Direction filter — via nature→direction join; 'unclassified' matches null natureId rows
    if (filters.direction === 'unclassified') {
      conditions.push(isNull(subCategory.natureId))
    } else if (filters.direction) {
      conditions.push(eq(direction.code, filters.direction))
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
      .leftJoin(nature, eq(subCategory.natureId, nature.id))
      .leftJoin(direction, eq(nature.directionId, direction.id))
      .leftJoin(
        userSubcategoryOverride,
        and(
          eq(userSubcategoryOverride.subCategoryId, subCategory.id),
          eq(userSubcategoryOverride.userId, userId),
        ),
      )
      .where(and(...conditions))
      .orderBy(...buildTransactionOrderBy(filters))
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
      .innerJoin(importFile, eq(transaction.fileId, importFile.id))
      .innerJoin(
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
      (a, b) => toDecimal(b.totalAmount).abs().comparedTo(toDecimal(a.totalAmount).abs()),
    )
  },
)

/** Row shape returned by getTopExpensesForOnboarding (260615-n3t). */
export type TopOnboardingExpenseRow = TopUncategorizedExpenseRow & {
  subCategoryId: number | null
  subCategoryName: string | null
}

/**
 * Returns up to `limit` top expense rows for the onboarding categorize step.
 * Same dedupe/order/cap as getTopUncategorizedExpenses (DISTINCT ON description_hash,
 * total_amount < 0, ORDER BY description_hash + ABS DESC, limit capped at 100, JS-side
 * |amount| DESC re-sort), but WITHOUT the `sub_category_id IS NULL` predicate.
 *
 * INVARIANT: the onboarding categorize step must show a STABLE set — a row must never
 * vanish after it is categorized or after a manual refresh. Categorized rows are returned
 * here (with their subcategory id + canonical name) and rendered with a persistent green
 * check; the done-state derives from "no uncategorized remain", not from an empty list.
 *
 * Non-goal: user_subcategory_override.custom_name is intentionally NOT joined — the green
 * check uses the canonical system subcategory name only (keep it cheap).
 *
 * Security: userId is bound from the session by the caller. Limit hard-capped at 100.
 */
export const getTopExpensesForOnboarding = cache(
  async (userId: string, limit = 15): Promise<TopOnboardingExpenseRow[]> => {
    // Hard cap to prevent DoS from large limit values
    const safeLimitValue = Math.min(limit, 100)

    // sub_category ALSO has a user_id column, so user_id (and id) are ambiguous after the
    // JOIN and MUST be qualified with expense. description_hash/total_amount/title live only
    // on expense; sub_category.name is the only column taken from the joined table.
    const result = await db.execute(sql`
      SELECT DISTINCT ON (description_hash)
        expense.id AS "id",
        title,
        description_hash AS "descriptionHash",
        total_amount AS "totalAmount",
        expense.sub_category_id AS "subCategoryId",
        sub_category.name AS "subCategoryName"
      FROM expense
      LEFT JOIN sub_category ON sub_category.id = expense.sub_category_id
      WHERE expense.user_id = ${userId}
        AND total_amount::numeric < 0
      ORDER BY description_hash, ABS(total_amount::numeric) DESC
      LIMIT ${safeLimitValue}
    `)

    const rows = result.rows as TopOnboardingExpenseRow[]

    // JS-side sort by |totalAmount| DESC because DISTINCT ON orders by description_hash
    return rows.sort(
      (a, b) => toDecimal(b.totalAmount).abs().comparedTo(toDecimal(a.totalAmount).abs()),
    )
  },
)

export { db }

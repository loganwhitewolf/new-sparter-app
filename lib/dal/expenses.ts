import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { category, expense, file, importFormatVersion, platform, subCategory, userSubcategoryOverride } from '@/lib/db/schema'
import { eq, and, gte, ilike, inArray, lte, or, asc, desc, sql } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { periodToDateRange } from '@/lib/utils/date'

export { periodToDateRange } from '@/lib/utils/date'

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

export const EXPENSE_LIST_LIMIT = 50

export type ExpenseSort = 'createdAt' | 'totalAmount'
export type ExpenseSortDirection = 'asc' | 'desc'

export type ExpenseFilters = {
  categorySlug?: string
  status?: 'uncategorized' | 'categorized'
  /**
   * Optional period filter — kept for backwards compatibility with any existing callers.
   * D-05: the expenses page no longer defaults to any period; this is only applied when
   * explicitly provided. D-11: Expenses toolbar does not expose a temporal filter at all.
   */
  period?: 'last-3-months' | 'last-6-months' | 'this-year' | 'last-year'
  name?: string
  /** Canonical search param key (D-19); same semantics as name */
  q?: string
  sort?: ExpenseSort
  dir?: ExpenseSortDirection
  // Wave 4: absolute-value amount range (D-20)
  amountMin?: string
  amountMax?: string
  /** Platform slug filter — requires importedFromFileId join chain */
  platform?: string
}

export type ExpensePagination = {
  limit?: number
  offset?: number
}

export type ExpenseRow = {
  id: string
  title: string
  status: '1' | '2' | '3' | '4'
  notes: string | null
  createdAt: Date
  totalAmount: string
  subCategoryId: number | null
  subCategoryName: string | null
  categoryName: string | null
  categorySlug: string | null
}

export function getExpenseSortColumn(sort: ExpenseSort) {
  switch (sort) {
    case 'totalAmount':
      return expense.totalAmount
    case 'createdAt':
    default:
      return expense.createdAt
  }
}

export function buildExpenseOrderBy({
  sort = 'createdAt',
  dir = 'desc',
}: Pick<ExpenseFilters, 'sort' | 'dir'> = {}) {
  const column = getExpenseSortColumn(sort)
  // Tie-break on id so OFFSET pagination never returns the same expense twice.
  return dir === 'asc'
    ? [asc(column), asc(expense.id)]
    : [desc(column), desc(expense.id)]
}

export const getExpenses = cache(async (
  filters: ExpenseFilters = {},
  pagination: ExpensePagination = {},
): Promise<ExpenseRow[]> => {
  const { userId } = await verifySession()
  const limit = pagination.limit ?? EXPENSE_LIST_LIMIT
  const offset = pagination.offset ?? 0

  // Build conditions array — all expense queries are always scoped to userId.
  // D-05: no implicit period — default view is all-time, no date clamp.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [
    eq(expense.userId, userId),
  ]

  // Period date range only when explicitly requested (D-05)
  if (filters.period) {
    const { from, to } = periodToDateRange(filters.period)
    conditions.push(gte(expense.createdAt, from), lte(expense.createdAt, to))
  }

  // O-01: status 4 → uncategorized bucket (conservative mapping)
  if (filters.status === 'uncategorized') {
    conditions.push(inArray(expense.status, ['1', '4']))
  }
  if (filters.status === 'categorized') {
    conditions.push(inArray(expense.status, ['2', '3']))
  }
  if (filters.categorySlug) {
    conditions.push(eq(category.slug, filters.categorySlug))
  }
  const searchTerm = filters.q ?? filters.name
  if (searchTerm) {
    const pattern = `%${escapeLikePattern(searchTerm)}%`
    conditions.push(ilike(expense.title, pattern))
  }

  // Wave 4: absolute-value amount range (D-20)
  if (filters.amountMin !== undefined) {
    conditions.push(sql`ABS(${expense.totalAmount}::numeric) >= ${filters.amountMin}::numeric`)
  }
  if (filters.amountMax !== undefined) {
    conditions.push(sql`ABS(${expense.totalAmount}::numeric) <= ${filters.amountMax}::numeric`)
  }

  // Wave 4: platform filter — via importedFromFileId → file → importFormatVersion → platform
  if (filters.platform) {
    conditions.push(eq(platform.slug, filters.platform))
  }

  return db
    .select({
      id: expense.id,
      title: expense.title,
      status: expense.status,
      notes: expense.notes,
      createdAt: expense.createdAt,
      totalAmount: expense.totalAmount,
      subCategoryId: expense.subCategoryId,
      subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
      categoryName: category.name,
      categorySlug: category.slug,
    })
    .from(expense)
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
    .leftJoin(
      userSubcategoryOverride,
      and(
        eq(userSubcategoryOverride.subCategoryId, subCategory.id),
        eq(userSubcategoryOverride.userId, userId),
      ),
    )
    // Platform join chain — only materializes a platform row when expense was imported from a file
    .leftJoin(file, eq(expense.importedFromFileId, file.id))
    .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(and(...conditions))
    .orderBy(...buildExpenseOrderBy(filters))
    .limit(limit)
    .offset(offset)
})

export const getExpenseById = cache(async (id: string): Promise<ExpenseRow | undefined> => {
  const { userId } = await verifySession()
  const rows = await db
    .select({
      id: expense.id,
      title: expense.title,
      status: expense.status,
      notes: expense.notes,
      createdAt: expense.createdAt,
      totalAmount: expense.totalAmount,
      subCategoryId: expense.subCategoryId,
      subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
      categoryName: category.name,
      categorySlug: category.slug,
    })
    .from(expense)
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
    .leftJoin(
      userSubcategoryOverride,
      and(
        eq(userSubcategoryOverride.subCategoryId, subCategory.id),
        eq(userSubcategoryOverride.userId, userId),
      ),
    )
    .where(and(eq(expense.id, id), eq(expense.userId, userId)))
    .limit(1)
  return rows[0]
})

export async function insertExpense(data: {
  userId: string
  title: string
  subCategoryId?: number
  notes?: string
}): Promise<void> {
  await db.insert(expense).values({
    id: crypto.randomUUID(),
    userId: data.userId,
    title: data.title,
    subCategoryId: data.subCategoryId ?? null,
    status: data.subCategoryId ? '3' : '1',
    notes: data.notes ?? null,
  })
}

export async function updateExpense(data: {
  id: string
  userId: string
  title: string
  subCategoryId?: number
  notes?: string
}): Promise<void> {
  await db
    .update(expense)
    .set({
      title: data.title,
      subCategoryId: data.subCategoryId ?? null,
      status: data.subCategoryId ? '3' : '1',
      notes: data.notes ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(expense.id, data.id), eq(expense.userId, data.userId)))
}

export async function updateExpenseTitle(data: {
  id: string
  userId: string
  title: string
}): Promise<void> {
  await db
    .update(expense)
    .set({
      title: data.title,
      updatedAt: new Date(),
    })
    .where(and(eq(expense.id, data.id), eq(expense.userId, data.userId)))
}

export async function deleteExpense(id: string, userId: string): Promise<void> {
  await db
    .delete(expense)
    .where(and(eq(expense.id, id), eq(expense.userId, userId)))
}

export async function deleteExpenses(ids: string[], userId: string): Promise<void> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return

  await db
    .delete(expense)
    .where(and(eq(expense.userId, userId), inArray(expense.id, unique)))
}

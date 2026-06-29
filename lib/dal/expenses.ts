import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { category, direction, expense, file, importFormatVersion, nature, platform, subCategory, userSubcategoryOverride } from '@/lib/db/schema'
import { eq, and, gte, ilike, inArray, isNull, lte, or, asc, desc, sql } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { periodToDateRange } from '@/lib/utils/date'

export { periodToDateRange } from '@/lib/utils/date'

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

export const EXPENSE_LIST_LIMIT = 50

export type ExpenseSort = 'createdAt' | 'totalAmount' | 'title' | 'category'
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
  /** FlowNature filter — eight nature codes plus sentinel 'unclassified' (null natureId). */
  nature?: string
  /** Direction filter — in/out/allocation/transfer plus sentinel 'unclassified' (null natureId). */
  direction?: string
  /** Subcategory id filter — narrows to a specific subCategory.id. */
  subCategoryId?: number
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
  platformName: string | null
}

export type ExpenseSourceFile = {
  id: string
  name: string
}

export type ExpenseImportContext = {
  sourceFile: ExpenseSourceFile | null
  platformName: string | null
}

/** Matches "Titolo" column label (case-insensitive). */
export const expenseTitleSortKey = sql<string>`LOWER(${expense.title})`

/** Total column uses formatAbsoluteAmount — sort by magnitude, not sign (D-20). */
export const expenseTotalAmountAbsSortKey = sql`ABS(${expense.totalAmount}::numeric)`

/** Rows showing "—" in the category column (missing category or subcategory name). */
export const expenseCategoryIncompleteBucket = sql<number>`CASE
  WHEN ${category.name} IS NULL THEN 1
  WHEN COALESCE(
    NULLIF(TRIM(${userSubcategoryOverride.customName}), ''),
    NULLIF(TRIM(${subCategory.name}), '')
  ) IS NULL THEN 1
  ELSE 0
END`

/** Matches "Categoria · Sottocategoria" when both names are present (case-insensitive). */
export const expenseCategorySortKey = sql<string>`LOWER(
  CONCAT(
    ${category.name},
    ' · ',
    COALESCE(NULLIF(TRIM(${userSubcategoryOverride.customName}), ''), ${subCategory.name})
  )
)`

export function getExpenseSortColumn(sort: ExpenseSort) {
  switch (sort) {
    case 'title':
      return expenseTitleSortKey
    case 'category':
      return expenseCategorySortKey
    case 'totalAmount':
      return expenseTotalAmountAbsSortKey
    case 'createdAt':
      return expense.createdAt
    default: {
      const _exhaustive: never = sort
      return _exhaustive
    }
  }
}

export function buildExpenseOrderBy({
  sort = 'createdAt',
  dir = 'desc',
}: Pick<ExpenseFilters, 'sort' | 'dir'> = {}) {
  // Incomplete category rows ("—") stay last in both ASC and DESC via bucket 0/1.
  if (sort === 'category') {
    return dir === 'asc'
      ? [asc(expenseCategoryIncompleteBucket), asc(expenseCategorySortKey), asc(expense.id)]
      : [asc(expenseCategoryIncompleteBucket), desc(expenseCategorySortKey), desc(expense.id)]
  }

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

  // Nature filter — cascade child via subCategory.natureId → nature.code join
  if (filters.nature === 'unclassified') {
    // Unclassified: no subCategory linked, or subCategory has null natureId
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

  if (filters.subCategoryId) {
    conditions.push(eq(subCategory.id, filters.subCategoryId))
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
      platformName: platform.name,
    })
    .from(expense)
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
      platformName: platform.name,
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
    // Platform join chain for getExpenseById — mirrors getExpenses join order
    .leftJoin(file, eq(expense.importedFromFileId, file.id))
    .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(and(eq(expense.id, id), eq(expense.userId, userId)))
    .limit(1)
  return rows[0]
})

export const getExpenseImportContext = cache(async (expenseId: string): Promise<ExpenseImportContext> => {
  const { userId } = await verifySession()

  const rows = await db
    .select({
      fileId: file.id,
      displayName: file.displayName,
      originalName: file.originalName,
      platformName: platform.name,
    })
    .from(expense)
    .leftJoin(file, eq(expense.importedFromFileId, file.id))
    .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(and(eq(expense.id, expenseId), eq(expense.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (!row) {
    return { sourceFile: null, platformName: null }
  }

  return {
    sourceFile: row.fileId
      ? {
          id: row.fileId,
          name: row.displayName?.trim() || row.originalName,
        }
      : null,
    platformName: row.platformName,
  }
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

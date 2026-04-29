import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { expense, subCategory, category } from '@/lib/db/schema'
import { eq, and, gte, lte, or, desc } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { periodToDateRange } from '@/lib/utils/date'

export { periodToDateRange } from '@/lib/utils/date'

export type ExpenseFilters = {
  categorySlug?: string
  status?: 'uncategorized' | 'categorized'
  period?: 'this-month' | 'last-3-months' | 'last-6-months' | 'this-year' | 'last-year'
}

export type ExpenseRow = {
  id: string
  title: string
  status: '1' | '2' | '3' | '4'
  notes: string | null
  createdAt: Date
  subCategoryId: number | null
  subCategoryName: string | null
  categoryName: string | null
  categorySlug: string | null
}

export const getExpenses = cache(async (filters: ExpenseFilters = {}): Promise<ExpenseRow[]> => {
  const { userId } = await verifySession()
  const { from, to } = periodToDateRange(filters.period ?? 'this-month')

  // Build conditions array — all expense queries are always scoped to userId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [
    eq(expense.userId, userId),
    gte(expense.createdAt, from),
    lte(expense.createdAt, to),
  ]

  if (filters.status === 'uncategorized') {
    conditions.push(eq(expense.status, '1'))
  }
  if (filters.status === 'categorized') {
    conditions.push(or(eq(expense.status, '2'), eq(expense.status, '3')))
  }
  if (filters.categorySlug) {
    conditions.push(eq(category.slug, filters.categorySlug))
  }

  return db
    .select({
      id: expense.id,
      title: expense.title,
      status: expense.status,
      notes: expense.notes,
      createdAt: expense.createdAt,
      subCategoryId: expense.subCategoryId,
      subCategoryName: subCategory.name,
      categoryName: category.name,
      categorySlug: category.slug,
    })
    .from(expense)
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
    .where(and(...conditions))
    .orderBy(desc(expense.createdAt))
    .limit(200)
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
      subCategoryId: expense.subCategoryId,
      subCategoryName: subCategory.name,
      categoryName: category.name,
      categorySlug: category.slug,
    })
    .from(expense)
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
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

export async function deleteExpense(id: string, userId: string): Promise<void> {
  await db
    .delete(expense)
    .where(and(eq(expense.id, id), eq(expense.userId, userId)))
}

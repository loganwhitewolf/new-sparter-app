import 'server-only'
import { cache } from 'react'
import { and, count, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import { category, expense, subCategory } from '@/lib/db/schema'
import type { DashboardFilters } from '@/lib/validations/dashboard'
import { dashboardPresetToDateRange } from '@/lib/utils/date'
import {
  computeBreakdownPercentages,
  computeDeltaPercent,
  computeSavingsRate,
} from '@/lib/utils/dashboard'

export type OverviewData = {
  totalIn: string
  totalOut: string
  balance: string
  savingsRate: number
  uncategorizedCount: number
  deltas: {
    totalIn: number | null
    totalOut: number | null
    balance: number | null
    savingsRate: number | null
    uncategorizedCount: number | null
  }
}

export type BreakdownSubCategory = {
  id: number
  name: string
  slug: string
  count: number
  amount: string
  percentage: number
}

export type BreakdownCategory = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out'
  count: number
  amount: string
  percentage: number
  subCategories: BreakdownSubCategory[]
}

export type MonthlyTrendPoint = {
  month: string
  label: string
  totalIn: string
  totalOut: string
  totalNc: number
  totalIgn: number
}

type BreakdownCategoryDraft = Omit<BreakdownCategory, 'percentage' | 'subCategories'> & {
  subCategories: Array<Omit<BreakdownSubCategory, 'percentage'>>
}

function currentMonthRange(now = new Date()) {
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

function previousMonthRange(now = new Date()) {
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
  }
}

async function getUncategorizedCount(userId: string, from: Date, to: Date): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(expense)
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
    .where(
      and(
        eq(expense.userId, userId),
        eq(expense.status, '1'),
        gte(expense.createdAt, from),
        lte(expense.createdAt, to),
        or(isNull(category.slug), ne(category.slug, 'ignore'))
      )
    )

  return Number(rows[0]?.total ?? 0)
}

export const getOverview = cache(async (): Promise<OverviewData> => {
  const { userId } = await verifySession()
  const now = new Date()
  const current = currentMonthRange(now)
  const previous = previousMonthRange(now)

  const [currentUncategorizedCount, previousUncategorizedCount] = await Promise.all([
    getUncategorizedCount(userId, current.from, current.to),
    getUncategorizedCount(userId, previous.from, previous.to),
  ])

  const totalIn = '0.00'
  const totalOut = '0.00'
  const balance = '0.00'
  const savingsRate = computeSavingsRate(totalIn, totalOut)

  return {
    totalIn,
    totalOut,
    balance,
    savingsRate,
    uncategorizedCount: currentUncategorizedCount,
    deltas: {
      totalIn: null,
      totalOut: null,
      balance: null,
      savingsRate: null,
      uncategorizedCount: computeDeltaPercent(currentUncategorizedCount, previousUncategorizedCount),
    },
  }
})

export const getCategoriesBreakdown = cache(
  async (filters: DashboardFilters): Promise<BreakdownCategory[]> => {
    const { userId } = await verifySession()
    const { from, to } = dashboardPresetToDateRange(filters.preset)

    const conditions = [
      eq(expense.userId, userId),
      gte(expense.createdAt, from),
      lte(expense.createdAt, to),
      isNotNull(expense.subCategoryId),
      ne(category.slug, 'ignore'),
    ]

    if (filters.type === 'out') {
      conditions.push(eq(category.type, 'out'))
    }
    if (filters.type === 'in') {
      conditions.push(eq(category.type, 'in'))
    }
    if (filters.type === 'all') {
      conditions.push(inArray(category.type, ['in', 'out']))
    }

    const rows = await db
      .select({
        categoryId: category.id,
        categoryName: category.name,
        categorySlug: category.slug,
        categoryType: category.type,
        subCategoryId: subCategory.id,
        subCategoryName: subCategory.name,
        subCategorySlug: subCategory.slug,
        total: count(),
      })
      .from(expense)
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .where(and(...conditions))
      .groupBy(
        category.id,
        category.name,
        category.slug,
        category.type,
        subCategory.id,
        subCategory.name,
        subCategory.slug
      )

    const categories = new Map<number, BreakdownCategoryDraft>()

    for (const row of rows) {
      const rowCount = Number(row.total ?? 0)
      if (row.categoryId === null || row.categoryName === null || row.categorySlug === null) {
        continue
      }
      if (row.categoryType !== 'in' && row.categoryType !== 'out') {
        continue
      }
      if (row.subCategoryId === null || row.subCategoryName === null || row.subCategorySlug === null) {
        continue
      }

      const existingCategory = categories.get(row.categoryId)
      if (existingCategory) {
        existingCategory.count += rowCount
        existingCategory.subCategories.push({
          id: row.subCategoryId,
          name: row.subCategoryName,
          slug: row.subCategorySlug,
          count: rowCount,
          amount: '0.00',
        })
        continue
      }

      categories.set(row.categoryId, {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
        type: row.categoryType,
        count: rowCount,
        amount: '0.00',
        subCategories: [
          {
            id: row.subCategoryId,
            name: row.subCategoryName,
            slug: row.subCategorySlug,
            count: rowCount,
            amount: '0.00',
          },
        ],
      })
    }

    return computeBreakdownPercentages(Array.from(categories.values()))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((breakdownCategory) => ({
        ...breakdownCategory,
        subCategories: computeBreakdownPercentages(
          breakdownCategory.subCategories.sort((a, b) => b.count - a.count)
        ),
      }))
  }
)

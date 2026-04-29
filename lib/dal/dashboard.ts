import 'server-only'
import { cache } from 'react'
import { and, count, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import { category, expense, subCategory } from '@/lib/db/schema'
import type { DashboardFilters, DashboardPreset } from '@/lib/validations/dashboard'
import { dashboardPresetToDateRange, monthLabel, monthsBetween } from '@/lib/utils/date'
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
  // Phase 5 rebuilds this with JOIN on transaction and SUM(amount).
  // Expense counts without transaction amounts produce misleading breakdown data.
  async (_filters: DashboardFilters): Promise<BreakdownCategory[]> => {
    return []
  }
)

export const getAggregatedTransactionsData = cache(
  async (preset: DashboardPreset): Promise<MonthlyTrendPoint[]> => {
    const { userId } = await verifySession()
    const { from, to } = dashboardPresetToDateRange(preset)
    const buckets = new Map<string, MonthlyTrendPoint>(
      monthsBetween(from, to).map((month) => [
        month,
        {
          month,
          label: monthLabel(month),
          totalIn: '0.00',
          totalOut: '0.00',
          totalNc: 0,
          totalIgn: 0,
        },
      ])
    )
    const monthSql = sql<string>`to_char(${expense.createdAt}, 'YYYY-MM')`

    const uncategorizedRows = await db
      .select({
        month: monthSql,
        total: count(),
      })
      .from(expense)
      .where(
        and(
          eq(expense.userId, userId),
          gte(expense.createdAt, from),
          lte(expense.createdAt, to),
          eq(expense.status, '1')
        )
      )
      .groupBy(monthSql)

    const ignoredRows = await db
      .select({
        month: monthSql,
        total: count(),
      })
      .from(expense)
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .where(
        and(
          eq(expense.userId, userId),
          gte(expense.createdAt, from),
          lte(expense.createdAt, to),
          eq(category.slug, 'ignore')
        )
      )
      .groupBy(monthSql)

    for (const row of uncategorizedRows) {
      const bucket = buckets.get(row.month)
      if (bucket) {
        bucket.totalNc = Number(row.total ?? 0)
      }
    }

    for (const row of ignoredRows) {
      const bucket = buckets.get(row.month)
      if (bucket) {
        bucket.totalIgn = Number(row.total ?? 0)
      }
    }

    return Array.from(buckets.values())
  }
)

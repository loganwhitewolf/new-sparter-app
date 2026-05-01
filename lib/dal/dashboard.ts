import 'server-only'
import { cache } from 'react'
import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import { category, expense, subCategory, transaction as transactionTable } from '@/lib/db/schema'
import type { DashboardFilters, DashboardPreset } from '@/lib/validations/dashboard'
import { dashboardPresetToDateRange, monthLabel, monthsBetween } from '@/lib/utils/date'
import {
  computeBreakdownPercentages,
  computeDeltaPercent,
  computeSavingsRate,
} from '@/lib/utils/dashboard'
import { toDecimal } from '@/lib/utils/decimal'

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

type OverviewAggregateRow = {
  totalIn: string | null
  totalOut: string | null
}

type BreakdownAggregateRow = {
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
  categoryType: 'in' | 'out' | 'system' | null
  subCategoryId: number | null
  subCategoryName: string | null
  subCategorySlug: string | null
  count: number | string | null
  amount: string | null
}

type TrendAggregateRow = {
  month: string
  totalIn: string | null
  totalOut: string | null
  totalNc: number | string | null
  totalIgn: number | string | null
}

const ZERO_AMOUNT = '0.00'

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

function normalizeAmount(value: string | number | null | undefined): string {
  return toDecimal(value ?? 0).toFixed(2)
}

function normalizeCount(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

function balanceFrom(totalIn: string, totalOut: string): string {
  return toDecimal(totalIn).minus(toDecimal(totalOut)).toFixed(2)
}

function notIgnoredCategory() {
  return or(isNull(category.slug), ne(category.slug, 'ignore'))
}

function dateScopedTransactions(userId: string, from: Date, to: Date) {
  return and(
    eq(transactionTable.userId, userId),
    gte(transactionTable.occurredAt, from),
    lte(transactionTable.occurredAt, to)
  )
}

function expenseStatusActive() {
  return eq(expense.status, '1')
}

async function getUncategorizedCount(userId: string, from: Date, to: Date): Promise<number> {
  try {
    const rows = await db
      .select({ total: countDistinct(expense.id) })
      .from(transactionTable)
      .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .where(
        and(
          dateScopedTransactions(userId, from, to),
          expenseStatusActive(),
          isNull(expense.subCategoryId),
          notIgnoredCategory()
        )
      )

    return normalizeCount(rows[0]?.total)
  } catch {
    return 0
  }
}

async function getOverviewAmountTotals(userId: string, from: Date, to: Date): Promise<OverviewAggregateRow> {
  try {
    const rows = await db
      .select({
        totalIn: sql<string>`coalesce(sum(case when ${transactionTable.amount} > 0 then ${transactionTable.amount} else 0 end), 0)::text`,
        totalOut: sql<string>`coalesce(abs(sum(case when ${transactionTable.amount} < 0 then ${transactionTable.amount} else 0 end)), 0)::text`,
      })
      .from(transactionTable)
      .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .where(and(dateScopedTransactions(userId, from, to), expenseStatusActive(), notIgnoredCategory()))

    return rows[0] ?? { totalIn: ZERO_AMOUNT, totalOut: ZERO_AMOUNT }
  } catch {
    return { totalIn: ZERO_AMOUNT, totalOut: ZERO_AMOUNT }
  }
}

export function buildOverviewData(input: {
  current: OverviewAggregateRow
  previous: OverviewAggregateRow
  currentUncategorizedCount: number
  previousUncategorizedCount: number
}): OverviewData {
  const totalIn = normalizeAmount(input.current.totalIn)
  const totalOut = normalizeAmount(input.current.totalOut)
  const balance = balanceFrom(totalIn, totalOut)
  const previousTotalIn = normalizeAmount(input.previous.totalIn)
  const previousTotalOut = normalizeAmount(input.previous.totalOut)
  const previousBalance = balanceFrom(previousTotalIn, previousTotalOut)
  const savingsRate = computeSavingsRate(totalIn, totalOut)
  const previousSavingsRate = computeSavingsRate(previousTotalIn, previousTotalOut)

  return {
    totalIn,
    totalOut,
    balance,
    savingsRate,
    uncategorizedCount: input.currentUncategorizedCount,
    deltas: {
      totalIn: computeDeltaPercent(totalIn, previousTotalIn),
      totalOut: computeDeltaPercent(totalOut, previousTotalOut),
      balance: computeDeltaPercent(balance, previousBalance),
      savingsRate: computeDeltaPercent(savingsRate, previousSavingsRate),
      uncategorizedCount: computeDeltaPercent(
        input.currentUncategorizedCount,
        input.previousUncategorizedCount
      ),
    },
  }
}

export function buildBreakdownData(rows: BreakdownAggregateRow[]): BreakdownCategory[] {
  const categoriesById = new Map<number, BreakdownCategoryDraft>()

  for (const row of rows) {
    if (
      row.categoryId === null ||
      row.categoryName === null ||
      row.categorySlug === null ||
      row.categoryType === null ||
      row.categoryType === 'system' ||
      row.subCategoryId === null ||
      row.subCategoryName === null ||
      row.subCategorySlug === null
    ) {
      continue
    }

    const amount = normalizeAmount(row.amount)
    const countValue = normalizeCount(row.count)
    const existing = categoriesById.get(row.categoryId)

    if (existing) {
      existing.count += countValue
      existing.amount = toDecimal(existing.amount).plus(amount).toFixed(2)
      existing.subCategories.push({
        id: row.subCategoryId,
        name: row.subCategoryName,
        slug: row.subCategorySlug,
        count: countValue,
        amount,
      })
    } else {
      categoriesById.set(row.categoryId, {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
        type: row.categoryType,
        count: countValue,
        amount,
        subCategories: [
          {
            id: row.subCategoryId,
            name: row.subCategoryName,
            slug: row.subCategorySlug,
            count: countValue,
            amount,
          },
        ],
      })
    }
  }

  return computeBreakdownPercentages(Array.from(categoriesById.values())).map((categoryRow) => ({
    ...categoryRow,
    subCategories: computeBreakdownPercentages(categoryRow.subCategories),
  }))
}

export function buildMonthlyTrendData(input: {
  from: Date
  to: Date
  rows: TrendAggregateRow[]
}): MonthlyTrendPoint[] {
  const buckets = new Map<string, MonthlyTrendPoint>(
    monthsBetween(input.from, input.to).map((month) => [
      month,
      {
        month,
        label: monthLabel(month),
        totalIn: ZERO_AMOUNT,
        totalOut: ZERO_AMOUNT,
        totalNc: 0,
        totalIgn: 0,
      },
    ])
  )

  for (const row of input.rows) {
    const bucket = buckets.get(row.month)
    if (bucket) {
      bucket.totalIn = normalizeAmount(row.totalIn)
      bucket.totalOut = normalizeAmount(row.totalOut)
      bucket.totalNc = normalizeCount(row.totalNc)
      bucket.totalIgn = normalizeCount(row.totalIgn)
    }
  }

  return Array.from(buckets.values())
}

export const getOverview = cache(async (): Promise<OverviewData> => {
  const { userId } = await verifySession()
  const now = new Date()
  const current = currentMonthRange(now)
  const previous = previousMonthRange(now)

  const [currentTotals, previousTotals, currentUncategorizedCount, previousUncategorizedCount] =
    await Promise.all([
      getOverviewAmountTotals(userId, current.from, current.to),
      getOverviewAmountTotals(userId, previous.from, previous.to),
      getUncategorizedCount(userId, current.from, current.to),
      getUncategorizedCount(userId, previous.from, previous.to),
    ])

  return buildOverviewData({
    current: currentTotals,
    previous: previousTotals,
    currentUncategorizedCount,
    previousUncategorizedCount,
  })
})

export const getCategoriesBreakdown = cache(
  async (filters: DashboardFilters): Promise<BreakdownCategory[]> => {
    const { userId } = await verifySession()
    const { from, to } = dashboardPresetToDateRange(filters.preset)
    const typeFilter = filters.type === 'all' ? undefined : eq(category.type, filters.type)

    let rows: BreakdownAggregateRow[] = []

    try {
      rows = await db
        .select({
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          categoryType: category.type,
          subCategoryId: subCategory.id,
          subCategoryName: subCategory.name,
          subCategorySlug: subCategory.slug,
          count: countDistinct(expense.id),
          amount: sql<string>`coalesce(abs(sum(${transactionTable.amount})), 0)::text`,
        })
        .from(transactionTable)
        .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
        .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
        .innerJoin(category, eq(subCategory.categoryId, category.id))
        .where(
          and(
            dateScopedTransactions(userId, from, to),
            expenseStatusActive(),
            ne(category.slug, 'ignore'),
            typeFilter
          )
        )
        .groupBy(category.id, subCategory.id)
        .orderBy(category.id, subCategory.id)
    } catch {
      rows = []
    }

    return buildBreakdownData(rows)
  }
)

export const getAggregatedTransactionsData = cache(
  async (preset: DashboardPreset): Promise<MonthlyTrendPoint[]> => {
    const { userId } = await verifySession()
    const { from, to } = dashboardPresetToDateRange(preset)
    const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`

    let rows: TrendAggregateRow[] = []

    try {
      rows = await db
        .select({
          month: monthSql,
          totalIn: sql<string>`coalesce(sum(case when ${transactionTable.amount} > 0 and (${category.slug} is null or ${category.slug} <> 'ignore') and ${expense.status} = '1' then ${transactionTable.amount} else 0 end), 0)::text`,
          totalOut: sql<string>`coalesce(abs(sum(case when ${transactionTable.amount} < 0 and (${category.slug} is null or ${category.slug} <> 'ignore') and ${expense.status} = '1' then ${transactionTable.amount} else 0 end)), 0)::text`,
          totalNc: sql<number>`count(distinct case when ${expense.status} = '1' and ${expense.subCategoryId} is null then ${expense.id} end)`,
          totalIgn: sql<number>`count(distinct case when ${category.slug} = 'ignore' then ${expense.id} end)`,
        })
        .from(transactionTable)
        .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
        .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
        .leftJoin(category, eq(subCategory.categoryId, category.id))
        .where(dateScopedTransactions(userId, from, to))
        .groupBy(monthSql)
    } catch {
      rows = []
    }

    return buildMonthlyTrendData({ from, to, rows })
  }
)

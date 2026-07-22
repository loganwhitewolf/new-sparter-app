import 'server-only'
import { cache } from 'react'
import {
  and,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import {
  category,
  direction,
  expense,
  expenseGroup,
  expenseGroupMembership,
  nature,
  subCategory,
  transaction as transactionTable,
  userSubcategoryOverride,
} from '@/lib/db/schema'
import type { DashboardFilters, DashboardPreset } from '@/lib/validations/dashboard'
import type { DateRange } from '@/lib/utils/date'
import { dashboardPresetToDateRange, monthLabel, monthsBetween } from '@/lib/utils/date'
import type { FlowNature } from '@/lib/utils/nature-labels'
import {
  buildDeviationMap,
  computeBreakdownPercentages,
  computeDeltaPercent,
  computeSavingsRate,
} from '@/lib/utils/dashboard'
import { toDecimal } from '@/lib/utils/decimal'
import { effectiveAmount, isNotSecondary } from '@/lib/dal/transaction-pairs-sql'
import { tagScopedTransactions } from '@/lib/dal/transaction-tags-sql'

export type OverviewData = {
  totalIn: string
  totalOut: string
  totalAllocation: string
  balance: string
  // Recurring-income-only balance (income nature minus totalOut) — the "structural"
  // sustainability signal. Null when the aggregate row did not carry totalInRecurring
  // (260709-kp1). No delta: it feeds the Bilancio reading, not a trend chip.
  structuralBalance: string | null
  // Recurring income total (nature.code = 'income') — feeds the Entrate card breakdown
  // (260709-lan). Extraordinary is derived as totalIn − totalInRecurring at render time.
  totalInRecurring: string | null
  // Recurring-only savings rate ((recurring − out)/recurring × 100) — feeds the Tasso
  // risparmio card breakdown (260709-lj5). Null when totalInRecurring is unknown.
  structuralSavingsRate: number | null
  // Spending split by nature — feeds the Uscite card breakdown (260709-lkw).
  // Null when the aggregate row lacks the per-nature fields.
  outByNature: { essential: string; discretionary: string; debt: string } | null
  savingsRate: number
  uncategorizedCount: number
  deltas: {
    totalIn: number | null
    totalOut: number | null
    totalAllocation: number | null
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

export type CategorySparklinePoint = {
  month: string
  label: string
  amount: string
}

export type CategoryRankingItem = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out'
  count: number
  amount: string
  percentage: number
  sparkline: CategorySparklinePoint[]
}

export type CategoryDetailTrendPoint = {
  month: string
  label: string
  amount: string
  count: number
}

export type CategoryDetailTopTransaction = {
  id: string
  title: string
  description: string
  date: string
  amount: string
}

export type CategoryDetailSubcategory = {
  id: number
  name: string
  slug: string
  count: number
  amount: string
  percentage: number
}

export type CategoryDetailCategory = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out'
}

export type CategoryDetailData = {
  category: CategoryDetailCategory | null
  summary: {
    total: string
    count: number
    average: string
  }
  trend: CategoryDetailTrendPoint[]
  subcategories: CategoryDetailSubcategory[]
  topTransactions: CategoryDetailTopTransaction[]
}

export type MonthlyTrendPoint = {
  month: string
  label: string
  totalIn: string
  totalOut: string
  totalNc: number
  totalIgn: number
}

export type MonthlyNatureTrendPoint = {
  month: string
  label: string
  segments: Record<FlowNature | 'unclassified', string>
  totalNc: number
  totalIgn: number
}

export type DeviationData = {
  deviation: number | null
  isNew: boolean
  belowNoiseThreshold: boolean
}

export type DeviationDateRanges = {
  reference: DateRange
  baseline: DateRange
}

export type CategoryDeviationsInput = {
  type: 'in' | 'out' | 'all'
  categoryId?: number
  tagId?: number
}

type BreakdownCategoryDraft = Omit<BreakdownCategory, 'percentage' | 'subCategories'> & {
  subCategories: Array<Omit<BreakdownSubCategory, 'percentage'>>
}

type OverviewAggregateRow = {
  totalIn: string | null
  totalOut: string | null
  totalAllocation: string | null
  // Recurring income only (nature.code = 'income', excludes income_extraordinary).
  // Optional: absent/null means "unknown" and structuralBalance degrades to null
  // (quick task 260709-kp1 — structural balance reading).
  totalInRecurring?: string | null
  // Per-nature OUT sums (abs of algebraic sum per nature, mirroring totalOut semantics).
  // Optional: absent → outByNature degrades to null (260709-lkw — Uscite card breakdown).
  totalOutEssential?: string | null
  totalOutDiscretionary?: string | null
  totalOutDebt?: string | null
}

type BreakdownAggregateRow = {
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  subCategoryId: number | null
  subCategoryName: string | null
  subCategorySlug: string | null
  count: number | string | null
  amount: string | null
}

type CategoryRankingAggregateRow = {
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  month: string | null
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

type NatureTrendAggregateRow = {
  month: string
  nature: FlowNature | null
  amount: string | null
  totalNc: number | string | null
  totalIgn: number | string | null
}

type CategoryDetailTrendRow = {
  categoryId: number | null
  categorySlug: string | null
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  month: string | null
  count: number | string | null
  amount: string | null
}

type CategoryDetailSubcategoryRow = {
  categoryId: number | null
  categorySlug: string | null
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  subCategoryId: number | null
  subCategoryName: string | null
  subCategorySlug: string | null
  count: number | string | null
  amount: string | null
}

type CategoryDetailTopTransactionRow = {
  id: string | null
  categoryId: number | null
  categorySlug: string | null
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
  description: string | null
  customTitle: string | null
  groupTitle: string | null
  amount: string | null
  occurredAt: Date | string | null
}

const ZERO_AMOUNT = '0.00'

export const DASHBOARD_TOTAL_EXPENSE_STATUSES = ['1', '2', '3'] as const

function previousDashboardPresetDateRange(preset: DashboardPreset, now = new Date()) {
  switch (preset) {
    case 'last-3-months':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 5, 1),
        to: new Date(now.getFullYear(), now.getMonth() - 2, 0, 23, 59, 59, 999),
      }
    case 'last-6-months':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 11, 1),
        to: new Date(now.getFullYear(), now.getMonth() - 5, 0, 23, 59, 59, 999),
      }
    case 'this-year':
      return {
        from: new Date(now.getFullYear() - 1, 0, 1),
        to: new Date(now.getFullYear() - 1, now.getMonth() + 1, 0, 23, 59, 59, 999),
      }
    case 'last-year':
      return {
        from: new Date(now.getFullYear() - 2, 0, 1),
        to: new Date(now.getFullYear() - 2, 11, 31, 23, 59, 59, 999),
      }
    case 'last-month':
    default: {
      const comparisonMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return {
        from: comparisonMonth,
        to: new Date(comparisonMonth.getFullYear(), comparisonMonth.getMonth() + 1, 0, 23, 59, 59, 999),
      }
    }
  }
}

export function getOverviewComparisonRanges(preset: DashboardPreset, now = new Date()) {
  return {
    current: dashboardPresetToDateRange(preset, now),
    previous: previousDashboardPresetDateRange(preset, now),
  }
}

const DEVIATION_NOISE_THRESHOLD = '15.00'

export function getDeviationDateRanges(now: Date = new Date()): DeviationDateRanges {
  const year = now.getFullYear()
  const month = now.getMonth()
  return {
    reference: {
      from: new Date(year, month - 1, 1),
      to: new Date(year, month, 0, 23, 59, 59, 999),
    },
    baseline: {
      from: new Date(year, month - 4, 1),
      to: new Date(year, month - 1, 0, 23, 59, 59, 999),
    },
  }
}

export function buildDeviationDataset(input: {
  referenceRows: Array<{ id: number; amount: string }>
  baselineRows: Array<{ id: number; month: string; amount: string }>
  noiseThreshold?: string
}): Map<number, DeviationData> {
  const threshold = toDecimal(input.noiseThreshold ?? DEVIATION_NOISE_THRESHOLD)

  const numericMap = buildDeviationMap({
    referenceRows: input.referenceRows,
    baselineRows: input.baselineRows,
    noiseThreshold: input.noiseThreshold ?? DEVIATION_NOISE_THRESHOLD,
  })

  const result = new Map<number, DeviationData>()
  for (const ref of input.referenceRows) {
    const refAmount = toDecimal(ref.amount).abs()
    const belowNoiseThreshold = refAmount.lt(threshold)
    const numericValue = numericMap.get(ref.id)
    const isNew = numericValue === 'new'
    const deviation = typeof numericValue === 'number' ? numericValue : null
    result.set(ref.id, { deviation, isNew, belowNoiseThreshold })
  }
  return result
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

function formatDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function emptyCategoryDetailData(
  categoryData: CategoryDetailCategory | null,
  from: Date,
  to: Date
): CategoryDetailData {
  return {
    category: categoryData,
    summary: {
      total: ZERO_AMOUNT,
      count: 0,
      average: ZERO_AMOUNT,
    },
    trend: monthsBetween(from, to).map((month) => ({
      month,
      label: monthLabel(month),
      amount: ZERO_AMOUNT,
      count: 0,
    })),
    subcategories: [],
    topTransactions: [],
  }
}

function rowMatchesCategory(
  categoryData: CategoryDetailCategory,
  row: { categoryId: number | null; categorySlug: string | null; categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null }
): boolean {
  return (
    row.categoryId === categoryData.id &&
    row.categorySlug === categoryData.slug &&
    row.categoryType !== 'transfer' &&
    row.categoryType === categoryData.type
  )
}

function dateScopedTransactions(userId: string, from: Date, to: Date) {
  return and(
    eq(transactionTable.userId, userId),
    gte(transactionTable.occurredAt, from),
    lte(transactionTable.occurredAt, to)
  )
}

function expenseStatusUncategorized() {
  return eq(expense.status, '1')
}

function expenseStatusIncludedInDashboardTotals() {
  return inArray(expense.status, [...DASHBOARD_TOTAL_EXPENSE_STATUSES])
}

export async function getUncategorizedCount(userId: string, from: Date, to: Date, tagId?: number): Promise<number> {
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
          expenseStatusUncategorized(),
          isNull(expense.subCategoryId),
          tagScopedTransactions(tagId)
        )
      )

    return normalizeCount(rows[0]?.total)
  } catch {
    return 0
  }
}

export async function getOverviewAmountTotals(userId: string, from: Date, to: Date, tagId?: number): Promise<OverviewAggregateRow> {
  try {
    const rows = await db
      .select({
        totalIn: sql<string>`coalesce(sum(case when ${direction.code} = 'in' then ${effectiveAmount()} else 0 end), 0)::text`,
        totalOut: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' then ${effectiveAmount()} else 0 end)), 0)::text`,
        totalAllocation: sql<string>`coalesce(sum(case when ${direction.code} = 'allocation' then ${effectiveAmount()} else 0 end), 0)::text`,
        // Recurring income only — excludes income_extraordinary (260709-kp1).
        totalInRecurring: sql<string>`coalesce(sum(case when ${direction.code} = 'in' and ${nature.code} = 'income' then ${effectiveAmount()} else 0 end), 0)::text`,
        // Per-nature OUT sums — Uscite card breakdown (260709-lkw). abs mirrors totalOut.
        totalOutEssential: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' and ${nature.code} = 'essential' then ${effectiveAmount()} else 0 end)), 0)::text`,
        totalOutDiscretionary: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' and ${nature.code} = 'discretionary' then ${effectiveAmount()} else 0 end)), 0)::text`,
        totalOutDebt: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' and ${nature.code} = 'debt' then ${effectiveAmount()} else 0 end)), 0)::text`,
      })
      .from(transactionTable)
      .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
      .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .innerJoin(category, eq(subCategory.categoryId, category.id))
      .leftJoin(
        userSubcategoryOverride,
        and(
          eq(userSubcategoryOverride.subCategoryId, subCategory.id),
          eq(userSubcategoryOverride.userId, userId),
        ),
      )
      .innerJoin(
        nature,
        eq(
          nature.id,
          sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
        )
      )
      .innerJoin(direction, eq(nature.directionId, direction.id))
      .where(
        and(
          dateScopedTransactions(userId, from, to),
          expenseStatusIncludedInDashboardTotals(),
          ne(direction.code, 'transfer'),
          isNotSecondary(),
          tagScopedTransactions(tagId)
        )
      )

    return (
      rows[0] ?? {
        totalIn: ZERO_AMOUNT,
        totalOut: ZERO_AMOUNT,
        totalAllocation: ZERO_AMOUNT,
        totalInRecurring: ZERO_AMOUNT,
        totalOutEssential: ZERO_AMOUNT,
        totalOutDiscretionary: ZERO_AMOUNT,
        totalOutDebt: ZERO_AMOUNT,
      }
    )
  } catch {
    return {
      totalIn: ZERO_AMOUNT,
      totalOut: ZERO_AMOUNT,
      totalAllocation: ZERO_AMOUNT,
      totalInRecurring: ZERO_AMOUNT,
      totalOutEssential: ZERO_AMOUNT,
      totalOutDiscretionary: ZERO_AMOUNT,
      totalOutDebt: ZERO_AMOUNT,
    }
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
  // totalAllocation: propagate from aggregate row (new field in Phase 49)
  const totalAllocation = normalizeAmount(input.current.totalAllocation)
  const balance = balanceFrom(totalIn, totalOut)
  // Structural balance: recurring income only (260709-kp1). Null when unknown.
  const totalInRecurring =
    input.current.totalInRecurring != null ? normalizeAmount(input.current.totalInRecurring) : null
  const structuralBalance =
    totalInRecurring !== null ? balanceFrom(totalInRecurring, totalOut) : null
  const previousTotalIn = normalizeAmount(input.previous.totalIn)
  const previousTotalOut = normalizeAmount(input.previous.totalOut)
  const previousTotalAllocation = normalizeAmount(input.previous.totalAllocation)
  const previousBalance = balanceFrom(previousTotalIn, previousTotalOut)
  // Savings rate uses spending-only totalOut — allocation must NOT enter the inputs (D-06, Pitfall 3)
  const savingsRate = computeSavingsRate(totalIn, totalOut)
  const previousSavingsRate = computeSavingsRate(previousTotalIn, previousTotalOut)
  // Recurring-only savings rate (260709-lj5) — same formula and guards, recurring income only.
  const structuralSavingsRate =
    totalInRecurring !== null ? computeSavingsRate(totalInRecurring, totalOut) : null
  // Spending split by nature (260709-lkw). All three fields or null.
  const outByNature =
    input.current.totalOutEssential != null &&
    input.current.totalOutDiscretionary != null &&
    input.current.totalOutDebt != null
      ? {
          essential: normalizeAmount(input.current.totalOutEssential),
          discretionary: normalizeAmount(input.current.totalOutDiscretionary),
          debt: normalizeAmount(input.current.totalOutDebt),
        }
      : null

  return {
    totalIn,
    totalOut,
    totalAllocation,
    balance,
    structuralBalance,
    totalInRecurring,
    savingsRate,
    structuralSavingsRate,
    outByNature,
    uncategorizedCount: input.currentUncategorizedCount,
    deltas: {
      totalIn: computeDeltaPercent(totalIn, previousTotalIn),
      totalOut: computeDeltaPercent(totalOut, previousTotalOut),
      totalAllocation: computeDeltaPercent(totalAllocation, previousTotalAllocation),
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
      row.categoryType === 'transfer' ||
      row.categoryType === 'allocation' ||
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
        type: row.categoryType as 'in' | 'out',
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

export function buildCategoryRankingData(input: {
  from: Date
  to: Date
  rows: CategoryRankingAggregateRow[]
}): CategoryRankingItem[] {
  const monthKeys = monthsBetween(input.from, input.to)
  const monthKeySet = new Set(monthKeys)
  const emptySparkline = () =>
    new Map<string, CategorySparklinePoint>(
      monthKeys.map((month) => [
        month,
        {
          month,
          label: monthLabel(month),
          amount: ZERO_AMOUNT,
        },
      ])
    )

  const categoriesById = new Map<number, Omit<CategoryRankingItem, 'percentage'>>()

  for (const row of input.rows) {
    if (
      row.categoryId === null ||
      row.categoryName === null ||
      row.categorySlug === null ||
      row.categoryType === null ||
      row.categoryType === 'transfer' ||
      row.categoryType === 'allocation' ||
      row.month === null ||
      !monthKeySet.has(row.month)
    ) {
      continue
    }

    const existing = categoriesById.get(row.categoryId)
    const amount = normalizeAmount(row.amount)
    const countValue = normalizeCount(row.count)

    if (existing) {
      existing.count += countValue
      existing.amount = toDecimal(existing.amount).plus(amount).toFixed(2)
      const bucket = existing.sparkline.find((point) => point.month === row.month)

      if (bucket) {
        bucket.amount = toDecimal(bucket.amount).plus(amount).toFixed(2)
      }
    } else {
      const sparklineBuckets = emptySparkline()
      const bucket = sparklineBuckets.get(row.month)

      if (bucket) {
        bucket.amount = amount
      }

      categoriesById.set(row.categoryId, {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
        type: row.categoryType as 'in' | 'out',
        count: countValue,
        amount,
        sparkline: Array.from(sparklineBuckets.values()),
      })
    }
  }

  return computeBreakdownPercentages(Array.from(categoriesById.values()))
    .sort((left, right) => {
      const amountComparison = toDecimal(right.amount).comparedTo(toDecimal(left.amount))

      if (amountComparison !== 0) {
        return amountComparison
      }

      const nameComparison = left.name.localeCompare(right.name)

      if (nameComparison !== 0) {
        return nameComparison
      }

      return left.id - right.id
    })
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

export function buildMonthlyNatureTrendData(input: {
  from: Date
  to: Date
  rows: NatureTrendAggregateRow[]
}): MonthlyNatureTrendPoint[] {
  const emptySegments = (): Record<FlowNature | 'unclassified', string> => ({
    essential: ZERO_AMOUNT,
    discretionary: ZERO_AMOUNT,
    income: ZERO_AMOUNT,
    income_extraordinary: ZERO_AMOUNT,
    debt: ZERO_AMOUNT,
    transfer: ZERO_AMOUNT,
    savings: ZERO_AMOUNT,
    investment: ZERO_AMOUNT,
    unclassified: ZERO_AMOUNT,
  })

  const buckets = new Map<string, MonthlyNatureTrendPoint>(
    monthsBetween(input.from, input.to).map((month) => [
      month,
      {
        month,
        label: monthLabel(month),
        segments: emptySegments(),
        totalNc: 0,
        totalIgn: 0,
      },
    ])
  )

  for (const row of input.rows) {
    const bucket = buckets.get(row.month)
    if (!bucket) continue

    const segmentKey: FlowNature | 'unclassified' = row.nature ?? 'unclassified'
    bucket.segments[segmentKey] = toDecimal(bucket.segments[segmentKey])
      .plus(toDecimal(row.amount ?? 0))
      .toFixed(2)
    if (bucket.totalNc === 0) bucket.totalNc = normalizeCount(row.totalNc)
    if (bucket.totalIgn === 0) bucket.totalIgn = normalizeCount(row.totalIgn)
  }

  return Array.from(buckets.values())
}

export function buildCategoryDetailData(input: {
  category: CategoryDetailCategory | null
  from: Date
  to: Date
  trendRows: CategoryDetailTrendRow[]
  subcategoryRows: CategoryDetailSubcategoryRow[]
  topTransactionRows: CategoryDetailTopTransactionRow[]
}): CategoryDetailData {
  const categoryData = input.category
  const detail = emptyCategoryDetailData(categoryData, input.from, input.to)

  if (categoryData === null) {
    return detail
  }

  const monthKeys = monthsBetween(input.from, input.to)
  const trendBuckets = new Map<string, CategoryDetailTrendPoint>(
    monthKeys.map((month) => [
      month,
      {
        month,
        label: monthLabel(month),
        amount: ZERO_AMOUNT,
        count: 0,
      },
    ])
  )

  for (const row of input.trendRows) {
    if (row.month === null || !trendBuckets.has(row.month) || !rowMatchesCategory(categoryData, row)) {
      continue
    }

    const bucket = trendBuckets.get(row.month)

    if (bucket) {
      bucket.amount = toDecimal(bucket.amount).plus(normalizeAmount(row.amount)).toFixed(2)
      bucket.count += normalizeCount(row.count)
    }
  }

  const subcategories = computeBreakdownPercentages(
    input.subcategoryRows
      .flatMap((row): Array<Omit<CategoryDetailSubcategory, 'percentage'>> => {
        if (
          !rowMatchesCategory(categoryData, row) ||
          row.subCategoryId === null ||
          row.subCategoryName === null ||
          row.subCategorySlug === null
        ) {
          return []
        }

        return [
          {
            id: row.subCategoryId,
            name: row.subCategoryName,
            slug: row.subCategorySlug,
            count: normalizeCount(row.count),
            amount: normalizeAmount(row.amount),
          },
        ]
      })
      .sort((left, right) => {
        const amountComparison = toDecimal(right.amount).comparedTo(toDecimal(left.amount))

        if (amountComparison !== 0) {
          return amountComparison
        }

        const nameComparison = left.name.localeCompare(right.name)

        if (nameComparison !== 0) {
          return nameComparison
        }

        return left.id - right.id
      })
  )

  const total = subcategories
    .reduce((sum, row) => sum.plus(toDecimal(row.amount).abs()), toDecimal(0))
    .toFixed(2)
  const count = subcategories.reduce((sum, row) => sum + row.count, 0)
  const average = count > 0 ? toDecimal(total).div(count).toFixed(2) : ZERO_AMOUNT

  const topTransactions = input.topTransactionRows
    .flatMap((row): CategoryDetailTopTransaction[] => {
      if (!rowMatchesCategory(categoryData, row) || row.id === null || row.description === null || row.occurredAt === null) {
        return []
      }

      const date = formatDateKey(row.occurredAt)

      if (date === '') {
        return []
      }

      return [
        {
          id: row.id,
          title: row.customTitle ?? row.groupTitle ?? row.description,
          description: row.description,
          date,
          amount: normalizeAmount(toDecimal(row.amount ?? 0).abs().toString()),
        },
      ]
    })
    .sort((left, right) => {
      const amountComparison = toDecimal(right.amount).comparedTo(toDecimal(left.amount))

      if (amountComparison !== 0) {
        return amountComparison
      }

      const dateComparison = right.date.localeCompare(left.date)

      if (dateComparison !== 0) {
        return dateComparison
      }

      const titleComparison = left.title.localeCompare(right.title)

      if (titleComparison !== 0) {
        return titleComparison
      }

      return left.id.localeCompare(right.id)
    })
    .slice(0, 5)

  return {
    category: categoryData,
    summary: {
      total,
      count,
      average,
    },
    trend: Array.from(trendBuckets.values()),
    subcategories,
    topTransactions,
  }
}

export const getOverview = cache(async (preset: DashboardPreset = 'last-month'): Promise<OverviewData> => {
  const { userId } = await verifySession()
  const { current, previous } = getOverviewComparisonRanges(preset)

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
    // Direction filter: use direction.code when a specific type is selected
    const typeFilter = filters.type === 'all' ? undefined : eq(direction.code, filters.type)

    let rows: BreakdownAggregateRow[] = []

    try {
      rows = await db
        .select({
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          // Restored from direction join (Phase 49 — replaces sql`null` stub)
          categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
          subCategoryId: subCategory.id,
          subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
          subCategorySlug: subCategory.slug,
          count: countDistinct(expense.id),
          amount: sql<string>`coalesce(abs(sum(${effectiveAmount()})), 0)::text`,
        })
        .from(transactionTable)
        .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
        .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
        .innerJoin(category, eq(subCategory.categoryId, category.id))
        .leftJoin(
          userSubcategoryOverride,
          and(
            eq(userSubcategoryOverride.subCategoryId, subCategory.id),
            eq(userSubcategoryOverride.userId, userId),
          ),
        )
        .innerJoin(
          nature,
          eq(
            nature.id,
            sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
          )
        )
        .innerJoin(direction, eq(nature.directionId, direction.id))
        .where(
          and(
            dateScopedTransactions(userId, from, to),
            expenseStatusIncludedInDashboardTotals(),
            eq(direction.includedInTotals, true),
            isNotSecondary(),
            typeFilter
          )
        )
        .groupBy(category.id, subCategory.id, userSubcategoryOverride.customName, direction.code)
        .orderBy(category.id, subCategory.id)
    } catch {
      rows = []
    }

    return buildBreakdownData(rows)
  }
)

export const getCategoryRanking = cache(
  async (filters: DashboardFilters, tagId?: number): Promise<CategoryRankingItem[]> => {
    const { userId } = await verifySession()
    const { from, to } = dashboardPresetToDateRange(filters.preset)
    const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`
    // Direction filter: use direction.code when a specific type is selected
    const typeFilter = filters.type === 'all' ? undefined : eq(direction.code, filters.type)

    let rows: CategoryRankingAggregateRow[] = []

    try {
      rows = await db
        .select({
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          // Restored from direction join (Phase 49 — replaces sql`null` stub)
          categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
          month: monthSql,
          count: countDistinct(expense.id),
          amount: sql<string>`coalesce(abs(sum(${effectiveAmount()})), 0)::text`,
        })
        .from(transactionTable)
        .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
        .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
        .innerJoin(category, eq(subCategory.categoryId, category.id))
        .leftJoin(
          userSubcategoryOverride,
          and(
            eq(userSubcategoryOverride.subCategoryId, subCategory.id),
            eq(userSubcategoryOverride.userId, userId),
          ),
        )
        .innerJoin(
          nature,
          eq(
            nature.id,
            sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
          )
        )
        .innerJoin(direction, eq(nature.directionId, direction.id))
        .where(
          and(
            dateScopedTransactions(userId, from, to),
            expenseStatusIncludedInDashboardTotals(),
            eq(direction.includedInTotals, true),
            isNotSecondary(),
            typeFilter,
            tagScopedTransactions(tagId)
          )
        )
        .groupBy(category.id, monthSql, direction.code)
        .orderBy(desc(sql`coalesce(abs(sum(${effectiveAmount()})), 0)`), category.id, monthSql)
    } catch {
      rows = []
    }

    return buildCategoryRankingData({ from, to, rows })
  }
)

export const getCategoryDeviations = cache(
  async (input: CategoryDeviationsInput): Promise<Map<number, DeviationData>> => {
    const { userId } = await verifySession()
    const { reference, baseline } = getDeviationDateRanges()
    // Direction filter: use direction.code when a specific type is selected
    const typeFilter = input.type === 'all' ? undefined : eq(direction.code, input.type)
    const groupColumn = input.categoryId !== undefined ? subCategory.id : category.id
    const categoryScope =
      input.categoryId !== undefined ? eq(category.id, input.categoryId) : undefined

    let referenceRows: Array<{ id: number; amount: string }> = []
    let baselineRows: Array<{ id: number; month: string; amount: string }> = []

    try {
      const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`

      const [refResult, baseResult] = await Promise.all([
        db
          .select({
            id: groupColumn,
            amount: sql<string>`coalesce(abs(sum(${effectiveAmount()})), 0)::text`,
          })
          .from(transactionTable)
          .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
          .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
          .innerJoin(category, eq(subCategory.categoryId, category.id))
          .leftJoin(
            userSubcategoryOverride,
            and(
              eq(userSubcategoryOverride.subCategoryId, subCategory.id),
              eq(userSubcategoryOverride.userId, userId),
            ),
          )
          .innerJoin(
            nature,
            eq(
              nature.id,
              sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
            )
          )
          .innerJoin(direction, eq(nature.directionId, direction.id))
          .where(
            and(
              dateScopedTransactions(userId, reference.from, reference.to),
              expenseStatusIncludedInDashboardTotals(),
              eq(direction.includedInTotals, true),
              isNotSecondary(),
              typeFilter,
              categoryScope,
              tagScopedTransactions(input.tagId)
            )
          )
          .groupBy(groupColumn),
        db
          .select({
            id: groupColumn,
            month: monthSql,
            amount: sql<string>`coalesce(abs(sum(${effectiveAmount()})), 0)::text`,
          })
          .from(transactionTable)
          .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
          .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
          .innerJoin(category, eq(subCategory.categoryId, category.id))
          .leftJoin(
            userSubcategoryOverride,
            and(
              eq(userSubcategoryOverride.subCategoryId, subCategory.id),
              eq(userSubcategoryOverride.userId, userId),
            ),
          )
          .innerJoin(
            nature,
            eq(
              nature.id,
              sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
            )
          )
          .innerJoin(direction, eq(nature.directionId, direction.id))
          .where(
            and(
              dateScopedTransactions(userId, baseline.from, baseline.to),
              expenseStatusIncludedInDashboardTotals(),
              eq(direction.includedInTotals, true),
              isNotSecondary(),
              typeFilter,
              categoryScope,
              tagScopedTransactions(input.tagId)
            )
          )
          .groupBy(groupColumn, monthSql),
      ])

      referenceRows = refResult.map((row) => ({
        id: Number(row.id),
        amount: String(row.amount),
      }))
      baselineRows = baseResult.map((row) => ({
        id: Number(row.id),
        month: String(row.month),
        amount: String(row.amount),
      }))
    } catch {
      referenceRows = []
      baselineRows = []
    }

    return buildDeviationDataset({ referenceRows, baselineRows })
  }
)

export const getCategoryDetail = cache(
  async (categoryId: number, filters: DashboardFilters, tagId?: number): Promise<CategoryDetailData> => {
    const { userId } = await verifySession()
    const { from, to } = dashboardPresetToDateRange(filters.preset)
    const emptyData = () => emptyCategoryDetailData(null, from, to)

    let categoryData: CategoryDetailCategory | null = null

    try {
      // Resolve the category's direction code via a correlated subquery on subcategories
      const categoryRows = await db
        .select({
          id: category.id,
          name: category.name,
          slug: category.slug,
          // Derive type from the first included-direction subcategory, honouring userSubcategoryOverride.
          // AND d.included_in_totals = true restricts to 'in'/'out' so the result always matches
          // the includedInTotals filter on the data queries and rowMatchesCategory never rejects rows
          // because of a non-deterministic 'allocation'/'transfer' result.
          // ORDER BY d.id makes LIMIT 1 deterministic.
          type: sql<'in' | 'out' | null>`(
            SELECT d.code FROM direction d
            INNER JOIN nature n ON n.direction_id = d.id
            INNER JOIN sub_category sc ON sc.id IN (
              SELECT sc2.id FROM sub_category sc2 WHERE sc2.category_id = ${category.id}
            )
            LEFT JOIN user_subcategory_override uso
              ON uso.sub_category_id = sc.id AND uso.user_id = ${userId}
            WHERE n.id = COALESCE(uso.nature_id, sc.nature_id)
              AND d.included_in_totals = true
            ORDER BY d.id
            LIMIT 1
          )`,
        })
        .from(category)
        .where(
          and(
            eq(category.id, categoryId),
            eq(category.isActive, true),
            or(isNull(category.userId), eq(category.userId, userId))
          )
        )
        .limit(1)

      const row = categoryRows[0]

      if (row) {
        categoryData = {
          id: row.id,
          name: row.name,
          slug: row.slug,
          type: (row.type ?? 'out') as 'in' | 'out',
        }
      }
    } catch {
      return emptyData()
    }

    if (categoryData === null) {
      return emptyData()
    }

    const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`
    const activeScopedCategory = and(
      eq(category.id, categoryId),
      eq(category.isActive, true),
      or(isNull(category.userId), eq(category.userId, userId))
    )
    const activeScopedSubCategory = and(
      eq(subCategory.isActive, true),
      or(isNull(subCategory.userId), eq(subCategory.userId, userId))
    )

    try {
      const [trendRows, subcategoryRows, topTransactionRows] = await Promise.all([
        db
          .select({
            categoryId: category.id,
            categorySlug: category.slug,
            // Restored from direction join (Phase 49 — replaces sql`null` stub)
            categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
            month: monthSql,
            count: countDistinct(expense.id),
            amount: sql<string>`coalesce(abs(sum(${effectiveAmount()})), 0)::text`,
          })
          .from(transactionTable)
          .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
          .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
          .innerJoin(category, eq(subCategory.categoryId, category.id))
          .leftJoin(
            userSubcategoryOverride,
            and(
              eq(userSubcategoryOverride.subCategoryId, subCategory.id),
              eq(userSubcategoryOverride.userId, userId),
            ),
          )
          .innerJoin(
            nature,
            eq(
              nature.id,
              sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
            )
          )
          .innerJoin(direction, eq(nature.directionId, direction.id))
          .where(
            and(
              dateScopedTransactions(userId, from, to),
              expenseStatusIncludedInDashboardTotals(),
              activeScopedCategory,
              activeScopedSubCategory,
              eq(direction.includedInTotals, true),
              isNotSecondary(),
              tagScopedTransactions(tagId)
            )
          )
          .groupBy(category.id, monthSql, direction.code)
          .orderBy(monthSql),
        db
          .select({
            categoryId: category.id,
            categorySlug: category.slug,
            // Restored from direction join (Phase 49 — replaces sql`null` stub)
            categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
            subCategoryId: subCategory.id,
            subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
            subCategorySlug: subCategory.slug,
            count: countDistinct(expense.id),
            amount: sql<string>`coalesce(abs(sum(${effectiveAmount()})), 0)::text`,
          })
          .from(transactionTable)
          .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
          .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
          .innerJoin(category, eq(subCategory.categoryId, category.id))
          .leftJoin(
            userSubcategoryOverride,
            and(
              eq(userSubcategoryOverride.subCategoryId, subCategory.id),
              eq(userSubcategoryOverride.userId, userId),
            ),
          )
          .innerJoin(
            nature,
            eq(
              nature.id,
              sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
            )
          )
          .innerJoin(direction, eq(nature.directionId, direction.id))
          .where(
            and(
              dateScopedTransactions(userId, from, to),
              expenseStatusIncludedInDashboardTotals(),
              activeScopedCategory,
              activeScopedSubCategory,
              eq(direction.includedInTotals, true),
              isNotSecondary(),
              tagScopedTransactions(tagId)
            )
          )
          .groupBy(category.id, subCategory.id, userSubcategoryOverride.customName, direction.code)
          .orderBy(desc(sql`coalesce(abs(sum(${effectiveAmount()})), 0)`), sql`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`, subCategory.id),
        db
          .select({
            id: transactionTable.id,
            categoryId: category.id,
            categorySlug: category.slug,
            // Restored from direction join (Phase 49 — replaces sql`null` stub)
            categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
            description: transactionTable.description,
            customTitle: transactionTable.customTitle,
            groupTitle: expenseGroup.title,
            amount: transactionTable.amount,
            occurredAt: transactionTable.occurredAt,
          })
          .from(transactionTable)
          .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
          .leftJoin(expenseGroupMembership, eq(expense.id, expenseGroupMembership.expenseId))
          .leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))
          .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
          .innerJoin(category, eq(subCategory.categoryId, category.id))
          .leftJoin(
            userSubcategoryOverride,
            and(
              eq(userSubcategoryOverride.subCategoryId, subCategory.id),
              eq(userSubcategoryOverride.userId, userId),
            ),
          )
          .innerJoin(
            nature,
            eq(
              nature.id,
              sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
            )
          )
          .innerJoin(direction, eq(nature.directionId, direction.id))
          .where(
            and(
              dateScopedTransactions(userId, from, to),
              expenseStatusIncludedInDashboardTotals(),
              activeScopedCategory,
              activeScopedSubCategory,
              eq(direction.includedInTotals, true),
              isNotSecondary(),
              tagScopedTransactions(tagId)
            )
          )
          .orderBy(desc(sql`abs(${effectiveAmount()})`), desc(transactionTable.occurredAt), transactionTable.id)
          .limit(5),
      ])

      return buildCategoryDetailData({
        category: categoryData,
        from,
        to,
        trendRows,
        subcategoryRows,
        topTransactionRows,
      })
    } catch {
      return buildCategoryDetailData({
        category: categoryData,
        from,
        to,
        trendRows: [],
        subcategoryRows: [],
        topTransactionRows: [],
      })
    }
  }
)

export const getMonthlyTrendByNature = cache(async (preset: DashboardPreset): Promise<MonthlyNatureTrendPoint[]> => {
  const { userId } = await verifySession()
  const { from, to } = dashboardPresetToDateRange(preset)
  const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`
  // Direction-aware nature grouping: resolve effective nature via override.natureId or sub.natureId → nature.code
  const natureSql = sql<FlowNature | null>`(
    SELECT n.code FROM nature n
    WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
    LIMIT 1
  )`

  let rows: NatureTrendAggregateRow[] = []

  try {
    rows = await db
      .select({
        month: monthSql,
        nature: natureSql,
        amount: sql<string>`coalesce(sum(${effectiveAmount()}), 0)::text`,
        totalNc: sql<number>`count(distinct case when ${expense.status} = '1' and ${expense.subCategoryId} is null then ${expense.id} end)`,
        totalIgn: sql<number>`count(distinct case when ${direction.code} = 'transfer' then ${expense.id} end)`,
      })
      .from(transactionTable)
      .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .leftJoin(
        userSubcategoryOverride,
        and(
          eq(userSubcategoryOverride.subCategoryId, subCategory.id),
          eq(userSubcategoryOverride.userId, userId),
        ),
      )
      .leftJoin(
        nature,
        eq(
          nature.id,
          sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
        )
      )
      .leftJoin(direction, eq(nature.directionId, direction.id))
      .where(
        and(
          dateScopedTransactions(userId, from, to),
          expenseStatusIncludedInDashboardTotals(),
          or(isNull(direction.code), ne(direction.code, 'transfer')),
          isNotSecondary()
        )
      )
      .groupBy(monthSql, natureSql)
  } catch {
    rows = []
  }

  return buildMonthlyNatureTrendData({ from, to, rows })
})

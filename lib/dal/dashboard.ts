import 'server-only'
import { cache } from 'react'
import {
  and,
  countDistinct,
  desc,
  eq,
  isNull,
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
  ledgerEntryCash,
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
import {
  DASHBOARD_TOTAL_EXPENSE_STATUSES,
  dateScopedTransactions,
  expenseStatusIncludedInDashboardTotals,
  type LedgerRowSource,
} from '@/lib/dal/dashboard-filters'
import { getCoveredMonthsInYear, type CoveredMonth } from '@/lib/dal/covered-months'
import {
  buildCoveredMonthSeries,
  buildYearSeries,
  computeCurrentMonthHybrid,
  computePaceAndProjection,
  isPartialMonth,
  MIN_COVERED_MONTHS_FOR_PACE,
} from '@/lib/services/pace-and-projection'

export { DASHBOARD_TOTAL_EXPENSE_STATUSES }

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

// Phase 83 (CLIST-01, CLIST-02, CLIST-04, D-09) — NEW, additive types alongside
// CategorySparklinePoint/CategoryRankingItem above. getCategoryYearRanking is a year+direction
// scoped composition of the Phase 82 number engine; it never reshapes getCategoryRanking or its
// types, which stay untouched for the v2.8/v2.9 regression suites (see the plan's prohibitions).
export type CategoryYearSparklinePoint = {
  month: string
  label: string
  amount: string
  state: 'covered' | 'current' | 'estimated' | 'uncovered'
}

export type CategoryYearRankingItem = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out' | 'allocation'
  count: number
  amount: string
  percentage: number
  sparkline: CategoryYearSparklinePoint[]
  projection: string | null
  pace: string | null
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

// Phase 83 — no categoryType column: getCategoryYearRanking is always scoped to one explicit
// directionCode argument, so the output item's `type` is set directly from that argument, never
// read off a row.
type CategoryYearRankingAggregateRow = {
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
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

function expenseStatusUncategorized() {
  return eq(expense.status, '1')
}

// Lens-invariant (Phase 80, ADR 0019 §10 seam survey "Confirm" note, closed here): an amortized
// transaction is always categorized before a plan can attach to it (D-04's activation guard), so
// an instalment can never itself be "uncategorized" — this function stays reading `transaction`
// under either lens, no ledgerRowSource parameter needed.
export async function getUncategorizedCount(userId: string, from: Date, to: Date): Promise<number> {
  try {
    const rows = await db
      .select({ total: countDistinct(expense.id) })
      .from(transactionTable)
      .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .where(
        and(
          dateScopedTransactions(transactionTable, userId, from, to),
          expenseStatusUncategorized(),
          isNull(expense.subCategoryId)
        )
      )

    return normalizeCount(rows[0]?.total)
  } catch {
    return 0
  }
}

export async function getOverviewAmountTotals(
  userId: string,
  from: Date,
  to: Date,
  ledgerRowSource: LedgerRowSource = ledgerEntryCash,
): Promise<OverviewAggregateRow> {
  try {
    const rows = await db
      .select({
        totalIn: sql<string>`coalesce(sum(case when ${direction.code} = 'in' then ${ledgerRowSource.amount} else 0 end), 0)::text`,
        totalOut: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' then ${ledgerRowSource.amount} else 0 end)), 0)::text`,
        totalAllocation: sql<string>`coalesce(sum(case when ${direction.code} = 'allocation' then ${ledgerRowSource.amount} else 0 end), 0)::text`,
        // Recurring income only — excludes income_extraordinary (260709-kp1).
        totalInRecurring: sql<string>`coalesce(sum(case when ${direction.code} = 'in' and ${nature.code} = 'income' then ${ledgerRowSource.amount} else 0 end), 0)::text`,
        // Per-nature OUT sums — Uscite card breakdown (260709-lkw). abs mirrors totalOut.
        totalOutEssential: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' and ${nature.code} = 'essential' then ${ledgerRowSource.amount} else 0 end)), 0)::text`,
        totalOutDiscretionary: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' and ${nature.code} = 'discretionary' then ${ledgerRowSource.amount} else 0 end)), 0)::text`,
        totalOutDebt: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' and ${nature.code} = 'debt' then ${ledgerRowSource.amount} else 0 end)), 0)::text`,
      })
      .from(ledgerRowSource)
      .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
          // ledger_entry_cash/ledger_entry_accrual's own WHERE NOT EXISTS (or UNION ALL branch)
          // already excludes refund rows — the old secondary-row exclusion fragment is
          // redundant here and intentionally dropped (Phase 77, D-11).
          dateScopedTransactions(ledgerRowSource, userId, from, to),
          expenseStatusIncludedInDashboardTotals(),
          ne(direction.code, 'transfer'),
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

/**
 * Phase 83 (CLIST-01, CLIST-02, CLIST-04, CLIST-06, D-07, D-09, D-15) — NEW, additive alongside
 * buildCategoryRankingData above (never a reshape of it). Zero-fills a 12-entry-per-category
 * sparkline for `input.year`, mirroring buildCategoryRankingData's emptySparkline()/accumulation
 * pattern, except each point additionally carries an explicit `state` — 'covered'/'current'/
 * 'estimated'/'uncovered' — computed ONCE (shared across every category, not recomputed per
 * category) from `input.coveredMonths` and today's calendar month:
 *   - the calendar-current month is always 'current' (never 'covered'), regardless of coverage;
 *   - a month strictly after the current month within the selected year is 'estimated' — its
 *     `amount` stays '0.00' forever, since no transaction can exist yet for a month that has not
 *     happened (a fabricated pace-derived value would violate D-07 by leaking into the summed
 *     total);
 *   - every other month is 'covered' when in the account-wide Covered Month set, 'uncovered'
 *     otherwise.
 *
 * For the current month only, when the year has >= MIN_COVERED_MONTHS_FOR_PACE pace-eligible
 * (non-Partial) Covered Months, that ONE point's displayed amount is replaced by
 * computeCurrentMonthHybrid(rawAmount, categoryPace) — never below the already-observed raw
 * amount (D-06 "current month = max(spent so far, pace)"). `amount` is then set to
 * `buildYearSeries(...).total` computed AFTER that substitution, so D-07 holds against the
 * DISPLAYED series, never the pre-hybrid one. `projection`/`pace` are both `null` whenever the
 * category's own pace-eligible series is insufficient (D-15) — computePaceAndProjection's
 * 'insufficient' branch is consumed directly, never coerced to a number or a zero.
 */
export function buildCategoryYearRankingData(input: {
  year: number
  directionCode: 'in' | 'out' | 'allocation'
  coveredMonths: CoveredMonth[]
  rows: CategoryYearRankingAggregateRow[]
}): CategoryYearRankingItem[] {
  const from = new Date(input.year, 0, 1)
  const to = new Date(input.year, 11, 31, 23, 59, 59, 999)
  const monthKeys = monthsBetween(from, to)
  const monthKeySet = new Set(monthKeys)
  const coveredSet = new Set(input.coveredMonths.map((m) => m.yearMonth))

  const today = new Date()
  // Shared, once-computed classification map — identical across every category row for this year
  // (never recomputed per category).
  const monthStateByKey = new Map<string, CategoryYearSparklinePoint['state']>()
  for (const month of monthKeys) {
    if (isPartialMonth(month, today)) {
      monthStateByKey.set(month, 'current')
      continue
    }
    const [monthYear, monthNumber] = month.split('-').map(Number) as [number, number]
    const isFutureMonth =
      monthYear > today.getFullYear() ||
      (monthYear === today.getFullYear() && monthNumber > today.getMonth() + 1)
    monthStateByKey.set(
      month,
      isFutureMonth ? 'estimated' : coveredSet.has(month) ? 'covered' : 'uncovered'
    )
  }

  // Account-wide pace eligibility, computed once — a Partial (current) Covered Month never
  // counts toward MIN_COVERED_MONTHS_FOR_PACE.
  const paceEligibleMonths = input.coveredMonths.filter((m) => !isPartialMonth(m.yearMonth, today))

  const emptySparkline = () =>
    new Map<string, CategoryYearSparklinePoint>(
      monthKeys.map((month) => [
        month,
        {
          month,
          label: monthLabel(month),
          amount: ZERO_AMOUNT,
          state: monthStateByKey.get(month) ?? 'uncovered',
        },
      ])
    )

  const categoriesById = new Map<number, Omit<CategoryYearRankingItem, 'percentage'>>()

  for (const row of input.rows) {
    if (
      row.categoryId === null ||
      row.categoryName === null ||
      row.categorySlug === null ||
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
        type: input.directionCode,
        count: countValue,
        amount: ZERO_AMOUNT,
        sparkline: Array.from(sparklineBuckets.values()),
        projection: null,
        pace: null,
      })
    }
  }

  for (const item of categoriesById.values()) {
    // Pace/projection composed from THIS category's raw (pre-hybrid) series, restricted to the
    // account-wide Covered Months and excluding the Partial current month (D-15).
    const categoryPaceSeries = buildCoveredMonthSeries(
      input.coveredMonths,
      item.sparkline.map((point) => ({ yearMonth: point.month, amount: point.amount }))
    ).filter((month) => !isPartialMonth(month.yearMonth, today))
    const paceResult = computePaceAndProjection(categoryPaceSeries)

    if (paceEligibleMonths.length >= MIN_COVERED_MONTHS_FOR_PACE && paceResult.status === 'complete') {
      const currentPoint = item.sparkline.find((point) => point.state === 'current')
      if (currentPoint) {
        currentPoint.amount = computeCurrentMonthHybrid(currentPoint.amount, paceResult.pace)
      }
    }

    // D-07: the total is the reduce-sum of the DISPLAYED series (post current-month-hybrid
    // substitution), never re-derived independently.
    item.amount = buildYearSeries(
      item.sparkline.map((point) => ({ yearMonth: point.month, amount: point.amount }))
    ).total

    item.projection = paceResult.status === 'complete' ? paceResult.projection : null
    item.pace = paceResult.status === 'complete' ? paceResult.pace : null
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
  async (
    filters: DashboardFilters,
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<BreakdownCategory[]> => {
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
          amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
        })
        .from(ledgerRowSource)
        .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
            // ledger_entry_cash's own WHERE NOT EXISTS already excludes refund rows —
            // the legacy refund-exclusion check is redundant here and intentionally dropped (Phase 77, D-11).
            dateScopedTransactions(ledgerRowSource, userId, from, to),
            expenseStatusIncludedInDashboardTotals(),
            eq(direction.includedInTotals, true),
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
  async (
    filters: DashboardFilters,
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<CategoryRankingItem[]> => {
    const { userId } = await verifySession()
    const { from, to } = dashboardPresetToDateRange(filters.preset)
    const monthSql = sql<string>`to_char(${ledgerRowSource.occurredAt}, 'YYYY-MM')`
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
          amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
        })
        .from(ledgerRowSource)
        .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
            // ledger_entry_cash's own WHERE NOT EXISTS already excludes refund rows —
            // the legacy refund-exclusion check is redundant here and intentionally dropped (Phase 77, D-11).
            dateScopedTransactions(ledgerRowSource, userId, from, to),
            expenseStatusIncludedInDashboardTotals(),
            eq(direction.includedInTotals, true),
            typeFilter
          )
        )
        .groupBy(category.id, monthSql, direction.code)
        .orderBy(desc(sql`coalesce(abs(sum(${ledgerRowSource.amount})), 0)`), category.id, monthSql)
    } catch {
      rows = []
    }

    return buildCategoryRankingData({ from, to, rows })
  }
)

/**
 * Phase 83 (CLIST-01, CLIST-04, D-09, D-10, T-83-01) — NEW, additive alongside getCategoryRanking
 * above (never a reshape of it): getCategoryRanking's `eq(direction.includedInTotals, true)`
 * predicate and its `typeFilter`/'all' branching stay completely untouched, because
 * tests/reimbursement-regression.test.ts and tests/helpers/reimbursement-test-db.ts's
 * captureAggregationSnapshot assert on that exact predicate/behavior across the v2.8/v2.9
 * regression suites.
 *
 * This function always takes an explicit single `directionCode` (never 'all') and uses the D-09
 * predicate flip: `eq(direction.hidden, false)` replaces `eq(direction.includedInTotals, true)`,
 * which for the first time surfaces the `allocation` direction (seeded
 * `includedInTotals: false`/`hidden: false` in scripts/seed-data.ts).
 *
 * Scoped to the authenticated session's userId via verifySession(), parameterized through
 * drizzle's query builder (T-83-01).
 */
export const getCategoryYearRanking = cache(
  async (
    year: number,
    directionCode: 'in' | 'out' | 'allocation',
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<CategoryYearRankingItem[]> => {
    const { userId } = await verifySession()
    const from = new Date(year, 0, 1)
    const to = new Date(year, 11, 31, 23, 59, 59, 999)
    const monthSql = sql<string>`to_char(${ledgerRowSource.occurredAt}, 'YYYY-MM')`

    let rows: CategoryYearRankingAggregateRow[] = []

    try {
      rows = await db
        .select({
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          month: monthSql,
          count: countDistinct(expense.id),
          amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
        })
        .from(ledgerRowSource)
        .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
            dateScopedTransactions(ledgerRowSource, userId, from, to),
            expenseStatusIncludedInDashboardTotals(),
            // D-09 predicate flip: hidden=false replaces includedInTotals=true, which for the
            // first time admits the allocation direction (Accantonamenti, CLIST-04).
            eq(direction.hidden, false),
            eq(direction.code, directionCode)
          )
        )
        .groupBy(category.id, monthSql)
        .orderBy(category.id, monthSql)
    } catch {
      rows = []
    }

    const coveredMonths = await getCoveredMonthsInYear(year)
    return buildCategoryYearRankingData({ year, directionCode, coveredMonths, rows })
  }
)

export const getCategoryDeviations = cache(
  async (
    input: CategoryDeviationsInput,
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<Map<number, DeviationData>> => {
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
      const monthSql = sql<string>`to_char(${ledgerRowSource.occurredAt}, 'YYYY-MM')`

      const [refResult, baseResult] = await Promise.all([
        db
          .select({
            id: groupColumn,
            amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
          })
          .from(ledgerRowSource)
          .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
              // ledger_entry_cash's own WHERE NOT EXISTS already excludes refund rows —
              // the legacy refund-exclusion check is redundant here and intentionally dropped (Phase 77, D-11).
              dateScopedTransactions(ledgerRowSource, userId, reference.from, reference.to),
              expenseStatusIncludedInDashboardTotals(),
              eq(direction.includedInTotals, true),
              typeFilter,
              categoryScope
            )
          )
          .groupBy(groupColumn),
        db
          .select({
            id: groupColumn,
            month: monthSql,
            amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
          })
          .from(ledgerRowSource)
          .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
              // ledger_entry_cash's own WHERE NOT EXISTS already excludes refund rows —
              // the legacy refund-exclusion check is redundant here and intentionally dropped (Phase 77, D-11).
              dateScopedTransactions(ledgerRowSource, userId, baseline.from, baseline.to),
              expenseStatusIncludedInDashboardTotals(),
              eq(direction.includedInTotals, true),
              typeFilter,
              categoryScope
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
  async (
    categoryId: number,
    filters: DashboardFilters,
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<CategoryDetailData> => {
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

    const monthSql = sql<string>`to_char(${ledgerRowSource.occurredAt}, 'YYYY-MM')`
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
            amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
          })
          .from(ledgerRowSource)
          .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
              // ledger_entry_cash's own WHERE NOT EXISTS already excludes refund rows —
              // the legacy refund-exclusion check is redundant here and intentionally dropped (Phase 77, D-11).
              dateScopedTransactions(ledgerRowSource, userId, from, to),
              expenseStatusIncludedInDashboardTotals(),
              activeScopedCategory,
              activeScopedSubCategory,
              eq(direction.includedInTotals, true)
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
            amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
          })
          .from(ledgerRowSource)
          .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
              // ledger_entry_cash's own WHERE NOT EXISTS already excludes refund rows —
              // the legacy refund-exclusion check is redundant here and intentionally dropped (Phase 77, D-11).
              dateScopedTransactions(ledgerRowSource, userId, from, to),
              expenseStatusIncludedInDashboardTotals(),
              activeScopedCategory,
              activeScopedSubCategory,
              eq(direction.includedInTotals, true)
            )
          )
          .groupBy(category.id, subCategory.id, userSubcategoryOverride.customName, direction.code)
          .orderBy(desc(sql`coalesce(abs(sum(${ledgerRowSource.amount})), 0)`), sql`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`, subCategory.id),
        db
          .select({
            id: ledgerRowSource.id,
            categoryId: category.id,
            categorySlug: category.slug,
            // Restored from direction join (Phase 49 — replaces sql`null` stub)
            categoryType: sql<'in' | 'out' | 'allocation' | 'system' | 'transfer' | null>`${direction.code}`,
            // An amortization_instalment row (under competenza) has no matching `transaction`
            // row and therefore no bank description — fall back to the shared Standalone
            // Expense's `title` (NOT NULL, guaranteed non-empty). Phase 80 Task 3.
            description: sql<string | null>`coalesce(${transactionTable.description}, ${expense.title})`,
            customTitle: transactionTable.customTitle,
            groupTitle: expenseGroup.title,
            // Prefer the RAW un-netted transaction amount when a real transaction row exists
            // (preserves the cash-lens display contract verbatim, per the 77-06 regression
            // comment); fall back to the ledger row's own already-resolved amount only when no
            // transaction row exists — an instalment, which has no netting applied to it in the
            // first place (ADR 0019 Consequences).
            amount: sql<string>`coalesce(${transactionTable.amount}, ${ledgerRowSource.amount})`,
            occurredAt: ledgerRowSource.occurredAt,
          })
          .from(ledgerRowSource)
          // LEFT JOIN (not INNER): an amortization_instalment row under competenza has no
          // matching `transaction` row, and this sub-query must still surface it (Phase 80,
          // Task 3) — the `transaction` join is now display-only context (description/
          // customTitle/groupTitle), never the row-filtering source.
          .leftJoin(transactionTable, eq(transactionTable.id, ledgerRowSource.id))
          .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
              dateScopedTransactions(ledgerRowSource, userId, from, to),
              expenseStatusIncludedInDashboardTotals(),
              activeScopedCategory,
              activeScopedSubCategory,
              eq(direction.includedInTotals, true)
            )
          )
          .orderBy(desc(sql`abs(${ledgerRowSource.amount})`), desc(ledgerRowSource.occurredAt), ledgerRowSource.id)
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

export const getMonthlyTrendByNature = cache(async (
  preset: DashboardPreset,
  ledgerRowSource: LedgerRowSource = ledgerEntryCash,
): Promise<MonthlyNatureTrendPoint[]> => {
  const { userId } = await verifySession()
  const { from, to } = dashboardPresetToDateRange(preset)
  const monthSql = sql<string>`to_char(${ledgerRowSource.occurredAt}, 'YYYY-MM')`
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
        amount: sql<string>`coalesce(sum(${ledgerRowSource.amount}), 0)::text`,
        totalNc: sql<number>`count(distinct case when ${expense.status} = '1' and ${expense.subCategoryId} is null then ${expense.id} end)`,
        totalIgn: sql<number>`count(distinct case when ${direction.code} = 'transfer' then ${expense.id} end)`,
      })
      .from(ledgerRowSource)
      .leftJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
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
          // ledger_entry_cash's own WHERE NOT EXISTS already excludes refund rows —
          // the legacy refund-exclusion check is redundant here and intentionally dropped (Phase 77, D-11).
          dateScopedTransactions(ledgerRowSource, userId, from, to),
          expenseStatusIncludedInDashboardTotals(),
          or(isNull(direction.code), ne(direction.code, 'transfer'))
        )
      )
      .groupBy(monthSql, natureSql)
  } catch {
    rows = []
  }

  return buildMonthlyNatureTrendData({ from, to, rows })
})

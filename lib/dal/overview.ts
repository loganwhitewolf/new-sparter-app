import 'server-only'
import { cache } from 'react'
import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import {
  category,
  expense,
  subCategory,
  transaction as transactionTable,
  userSubcategoryOverride,
} from '@/lib/db/schema'
import { monthLabel, monthsBetween } from '@/lib/utils/date'
import type { FlowNature } from '@/lib/utils/nature-labels'
import { toDecimal } from '@/lib/utils/decimal'
import {
  buildOverviewData,
  getOverviewAmountTotals,
  getUncategorizedCount,
  DASHBOARD_TOTAL_EXPENSE_STATUSES,
  notExcludedFromTotals,
} from '@/lib/dal/dashboard'
import type { OverviewData } from '@/lib/dal/dashboard'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MonthOverMonthChange = {
  categoryId: number
  name: string
  delta: string // signed Decimal string; negative = spent less (saved money)
  isNew: boolean
}

type OutNature = 'essential' | 'discretionary' | 'operational' | 'financial' | 'debt' | 'extraordinary'

const OUT_NATURES: OutNature[] = [
  'essential',
  'discretionary',
  'operational',
  'financial',
  'debt',
  'extraordinary',
]

const ZERO_AMOUNT = '0.00'

export type OverviewChartPoint = {
  month: string
  label: string
  income: { recurring: string; extraordinary: string }
  out: Record<OutNature, string>
}

// ─── Private helpers (mirrors dashboard.ts private helpers) ──────────────────

function notTransferCategory() {
  return or(isNull(category.type), ne(category.type, 'transfer'))
}

function dateScopedTransactions(userId: string, from: Date, to: Date) {
  return and(
    eq(transactionTable.userId, userId),
    gte(transactionTable.occurredAt, from),
    lte(transactionTable.occurredAt, to)
  )
}

function expenseStatusIncludedInDashboardTotals() {
  return inArray(expense.status, [...DASHBOARD_TOTAL_EXPENSE_STATUSES])
}

function emptyOutSegments(): Record<OutNature, string> {
  return {
    essential: ZERO_AMOUNT,
    discretionary: ZERO_AMOUNT,
    operational: ZERO_AMOUNT,
    financial: ZERO_AMOUNT,
    debt: ZERO_AMOUNT,
    extraordinary: ZERO_AMOUNT,
  }
}

// ─── Exported DAL functions ───────────────────────────────────────────────────

/**
 * Returns distinct years (YYYY) that have at least one transaction for the
 * authenticated user, ordered descending.
 *
 * T-42-05 mitigated: verifySession() scopes query to authenticated userId.
 */
export const getYearsWithData = cache(async (): Promise<string[]> => {
  const { userId } = await verifySession()

  try {
    const result = await db.execute(sql`
      SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY') AS yr
      FROM transaction
      WHERE user_id = ${userId}
      ORDER BY yr DESC
    `)
    const rows = result.rows as { yr: string }[]
    return rows.map((row) => row.yr)
  } catch {
    return []
  }
})

/**
 * Returns the four KPI totals (totalIn, totalOut, balance, savingsRate) plus
 * YTD-vs-prior-YTD deltas for the given year.
 *
 * YTD upper bound = last month with data in the year (D-11: avoids comparing a
 * partial current month against a full prior-year month).
 * Prior-year span uses the same month index (equal-span comparison).
 *
 * T-42-05 mitigated: verifySession() scopes all sub-queries to authenticated userId.
 */
export const getOverview = cache(async (year: number): Promise<OverviewData> => {
  const { userId } = await verifySession()

  try {
    // Determine YTD upper bound: last month with data in this year
    const lastMonthResult = await db.execute(sql`
      SELECT MAX(TO_CHAR(occurred_at, 'YYYY-MM')) AS last_ym
      FROM transaction
      WHERE user_id = ${userId}
        AND TO_CHAR(occurred_at, 'YYYY') = ${String(year)}
    `)
    const lastYm = (lastMonthResult.rows[0] as { last_ym: string | null } | undefined)?.last_ym
    // Default to full year (Dec) if no data found
    const lastMonthIdx = lastYm ? Number(lastYm.slice(5, 7)) - 1 : 11

    const currentFrom = new Date(year, 0, 1)
    const currentTo = new Date(year, lastMonthIdx + 1, 0, 23, 59, 59, 999)
    const previousFrom = new Date(year - 1, 0, 1)
    const previousTo = new Date(year - 1, lastMonthIdx + 1, 0, 23, 59, 59, 999)

    const [currentTotals, previousTotals, currentUncat, previousUncat] = await Promise.all([
      getOverviewAmountTotals(userId, currentFrom, currentTo),
      getOverviewAmountTotals(userId, previousFrom, previousTo),
      getUncategorizedCount(userId, currentFrom, currentTo),
      getUncategorizedCount(userId, previousFrom, previousTo),
    ])

    return buildOverviewData({
      current: currentTotals,
      previous: previousTotals,
      currentUncategorizedCount: currentUncat,
      previousUncategorizedCount: previousUncat,
    })
  } catch {
    return buildOverviewData({
      current: { totalIn: ZERO_AMOUNT, totalOut: ZERO_AMOUNT },
      previous: { totalIn: ZERO_AMOUNT, totalOut: ZERO_AMOUNT },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })
  }
})

/**
 * Returns OUT-category month-over-month changes for a given month.
 *
 * Compares the given month against the previous calendar month (with year-crossing
 * support: January compares against December of the prior year — D-06).
 *
 * Applies the €15 noise floor on |Δ€| (D-07).
 * Sets isNew = true when previous spend is zero and current is positive (D-08).
 * Returns MonthOverMonthChange[] sorted by |Δ€| descending.
 *
 * T-42-05 mitigated: verifySession() scopes all sub-queries to authenticated userId.
 */
export const getMonthOverMonthCategoryChanges = cache(
  async (year: number, monthIndex = 0, limit = 10): Promise<MonthOverMonthChange[]> => {
    const { userId } = await verifySession()

    // Year-crossing guard (D-06): January (monthIndex=0) compares against December of prior year
    const prevYear = monthIndex === 0 ? year - 1 : year
    const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1

    const currFrom = new Date(year, monthIndex, 1)
    const currTo = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
    const prevFrom = new Date(prevYear, prevMonthIndex, 1)
    const prevTo = new Date(prevYear, prevMonthIndex + 1, 0, 23, 59, 59, 999)

    type CategoryAmountRow = { id: number; name: string; amount: string }

    let currRows: CategoryAmountRow[] = []
    let prevRows: CategoryAmountRow[] = []

    try {
      const [rawCurr, rawPrev] = await Promise.all([
        db
          .select({
            id: category.id,
            name: category.name,
            amount: sql<string>`coalesce(abs(sum(${transactionTable.amount})), 0)::text`,
          })
          .from(transactionTable)
          .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
          .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
          .leftJoin(category, eq(subCategory.categoryId, category.id))
          .where(
            and(
              dateScopedTransactions(userId, currFrom, currTo),
              expenseStatusIncludedInDashboardTotals(),
              notTransferCategory(),
              notExcludedFromTotals(),
              eq(category.type, 'out')
            )
          )
          .groupBy(category.id, category.name),
        db
          .select({
            id: category.id,
            name: category.name,
            amount: sql<string>`coalesce(abs(sum(${transactionTable.amount})), 0)::text`,
          })
          .from(transactionTable)
          .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
          .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
          .leftJoin(category, eq(subCategory.categoryId, category.id))
          .where(
            and(
              dateScopedTransactions(userId, prevFrom, prevTo),
              expenseStatusIncludedInDashboardTotals(),
              notTransferCategory(),
              notExcludedFromTotals(),
              eq(category.type, 'out')
            )
          )
          .groupBy(category.id, category.name),
      ])

      currRows = Array.isArray(rawCurr)
        ? rawCurr.map((r) => ({ id: Number(r.id), name: String(r.name), amount: String(r.amount) }))
        : []
      prevRows = Array.isArray(rawPrev)
        ? rawPrev.map((r) => ({ id: Number(r.id), name: String(r.name), amount: String(r.amount) }))
        : []
    } catch {
      return []
    }

    // Build lookup for previous-month amounts
    const prevMap = new Map<number, string>(prevRows.map((r) => [r.id, r.amount]))

    const NOISE_FLOOR = toDecimal('15.00')
    const changes: MonthOverMonthChange[] = []

    for (const curr of currRows) {
      const prevAmount = prevMap.get(curr.id) ?? ZERO_AMOUNT
      const delta = toDecimal(curr.amount).minus(toDecimal(prevAmount))

      // Apply €15 noise floor on |Δ€|
      if (delta.abs().lt(NOISE_FLOOR)) continue

      const isNew = prevAmount === ZERO_AMOUNT && toDecimal(curr.amount).gt(0)
      changes.push({
        categoryId: curr.id,
        name: curr.name,
        delta: delta.toFixed(2),
        isNew,
      })
    }

    // Also include categories that were in prev but not in curr (savings/disappearances)
    for (const prev of prevRows) {
      if (changes.some((c) => c.categoryId === prev.id)) continue

      const hasCurrRow = currRows.some((r) => r.id === prev.id)
      if (hasCurrRow) continue // already processed above

      const delta = toDecimal(ZERO_AMOUNT).minus(toDecimal(prev.amount))

      // Apply €15 noise floor on |Δ€|
      if (delta.abs().lt(NOISE_FLOOR)) continue

      changes.push({
        categoryId: prev.id,
        name: prev.name,
        delta: delta.toFixed(2),
        isNew: false,
      })
    }

    // Sort by |Δ€| descending, then slice to limit
    changes.sort((a, b) =>
      toDecimal(b.delta).abs().minus(toDecimal(a.delta).abs()).toNumber()
    )

    return changes.slice(0, limit)
  }
)

/**
 * Returns per-month income (recurring + extraordinary) and per-nature OUT amounts
 * for the given year. Missing months are zero-filled (12 buckets total).
 *
 * income.recurring  → nature 'income'
 * income.extraordinary → nature 'income_extraordinary'
 * out → 6 OUT natures (essential, discretionary, operational, financial, debt, extraordinary)
 *
 * T-42-05 mitigated: verifySession() scopes all sub-queries to authenticated userId.
 */
export const getOverviewChart = cache(async (year: number): Promise<OverviewChartPoint[]> => {
  const { userId } = await verifySession()

  const from = new Date(year, 0, 1)
  const to = new Date(year, 11, 31, 23, 59, 59, 999)

  const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`
  const natureSql = sql<FlowNature | null>`coalesce(${userSubcategoryOverride.nature}, ${subCategory.nature})`

  type NatureAggRow = { month: string; nature: FlowNature | null; amount: string }
  let rows: NatureAggRow[] = []

  try {
    const rawRows = await db
      .select({
        month: monthSql,
        nature: natureSql,
        amount: sql<string>`coalesce(sum(${transactionTable.amount}), 0)::text`,
      })
      .from(transactionTable)
      .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .leftJoin(
        userSubcategoryOverride,
        and(
          eq(userSubcategoryOverride.subCategoryId, subCategory.id),
          eq(userSubcategoryOverride.userId, userId)
        )
      )
      .where(
        and(
          dateScopedTransactions(userId, from, to),
          expenseStatusIncludedInDashboardTotals(),
          notExcludedFromTotals(),
          notTransferCategory()
        )
      )
      .groupBy(monthSql, natureSql)

    rows = Array.isArray(rawRows)
      ? rawRows.map((r) => ({
          month: String(r.month),
          nature: r.nature ?? null,
          amount: String(r.amount),
        }))
      : []
  } catch {
    rows = []
  }

  // Zero-fill 12 month buckets
  const buckets = new Map<string, OverviewChartPoint>(
    monthsBetween(from, to).map((month) => [
      month,
      {
        month,
        label: monthLabel(month),
        income: { recurring: ZERO_AMOUNT, extraordinary: ZERO_AMOUNT },
        out: emptyOutSegments(),
      },
    ])
  )

  for (const row of rows) {
    const bucket = buckets.get(row.month)
    if (!bucket) continue

    const nature = row.nature
    const rawAmount = row.amount

    if (nature === 'income') {
      bucket.income.recurring = toDecimal(bucket.income.recurring)
        .plus(toDecimal(rawAmount))
        .toFixed(2)
    } else if (nature === 'income_extraordinary') {
      bucket.income.extraordinary = toDecimal(bucket.income.extraordinary)
        .plus(toDecimal(rawAmount))
        .toFixed(2)
    } else if (nature !== null && OUT_NATURES.includes(nature as OutNature)) {
      const outKey = nature as OutNature
      const absAmount = toDecimal(rawAmount).abs().toFixed(2)
      bucket.out[outKey] = toDecimal(bucket.out[outKey]).plus(toDecimal(absAmount)).toFixed(2)
    }
  }

  return Array.from(buckets.values())
})

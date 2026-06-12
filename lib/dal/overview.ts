import 'server-only'
import { cache } from 'react'
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import {
  category,
  direction as directionTable,
  expense,
  nature as natureTable,
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
} from '@/lib/dal/dashboard'
import type { OverviewData } from '@/lib/dal/dashboard'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MonthOverMonthChange = {
  categoryId: number | null
  name: string
  delta: string // signed Decimal string; negative = spent less (saved money)
  isNew: boolean
  natureCode?: string | null // populated for allocation grain (directionParam=allocation)
}

const ZERO_AMOUNT = '0.00'

// Phase 49: OverviewChartPoint reshaped to 3-bucket layout (direction-aware: in/out/allocation).
// Transfer is excluded via WHERE clause; savings/investment routed to allocation bucket.
export type OverviewChartPoint = {
  month: string
  label: string
  income: { recurring: string; extraordinary: string }
  out: { essential: string; discretionary: string; debt: string }
  allocation: { savings: string; investment: string }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

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

function emptyOutSegments(): { essential: string; discretionary: string; debt: string } {
  return {
    essential: ZERO_AMOUNT,
    discretionary: ZERO_AMOUNT,
    debt: ZERO_AMOUNT,
  }
}

function emptyAllocationSegments(): { savings: string; investment: string } {
  return {
    savings: ZERO_AMOUNT,
    investment: ZERO_AMOUNT,
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
 * Returns the five KPI totals (totalIn, totalOut, totalAllocation, balance, savingsRate) plus
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
      current: { totalIn: ZERO_AMOUNT, totalOut: ZERO_AMOUNT, totalAllocation: ZERO_AMOUNT },
      previous: { totalIn: ZERO_AMOUNT, totalOut: ZERO_AMOUNT, totalAllocation: ZERO_AMOUNT },
      currentUncategorizedCount: 0,
      previousUncategorizedCount: 0,
    })
  }
})

/**
 * Returns direction-scoped month-over-month changes for a given month.
 *
 * Compares the given month against the previous calendar month (with year-crossing
 * support: January compares against December of the prior year — D-06).
 *
 * For directionParam 'allocation': groups by nature (savings/investment) instead of category.
 * For directionParam 'in'/'out': groups by category (per-category grain).
 *
 * Applies the €15 noise floor on |Δ€| (D-07).
 * Sets isNew = true when previous spend is zero and current is positive (D-08).
 * Returns MonthOverMonthChange[] sorted by |Δ€| descending.
 *
 * T-42-05 mitigated: verifySession() scopes all sub-queries to authenticated userId.
 */
export const getMonthOverMonthCategoryChanges = cache(
  async (
    year: number,
    monthIndex = 0,
    directionParam: 'in' | 'out' | 'allocation' = 'out',
    limit = 10
  ): Promise<MonthOverMonthChange[]> => {
    const { userId } = await verifySession()

    // Year-crossing guard (D-06): January (monthIndex=0) compares against December of prior year
    const prevYear = monthIndex === 0 ? year - 1 : year
    const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1

    const currFrom = new Date(year, monthIndex, 1)
    const currTo = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
    const prevFrom = new Date(prevYear, prevMonthIndex, 1)
    const prevTo = new Date(prevYear, prevMonthIndex + 1, 0, 23, 59, 59, 999)

    const isAllocation = directionParam === 'allocation'

    type AmountRow = { id: number; name: string; amount: string; natureCode?: string | null }

    let currRows: AmountRow[] = []
    let prevRows: AmountRow[] = []

    try {
      if (isAllocation) {
        // Allocation grain: group by nature (max 2 rows: savings, investment)
        const [rawCurr, rawPrev] = await Promise.all([
          db
            .select({
              id: natureTable.id,
              name: natureTable.labelIt,
              natureCode: natureTable.code,
              amount: sql<string>`coalesce(abs(sum(${transactionTable.amount})), 0)::text`,
            })
            .from(transactionTable)
            .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
            .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
            .leftJoin(
              userSubcategoryOverride,
              and(
                eq(userSubcategoryOverride.subCategoryId, subCategory.id),
                eq(userSubcategoryOverride.userId, userId),
              ),
            )
            .innerJoin(
              natureTable,
              eq(
                natureTable.id,
                sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
              )
            )
            .innerJoin(directionTable, eq(natureTable.directionId, directionTable.id))
            .where(
              and(
                dateScopedTransactions(userId, currFrom, currTo),
                expenseStatusIncludedInDashboardTotals(),
                eq(directionTable.code, 'allocation')
              )
            )
            .groupBy(natureTable.id, natureTable.labelIt, natureTable.code),
          db
            .select({
              id: natureTable.id,
              name: natureTable.labelIt,
              natureCode: natureTable.code,
              amount: sql<string>`coalesce(abs(sum(${transactionTable.amount})), 0)::text`,
            })
            .from(transactionTable)
            .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
            .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
            .leftJoin(
              userSubcategoryOverride,
              and(
                eq(userSubcategoryOverride.subCategoryId, subCategory.id),
                eq(userSubcategoryOverride.userId, userId),
              ),
            )
            .innerJoin(
              natureTable,
              eq(
                natureTable.id,
                sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
              )
            )
            .innerJoin(directionTable, eq(natureTable.directionId, directionTable.id))
            .where(
              and(
                dateScopedTransactions(userId, prevFrom, prevTo),
                expenseStatusIncludedInDashboardTotals(),
                eq(directionTable.code, 'allocation')
              )
            )
            .groupBy(natureTable.id, natureTable.labelIt, natureTable.code),
        ])

        currRows = Array.isArray(rawCurr)
          ? rawCurr.map((r) => ({ id: Number(r.id), name: String(r.name), amount: String(r.amount), natureCode: r.natureCode ?? null }))
          : []
        prevRows = Array.isArray(rawPrev)
          ? rawPrev.map((r) => ({ id: Number(r.id), name: String(r.name), amount: String(r.amount), natureCode: r.natureCode ?? null }))
          : []
      } else {
        // In/out grain: group by category
        const [rawCurr, rawPrev] = await Promise.all([
          db
            .select({
              id: category.id,
              name: category.name,
              amount: sql<string>`coalesce(abs(sum(${transactionTable.amount})), 0)::text`,
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
              natureTable,
              eq(
                natureTable.id,
                sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
              )
            )
            .innerJoin(directionTable, eq(natureTable.directionId, directionTable.id))
            .where(
              and(
                dateScopedTransactions(userId, currFrom, currTo),
                expenseStatusIncludedInDashboardTotals(),
                eq(directionTable.code, directionParam)
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
              natureTable,
              eq(
                natureTable.id,
                sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
              )
            )
            .innerJoin(directionTable, eq(natureTable.directionId, directionTable.id))
            .where(
              and(
                dateScopedTransactions(userId, prevFrom, prevTo),
                expenseStatusIncludedInDashboardTotals(),
                eq(directionTable.code, directionParam)
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
      }
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

      const isNew = toDecimal(prevAmount).isZero() && toDecimal(curr.amount).gt(0)
      changes.push({
        categoryId: isAllocation ? null : curr.id,
        name: curr.name,
        delta: delta.toFixed(2),
        isNew,
        natureCode: curr.natureCode ?? null,
      })
    }

    // Also include categories/natures that were in prev but not in curr (savings/disappearances)
    for (const prev of prevRows) {
      if (changes.some((c) => c.categoryId === prev.id)) continue

      const hasCurrRow = currRows.some((r) => r.id === prev.id)
      if (hasCurrRow) continue // already processed above

      const delta = toDecimal(ZERO_AMOUNT).minus(toDecimal(prev.amount))

      // Apply €15 noise floor on |Δ€|
      if (delta.abs().lt(NOISE_FLOOR)) continue

      changes.push({
        categoryId: isAllocation ? null : prev.id,
        name: prev.name,
        delta: delta.toFixed(2),
        isNew: false,
        natureCode: prev.natureCode ?? null,
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
 * Returns per-month income (recurring + extraordinary), per-nature OUT amounts,
 * and allocation amounts for the given year. Missing months are zero-filled (12 buckets total).
 *
 * income.recurring    → nature 'income'
 * income.extraordinary → nature 'income_extraordinary'
 * out.essential       → nature 'essential'
 * out.discretionary   → nature 'discretionary'
 * out.debt            → nature 'debt'
 * allocation.savings  → nature 'savings'
 * allocation.investment → nature 'investment'
 * transfer            → excluded (direction.code = 'transfer' filtered out)
 *
 * T-42-05 mitigated: verifySession() scopes all sub-queries to authenticated userId.
 */
export const getOverviewChart = cache(async (year: number): Promise<OverviewChartPoint[]> => {
  const { userId } = await verifySession()

  const from = new Date(year, 0, 1)
  const to = new Date(year, 11, 31, 23, 59, 59, 999)

  const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`
  // Effective nature: resolves via override.natureId or subCategory.natureId → nature.code
  const natureSql = sql<FlowNature | null>`(
    SELECT n.code FROM nature n
    WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
    LIMIT 1
  )`
  // Direction code via the same FK chain
  const directionCodeSql = sql<string | null>`(
    SELECT d.code FROM direction d
    INNER JOIN nature n ON n.direction_id = d.id
    WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
    LIMIT 1
  )`

  type NatureAggRow = { month: string; nature: FlowNature | null; directionCode: string | null; amount: string }
  let rows: NatureAggRow[] = []

  try {
    const rawRows = await db
      .select({
        month: monthSql,
        nature: natureSql,
        directionCode: directionCodeSql,
        amount: sql<string>`coalesce(sum(${transactionTable.amount}), 0)::text`,
      })
      .from(transactionTable)
      .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
      .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .innerJoin(category, eq(subCategory.categoryId, category.id))
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
          // Exclude transfer via correlated direction subquery (INNER JOINs above ensure subCategoryId is set)
          sql`(
            SELECT d.code FROM direction d
            INNER JOIN nature n ON n.direction_id = d.id
            WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
            LIMIT 1
          ) != 'transfer'`
        )
      )
      .groupBy(monthSql, natureSql, directionCodeSql)

    rows = Array.isArray(rawRows)
      ? rawRows.map((r) => ({
          month: String(r.month),
          nature: r.nature ?? null,
          directionCode: r.directionCode ?? null,
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
        allocation: emptyAllocationSegments(),
      },
    ])
  )

  for (const row of rows) {
    const bucket = buckets.get(row.month)
    if (!bucket) continue

    const nature = row.nature
    const directionCode = row.directionCode
    const rawAmount = row.amount

    if (directionCode === 'in') {
      // IN direction: route by nature to income buckets
      if (nature === 'income') {
        bucket.income.recurring = toDecimal(bucket.income.recurring)
          .plus(toDecimal(rawAmount))
          .toFixed(2)
      } else if (nature === 'income_extraordinary') {
        bucket.income.extraordinary = toDecimal(bucket.income.extraordinary)
          .plus(toDecimal(rawAmount))
          .toFixed(2)
      }
    } else if (directionCode === 'out') {
      // OUT direction: route by nature to out buckets (essential/discretionary/debt only)
      const absAmount = toDecimal(rawAmount).abs().toFixed(2)
      if (nature === 'essential') {
        bucket.out.essential = toDecimal(bucket.out.essential).plus(toDecimal(absAmount)).toFixed(2)
      } else if (nature === 'discretionary') {
        bucket.out.discretionary = toDecimal(bucket.out.discretionary).plus(toDecimal(absAmount)).toFixed(2)
      } else if (nature === 'debt') {
        bucket.out.debt = toDecimal(bucket.out.debt).plus(toDecimal(absAmount)).toFixed(2)
      }
    } else if (directionCode === 'allocation') {
      // ALLOCATION direction: route by nature to allocation buckets (savings/investment)
      const absAmount = toDecimal(rawAmount).abs().toFixed(2)
      if (nature === 'savings') {
        bucket.allocation.savings = toDecimal(bucket.allocation.savings).plus(toDecimal(absAmount)).toFixed(2)
      } else if (nature === 'investment') {
        bucket.allocation.investment = toDecimal(bucket.allocation.investment).plus(toDecimal(absAmount)).toFixed(2)
      }
    }
    // transfer direction is excluded via WHERE clause
  }

  return Array.from(buckets.values())
})

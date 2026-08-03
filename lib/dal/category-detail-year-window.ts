import 'server-only'
import { cache } from 'react'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { category, ledgerEntryCash } from '@/lib/db/schema'
import type { LedgerRowSource } from '@/lib/dal/dashboard-filters'
import { getCategoryMonthlyAmounts, getCoveredMonthsInYear } from '@/lib/dal/covered-months'
import {
  buildCoveredMonthSeries,
  buildYearSeries,
  computeComparison,
  computeCurrentMonthHybrid,
  computePaceAndProjection,
  isPartialMonth,
} from '@/lib/services/pace-and-projection'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'
import { monthLabel, monthsBetween } from '@/lib/utils/date'
import type { CategoryDetailWindow } from '@/lib/validations/category-year-window'

/** A category's metadata for the detail page header + back-link direction (D-06). */
export type CategoryDetailMeta = { id: number; name: string; slug: string; type: 'in' | 'out' }

/**
 * Resolves a category's id/name/slug/direction for the detail page, scoped to the signed-in
 * user (T-84-02 mitigation) — replicates getCategoryDetail's existing metadata subquery verbatim
 * (same `eq(direction.includedInTotals, true)` predicate, same `type ?? 'out'` fallback). This
 * intentionally preserves the existing allocation-category gap: CR-01 in category-ranking-list.tsx
 * already guarantees an allocation category never links here, so widening this predicate is out
 * of this plan's scope.
 *
 * Returns null (never throws) for a missing/inactive/foreign category — the caller redirects.
 */
export const getCategoryDetailMeta = cache(
  async (categoryId: number): Promise<CategoryDetailMeta | null> => {
    const { userId } = await verifySession()

    try {
      const categoryRows = await db
        .select({
          id: category.id,
          name: category.name,
          slug: category.slug,
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
            or(isNull(category.userId), eq(category.userId, userId)),
          ),
        )
        .limit(1)

      const row = categoryRows[0]

      if (!row) {
        return null
      }

      return { id: row.id, name: row.name, slug: row.slug, type: (row.type ?? 'out') as 'in' | 'out' }
    } catch {
      return null
    }
  },
)

/** The classification of a single month inside a category's year window (D-06/CDET-06). */
export type CategoryDetailMonthState = 'covered' | 'current' | 'estimated' | 'uncovered'

/**
 * A single window column. `amount` is `null` ONLY when `state` is `'uncovered'` — never a
 * fabricated '0.00' (D-10). `monthOverMonthDelta` is `null` for the window's first column, for
 * any 'estimated' month, and whenever the immediately preceding column has no real amount.
 */
export type CategoryDetailWindowMonth = {
  yearMonth: string
  label: string
  amount: string | null
  state: CategoryDetailMonthState
  monthOverMonthDelta: string | null
}

/** The window-sliced series rendered as the table's row 1, plus its D-10 summary figures. */
export type CategoryDetailWindowSeries = {
  months: CategoryDetailWindowMonth[]
  total: string
  average: string
  coveredMonthCountInWindow: number
  uncoveredMonthLabels: string[]
}

/**
 * The full detail-page payload. `previousYear`/`subcategories`/`topTransactions` are typed
 * placeholders Plan 84-02 fills in — a tracer stub, not an architecture change later.
 */
export type CategoryDetailYearWindowData = {
  category: CategoryDetailMeta | null
  window: CategoryDetailWindow
  current: CategoryDetailWindowSeries
  previousYear: null
  pace: string | null
  projection: string | null
  subcategories: []
  topTransactions: []
}

/**
 * Builds a category's year+window payload (D-01..D-10). `ledgerRowSource` defaults to
 * `ledgerEntryCash` — Categories reads cassa only (D-12/Phase 82).
 *
 * Month-state classification mirrors buildCategoryYearRankingData's account-wide pattern
 * (lib/dal/dashboard.ts) for a single category: the calendar-current month is always 'current';
 * a future month in `year` is 'estimated'; every other month is 'covered' when in
 * getCoveredMonthsInYear(year), 'uncovered' otherwise.
 *
 * Pace/projection are computed ONCE from the FULL YEAR's pace-eligible Covered Months (never the
 * window, D-06) — an 'estimated' month's amount is that pace (or null when insufficient); the
 * 'current' month's amount is computeCurrentMonthHybrid(rawSpent, pace) when pace-eligible, else
 * the raw observed amount.
 *
 * `total`/`average` are computed over the WINDOW slice only (never the full year) via
 * buildYearSeries, excluding 'uncovered' months entirely from both sum and denominator (D-10) —
 * never zero-filled.
 */
export const getCategoryDetailYearWindow = cache(
  async (
    categoryId: number,
    year: number,
    window: CategoryDetailWindow,
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<CategoryDetailYearWindowData> => {
    await verifySession()

    const [categoryMeta, categoryMonths, coveredMonths] = await Promise.all([
      getCategoryDetailMeta(categoryId),
      getCategoryMonthlyAmounts(categoryId, year, ledgerRowSource),
      getCoveredMonthsInYear(year),
    ])

    const today = new Date()
    const from = new Date(year, 0, 1)
    const to = new Date(year, 11, 31, 23, 59, 59, 999)
    const monthKeys = monthsBetween(from, to)
    const coveredSet = new Set(coveredMonths.map((m) => m.yearMonth))
    const amountByMonth = new Map(categoryMonths.map((m) => [m.yearMonth, m.amount]))

    const monthStateByKey = new Map<string, CategoryDetailMonthState>()
    for (const month of monthKeys) {
      if (isPartialMonth(month, today)) {
        monthStateByKey.set(month, 'current')
        continue
      }
      const [monthYear, monthNumber] = month.split('-').map(Number) as [number, number]
      const isFutureMonth =
        monthYear > today.getFullYear() ||
        (monthYear === today.getFullYear() && monthNumber > today.getMonth() + 1)
      monthStateByKey.set(month, isFutureMonth ? 'estimated' : coveredSet.has(month) ? 'covered' : 'uncovered')
    }

    // Account-wide pace/projection, computed ONCE from the full year's pace-eligible (non-Partial)
    // Covered Months — never the window (D-06).
    const paceEligibleSeries = buildCoveredMonthSeries(coveredMonths, categoryMonths).filter(
      (m) => !isPartialMonth(m.yearMonth, today),
    )
    const paceResult = computePaceAndProjection(paceEligibleSeries)
    const pace = paceResult.status === 'complete' ? paceResult.pace : null
    const projection = paceResult.status === 'complete' ? paceResult.projection : null

    const fullYearMonths: CategoryDetailWindowMonth[] = monthKeys.map((month) => {
      const state = monthStateByKey.get(month) ?? 'uncovered'
      const rawAmount = amountByMonth.get(month) ?? '0.00'
      let amount: string | null

      switch (state) {
        case 'uncovered':
          amount = null
          break
        case 'estimated':
          amount = pace
          break
        case 'current':
          amount = pace !== null ? computeCurrentMonthHybrid(rawAmount, pace) : rawAmount
          break
        case 'covered':
        default:
          amount = rawAmount
          break
      }

      return { yearMonth: month, label: monthLabel(month), amount, state, monthOverMonthDelta: null }
    })

    // Slice to the already-clamped window — re-derive the same indices parseCategoryDetailWindow
    // computed from window.from/window.months, never re-clamp here.
    const [, startMonthRaw] = window.from.split('-')
    const startIndex = Number(startMonthRaw) - 1
    const windowMonths = fullYearMonths
      .slice(startIndex, startIndex + window.months)
      .map((month, index, arr): CategoryDetailWindowMonth => {
        if (index === 0 || month.state === 'estimated' || month.amount === null) {
          return month
        }
        const previous = arr[index - 1]
        if ((previous.state === 'covered' || previous.state === 'current') && previous.amount !== null) {
          return { ...month, monthOverMonthDelta: computeComparison(month.amount, previous.amount) }
        }
        return month
      })

    const monthsWithAmount = windowMonths.filter((m) => m.amount !== null)
    const { total } = buildYearSeries(
      monthsWithAmount.map((m) => ({ yearMonth: m.yearMonth, amount: m.amount as string })),
    )
    const coveredMonthCountInWindow = monthsWithAmount.length
    const average =
      coveredMonthCountInWindow > 0 ? toDbDecimal(toDecimal(total).dividedBy(coveredMonthCountInWindow)) : '0.00'
    const uncoveredMonthLabels = windowMonths.filter((m) => m.state === 'uncovered').map((m) => m.label)

    return {
      category: categoryMeta,
      window,
      current: {
        months: windowMonths,
        total,
        average,
        coveredMonthCountInWindow,
        uncoveredMonthLabels,
      },
      previousYear: null,
      pace,
      projection,
      subcategories: [],
      topTransactions: [],
    }
  },
)

import 'server-only'
import { cache } from 'react'
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
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
import type { CategoryDetailTopTransaction } from '@/lib/dal/dashboard'
import type { LedgerRowSource } from '@/lib/dal/dashboard-filters'
import { dateScopedTransactions, expenseStatusIncludedInDashboardTotals } from '@/lib/dal/dashboard-filters'
import { getCategoryMonthlyAmounts, getCoveredMonthsInYear } from '@/lib/dal/covered-months'
import {
  buildCoveredMonthSeries,
  buildYearSeries,
  canShowPreviousYearTotalDifference,
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
 * (same `eq(direction.included_in_totals, true)` predicate, same `type ?? 'out'` fallback). This
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
 * A single previous-year homologous-window column — plain amount only, never a per-cell delta
 * (D-11): the previous-year row exists to make the month-by-month comparison readable against
 * row 1 above it, not to duplicate row 1's own delta mechanic.
 */
export type CategoryDetailPreviousYearMonth = {
  yearMonth: string
  label: string
  amount: string | null
  state: 'covered' | 'uncovered'
}

/** The previous year's homologous-window series (D-11): plain amounts, buildYearSeries total/average. */
export type CategoryDetailPreviousYearSeries = {
  months: CategoryDetailPreviousYearMonth[]
  total: string
  average: string
  coveredMonthCountInWindow: number
}

/**
 * D-10/D-12: gates ONLY the Totale difference figure — the Media difference always renders
 * regardless of this status (CDET-07).
 */
export type CategoryDetailPreviousYearTotalDifference =
  | { status: 'shown'; value: string }
  | { status: 'insufficient'; coveredMonthCount: number }

/**
 * The previous-year comparison row (D-11/CDET-02). `'unavailable'` when the previous year has
 * zero Covered Months inside the homologous window — the table renders a stated-reason line
 * instead of a data row in that case, never a silent gap.
 */
export type CategoryDetailPreviousYearComparison =
  | { status: 'unavailable' }
  | {
      status: 'available'
      series: CategoryDetailPreviousYearSeries
      totalDifference: CategoryDetailPreviousYearTotalDifference
      averageDifference: string
      /**
       * CR-01 fix (review 84-REVIEW.md): the RAW (non-projected) current-window total minus the
       * raw previous-window total, over the SAME window as `totalDifference` above — this, NOT
       * `totalDifference`, is the figure `subcategories[].contribution` is guaranteed to sum to
       * exactly. `totalDifference` is derived from `total` (row-1's pace/hybrid-projected total,
       * see `CategoryDetailWindowSeries.total`), while `getSubcategoryWindowAmounts` is a plain
       * raw SQL sum with no pace/hybrid concept — pairing the subcategory sums against a
       * projected total would break the telescoping identity whenever the window includes a
       * 'current' or 'estimated' month. The UI must label the subcategory block's own
       * "Differenza" as observed-months-only so the two figures are never confused.
       */
      rawTotalDifference: CategoryDetailPreviousYearTotalDifference
    }

/** Where a subcategory's contribution comes from relative to the two compared windows (D-16). */
export type CategoryDetailSubcategoryPresence = 'current-only' | 'previous-only' | 'both'

/**
 * A subcategory's contribution to the parent category's total difference (CDET-05/D-16).
 * `contribution` is `current − previous` via computeComparison; the full array's contributions
 * sum EXACTLY to the parent's own total difference, including a subcategory present in only one
 * of the two compared periods (negative contribution + 0% weight for a previous-only row).
 */
export type CategoryDetailSubcategoryContribution = {
  id: number
  name: string
  slug: string
  currentAmount: string
  previousAmount: string
  contribution: string
  weightPercentage: number
  presence: CategoryDetailSubcategoryPresence
}

/** The full detail-page payload (D-01..D-16). */
export type CategoryDetailYearWindowData = {
  category: CategoryDetailMeta | null
  window: CategoryDetailWindow
  current: CategoryDetailWindowSeries
  previousYear: CategoryDetailPreviousYearComparison
  pace: string | null
  projection: string | null
  subcategories: CategoryDetailSubcategoryContribution[]
  topTransactions: CategoryDetailTopTransaction[]
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

type SubcategoryWindowRow = {
  subCategoryId: number
  subCategoryName: string
  subCategorySlug: string
  amount: string
}

/**
 * A window-scoped, per-subcategory amount total for `categoryId` (CDET-05/D-16). Mirrors
 * getCategoryDetail's subcategoryRows query shape verbatim (lib/dal/dashboard.ts): same join
 * chain (ledgerRowSource -> expense -> subCategory -> category, leftJoin userSubcategoryOverride,
 * innerJoin nature, innerJoin direction), same `eq(direction.includedInTotals, true)` predicate
 * and active-scoping. Called TWICE by the caller — once for the current window, once for the
 * previous-homologous window — never re-derived from the account-wide monthly series.
 */
async function getSubcategoryWindowAmounts(
  categoryId: number,
  userId: string,
  from: Date,
  to: Date,
  ledgerRowSource: LedgerRowSource,
): Promise<SubcategoryWindowRow[]> {
  try {
    const rows = await db
      .select({
        subCategoryId: subCategory.id,
        subCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
        subCategorySlug: subCategory.slug,
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
      .innerJoin(nature, eq(nature.id, sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`))
      .innerJoin(direction, eq(nature.directionId, direction.id))
      .where(
        and(
          eq(category.id, categoryId),
          eq(category.isActive, true),
          or(isNull(category.userId), eq(category.userId, userId)),
          eq(subCategory.isActive, true),
          or(isNull(subCategory.userId), eq(subCategory.userId, userId)),
          dateScopedTransactions(ledgerRowSource, userId, from, to),
          expenseStatusIncludedInDashboardTotals(),
          eq(direction.includedInTotals, true),
        ),
      )
      .groupBy(category.id, subCategory.id, userSubcategoryOverride.customName, direction.code)

    return rows.flatMap((row): SubcategoryWindowRow[] => {
      if (row.subCategoryId === null || row.subCategoryName === null || row.subCategorySlug === null) {
        return []
      }
      return [
        {
          subCategoryId: row.subCategoryId,
          subCategoryName: row.subCategoryName,
          subCategorySlug: row.subCategorySlug,
          amount: row.amount,
        },
      ]
    })
  } catch {
    return []
  }
}

/**
 * The window-scoped top-5-transactions block (D-05/T-84-05). Replicates getCategoryDetail's
 * topTransactionRows query verbatim (lib/dal/dashboard.ts): same LEFT JOIN transaction (an
 * amortization instalment has no matching transaction row), same title fallback chain
 * (customTitle ?? groupTitle ?? description), same ordering
 * (desc(abs(amount)), desc(occurredAt), id) and `.limit(5)` — parameterized on the CURRENT
 * window's {from,to}, never the full year.
 */
async function getWindowTopTransactions(
  categoryId: number,
  userId: string,
  from: Date,
  to: Date,
  ledgerRowSource: LedgerRowSource,
): Promise<CategoryDetailTopTransaction[]> {
  try {
    const rows = await db
      .select({
        id: ledgerRowSource.id,
        description: sql<string | null>`coalesce(${transactionTable.description}, ${expense.title})`,
        customTitle: transactionTable.customTitle,
        groupTitle: expenseGroup.title,
        amount: sql<string>`coalesce(${transactionTable.amount}, ${ledgerRowSource.amount})`,
        occurredAt: ledgerRowSource.occurredAt,
      })
      .from(ledgerRowSource)
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
      .innerJoin(nature, eq(nature.id, sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`))
      .innerJoin(direction, eq(nature.directionId, direction.id))
      .where(
        and(
          eq(category.id, categoryId),
          eq(category.isActive, true),
          or(isNull(category.userId), eq(category.userId, userId)),
          eq(subCategory.isActive, true),
          or(isNull(subCategory.userId), eq(subCategory.userId, userId)),
          dateScopedTransactions(ledgerRowSource, userId, from, to),
          expenseStatusIncludedInDashboardTotals(),
          eq(direction.includedInTotals, true),
        ),
      )
      .orderBy(desc(sql`abs(${ledgerRowSource.amount})`), desc(ledgerRowSource.occurredAt), ledgerRowSource.id)
      .limit(5)

    return rows.flatMap((row): CategoryDetailTopTransaction[] => {
      if (row.id === null || row.description === null || row.occurredAt === null) {
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
          amount: toDbDecimal(toDecimal(row.amount ?? '0').abs()),
        },
      ]
    })
  } catch {
    return []
  }
}

/**
 * Builds a category's year+window payload (D-01..D-16). `ledgerRowSource` defaults to
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
 *
 * `previousYear`/`subcategories`/`topTransactions` (Plan 84-02): the previous-year comparison row
 * (D-11), the subcategory contributions that sum exactly to the total difference (D-16), and the
 * window-scoped top transactions (D-05).
 */
export const getCategoryDetailYearWindow = cache(
  async (
    categoryId: number,
    year: number,
    window: CategoryDetailWindow,
    ledgerRowSource: LedgerRowSource = ledgerEntryCash,
  ): Promise<CategoryDetailYearWindowData> => {
    const { userId } = await verifySession()

    // Window date boundaries computed ONCE, shared by the subcategory/top-transaction queries
    // below. D-03 guarantees the window never crosses the year boundary, so the end month index
    // is simply start + months - 1 — no modulo/carry arithmetic (84-RESEARCH.md Example 2's
    // corrected reasoning).
    const [, startMonthRaw] = window.from.split('-')
    const startIndex = Number(startMonthRaw) - 1
    const endIndex = startIndex + window.months - 1
    const windowFrom = new Date(year, startIndex, 1)
    const windowTo = new Date(year, endIndex + 1, 0, 23, 59, 59, 999)
    const previousYearNumber = year - 1
    const previousWindowFrom = new Date(previousYearNumber, startIndex, 1)
    const previousWindowTo = new Date(previousYearNumber, endIndex + 1, 0, 23, 59, 59, 999)

    const [
      categoryMeta,
      categoryMonths,
      coveredMonths,
      previousCategoryMonths,
      previousCoveredMonths,
      currentSubcategoryRows,
      previousSubcategoryRows,
      topTransactions,
    ] = await Promise.all([
      getCategoryDetailMeta(categoryId),
      getCategoryMonthlyAmounts(categoryId, year, ledgerRowSource),
      getCoveredMonthsInYear(year),
      getCategoryMonthlyAmounts(categoryId, previousYearNumber, ledgerRowSource),
      getCoveredMonthsInYear(previousYearNumber),
      getSubcategoryWindowAmounts(categoryId, userId, windowFrom, windowTo, ledgerRowSource),
      getSubcategoryWindowAmounts(categoryId, userId, previousWindowFrom, previousWindowTo, ledgerRowSource),
      getWindowTopTransactions(categoryId, userId, windowFrom, windowTo, ledgerRowSource),
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

    // CR-01 fix: RAW (non-projected) current-window total, over the exact same window slice as
    // `total` above but reading `amountByMonth` directly instead of the hybrid/pace-substituted
    // `windowMonths[].amount`. Mirrors what `getSubcategoryWindowAmounts` actually sums (a plain
    // SQL sum over the continuous [windowFrom, windowTo] date range, with no month-state
    // awareness at all) — an uncovered month contributes its real amount, which is always 0.00
    // because Mese Coperto is account-wide (CONTEXT.md): if the account has zero transactions
    // that month, this category has none either.
    const rawCurrentTotal = toDbDecimal(
      windowMonths.reduce(
        (sum, month) => sum.plus(toDecimal(amountByMonth.get(month.yearMonth) ?? '0.00')),
        toDecimal(0),
      ),
    )

    // Previous-year comparison row (D-11/D-12/CDET-02/CDET-04/CDET-07).
    const previousMonthKeys = monthsBetween(
      new Date(previousYearNumber, 0, 1),
      new Date(previousYearNumber, 11, 31, 23, 59, 59, 999),
    ).slice(startIndex, startIndex + window.months)
    const previousCoveredSet = new Set(previousCoveredMonths.map((m) => m.yearMonth))
    const previousAmountByMonth = new Map(previousCategoryMonths.map((m) => [m.yearMonth, m.amount]))
    const previousFilteredCoveredCount = previousMonthKeys.filter((mk) => previousCoveredSet.has(mk)).length

    let previousYear: CategoryDetailPreviousYearComparison

    if (previousFilteredCoveredCount === 0) {
      previousYear = { status: 'unavailable' }
    } else {
      const previousYearMonths: CategoryDetailPreviousYearMonth[] = previousMonthKeys.map((monthKey) => {
        const covered = previousCoveredSet.has(monthKey)
        return {
          yearMonth: monthKey,
          label: monthLabel(monthKey),
          amount: covered ? previousAmountByMonth.get(monthKey) ?? '0.00' : null,
          state: covered ? 'covered' : 'uncovered',
        }
      })
      const previousMonthsWithAmount = previousYearMonths.filter((m) => m.amount !== null)
      const { total: previousTotal } = buildYearSeries(
        previousMonthsWithAmount.map((m) => ({ yearMonth: m.yearMonth, amount: m.amount as string })),
      )
      const previousAverage = toDbDecimal(toDecimal(previousTotal).dividedBy(previousFilteredCoveredCount))

      const totalDifference: CategoryDetailPreviousYearTotalDifference = canShowPreviousYearTotalDifference(
        previousFilteredCoveredCount,
      )
        ? { status: 'shown', value: computeComparison(total, previousTotal) }
        : { status: 'insufficient', coveredMonthCount: previousFilteredCoveredCount }

      // CR-01 fix: same gate as `totalDifference` (previous-year data reliability), but paired
      // with `rawCurrentTotal` instead of the pace/hybrid-projected `total` — see
      // `CategoryDetailPreviousYearComparison.rawTotalDifference`'s doc comment above.
      const rawTotalDifference: CategoryDetailPreviousYearTotalDifference = canShowPreviousYearTotalDifference(
        previousFilteredCoveredCount,
      )
        ? { status: 'shown', value: computeComparison(rawCurrentTotal, previousTotal) }
        : { status: 'insufficient', coveredMonthCount: previousFilteredCoveredCount }

      previousYear = {
        status: 'available',
        series: {
          months: previousYearMonths,
          total: previousTotal,
          average: previousAverage,
          coveredMonthCountInWindow: previousFilteredCoveredCount,
        },
        totalDifference,
        averageDifference: computeComparison(average, previousAverage),
        rawTotalDifference,
      }
    }

    // Subcategory contributions (CDET-05/D-16): union of every subcategory id appearing in
    // EITHER window, contribution = current - previous via computeComparison. This sums EXACTLY
    // to `previousYear.rawTotalDifference` (when available) by construction (telescoping:
    // sum(current_i - previous_i) = sum(current_i) - sum(previous_i) when every term already
    // carries exactly 2 decimal places, per CLAUDE.md's Decimal.js rule) — NOT to
    // `previousYear.totalDifference`, which is derived from the pace/hybrid-projected `total`
    // and therefore diverges from this sum whenever the window includes a 'current' or
    // 'estimated' month (CR-01, 84-REVIEW.md). `getSubcategoryWindowAmounts` is a raw SQL sum
    // with no pace/hybrid concept, so its telescoping partner must be equally raw.
    const currentSubMap = new Map(currentSubcategoryRows.map((row) => [row.subCategoryId, row]))
    const previousSubMap = new Map(previousSubcategoryRows.map((row) => [row.subCategoryId, row]))
    const subcategoryIds = new Set<number>([...currentSubMap.keys(), ...previousSubMap.keys()])
    const currentSubcategoryTotal = currentSubcategoryRows.reduce(
      (sum, row) => sum.plus(toDecimal(row.amount)),
      toDecimal(0),
    )

    const subcategories: CategoryDetailSubcategoryContribution[] = Array.from(subcategoryIds)
      .map((id): CategoryDetailSubcategoryContribution => {
        const currentRow = currentSubMap.get(id)
        const previousRow = previousSubMap.get(id)
        const currentAmount = currentRow?.amount ?? '0.00'
        const previousAmount = previousRow?.amount ?? '0.00'
        const presence: CategoryDetailSubcategoryPresence =
          currentRow && previousRow ? 'both' : currentRow ? 'current-only' : 'previous-only'
        const weightPercentage = currentSubcategoryTotal.isZero()
          ? 0
          : toDecimal(currentAmount)
              .dividedBy(currentSubcategoryTotal)
              .times(100)
              .toDecimalPlaces(1)
              .toNumber()
        const reference = currentRow ?? previousRow

        return {
          id,
          name: reference?.subCategoryName ?? '',
          slug: reference?.subCategorySlug ?? '',
          currentAmount,
          previousAmount,
          contribution: computeComparison(currentAmount, previousAmount),
          weightPercentage,
          presence,
        }
      })
      .sort((left, right) => toDecimal(right.currentAmount).comparedTo(toDecimal(left.currentAmount)))

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
      previousYear,
      pace,
      projection,
      subcategories,
      topTransactions,
    }
  },
)

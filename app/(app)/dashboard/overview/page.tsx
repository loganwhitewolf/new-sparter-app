import { Suspense } from 'react'
import {
  getOverview,
  getOverviewChart,
  getYearsWithData,
  getMonthOverMonthCategoryChanges,
  type OverviewChartPoint,
} from '@/lib/dal/overview'
import { resolveYear } from '@/components/dashboard/overview/resolve-year'
import { OverviewEmptyState } from '@/components/dashboard/overview/overview-empty-state'
import { OverviewHeader } from '@/components/dashboard/overview/overview-header'
import { KpiRow } from '@/components/dashboard/overview/kpi-row'
import { OverviewMoversSection } from '@/components/dashboard/overview/overview-movers-section'
import { OverviewPageSkeleton } from '@/components/dashboard/overview/overview-page-skeleton'
import { OverviewNudge } from '@/components/dashboard/overview/overview-nudge'
import { toDecimal } from '@/lib/utils/decimal'

type Props = {
  searchParams: Promise<{ year?: string }>
}

// Checks whether the KPIs and chart contain any meaningful data for the year.
// Returns true if totalIn + totalOut are both zero (no activity at all).
function isYearWithNoData(totalIn: string, totalOut: string): boolean {
  return toDecimal(totalIn).isZero() && toDecimal(totalOut).isZero()
}

/**
 * Derives the last month index that has any activity in the chart data (D-04).
 *
 * Scans from the most recent month downward using Decimal arithmetic on income and out.
 * IMPORTANT: p.out is Record<OutNature, string> — must use Object.values, not .reduce on object.
 * Returns 0 if no month has activity (all-zero year, already guarded by isYearWithNoData).
 */
function deriveDefaultMonthIndex(chart: OverviewChartPoint[]): number {
  for (let i = chart.length - 1; i >= 0; i--) {
    const p = chart[i]
    // Phase 49: include allocation bucket (savings + investment) in the activity check.
    const total = Object.values(p.out)
      .reduce(
        (acc, v) => acc.plus(toDecimal(v)),
        toDecimal(p.income.recurring)
          .plus(toDecimal(p.income.extraordinary))
          .plus(toDecimal(p.allocation.savings))
          .plus(toDecimal(p.allocation.investment))
      )
    if (!total.isZero()) return i
  }
  return 0
}

// Inner async component that fetches and renders header + KPIs + chart + movers under Suspense.
// FRU-FIX-03: OverviewHeader is rendered here (not eagerly) so it has access to
// uncategorizedCount for the inline nudge slot on the title row.
async function OverviewDataSection({ year, years }: { year: number; years: string[] }) {
  const [overview, chart] = await Promise.all([getOverview(year), getOverviewChart(year)])

  if (isYearWithNoData(overview.totalIn, overview.totalOut)) {
    return (
      <>
        <OverviewHeader year={year} years={years} />
        <OverviewEmptyState variant="no-data-for-year" year={year} />
      </>
    )
  }

  // D-04: compute the real last-month-with-data index (not naively the last index).
  const defaultMonthIndex = deriveDefaultMonthIndex(chart)
  // Pre-fetch all 3 directions in parallel so the panel is fully populated on first paint.
  const [initialMoversIn, initialMoversOut, initialMoversAllocation] = await Promise.all([
    getMonthOverMonthCategoryChanges(year, defaultMonthIndex, 'in'),
    getMonthOverMonthCategoryChanges(year, defaultMonthIndex, 'out'),
    getMonthOverMonthCategoryChanges(year, defaultMonthIndex, 'allocation'),
  ])

  return (
    <div className="flex flex-col gap-6">
      {/* FRU-FIX-03: header with inline nudge slot — nudge is right-aligned on the title row,
          no longer its own full-width row. Year selector still works (router.replace ?year=). */}
      <OverviewHeader
        year={year}
        years={years}
        nudge={<OverviewNudge uncategorizedCount={overview.uncategorizedCount} year={year} />}
      />
      <KpiRow data={overview} year={year} />
      {/* OverviewMoversSection owns the shared selectedMonth — chart + movers panel never drift.
          All 3 directions are pre-fetched server-side and shown simultaneously in 3 columns. */}
      <OverviewMoversSection
        data={chart}
        year={year}
        defaultMonthIndex={defaultMonthIndex}
        initialMoversIn={initialMoversIn}
        initialMoversOut={initialMoversOut}
        initialMoversAllocation={initialMoversAllocation}
      />
    </div>
  )
}

export default async function DashboardOverviewPage({ searchParams }: Props) {
  const params = await searchParams
  const years = await getYearsWithData()
  const year = resolveYear(params.year, years)

  // D-06 case b: account has no years with data at all.
  if (year === null) {
    return <OverviewEmptyState variant="no-years" />
  }

  return (
    // FRU-FIX-03: OverviewHeader is now rendered inside OverviewDataSection so it can
    // receive uncategorizedCount for the inline nudge slot. The Suspense fallback
    // (OverviewPageSkeleton) covers both the header and the data section during streaming.
    <Suspense fallback={<OverviewPageSkeleton />}>
      <OverviewDataSection year={year} years={years} />
    </Suspense>
  )
}

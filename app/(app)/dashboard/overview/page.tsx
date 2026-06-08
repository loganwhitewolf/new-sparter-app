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
    const total = Object.values(p.out).reduce(
      (acc, v) => acc.plus(toDecimal(v)),
      toDecimal(p.income.recurring).plus(toDecimal(p.income.extraordinary))
    )
    if (!total.isZero()) return i
  }
  return 0
}

// Inner async component that fetches and renders KPIs + chart + movers under Suspense.
async function OverviewDataSection({ year }: { year: number }) {
  const [overview, chart] = await Promise.all([getOverview(year), getOverviewChart(year)])

  if (isYearWithNoData(overview.totalIn, overview.totalOut)) {
    return <OverviewEmptyState variant="no-data-for-year" year={year} />
  }

  // D-04: compute the real last-month-with-data index (not naively the last index).
  const defaultMonthIndex = deriveDefaultMonthIndex(chart)
  // D-03: pre-fetch that month's movers server-side so the panel is populated on first paint.
  const initialMovers = await getMonthOverMonthCategoryChanges(year, defaultMonthIndex)

  return (
    <div className="flex flex-col gap-6">
      {/* Inline amber nudge: appears when uncategorized OUT expenses exist for the year.
          Dismissal is localStorage-only (year-scoped, lastSeenCount semantics) — no DB write.
          Placed above KpiRow so it reads as part of the title context (D-02, D-03, D-10). */}
      <OverviewNudge uncategorizedCount={overview.uncategorizedCount} year={year} />
      <KpiRow data={overview} year={year} />
      {/* OverviewMoversSection owns the shared selectedMonth — chart + movers panel never drift. */}
      <OverviewMoversSection
        data={chart}
        year={year}
        defaultMonthIndex={defaultMonthIndex}
        initialMovers={initialMovers}
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
    <div className="flex flex-col gap-6">
      {/* Header renders eagerly — it only needs the years list (HEAD-01/03). */}
      <OverviewHeader year={year} years={years} />

      {/* Data section streams under Suspense — KPIs + chart refetch together
          when ?year= changes (HEAD-02: re-scoping is automatic via server component re-render). */}
      <Suspense fallback={<OverviewPageSkeleton />}>
        <OverviewDataSection year={year} />
      </Suspense>
    </div>
  )
}

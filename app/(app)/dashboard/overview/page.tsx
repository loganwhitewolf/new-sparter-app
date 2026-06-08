import { Suspense } from 'react'
import { getOverview, getOverviewChart, getYearsWithData } from '@/lib/dal/overview'
import { resolveYear } from '@/components/dashboard/overview/resolve-year'
import { OverviewEmptyState } from '@/components/dashboard/overview/overview-empty-state'
import { OverviewHeader } from '@/components/dashboard/overview/overview-header'
import { KpiRow } from '@/components/dashboard/overview/kpi-row'
import { OverviewChart } from '@/components/dashboard/overview/overview-chart'
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

// Inner async component that fetches and renders KPIs + chart under Suspense.
async function OverviewDataSection({ year }: { year: number }) {
  const [overview, chart] = await Promise.all([getOverview(year), getOverviewChart(year)])

  if (isYearWithNoData(overview.totalIn, overview.totalOut)) {
    return <OverviewEmptyState variant="no-data-for-year" year={year} />
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Inline amber nudge: appears when uncategorized OUT expenses exist for the year.
          Dismissal is localStorage-only (year-scoped, lastSeenCount semantics) — no DB write.
          Placed above KpiRow so it reads as part of the title context (D-02, D-03, D-10). */}
      <OverviewNudge uncategorizedCount={overview.uncategorizedCount} year={year} />
      <KpiRow data={overview} year={year} />
      <section className="space-y-3" aria-labelledby="overview-chart-heading">
        <h2 id="overview-chart-heading" className="text-lg font-semibold">
          Entrate e uscite per mese
        </h2>
        <OverviewChart data={chart} />
      </section>
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

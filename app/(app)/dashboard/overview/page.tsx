import { Suspense } from 'react'
import {
  getOverview,
  getOverviewChart,
  getYearsWithData,
  getMonthOverMonthCategoryChanges,
  type OverviewChartPoint,
} from '@/lib/dal/overview'
import { resolveLedgerRowSource } from '@/lib/dal/dashboard-filters'
import { hasAmortizationPlans } from '@/lib/dal/amortization'
import { verifySession } from '@/lib/dal/auth'
import { resolveYear } from '@/components/dashboard/overview/resolve-year'
import { OverviewEmptyState } from '@/components/dashboard/overview/overview-empty-state'
import { OverviewHeader } from '@/components/dashboard/overview/overview-header'
import { OverviewDashboardSection } from '@/components/dashboard/overview/overview-dashboard-section'
import { OverviewPageSkeleton } from '@/components/dashboard/overview/overview-page-skeleton'
import { OverviewNudge } from '@/components/dashboard/overview/overview-nudge'
import { toDecimal } from '@/lib/utils/decimal'
import { parseLensParam, type Lens } from '@/lib/utils/search-params'

type Props = {
  searchParams: Promise<{ year?: string; lens?: string }>
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
async function OverviewDataSection({
  year,
  years,
  lens,
}: {
  year: number
  years: string[]
  lens: Lens
}) {
  // Phase 80 Plan 04: the SAME resolved ledgerRowSource threads into every widget on this
  // page (KPIs, chart, movers) — never re-derived per call site (T-80-08).
  const ledgerRowSource = resolveLedgerRowSource(lens)

  // React's cache() memoizes verifySession() within the same request — this is a free
  // re-call, not a second auth round-trip (the page-level verifySession() call stays).
  const { userId } = await verifySession()

  // Prior-year chart points feed the filtered YoY deltas on the KPI cards (260711-gfd):
  // deltas compare the SAME chip selection year-over-year. A prior year with no data
  // yields zero sums → null deltas (existing null handling). Both years read the SAME
  // lens so the delta comparison is meaningful.
  //
  // LSD-03: the cash-lens overlay chart is fetched ONLY when the active lens is
  // `competenza` — a ternary inside this SAME Promise.all array (not a separate `if`
  // branch), so selecting `cassa` triggers no extra query at all.
  const [overview, chart, prevChart, hasPlans, cashOverlayData] = await Promise.all([
    getOverview(year, ledgerRowSource),
    getOverviewChart(year, ledgerRowSource),
    getOverviewChart(year - 1, ledgerRowSource),
    hasAmortizationPlans(userId),
    lens === 'competenza'
      ? getOverviewChart(year, resolveLedgerRowSource('cassa'))
      : Promise.resolve(undefined),
  ])

  if (isYearWithNoData(overview.totalIn, overview.totalOut)) {
    return (
      <>
        <OverviewHeader year={year} years={years} lens={lens} hasAmortizationPlans={hasPlans} />
        <OverviewEmptyState variant="no-data-for-year" year={year} />
      </>
    )
  }

  // D-04: compute the real last-month-with-data index (not naively the last index).
  const defaultMonthIndex = deriveDefaultMonthIndex(chart)
  // Pre-fetch all 3 directions in parallel so the panel is fully populated on first paint.
  const [initialMoversIn, initialMoversOut, initialMoversAllocation] = await Promise.all([
    getMonthOverMonthCategoryChanges(year, defaultMonthIndex, 'in', 10, ledgerRowSource),
    getMonthOverMonthCategoryChanges(year, defaultMonthIndex, 'out', 10, ledgerRowSource),
    getMonthOverMonthCategoryChanges(year, defaultMonthIndex, 'allocation', 10, ledgerRowSource),
  ])

  return (
    <div className="flex flex-col gap-6">
      {/* FRU-FIX-03: header with inline nudge slot — nudge is right-aligned on the title row,
          no longer its own full-width row. Year selector still works (router.replace ?year=). */}
      <OverviewHeader
        year={year}
        years={years}
        lens={lens}
        hasAmortizationPlans={hasPlans}
        nudge={<OverviewNudge uncategorizedCount={overview.uncategorizedCount} year={year} />}
      />
      {/* 260711-gfd: chips + KPI cards + chart/movers share one dashboard-wide chip
          selection — OverviewDashboardSection owns it (sustainability default). */}
      <OverviewDashboardSection
        data={chart}
        prevData={prevChart}
        year={year}
        defaultMonthIndex={defaultMonthIndex}
        initialMoversIn={initialMoversIn}
        initialMoversOut={initialMoversOut}
        initialMoversAllocation={initialMoversAllocation}
        cashOverlayData={cashOverlayData}
      />
    </div>
  )
}

export default async function DashboardOverviewPage({ searchParams }: Props) {
  await verifySession()
  const params = await searchParams
  const lens = parseLensParam(params.lens)

  // Phase 80 Plan 04: fetch BOTH lenses' years unconditionally — needed for the D-10
  // cross-lens clamp regardless of which lens is active (a flip must be able to detect
  // "requested year exists only in the OTHER lens").
  const [yearsForCassa, yearsForCompetenza] = await Promise.all([
    getYearsWithData('cassa'),
    getYearsWithData('competenza'),
  ])
  const yearsForActiveLens = lens === 'competenza' ? yearsForCompetenza : yearsForCassa
  const yearsForOtherLens = lens === 'competenza' ? yearsForCassa : yearsForCompetenza
  const year = resolveYear(params.year, yearsForActiveLens, yearsForOtherLens)

  // D-06 case b: account has no years with data at all.
  if (year === null) {
    return <OverviewEmptyState variant="no-years" />
  }

  return (
    // FRU-FIX-03: OverviewHeader is now rendered inside OverviewDataSection so it can
    // receive uncategorizedCount for the inline nudge slot. The Suspense fallback
    // (OverviewPageSkeleton) covers both the header and the data section during streaming.
    <Suspense fallback={<OverviewPageSkeleton />}>
      <OverviewDataSection year={year} years={yearsForActiveLens} lens={lens} />
    </Suspense>
  )
}

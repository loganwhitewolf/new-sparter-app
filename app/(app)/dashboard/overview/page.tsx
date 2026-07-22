import { Suspense } from 'react'
import {
  getOverview,
  getOverviewChart,
  getYearsWithData,
  getMonthOverMonthCategoryChanges,
  type OverviewChartPoint,
} from '@/lib/dal/overview'
import { verifySession } from '@/lib/dal/auth'
import { getTags, resolveOwnedTagId, type TagRow } from '@/lib/dal/tags'
import { parseTagIdParam } from '@/lib/validations/dashboard'
import { resolveYear } from '@/components/dashboard/overview/resolve-year'
import { OverviewEmptyState } from '@/components/dashboard/overview/overview-empty-state'
import { OverviewHeader } from '@/components/dashboard/overview/overview-header'
import { TagFilterSelect } from '@/components/dashboard/tag-filter-select'
import { OverviewDashboardSection } from '@/components/dashboard/overview/overview-dashboard-section'
import { OverviewPageSkeleton } from '@/components/dashboard/overview/overview-page-skeleton'
import { OverviewNudge } from '@/components/dashboard/overview/overview-nudge'
import { toDecimal } from '@/lib/utils/decimal'

type Props = {
  searchParams: Promise<{ year?: string; tag?: string }>
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
  tagId,
  tags,
}: {
  year: number
  years: string[]
  tagId?: number
  tags: TagRow[]
}) {
  // Prior-year chart points feed the filtered YoY deltas on the KPI cards (260711-gfd):
  // deltas compare the SAME chip selection year-over-year. A prior year with no data
  // yields zero sums → null deltas (existing null handling). v2.6: tagId narrows all
  // three fetches so the dashboard-wide tag filter reaches the KPI cards, chart, and deltas.
  const [overview, chart, prevChart] = await Promise.all([
    getOverview(year, tagId),
    getOverviewChart(year, tagId),
    getOverviewChart(year - 1, tagId),
  ])

  if (isYearWithNoData(overview.totalIn, overview.totalOut)) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-3">
          <OverviewHeader year={year} years={years} />
          <TagFilterSelect tags={tags} value={tagId} />
        </div>
        {/* 68-06: a tag filter active with zero matching transactions is a distinct empty
            state from "no data for the year at all" — surfaces the tag-specific copy
            (68-UI-SPEC.md Copywriting Contract) so the user knows to change/remove the
            tag filter rather than the year. */}
        <OverviewEmptyState variant={tagId ? 'no-data-for-tag' : 'no-data-for-year'} year={year} />
      </>
    )
  }

  // D-04: compute the real last-month-with-data index (not naively the last index).
  const defaultMonthIndex = deriveDefaultMonthIndex(chart)
  // Pre-fetch all 3 directions in parallel so the panel is fully populated on first paint.
  const [initialMoversIn, initialMoversOut, initialMoversAllocation] = await Promise.all([
    getMonthOverMonthCategoryChanges(year, defaultMonthIndex, 'in', 10, tagId),
    getMonthOverMonthCategoryChanges(year, defaultMonthIndex, 'out', 10, tagId),
    getMonthOverMonthCategoryChanges(year, defaultMonthIndex, 'allocation', 10, tagId),
  ])

  return (
    <div className="flex flex-col gap-6">
      {/* FRU-FIX-03: header with inline nudge slot — nudge is right-aligned on the title row,
          no longer its own full-width row. Year selector still works (router.replace ?year=).
          68-06: TagFilterSelect renders as a sibling next to OverviewHeader (not inside it),
          per 68-UI-SPEC.md's "next to OverviewHeader's year select" placement. */}
      <div className="flex flex-wrap items-center gap-3">
        <OverviewHeader
          year={year}
          years={years}
          nudge={<OverviewNudge uncategorizedCount={overview.uncategorizedCount} year={year} />}
        />
        <TagFilterSelect tags={tags} value={tagId} />
      </div>
      {/* 260711-gfd: chips + KPI cards + chart/movers share one dashboard-wide chip
          selection — OverviewDashboardSection owns it (sustainability default).
          v2.6: tagId flows through so the movers' client-side month-switch refetch keeps the tag filter. */}
      <OverviewDashboardSection
        data={chart}
        prevData={prevChart}
        year={year}
        defaultMonthIndex={defaultMonthIndex}
        initialMoversIn={initialMoversIn}
        initialMoversOut={initialMoversOut}
        initialMoversAllocation={initialMoversAllocation}
        tagId={tagId}
      />
    </div>
  )
}

export default async function DashboardOverviewPage({ searchParams }: Props) {
  const { userId } = await verifySession()
  const params = await searchParams
  const years = await getYearsWithData()
  const year = resolveYear(params.year, years)

  // D-06 case b: account has no years with data at all.
  if (year === null) {
    return <OverviewEmptyState variant="no-years" />
  }

  // 68-06 (T-68-01): resolveOwnedTagId is fail-closed — a foreign or malformed tagId
  // silently resolves to undefined instead of being forwarded to any DAL call.
  const candidateTagId = parseTagIdParam(params)
  const tagId = await resolveOwnedTagId(userId, candidateTagId)
  const tags = await getTags(userId)

  return (
    // FRU-FIX-03: OverviewHeader is now rendered inside OverviewDataSection so it can
    // receive uncategorizedCount for the inline nudge slot. The Suspense fallback
    // (OverviewPageSkeleton) covers both the header and the data section during streaming.
    <Suspense fallback={<OverviewPageSkeleton />}>
      <OverviewDataSection year={year} years={years} tagId={tagId} tags={tags} />
    </Suspense>
  )
}

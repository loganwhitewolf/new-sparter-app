import { Suspense } from 'react'
import { CategoryBreakdownChart } from '@/components/dashboard/category-breakdown-chart'
import { DashboardFilters } from '@/components/dashboard/dashboard-filters'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { MonthlyTrendChart } from '@/components/dashboard/monthly-trend-chart'
import { BreakdownSkeleton } from '@/components/dashboard/breakdown-skeleton'
import { OverviewSkeleton } from '@/components/dashboard/overview-skeleton'
import { TrendSkeleton } from '@/components/dashboard/trend-skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getAggregatedTransactionsData,
  getCategoriesBreakdown,
  getOverview,
} from '@/lib/dal/dashboard'
import {
  parseDashboardFilters,
  type DashboardFilters as DashboardFilterValues,
  type DashboardPreset,
} from '@/lib/validations/dashboard'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string | string[]; type?: string | string[] }>
}) {
  const filters = parseDashboardFilters(await searchParams)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Panoramica delle tue finanze</p>
      </div>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewSection />
      </Suspense>

      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Breakdown categorie</CardTitle>
            <Suspense
              fallback={<div className="h-10 w-full rounded-md bg-muted animate-pulse md:w-80" />}
            >
              <DashboardFilters preset={filters.preset} type={filters.type} />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<BreakdownSkeleton />}>
            <BreakdownSection filters={filters} />
          </Suspense>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Trend mensile</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TrendSkeleton />}>
            <TrendSection preset={filters.preset} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

async function OverviewSection() {
  const data = await getOverview()
  return <KpiCards data={data} />
}

async function BreakdownSection({ filters }: { filters: DashboardFilterValues }) {
  const data = await getCategoriesBreakdown(filters)
  return <CategoryBreakdownChart data={data} type={filters.type} />
}

async function TrendSection({ preset }: { preset: DashboardPreset }) {
  const data = await getAggregatedTransactionsData(preset)
  return <MonthlyTrendChart data={data} />
}

import { Suspense } from 'react'
import { getOverview, getAggregatedTransactionsData } from '@/lib/dal/dashboard'
import { parseDashboardFilters } from '@/lib/validations/dashboard'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { EntrateUsciteChart } from '@/components/dashboard/entrate-uscite-chart'
import { BilancioBarsChart } from '@/components/dashboard/bilancio-bars-chart'
import { OverviewFilters } from '@/components/dashboard/overview-filters'
import { OverviewSkeleton } from '@/components/dashboard/overview-skeleton'
import { TrendSkeleton } from '@/components/dashboard/trend-skeleton'

type Props = {
  searchParams: Promise<{ preset?: string; type?: string }>
}

async function OverviewContent({ preset }: { preset: string | undefined }) {
  const filters = parseDashboardFilters({ preset })
  const data = await getOverview(filters.preset)
  return <KpiCards data={data} />
}

async function TrendContent({ preset }: { preset: string | undefined }) {
  const filters = parseDashboardFilters({ preset })
  const data = await getAggregatedTransactionsData(filters.preset)
  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3" aria-labelledby="overview-entrate-uscite-heading">
        <h2 id="overview-entrate-uscite-heading" className="text-lg font-semibold">
          Entrate e uscite per mese
        </h2>
        <EntrateUsciteChart data={data} />
      </section>
      <section className="space-y-3" aria-labelledby="overview-bilancio-heading">
        <h2 id="overview-bilancio-heading" className="text-lg font-semibold">
          Bilancio mensile
        </h2>
        <BilancioBarsChart data={data} />
      </section>
    </div>
  )
}

export default async function DashboardOverviewPage({ searchParams }: Props) {
  const params = await searchParams
  const filters = parseDashboardFilters(params)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Panoramica delle tue finanze</p>
      </div>

      <OverviewFilters preset={filters.preset} />

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent preset={params.preset} />
      </Suspense>

      <Suspense fallback={<TrendSkeleton />}>
        <TrendContent preset={params.preset} />
      </Suspense>
    </div>
  )
}

import { KpiCard } from '@/components/dashboard/kpi-card'
import type { OverviewData } from '@/lib/dal/dashboard'

type Props = {
  data: OverviewData
}

export function KpiCards({ data }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
      <KpiCard
        label="Totale entrate"
        value={data.totalIn}
        tone="in"
        delta={data.deltas.totalIn}
        goodWhenPositive
      />
      <KpiCard
        label="Totale uscite"
        value={data.totalOut}
        tone="out"
        delta={data.deltas.totalOut}
        goodWhenPositive={false}
      />
      <KpiCard
        label="Bilancio"
        value={data.balance}
        tone="balance"
        delta={data.deltas.balance}
        goodWhenPositive
      />
      <KpiCard
        label="Tasso risparmio"
        value={`${data.savingsRate}%`}
        tone="savings"
        delta={data.deltas.savingsRate}
        goodWhenPositive
      />
      <div className="col-span-2 flex justify-center md:col-span-1 md:block">
        <KpiCard
          label="Da categorizzare"
          value={String(data.uncategorizedCount)}
          tone="neutral"
          delta={data.deltas.uncategorizedCount}
          goodWhenPositive={false}
          className="w-1/2 min-w-36 md:w-auto"
        />
      </div>
    </div>
  )
}

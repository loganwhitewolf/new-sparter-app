// PROTOTYPE — wipe me. Year-scoped KPI row, reuses the real KpiCard (approved in grill).
import { KpiCard } from '@/components/dashboard/kpi-card'
import { getKpis, eur } from './mock-data'

export function KpiRow({ year }: { year: number }) {
  const k = getKpis(year, new Set(), new Set()) // KPIs show REAL totals, ignore chart filters
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <KpiCard label="Totale entrate" value={eur(k.totalIn)} tone="in" delta={k.deltas.totalIn} goodWhenPositive className="min-h-0" />
      <KpiCard label="Totale uscite" value={eur(k.totalOut)} tone="out" delta={k.deltas.totalOut} goodWhenPositive={false} className="min-h-0" />
      <KpiCard label="Bilancio" value={eur(k.balance)} tone="balance" delta={k.deltas.balance} goodWhenPositive className="min-h-0" />
      <KpiCard label="Tasso risparmio" value={`${k.savings}%`} tone="savings" delta={k.deltas.savings} goodWhenPositive className="min-h-0" />
      <div className="col-span-2 flex justify-center md:col-span-1 md:block">
        <KpiCard
          label="Da categorizzare"
          value={String(k.uncategorized)}
          tone="neutral"
          delta={k.deltas.uncat}
          goodWhenPositive={false}
          className="min-h-0 w-1/2 min-w-36 md:w-auto"
        />
      </div>
    </div>
  )
}

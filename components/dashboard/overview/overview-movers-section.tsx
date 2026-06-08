'use client'
import { useState, useTransition } from 'react'
import type { OverviewChartPoint, MonthOverMonthChange } from '@/lib/dal/overview'
import { fetchMovers } from '@/lib/actions/overview'
import { OverviewChart } from './overview-chart'
import { OverviewMoversPanel } from './overview-movers-panel'

type Props = {
  data: OverviewChartPoint[]
  year: number
  defaultMonthIndex: number
  initialMovers: MonthOverMonthChange[]
}

/**
 * Shared-state parent for the chart + movers panel (D-03 architecture).
 *
 * Owns the single selectedMonth so chart highlight and panel month never drift.
 * On month change: updates selectedMonth immediately (instant highlight) then
 * fetches new movers inside useTransition (non-blocking, shows loading state).
 */
export function OverviewMoversSection({ data, year, defaultMonthIndex, initialMovers }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthIndex)
  const [movers, setMovers] = useState<MonthOverMonthChange[]>(initialMovers)
  const [isPending, startTransition] = useTransition()

  function handleMonthSelect(monthIndex: number) {
    // Update highlight immediately — no waiting for the fetch.
    setSelectedMonth(monthIndex)

    startTransition(async () => {
      const result = await fetchMovers(year, monthIndex)
      if (!result.error) {
        setMovers(result.movers)
      }
    })
  }

  return (
    <section className="space-y-3" aria-labelledby="overview-chart-heading">
      <h2 id="overview-chart-heading" className="text-lg font-semibold">
        Entrate e uscite per mese
      </h2>
      <OverviewChart
        data={data}
        selectedMonth={selectedMonth}
        onMonthSelect={handleMonthSelect}
      />
      <OverviewMoversPanel
        year={year}
        selectedMonth={selectedMonth}
        movers={movers}
        isPending={isPending}
        data={data}
      />
    </section>
  )
}

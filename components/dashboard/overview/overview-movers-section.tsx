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
  initialMoversIn: MonthOverMonthChange[]
  initialMoversOut: MonthOverMonthChange[]
  initialMoversAllocation: MonthOverMonthChange[]
}

/**
 * Shared-state parent for the chart + movers panel (D-03 architecture).
 *
 * Owns the single selectedMonth so chart highlight and panel month never drift.
 * On month change: fetches movers for all 3 directions (in/out/allocation) in
 * parallel and renders them side-by-side in a 3-column layout.
 *
 * Clicking any bar selects the month — no per-direction routing.
 */
export function OverviewMoversSection({
  data,
  year,
  defaultMonthIndex,
  initialMoversIn,
  initialMoversOut,
  initialMoversAllocation,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthIndex)
  const [moversIn, setMoversIn] = useState<MonthOverMonthChange[]>(initialMoversIn)
  const [moversOut, setMoversOut] = useState<MonthOverMonthChange[]>(initialMoversOut)
  const [moversAllocation, setMoversAllocation] = useState<MonthOverMonthChange[]>(initialMoversAllocation)
  const [isPending, startTransition] = useTransition()

  function handleMonthSelect(monthIndex: number) {
    // Update highlight immediately — no waiting for the fetch.
    setSelectedMonth(monthIndex)

    startTransition(async () => {
      // Fetch all 3 directions in parallel.
      const [resultIn, resultOut, resultAllocation] = await Promise.all([
        fetchMovers(year, monthIndex, 'in'),
        fetchMovers(year, monthIndex, 'out'),
        fetchMovers(year, monthIndex, 'allocation'),
      ])

      setMoversIn(resultIn.error ? [] : resultIn.movers)
      setMoversOut(resultOut.error ? [] : resultOut.movers)
      setMoversAllocation(resultAllocation.error ? [] : resultAllocation.movers)
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
        moversIn={moversIn}
        moversOut={moversOut}
        moversAllocation={moversAllocation}
        isPending={isPending}
      />
    </section>
  )
}

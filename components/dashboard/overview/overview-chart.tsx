'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { OverviewChartPoint } from '@/lib/dal/overview'
import { formatEur, formatEurCompact } from './format'
import {
  deriveFilteredBarRow,
  INCOME_KEYS,
  OUT_KEYS,
  type IncomeKey,
  type OutKey,
} from './overview-chart-utils'
import { OverviewChartFilters } from './overview-chart-filters'

// Chart config: Entrate = green (--total-in), Uscite = red (--total-out).
const chartConfig = {
  entrate: { label: 'Entrate', color: 'var(--total-in)' },
  uscite: { label: 'Uscite', color: 'var(--total-out)' },
} satisfies ChartConfig

type OverviewChartProps = {
  data: OverviewChartPoint[]
  // D-03 / P45: called when user selects a month (movers drill-down seam)
  onMonthSelect?: (monthIndex: number) => void
}

export function OverviewChart({ data }: OverviewChartProps) {
  // D-03 scaffold: internal selected-month state for P45 movers drill-down.
  // Default to the last month index (most recent data).
  const [selectedMonth, setSelectedMonth] = useState(() => data.length - 1)

  // D-06: default all-on — all income and out keys included.
  // D-09: chip state is chart-local only (no URL, no localStorage).
  const [includedIncome, setIncludedIncome] = useState<Set<IncomeKey>>(
    () => new Set(INCOME_KEYS)
  )
  const [includedOut, setIncludedOut] = useState<Set<OutKey>>(
    () => new Set(OUT_KEYS)
  )

  // D-07: inclusive toggle — adds or removes a single key from the included set.
  function handleToggleIncome(key: IncomeKey) {
    setIncludedIncome((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleToggleOut(key: OutKey) {
    setIncludedOut((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // D-08: reset restores all keys in both groups.
  function handleReset() {
    setIncludedIncome(new Set(INCOME_KEYS))
    setIncludedOut(new Set(OUT_KEYS))
  }

  // Derive bar rows using filter-aware reduction (FILT-01, FILT-02).
  // Number() conversion happens only inside deriveFilteredBarRow (Recharts boundary).
  const rows = data.map((p) =>
    deriveFilteredBarRow(p, [...includedIncome], [...includedOut])
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Filter chips — Entrate and Uscite groups with group popovers and per-chip tooltips */}
      <OverviewChartFilters
        includedIncome={includedIncome}
        includedOut={includedOut}
        onToggleIncome={handleToggleIncome}
        onToggleOut={handleToggleOut}
        onReset={handleReset}
      />

      <ChartContainer config={chartConfig} className="aspect-auto min-h-0 w-full flex-1">
        <BarChart data={rows} barGap={4} barCategoryGap="24%">
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => formatEur(v)}
            width={64}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />

          {/* Entrate bar — green fill, grouped side-by-side (CHART-01 / CHART-03) */}
          <Bar
            dataKey="entrate"
            fill="var(--color-entrate)"
            radius={[4, 4, 0, 0]}
            cursor="default"
            activeBar={false}
            // D-03: P45 will switch this to selected-month highlight + cursor:pointer
            onClick={(_, index) => setSelectedMonth(index)}
          >
            {/* CHART-02: always-on compact k-notation labels above each bar */}
            <LabelList
              dataKey="entrate"
              position="top"
              offset={6}
              className="fill-muted-foreground"
              fontSize={10}
              formatter={(v: unknown) => formatEurCompact(Number(v))}
            />
          </Bar>

          {/* Uscite bar — red fill via per-bar Cell, grouped side-by-side (CHART-01 / CHART-03) */}
          <Bar
            dataKey="uscite"
            radius={[4, 4, 0, 0]}
            cursor="default"
            activeBar={false}
            // D-03: P45 will switch this to selected-month highlight + cursor:pointer
            onClick={(_, index) => setSelectedMonth(index)}
          >
            {/* CHART-02: always-on compact k-notation labels above each bar */}
            <LabelList
              dataKey="uscite"
              position="top"
              offset={6}
              className="fill-muted-foreground"
              fontSize={10}
              formatter={(v: unknown) => formatEurCompact(Number(v))}
            />
            {/* D-03 scaffold: per-bar Cell for opacity control.
                In P43/P44: constant fillOpacity=1, cursor=default (no visible affordance).
                D-03: P45 will switch this to selected-month highlight + cursor:pointer */}
            {rows.map((_, i) => (
              <Cell
                key={i}
                fill="var(--color-uscite)"
                // D-03: P45 will switch this to: i === selectedMonth ? 1 : 0.4
                fillOpacity={1}
                cursor="default"
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

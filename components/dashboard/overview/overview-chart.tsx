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
import { toDecimal } from '@/lib/utils/decimal'
import { formatEur, formatEurCompact } from './format'

// Chart config: Entrate = green (--total-in), Uscite = red (--total-out).
const chartConfig = {
  entrate: { label: 'Entrate', color: 'var(--total-in)' },
  uscite: { label: 'Uscite', color: 'var(--total-out)' },
} satisfies ChartConfig

// Derive the bar row values from an OverviewChartPoint using Decimal arithmetic.
// Entrate = income.recurring + income.extraordinary (one green bar).
// Uscite = sum of all 6 OUT natures (one red bar).
// NEVER use native + on DECIMAL strings; always use toDecimal().plus().
function deriveBarRow(point: OverviewChartPoint) {
  const entrate = toDecimal(point.income.recurring)
    .plus(toDecimal(point.income.extraordinary))

  const outNatures = [
    point.out.essential,
    point.out.discretionary,
    point.out.operational,
    point.out.financial,
    point.out.debt,
    point.out.extraordinary,
  ]
  const uscite = outNatures
    .slice(1)
    .reduce((acc, v) => acc.plus(toDecimal(v)), toDecimal(outNatures[0]))

  return {
    label: point.label,
    // Convert to number only at the recharts boundary (recharts requires numbers).
    entrate: Number(entrate),
    uscite: Number(uscite),
  }
}

// Optional props for future P44 (filter chips) and P45 (movers drill-down).
// Typed here so downstream phases wire them without a component rewrite.
// All are unused / no-op in P43.
type OverviewChartProps = {
  data: OverviewChartPoint[]
  // D-03 / P44: called when user selects a month (filter chip interaction)
  onMonthSelect?: (monthIndex: number) => void
  // D-03 / P44: hidden income types — used by P44 filter chips to slice entrate bar
  hiddenIncome?: Set<string>
  // D-03 / P44: hidden out natures — used by P44 filter chips to slice uscite bar
  hiddenOut?: Set<string>
}

export function OverviewChart({ data }: OverviewChartProps) {
  // D-03 scaffold: internal selected-month state for P45 movers drill-down.
  // Default to the last month index (most recent data).
  const [selectedMonth, setSelectedMonth] = useState(() => data.length - 1)

  const rows = data.map(deriveBarRow)

  return (
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
              In P43: constant fillOpacity=1, cursor=default (no visible affordance).
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
  )
}

'use client'

import { useMemo } from 'react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { toDecimal } from '@/lib/utils/decimal'
import type { MonthlyTrendPoint } from '@/lib/dal/dashboard'

type Props = { data: MonthlyTrendPoint[] }

type ChartPoint = {
  month: string
  label: string
  totalIn: number
  totalOut: number
}

const chartConfig = {
  totalIn: { label: 'Entrate', color: 'var(--total-in)' },
  totalOut: { label: 'Uscite', color: 'var(--total-out)' },
} satisfies ChartConfig

export function EntrateUsciteChart({ data }: Props) {
  const chartData = useMemo<ChartPoint[]>(
    () =>
      data.map((point) => ({
        month: point.month,
        label: point.label,
        totalIn: toDecimal(point.totalIn).toNumber(),
        totalOut: toDecimal(point.totalOut).toNumber(),
      })),
    [data]
  )

  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full" data-config={JSON.stringify(chartConfig)}>
      <BarChart data={chartData} barGap={2} barCategoryGap="20%">
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="totalIn" fill="var(--total-in)" />
        <Bar dataKey="totalOut" fill="var(--total-out)" />
      </BarChart>
    </ChartContainer>
  )
}

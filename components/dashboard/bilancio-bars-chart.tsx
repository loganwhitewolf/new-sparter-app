'use client'

import { useMemo } from 'react'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
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
  balance: number
}

const chartConfig = {
  balance: { label: 'Bilancio', color: 'var(--total-in)' },
} satisfies ChartConfig

export function BilancioBarsChart({ data }: Props) {
  const chartData = useMemo<ChartPoint[]>(
    () =>
      data.map((point) => {
        const balance = toDecimal(point.totalIn).minus(toDecimal(point.totalOut))
        return {
          month: point.month,
          label: point.label,
          balance: balance.toNumber(),
        }
      }),
    [data]
  )

  return (
    <ChartContainer config={chartConfig} className="min-h-[220px] w-full" data-config={JSON.stringify(chartConfig)}>
      <BarChart data={chartData} barCategoryGap="20%">
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
          domain={[
            (min: number) => Math.min(min, 0),
            (max: number) => Math.max(max, 0),
          ]}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
          {chartData.map((point) => (
            <Cell
              key={point.month}
              fill={point.balance >= 0 ? 'var(--total-in)' : 'var(--color-destructive)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { MonthlyTrendPoint } from '@/lib/dal/dashboard'

type Props = { data: MonthlyTrendPoint[] }

type SeriesKey = 'totalIn' | 'totalOut' | 'totalNc' | 'totalIgn'

const series: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: 'totalIn', label: 'Entrate', color: 'var(--total-in)' },
  { key: 'totalOut', label: 'Uscite', color: 'var(--total-out)' },
  { key: 'totalNc', label: 'Non categorizzato', color: 'var(--muted-foreground)' },
  { key: 'totalIgn', label: 'Ignorato', color: 'var(--muted)' },
]

const trendChartConfig = {
  totalIn: { label: 'Entrate', color: 'var(--total-in)' },
  totalOut: { label: 'Uscite', color: 'var(--total-out)' },
  totalNc: { label: 'Non categorizzato', color: 'var(--muted-foreground)' },
  totalIgn: { label: 'Ignorato', color: 'var(--muted)' },
} satisfies ChartConfig

export function MonthlyTrendChart({ data }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const chartData = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        totalIn: Number(point.totalIn),
        totalOut: Number(point.totalOut),
      })),
    [data]
  )

  function toggleSeries(key: SeriesKey) {
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      <ChartContainer config={trendChartConfig} className="min-h-[300px] w-full">
        <BarChart data={chartData} barGap={2} barCategoryGap="20%">
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="totalIn" fill="var(--total-in)" hide={hidden.has('totalIn')} />
          <Bar dataKey="totalOut" fill="var(--total-out)" hide={hidden.has('totalOut')} />
          <Bar
            dataKey="totalNc"
            fill="var(--muted-foreground)"
            hide={hidden.has('totalNc')}
          />
          <Bar dataKey="totalIgn" fill="var(--muted)" hide={hidden.has('totalIgn')} />
        </BarChart>
      </ChartContainer>

      <div className="flex flex-wrap gap-2">
        {series.map((item) => {
          const isVisible = !hidden.has(item.key)

          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={isVisible}
              onClick={() => toggleSeries(item.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
                isVisible
                  ? 'border-border text-foreground'
                  : 'border-border bg-muted text-muted-foreground'
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

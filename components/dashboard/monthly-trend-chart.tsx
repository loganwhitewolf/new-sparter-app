'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  type DotProps,
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { toDecimal } from '@/lib/utils/decimal'
import type { MonthlyTrendPoint } from '@/lib/dal/dashboard'

type Props = { data: MonthlyTrendPoint[] }

type SeriesKey = 'totalIn' | 'totalOut' | 'totalNc' | 'totalIgn' | 'balance'

const series: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: 'totalIn', label: 'Entrate', color: 'var(--total-in)' },
  { key: 'totalOut', label: 'Uscite', color: 'var(--total-out)' },
  { key: 'totalNc', label: 'Non categorizzato', color: 'var(--muted-foreground)' },
  { key: 'totalIgn', label: 'Ignorato', color: 'var(--muted)' },
  { key: 'balance', label: 'Bilancio', color: 'var(--total-in)' },
]

const trendChartConfig = {
  totalIn: { label: 'Entrate', color: 'var(--total-in)' },
  totalOut: { label: 'Uscite', color: 'var(--total-out)' },
  totalNc: { label: 'Non categorizzato', color: 'var(--muted-foreground)' },
  totalIgn: { label: 'Ignorato', color: 'var(--muted)' },
  balance: { label: 'Bilancio', color: 'var(--total-in)' },
} satisfies ChartConfig

type ChartPoint = {
  month: string
  label: string
  totalIn: number
  totalOut: number
  totalNc: number
  totalIgn: number
  balance: number
}

function BalanceDot(props: DotProps & { payload?: ChartPoint }) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || payload == null) return null
  const fill = payload.balance >= 0 ? 'var(--total-in)' : 'var(--color-destructive)'
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="none" />
}

export function MonthlyTrendChart({ data }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const chartData = useMemo<ChartPoint[]>(
    () =>
      data.map((point) => {
        const inVal = toDecimal(point.totalIn)
        const outVal = toDecimal(point.totalOut)
        return {
          month: point.month,
          label: point.label,
          totalIn: inVal.toNumber(),
          totalOut: outVal.toNumber(),
          totalNc: point.totalNc,
          totalIgn: point.totalIgn,
          balance: inVal.minus(outVal).toNumber(),
        }
      }),
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
        <ComposedChart data={chartData} barGap={2} barCategoryGap="20%">
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
          <Line
            dataKey="balance"
            stroke="var(--total-in)"
            strokeWidth={2}
            dot={<BalanceDot />}
            activeDot={false}
            hide={hidden.has('balance')}
          />
        </ComposedChart>
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

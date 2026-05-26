'use client'

import { useMemo, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { FlowNature } from '@/lib/utils/nature-labels'
import { NATURE_COLORS, NATURE_LABELS, NATURE_ORDER } from '@/lib/utils/nature-labels'
import type { MonthlyNatureTrendPoint } from '@/lib/dal/dashboard'

type SegmentKey = FlowNature | 'unclassified'

const SEGMENT_KEYS: ReadonlyArray<SegmentKey> = NATURE_ORDER.map((n) => n ?? 'unclassified')

const chartConfig = Object.fromEntries(
  SEGMENT_KEYS.map((key) => [key, { label: NATURE_LABELS[key], color: NATURE_COLORS[key] }])
) as ChartConfig

type LegendProps = {
  visibleKeys: ReadonlyArray<SegmentKey>
  hidden: Set<SegmentKey>
  onToggle: (key: SegmentKey) => void
}

function CustomNatureLegend({ visibleKeys, hidden, onToggle }: LegendProps) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-sm">
      {visibleKeys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onToggle(key)}
          className={cn('flex items-center gap-1.5 cursor-pointer', hidden.has(key) && 'opacity-40')}
          aria-pressed={!hidden.has(key)}
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: NATURE_COLORS[key] }}
          />
          {NATURE_LABELS[key]}
        </button>
      ))}
    </div>
  )
}

type Props = { data: MonthlyNatureTrendPoint[] }

export function EntrateUsciteChart({ data }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const hidden = useMemo<Set<SegmentKey>>(() => {
    const raw = searchParams.get('hidden')
    if (!raw) return new Set()
    return new Set(raw.split(',') as SegmentKey[])
  }, [searchParams])

  const unclassifiedHasData = useMemo(
    () => data.some((p) => Number(p.segments['unclassified'] ?? 0) !== 0),
    [data]
  )

  const visibleKeys = unclassifiedHasData
    ? SEGMENT_KEYS
    : SEGMENT_KEYS.filter((k) => k !== 'unclassified')

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        month: point.month,
        label: point.label,
        ...Object.fromEntries(
          SEGMENT_KEYS.map((k) => [k, parseFloat(point.segments[k] ?? '0')])
        ),
      })),
    [data]
  )

  function toggleNature(key: SegmentKey) {
    const params = new URLSearchParams(searchParams.toString())
    const current = new Set((params.get('hidden') ?? '').split(',').filter(Boolean) as SegmentKey[])

    if (current.has(key)) {
      current.delete(key)
    } else {
      current.add(key)
    }

    if (current.size === 0) {
      params.delete('hidden')
    } else {
      params.set('hidden', Array.from(current).join(','))
    }

    const search = params.toString()
    startTransition(() => {
      router.replace(pathname + (search ? '?' + search : ''), { scroll: false })
    })
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full" data-config={JSON.stringify(chartConfig)}>
      <BarChart data={chartData} barGap={2} barCategoryGap="20%">
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          content={
            <CustomNatureLegend
              visibleKeys={visibleKeys}
              hidden={hidden}
              onToggle={toggleNature}
            />
          }
        />
        {visibleKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="a"
            fill={`var(--color-${key})`}
            hide={hidden.has(key)}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

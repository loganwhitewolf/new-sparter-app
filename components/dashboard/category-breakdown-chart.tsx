'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { BreakdownCategory } from '@/lib/dal/dashboard'
import type { DashboardType } from '@/lib/validations/dashboard'

type Props = {
  data: BreakdownCategory[]
  type: DashboardType
}

type DisplayRow = {
  slug: string
  parentSlug?: string
  name: string
  count: number
  percentage: number
  kind: 'category' | 'subcategory'
}

const chartConfig = {
  percentage: {
    label: 'Percentuale',
  },
} satisfies ChartConfig

export function CategoryBreakdownChart({ data, type }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const parentFill = type === 'in' ? 'var(--total-in)' : 'var(--total-out)'

  const displayData = useMemo<DisplayRow[]>(() => {
    return data.flatMap((category) => {
      const rows: DisplayRow[] = [
        {
          slug: category.slug,
          name: category.name,
          count: category.count,
          percentage: category.percentage,
          kind: 'category',
        },
      ]

      if (expanded.has(category.slug)) {
        rows.push(
          ...category.subCategories.map((subCategory) => ({
            slug: subCategory.slug,
            parentSlug: category.slug,
            name: subCategory.name,
            count: subCategory.count,
            percentage: subCategory.percentage,
            kind: 'subcategory' as const,
          }))
        )
      }

      return rows
    })
  }, [data, expanded])

  function toggleCategory(slug: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }

  if (data.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Nessun dato per il periodo selezionato
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {data.map((category) => (
          <button
            key={category.slug}
            type="button"
            aria-label={'Espandi ' + category.name}
            aria-expanded={expanded.has(category.slug)}
            onClick={() => toggleCategory(category.slug)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              expanded.has(category.slug)
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
        <BarChart data={displayData} layout="vertical" margin={{ left: 120, right: 16 }}>
          <XAxis type="number" domain={[0, 100]} unit="%" hide />
          <YAxis dataKey="name" type="category" width={112} tick={{ fontSize: 12 }} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
            {displayData.map((row) => (
              <Cell
                key={`${row.kind}-${row.parentSlug ?? row.slug}-${row.slug}`}
                fill={row.kind === 'category' ? parentFill : 'var(--muted-foreground)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      <ul className="grid gap-2 text-sm">
        {displayData.map((row) => (
          <li
            key={`${row.kind}-detail-${row.parentSlug ?? row.slug}-${row.slug}`}
            className={cn(
              'flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2',
              row.kind === 'subcategory' && 'ml-4'
            )}
          >
            <span className="truncate">{row.name}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {row.count} movimenti · {row.percentage}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

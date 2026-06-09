'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import type { OverviewChartPoint } from '@/lib/dal/overview'
import { NATURE_COLORS, NATURE_LABELS } from '@/lib/utils/nature-labels'
import { formatEur, formatEurCompact } from './format'
import {
  deriveFilteredBarRow,
  deriveNatureBreakdown,
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

// ─── Income legend metadata (display order: recurring, extraordinary) ────────
const INCOME_LEGEND_ITEMS = [
  { key: 'recurring', label: NATURE_LABELS['income'], color: NATURE_COLORS['income'] },
  { key: 'extraordinary', label: NATURE_LABELS['income_extraordinary'], color: NATURE_COLORS['income_extraordinary'] },
] as const

// ─── Out legend metadata (display order follows OUT_KEYS) ────────────────────
const OUT_LEGEND_ITEMS = OUT_KEYS.map((key) => ({
  key,
  label: NATURE_LABELS[key],
  color: NATURE_COLORS[key],
}))

// ─── Custom per-nature tooltip ────────────────────────────────────────────────

type NatureTooltipProps = {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  data: OverviewChartPoint[]
  includedIncome: Set<IncomeKey>
  includedOut: Set<OutKey>
}

function NatureTooltip({ active, payload, data, includedIncome, includedOut }: NatureTooltipProps) {
  if (!active || !payload?.length) return null

  // Resolve the hovered data point from the original (unfiltered) data array.
  // payload[0].payload.label is the XAxis label; find by matching label.
  const hoveredLabel = payload[0]?.payload?.label as string | undefined
  const point = data.find((p) => p.label === hoveredLabel)
  if (!point) return null

  const breakdown = deriveNatureBreakdown(point, includedIncome, includedOut)

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md min-w-[160px]">
      <p className="mb-1.5 font-semibold text-foreground">{hoveredLabel}</p>

      {/* Entrate section */}
      {breakdown.income.length > 0 && (
        <div className="mb-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-1">Entrate</p>
          {breakdown.income.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 py-0.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <span className="font-mono text-xs tabular-nums">{formatEur(item.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Uscite section */}
      {breakdown.out.filter((i) => i.amount > 0).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Uscite</p>
          {breakdown.out
            .filter((item) => item.amount > 0)
            .map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 py-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <span className="font-mono text-xs tabular-nums">{formatEur(item.amount)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Custom two-row legend ────────────────────────────────────────────────────

type NatureLegendProps = {
  includedIncome: Set<IncomeKey>
  includedOut: Set<OutKey>
}

function NatureLegend({ includedIncome, includedOut }: NatureLegendProps) {
  return (
    <div className="flex flex-col gap-1 mt-2 px-1">
      {/* Row 1: income natures */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {INCOME_LEGEND_ITEMS.map((item) => {
          const included = includedIncome.has(item.key as IncomeKey)
          return (
            <div
              key={item.key}
              className="flex items-center gap-1.5"
              style={{ opacity: included ? 1 : 0.4 }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          )
        })}
      </div>
      {/* Row 2: out natures */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {OUT_LEGEND_ITEMS.map((item) => {
          const included = includedOut.has(item.key as OutKey)
          return (
            <div
              key={item.key}
              className="flex items-center gap-1.5"
              style={{ opacity: included ? 1 : 0.4 }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type OverviewChartProps = {
  data: OverviewChartPoint[]
  // D-03 / P45: controlled by parent — single source of truth shared with movers panel.
  selectedMonth: number
  onMonthSelect: (monthIndex: number) => void
}

export function OverviewChart({ data, selectedMonth, onMonthSelect }: OverviewChartProps) {
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

      <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
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
          {/* FRU-FIX-02: per-nature tooltip instead of generic entrate/uscite totals */}
          {/* FRU-FIX-05: cursor={false} removes the green/muted highlight rectangle on hover */}
          <ChartTooltip
            cursor={false}
            content={
              <NatureTooltip
                data={data}
                includedIncome={includedIncome}
                includedOut={includedOut}
              />
            }
          />

          {/* Entrate bar — green fill, grouped side-by-side (CHART-01 / CHART-03) */}
          <Bar
            dataKey="entrate"
            fill="var(--color-entrate)"
            radius={[4, 4, 0, 0]}
            cursor="default"
            activeBar={false}
            // D-03: clicks are forwarded to the shared-state parent via controlled prop
            onClick={(_, index) => onMonthSelect(index)}
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
            {/* D-03: per-Cell opacity — selected month at full opacity, others dimmed (D-06) */}
            {rows.map((_, i) => (
              <Cell
                key={i}
                fill="var(--color-entrate)"
                fillOpacity={i === selectedMonth ? 1 : 0.4}
                cursor="pointer"
              />
            ))}
          </Bar>

          {/* Uscite bar — red fill via per-bar Cell, grouped side-by-side (CHART-01 / CHART-03) */}
          <Bar
            dataKey="uscite"
            radius={[4, 4, 0, 0]}
            cursor="default"
            activeBar={false}
            // D-03: clicks are forwarded to the shared-state parent via controlled prop
            onClick={(_, index) => onMonthSelect(index)}
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
            {/* D-03: per-Cell opacity — selected month at full opacity, others dimmed (D-06) */}
            {rows.map((_, i) => (
              <Cell
                key={i}
                fill="var(--color-uscite)"
                fillOpacity={i === selectedMonth ? 1 : 0.4}
                cursor="pointer"
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* FRU-FIX-06: two-row nature legend outside Recharts — income row + out row, each with colored dot */}
      <NatureLegend includedIncome={includedIncome} includedOut={includedOut} />
    </div>
  )
}

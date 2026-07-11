'use client'

import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import type { OverviewChartPoint } from '@/lib/dal/overview'
import { formatEur, formatEurCompact } from './format'
import {
  deriveFilteredBarRow,
  deriveNatureBreakdown,
  type IncomeKey,
  type OutKey,
  type AllocationKey,
} from './overview-chart-utils'

// Chart config: Entrate = green (--total-in), Uscite = orange (--total-out), Accantonato = purple (--total-allocation).
const chartConfig = {
  entrate: { label: 'Entrate', color: 'var(--total-in)' },
  uscite: { label: 'Uscite', color: 'var(--total-out)' },
  accantonato: { label: 'Accantonato', color: 'var(--total-allocation)' },
} satisfies ChartConfig

// ─── Custom per-nature tooltip ────────────────────────────────────────────────

type NatureTooltipProps = {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  data: OverviewChartPoint[]
  includedIncome: Set<IncomeKey>
  includedOut: Set<OutKey>
  includedAllocation: Set<AllocationKey>
}

function NatureTooltip({ active, payload, data, includedIncome, includedOut, includedAllocation }: NatureTooltipProps) {
  if (!active || !payload?.length) return null

  // Resolve the hovered data point from the original (unfiltered) data array.
  // payload[0].payload.label is the XAxis label; find by matching label.
  const hoveredLabel = payload[0]?.payload?.label as string | undefined
  const point = data.find((p) => p.label === hoveredLabel)
  if (!point) return null

  const breakdown = deriveNatureBreakdown(point, includedIncome, includedOut, includedAllocation)

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
        <div className="mb-1.5">
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

      {/* Accantonamenti section — always shown if allocation data exists */}
      {breakdown.allocation.some((i) => i.amount > 0) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Accantonamenti</p>
          {breakdown.allocation
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

type OverviewChartProps = {
  data: OverviewChartPoint[]
  // D-03 / P45: controlled by parent — single source of truth shared with movers panel.
  selectedMonth: number
  // Month selection: clicking any bar selects the month and shows all 3 directions at once.
  onMonthSelect: (monthIndex: number) => void
  // 260711-gfd: chip selection is dashboard-wide — owned by OverviewDashboardSection
  // (which also renders the chips above the KPI cards); the chart is fully controlled.
  includedIncome: Set<IncomeKey>
  includedOut: Set<OutKey>
  includedAllocation: Set<AllocationKey>
}

export function OverviewChart({
  data,
  selectedMonth,
  onMonthSelect,
  includedIncome,
  includedOut,
  includedAllocation,
}: OverviewChartProps) {
  // Derive bar rows using filter-aware reduction (FILT-01, FILT-02).
  // Number() conversion happens only inside deriveFilteredBarRow (Recharts boundary).
  const rows = data.map((p) =>
    deriveFilteredBarRow(p, [...includedIncome], [...includedOut], [...includedAllocation])
  )

  return (
    <div className="flex flex-col gap-3">
      {/* FRU-FIX-05: clicking a bar focuses Recharts' internal z-index group
          (<g class="recharts-zIndex-layer_*">), and the global
          `* { outline-ring/50 }` base rule (ring hue is green) paints a green
          5px outline around the clicked month. Suppress focus outlines on every
          element inside the chart — month selection is already conveyed by
          per-Cell opacity, and the filter chips use a ring (box-shadow), not an
          outline, so their focus indicator is unaffected. */}
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[260px] w-full [&_*:focus]:outline-none [&_*:focus-visible]:outline-none"
      >
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
                includedAllocation={includedAllocation}
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
            // Month selection: any bar click selects the month, all 3 directions shown at once.
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

          {/* Uscite bar — orange fill via per-bar Cell, grouped side-by-side (CHART-01 / CHART-03) */}
          <Bar
            dataKey="uscite"
            radius={[4, 4, 0, 0]}
            cursor="default"
            activeBar={false}
            // Month selection: any bar click selects the month, all 3 directions shown at once.
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

          {/* Accantonato bar — purple fill, always rendered even at zero (D-01) */}
          <Bar
            dataKey="accantonato"
            fill="var(--color-accantonato)"
            radius={[4, 4, 0, 0]}
            cursor="default"
            activeBar={false}
            // Month selection: any bar click selects the month, all 3 directions shown at once.
            // D-04: zero-height bar is still clickable (cursor pointer applied per-Cell).
            onClick={(_, index) => onMonthSelect(index)}
          >
            {/* CHART-02: always-on compact k-notation labels above each bar */}
            <LabelList
              dataKey="accantonato"
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
                fill="var(--color-accantonato)"
                fillOpacity={i === selectedMonth ? 1 : 0.4}
                cursor="pointer"
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

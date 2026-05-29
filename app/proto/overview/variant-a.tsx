'use client'

// PROTOTYPE — wipe me. Variant A: barre verticali raggruppate, movers in lista sotto.
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { getYearData, incomeTotal, usciteTotal, eur } from './mock-data'
import { MoversList, FilterBar, useFilters } from './shared'

const config = {
  entrate: { label: 'Entrate', color: 'var(--total-in)' },
  uscite: { label: 'Uscite', color: 'var(--total-out)' },
} satisfies ChartConfig

export function VariantA({ year }: { year: number }) {
  const { hiddenUscite, hiddenIncome, toggleUscite, toggleIncome } = useFilters()
  const data = useMemo(
    () =>
      getYearData(year).map((p) => ({
        label: p.label,
        entrate: incomeTotal(p, hiddenIncome),
        uscite: usciteTotal(p, hiddenUscite),
      })),
    [year, hiddenUscite, hiddenIncome]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <h2 className="shrink-0 text-lg font-semibold">Entrate e uscite per mese</h2>
        <FilterBar
          hiddenIncome={hiddenIncome}
          onToggleIncome={toggleIncome}
          hiddenUscite={hiddenUscite}
          onToggleUscite={toggleUscite}
          className="shrink-0"
        />
        <ChartContainer config={config} className="aspect-auto min-h-0 w-full flex-1">
          <BarChart data={data} barGap={4} barCategoryGap="24%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => eur(v)}
              width={64}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="entrate" fill="var(--color-entrate)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="uscite" fill="var(--color-uscite)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </section>
      <div className="shrink-0">
        <MoversList year={year} dense />
      </div>
    </div>
  )
}

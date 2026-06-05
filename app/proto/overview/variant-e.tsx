'use client'

// PROTOTYPE — wipe me. Variant E: grafico a sinistra (barre raggruppate, clic per mese),
// colonna destra = dettaglio top movers del mese selezionato vs mese precedente.
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
import { getYearData, incomeTotal, lastMonthIndex, usciteTotal, eur, eurCompact } from './mock-data'
import { MoversList, FilterBar, useFilters } from './shared'

const config = {
  entrate: { label: 'Entrate', color: 'var(--total-in)' },
  uscite: { label: 'Uscite', color: 'var(--total-out)' },
} satisfies ChartConfig

export function VariantE({ year }: { year: number }) {
  const { hiddenUscite, hiddenIncome, toggleUscite, toggleIncome } = useFilters()
  const [selected, setSelected] = useState(() => lastMonthIndex(year))
  const data = getYearData(year).map((p) => ({
    label: p.label,
    entrate: incomeTotal(p, hiddenIncome),
    uscite: usciteTotal(p, hiddenUscite),
  }))

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section className="flex min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Entrate e uscite per mese</h2>
          <span className="text-xs text-muted-foreground">Tocca un mese →</span>
        </div>
        <FilterBar
          hiddenIncome={hiddenIncome}
          onToggleIncome={toggleIncome}
          hiddenUscite={hiddenUscite}
          onToggleUscite={toggleUscite}
          className="shrink-0"
        />
        <ChartContainer config={config} className="aspect-auto min-h-0 w-full flex-1">
          <BarChart data={data} barGap={4} barCategoryGap="24%" className="cursor-pointer">
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
            <Bar
              dataKey="entrate"
              fill="var(--color-entrate)"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              activeBar={false}
              onClick={(_, index) => setSelected(index)}
            >
              <LabelList
                dataKey="entrate"
                position="top"
                offset={6}
                className="fill-muted-foreground"
                fontSize={10}
                formatter={(v) => eurCompact(Number(v))}
              />
            </Bar>
            <Bar
              dataKey="uscite"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              activeBar={false}
              onClick={(_, index) => setSelected(index)}
            >
              <LabelList
                dataKey="uscite"
                position="top"
                offset={6}
                className="fill-muted-foreground"
                fontSize={10}
                formatter={(v) => eurCompact(Number(v))}
              />
              {data.map((_, i) => (
                <Cell key={i} fill="var(--color-uscite)" fillOpacity={i === selected ? 1 : 0.4} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </section>
      <div className="min-h-0 overflow-y-auto">
        <MoversList year={year} monthIndex={selected} limit={8} dense />
      </div>
    </div>
  )
}

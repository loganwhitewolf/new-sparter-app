'use client'

// PROTOTYPE — wipe me. Variant D: grafico e movers separati in due tab, così ognuno
// prende tutta l'area sotto le KPI invece di impilarsi.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getYearData, getMovers, incomeTotal, usciteTotal, eur } from './mock-data'
import { MoversList, FilterBar, useFilters } from './shared'

const config = {
  entrate: { label: 'Entrate', color: 'var(--total-in)' },
  uscite: { label: 'Uscite', color: 'var(--total-out)' },
} satisfies ChartConfig

export function VariantD({ year }: { year: number }) {
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
  const moversCount = getMovers(year).rows.length

  return (
    <Tabs defaultValue="andamento" className="flex h-full min-h-0 flex-col gap-3">
      <TabsList className="shrink-0 self-start">
        <TabsTrigger value="andamento">Andamento</TabsTrigger>
        <TabsTrigger value="variazioni">Cambiamenti ({moversCount})</TabsTrigger>
      </TabsList>

      <TabsContent value="andamento" className="flex min-h-0 flex-1 flex-col gap-2">
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
      </TabsContent>

      <TabsContent value="variazioni" className="min-h-0 flex-1 overflow-y-auto">
        <MoversList year={year} />
      </TabsContent>
    </Tabs>
  )
}

'use client'

// PROTOTYPE — wipe me. Variant B: barre divergenti (entrate su / uscite giù dallo zero),
// il "net" mensile si legge a colpo d'occhio. Movers in colonna laterale.
import { useMemo } from 'react'
import { Bar, BarChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { getYearData, incomeTotal, usciteTotal, eur } from './mock-data'
import { MoversList, FilterBar, useFilters } from './shared'

const config = {
  entrate: { label: 'Entrate', color: 'var(--total-in)' },
  uscite: { label: 'Uscite', color: 'var(--total-out)' },
} satisfies ChartConfig

type Row = { label: string; entrate: number; uscite: number; netLabel: string }

function DivergingTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const net = row.entrate - Math.abs(row.uscite)
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{row.label}</p>
      <p className="text-total-in">Entrate {eur(row.entrate)}</p>
      <p className="text-total-out">Uscite {eur(Math.abs(row.uscite))}</p>
      <p className="mt-1 border-t pt-1">Bilancio {eur(net)}</p>
    </div>
  )
}

export function VariantB({ year }: { year: number }) {
  const { hiddenUscite, hiddenIncome, toggleUscite, toggleIncome } = useFilters()
  const data = useMemo<Row[]>(
    () =>
      getYearData(year).map((p) => {
        const uscite = usciteTotal(p, hiddenUscite)
        return { label: p.label, entrate: incomeTotal(p, hiddenIncome), uscite: -uscite, netLabel: '' }
      }),
    [year, hiddenUscite, hiddenIncome]
  )

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section className="flex min-h-0 flex-col gap-2">
        <h2 className="shrink-0 text-lg font-semibold">Entrate e uscite per mese</h2>
        <FilterBar
          hiddenIncome={hiddenIncome}
          onToggleIncome={toggleIncome}
          hiddenUscite={hiddenUscite}
          onToggleUscite={toggleUscite}
          className="shrink-0"
        />
        <ChartContainer config={config} className="aspect-auto min-h-0 w-full flex-1">
          <BarChart data={data} stackOffset="sign" barCategoryGap="22%">
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => eur(Math.abs(v))}
              width={64}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<DivergingTooltip />} />
            <Bar dataKey="entrate" fill="var(--color-entrate)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="uscite" fill="var(--color-uscite)" radius={[0, 0, 4, 4]} />
          </BarChart>
        </ChartContainer>
        <p className="shrink-0 text-xs text-muted-foreground">
          Sopra lo zero le entrate, sotto le uscite: la differenza visiva è il bilancio del mese.
        </p>
      </section>
      <div className="min-h-0 overflow-y-auto">
        <MoversList year={year} dense />
      </div>
    </div>
  )
}

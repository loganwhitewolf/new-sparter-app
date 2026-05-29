'use client'

// PROTOTYPE — wipe me. Variant C: niente grafico recharts — righe per mese con doppia
// mini-barra (entrate/uscite), scansionabile come una tabella. Movers promossi in cima.
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getYearData, incomeTotal, usciteTotal, eur } from './mock-data'
import { MoversList, FilterBar, useFilters } from './shared'

export function VariantC({ year }: { year: number }) {
  const { hiddenUscite, hiddenIncome, toggleUscite, toggleIncome } = useFilters()
  const rows = useMemo(
    () =>
      getYearData(year).map((p) => ({
        label: p.label,
        entrate: incomeTotal(p, hiddenIncome),
        uscite: usciteTotal(p, hiddenUscite),
      })),
    [year, hiddenUscite, hiddenIncome]
  )
  const max = Math.max(1, ...rows.flatMap((r) => [r.entrate, r.uscite]))

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <MoversList year={year} dense />
      </div>

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Entrate e uscite per mese</h2>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-total-in" /> Entrate
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-total-out" /> Uscite
            </span>
          </span>
        </div>
        <FilterBar
          hiddenIncome={hiddenIncome}
          onToggleIncome={toggleIncome}
          hiddenUscite={hiddenUscite}
          onToggleUscite={toggleUscite}
          className="shrink-0"
        />
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
          {rows.map((r, i) => {
            const net = r.entrate - r.uscite
            return (
              <div
                key={r.label}
                className={cn('grid grid-cols-[3rem_1fr_5rem] items-center gap-3 px-4 py-2.5', i > 0 && 'border-t')}
              >
                <span className="text-sm font-medium text-muted-foreground">{r.label}</span>
                <div className="space-y-1">
                  <Bar value={r.entrate} max={max} tone="in" />
                  <Bar value={r.uscite} max={max} tone="out" />
                </div>
                <span
                  className={cn(
                    'text-right font-mono text-sm tabular-nums',
                    net >= 0 ? 'text-total-in' : 'text-total-out'
                  )}
                  title="Bilancio del mese"
                >
                  {net >= 0 ? '+' : '−'}
                  {eur(Math.abs(net))}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Bar({ value, max, tone }: { value: number; max: number; tone: 'in' | 'out' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded-sm bg-muted">
        <div
          className={cn('h-full rounded-sm', tone === 'in' ? 'bg-total-in' : 'bg-total-out')}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {eur(value)}
      </span>
    </div>
  )
}

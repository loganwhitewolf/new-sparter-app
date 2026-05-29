'use client'

// PROTOTYPE — wipe me. Shared bits across the overview variants.
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  INCOME_COLORS,
  INCOME_LABELS,
  INCOME_TYPES,
  NATURE_COLORS,
  NATURE_LABELS,
  USCITE_NATURES,
  eur,
  eurSigned,
  getMovers,
  type IncomeType,
  type UsciteNature,
} from './mock-data'

function toggleSet<T>(prev: Set<T>, key: T): Set<T> {
  const next = new Set(prev)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export function useFilters() {
  const [hiddenUscite, setUscite] = useState<Set<UsciteNature>>(new Set())
  const [hiddenIncome, setIncome] = useState<Set<IncomeType>>(new Set())
  return {
    hiddenUscite,
    hiddenIncome,
    toggleUscite: (n: UsciteNature) => setUscite((p) => toggleSet(p, n)),
    toggleIncome: (t: IncomeType) => setIncome((p) => toggleSet(p, t)),
  }
}

function Chip({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
        active ? 'border-border' : 'border-dashed opacity-40'
      )}
    >
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </button>
  )
}

export function FilterBar({
  hiddenIncome,
  onToggleIncome,
  hiddenUscite,
  onToggleUscite,
  className,
}: {
  hiddenIncome: Set<IncomeType>
  onToggleIncome: (t: IncomeType) => void
  hiddenUscite: Set<UsciteNature>
  onToggleUscite: (n: UsciteNature) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-12 text-xs font-medium text-muted-foreground">Entrate</span>
        {INCOME_TYPES.map((t) => (
          <Chip
            key={t}
            label={INCOME_LABELS[t]}
            color={INCOME_COLORS[t]}
            active={!hiddenIncome.has(t)}
            onClick={() => onToggleIncome(t)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-12 text-xs font-medium text-muted-foreground">Uscite</span>
        {USCITE_NATURES.map((n) => (
          <Chip
            key={n}
            label={NATURE_LABELS[n]}
            color={NATURE_COLORS[n]}
            active={!hiddenUscite.has(n)}
            onClick={() => onToggleUscite(n)}
          />
        ))}
      </div>
    </div>
  )
}

export function MoversList({ year, dense = false }: { year: number; dense?: boolean }) {
  const { current, previous, rows } = getMovers(year)
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Variazioni mese-su-mese</h2>
        <span className="text-xs text-muted-foreground">
          {current} vs {previous} · solo uscite
        </span>
      </div>
      <ul className="divide-y rounded-lg border">
        {rows.map((r) => {
          const up = r.delta > 0
          const pct = r.prev > 0 ? Math.round((r.delta / r.prev) * 100) : null
          return (
            <li key={r.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-4 text-left hover:bg-muted/50',
                  dense ? 'py-2' : 'py-3'
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-mono text-sm',
                      up ? 'text-total-out' : 'text-total-in'
                    )}
                    aria-hidden
                  >
                    {up ? '▲' : '▼'}
                  </span>
                  <span className="text-sm font-medium">{r.name}</span>
                </span>
                <span className="flex items-center gap-2 font-mono text-sm tabular-nums">
                  <span className={up ? 'text-total-out' : 'text-total-in'}>{eurSigned(r.delta)}</span>
                  {pct !== null && (
                    <span className="text-xs text-muted-foreground">
                      ({pct > 0 ? '+' : ''}
                      {pct}%)
                    </span>
                  )}
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {eur(r.prev)}→{eur(r.curr)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

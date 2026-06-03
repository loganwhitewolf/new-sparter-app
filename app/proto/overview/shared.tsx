'use client'

// PROTOTYPE — wipe me. Shared bits across the overview variants.
import { useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  INCOME_COLORS,
  INCOME_DESCRIPTIONS,
  INCOME_LABELS,
  INCOME_TYPES,
  NATURE_COLORS,
  NATURE_DESCRIPTIONS,
  NATURE_LABELS,
  USCITE_NATURES,
  eur,
  getMovers,
  type IncomeType,
  type Mover,
  type UsciteNature,
} from './mock-data'

// Abbrev → full Italian month name, lowercased for inline copy ("rispetto a marzo").
const FULL_MONTH: Record<string, string> = {
  Gen: 'gennaio', Feb: 'febbraio', Mar: 'marzo', Apr: 'aprile', Mag: 'maggio', Giu: 'giugno',
  Lug: 'luglio', Ago: 'agosto', Set: 'settembre', Ott: 'ottobre', Nov: 'novembre', Dic: 'dicembre',
}
const fullMonth = (abbr: string) => FULL_MONTH[abbr] ?? abbr.toLowerCase()

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
  title,
}: {
  label: string
  color: string
  active: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
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

// In-context education for the jargon labels: an ⓘ that opens a legend popover.
// Discoverable + works on touch (unlike a hover-only title). Reused for Entrate and
// Uscite. See NOTES.md.
function Legend({
  ariaLabel,
  title,
  items,
}: {
  ariaLabel: string
  title: string
  items: { key: string; color: string; label: string; description: string }[]
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={ariaLabel}
        className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="mb-2 text-sm font-medium">{title}</p>
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.key} className="flex gap-2 text-xs">
              <span
                className="mt-0.5 inline-block size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: it.color }}
              />
              <span>
                <span className="font-medium">{it.label}</span> — {it.description}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
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
        <span className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
          Entrate
          <Legend
            ariaLabel="Cosa significano i tipi di entrata"
            title="Tipi di entrata"
            items={INCOME_TYPES.map((t) => ({
              key: t,
              color: INCOME_COLORS[t],
              label: INCOME_LABELS[t],
              description: INCOME_DESCRIPTIONS[t],
            }))}
          />
        </span>
        {INCOME_TYPES.map((t) => (
          <Chip
            key={t}
            label={INCOME_LABELS[t]}
            color={INCOME_COLORS[t]}
            active={!hiddenIncome.has(t)}
            onClick={() => onToggleIncome(t)}
            title={INCOME_DESCRIPTIONS[t]}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
          Uscite
          <Legend
            ariaLabel="Cosa significano le categorie di spesa"
            title="Categorie di spesa"
            items={USCITE_NATURES.map((n) => ({
              key: n,
              color: NATURE_COLORS[n],
              label: NATURE_LABELS[n],
              description: NATURE_DESCRIPTIONS[n],
            }))}
          />
        </span>
        {USCITE_NATURES.map((n) => (
          <Chip
            key={n}
            label={NATURE_LABELS[n]}
            color={NATURE_COLORS[n]}
            active={!hiddenUscite.has(n)}
            onClick={() => onToggleUscite(n)}
            title={NATURE_DESCRIPTIONS[n]}
          />
        ))}
      </div>
    </div>
  )
}

type ChangeRow = Mover & { delta: number }

// One mover row, framed as a human sentence: category + amount + direction.
// No raw "prev→curr" schema, no percentages. prev === 0 reads "spesa nuova".
function MoverRow({ row, tone, dense }: { row: ChangeRow; tone: 'up' | 'down'; dense: boolean }) {
  const abs = Math.abs(row.delta)
  const isNew = tone === 'up' && row.prev === 0
  const qualifier = isNew ? 'spesa nuova' : tone === 'up' ? 'in più' : 'in meno'
  const toneClass = tone === 'up' ? 'text-total-out' : 'text-total-in'
  return (
    <li>
      <button
        type="button"
        className={cn(
          'flex w-full items-baseline justify-between gap-3 px-4 text-left hover:bg-muted/50',
          dense ? 'py-2' : 'py-2.5'
        )}
      >
        <span className="text-sm font-medium">{row.name}</span>
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <span className={cn('text-sm font-semibold', toneClass)}>{eur(abs)}</span>
          <span className="text-xs text-muted-foreground">{qualifier}</span>
        </span>
      </button>
    </li>
  )
}

function MoverSection({
  title,
  rows,
  tone,
  dense,
}: {
  title: string
  rows: ChangeRow[]
  tone: 'up' | 'down'
  dense: boolean
}) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-1.5">
      <h3 className="px-1 text-sm font-semibold">{title}</h3>
      <ul className="divide-y rounded-lg border">
        {rows.map((r) => (
          <MoverRow key={r.id} row={r} tone={tone} dense={dense} />
        ))}
      </ul>
    </section>
  )
}

export function MoversList({
  year,
  monthIndex,
  limit = 5,
  dense = false,
  split = false,
}: {
  year: number
  monthIndex?: number
  limit?: number
  dense?: boolean
  // split = two side-by-side columns (wide panel, variant A); default = stacked (narrow, variant E)
  split?: boolean
}) {
  const { current, previous, rows } = getMovers(year, monthIndex, limit)
  const increases = rows.filter((r) => r.delta > 0)
  const decreases = rows.filter((r) => r.delta < 0)

  // First month of the data: no previous month to compare against.
  if (previous === '') {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        {fullMonth(current).replace(/^./, (c) => c.toUpperCase())} è il primo mese: nessun confronto disponibile.
      </p>
    )
  }

  if (increases.length === 0 && decreases.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Nessun cambiamento di rilievo a {fullMonth(current)} rispetto a {fullMonth(previous)}.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-muted-foreground">
        Spese di <span className="font-medium text-foreground">{fullMonth(current)}</span> rispetto a{' '}
        {fullMonth(previous)}
      </p>
      <div className={cn(split ? 'grid items-start gap-4 sm:grid-cols-2' : 'space-y-4')}>
        <MoverSection title="Dove hai speso di più" rows={increases} tone="up" dense={dense} />
        <MoverSection title="Dove hai risparmiato" rows={decreases} tone="down" dense={dense} />
      </div>
    </div>
  )
}

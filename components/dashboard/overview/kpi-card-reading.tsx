import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type Reading = { text: string; sentiment: 'good' | 'warn' | 'bad' | 'neutral' }

/**
 * Colour role for a KPI value. Drives both the text colour and the leading dot.
 * `allocation` uses an arbitrary var (no registered --color-* token); the rest map
 * to Tailwind utilities backed by --color-total-in/out and --foreground/--muted.
 */
export type ValueTone = 'in' | 'out' | 'allocation' | 'muted' | 'neutral'

/**
 * One stacked row in the card's primary area (260709-mf6). The emphasised row is the
 * recurring/structural value that "explains the trend" — rendered large with a coloured
 * dot; secondary rows are smaller and muted. A row without a label renders the value
 * alone, left-aligned (single-value cards like Accantonato).
 */
export type KpiComponentRow = {
  label?: string
  value: string
  tone: ValueTone
  emphasis?: boolean
  /**
   * `inline` (default): label left, value right — for additive breakdown rows that
   * read as a column of aligned amounts (Entrate, Uscite).
   * `stacked`: label above the value — for a standalone hero value whose label would
   * otherwise wrap beside a large number in a narrow card (Bilancio, Tasso risparmio).
   */
  layout?: 'inline' | 'stacked'
}

const sentimentColor: Record<Reading['sentiment'], string> = {
  good: 'text-total-in',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-total-out',
  neutral: 'text-muted-foreground',
}

const toneColor: Record<ValueTone, string> = {
  in: 'text-total-in',
  out: 'text-total-out',
  allocation: 'text-[var(--total-allocation)]',
  muted: 'text-muted-foreground',
  neutral: 'text-foreground',
}

const dotColor: Record<ValueTone, string> = {
  in: 'bg-total-in',
  out: 'bg-total-out',
  allocation: 'bg-[var(--total-allocation)]',
  muted: 'bg-muted-foreground',
  neutral: 'bg-foreground',
}

function formatDelta(delta: number): string {
  if (delta === 0) return '0%'
  const formatted = Number.isInteger(delta) ? String(delta) : delta.toFixed(1)
  return delta > 0 ? `+${formatted}%` : `${formatted}%`
}

function deltaColor(delta: number, goodWhenPositive: boolean): string {
  if (delta === 0) return 'text-muted-foreground'
  const isGood = goodWhenPositive ? delta > 0 : delta < 0
  return isGood ? 'text-total-in' : 'text-total-out'
}

function ComponentRow({ row }: { row: KpiComponentRow }) {
  const valueClass = cn(
    'font-mono tabular-nums',
    row.emphasis ? 'text-2xl font-semibold leading-none' : 'text-lg font-medium',
    toneColor[row.tone]
  )

  // Labelless row: single big value, left-aligned (Accantonato).
  if (!row.label) {
    return <p className={valueClass}>{row.value}</p>
  }

  const labelEl = (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {row.emphasis ? (
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotColor[row.tone])} aria-hidden="true" />
      ) : null}
      {row.label}
    </span>
  )

  // Stacked: label above the value — avoids the label wrapping beside a large number
  // in a narrow card (Bilancio, Tasso risparmio).
  if (row.layout === 'stacked') {
    return (
      <div className="flex flex-col gap-1">
        {labelEl}
        <span className={valueClass}>{row.value}</span>
      </div>
    )
  }

  // Inline (default): label left, value right.
  return (
    <div className="flex items-baseline justify-between gap-2">
      {labelEl}
      <span className={valueClass}>{row.value}</span>
    </div>
  )
}

/**
 * ReadingKpiCard — recurring-first KPI card (260709-mf6).
 *
 * Primary area: stacked component rows (recurring/structural emphasised in full colour).
 * Footer (below a divider): optional grand-total summary line, an optional reading, and
 * the optional YoY delta badge.
 */
export function ReadingKpiCard({
  label,
  components,
  total,
  delta,
  goodWhenPositive = true,
  reading,
  prevYear,
  className,
}: {
  label: string
  components: KpiComponentRow[]
  /** Grand-total summary line under the divider. Null for single-value cards. */
  total?: { value: string; tone: ValueTone } | null
  delta: number | null
  goodWhenPositive?: boolean
  reading?: Reading | null
  prevYear: number
  className?: string
}) {
  const hasFooter = Boolean(total) || Boolean(reading) || delta !== null

  return (
    <Card className={cn('min-h-32 rounded-lg py-0', className)}>
      <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
        <div className="space-y-2.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="space-y-2">
            {components.map((row, index) => (
              <ComponentRow key={row.label ?? `v-${index}`} row={row} />
            ))}
          </div>
        </div>

        {hasFooter ? (
          <div className="space-y-1.5">
            <div className="h-px bg-border" aria-hidden="true" />
            {total ? (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">Totale</span>
                <span className={cn('font-mono text-sm font-medium tabular-nums', toneColor[total.tone])}>
                  {total.value}
                </span>
              </div>
            ) : null}
            {reading ? (
              <p className={cn('text-xs font-medium leading-snug', sentimentColor[reading.sentiment])}>
                {reading.text}
              </p>
            ) : null}
            {delta !== null ? (
              <Badge
                variant="outline"
                className={cn('border-border bg-background font-mono', deltaColor(delta, goodWhenPositive))}
              >
                <span>{formatDelta(delta)}</span>
                <span className="hidden lg:inline"> vs {prevYear}</span>
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

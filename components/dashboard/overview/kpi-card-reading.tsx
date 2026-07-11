import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type Reading = { text: string; sentiment: 'good' | 'warn' | 'bad' | 'neutral' }

/**
 * Colour role for a KPI value. Drives the hero text colour and the bar fill.
 * `allocation` uses an arbitrary var (no registered --color-* token); the rest map
 * to Tailwind utilities backed by --color-total-in/out and --foreground/--muted.
 */
export type ValueTone = 'in' | 'out' | 'allocation' | 'muted' | 'neutral'

/**
 * One segment of a composition bar (260709-…, option B). `value` is the proportion
 * weight (raw amount); `display` is the pre-formatted amount shown on hover. `step` picks
 * the shade in the tone ramp: 0 (default) is the solid, dominant segment; 1+ are lighter.
 */
export type BarSegment = {
  label: string
  value: number
  display: string
  tone: ValueTone
  step?: number
}

/**
 * The card's single glanceable visual. `composition` is a stacked proportion bar
 * (Entrate/Uscite mix); `progress` is a value-vs-target bar with a tick (Tasso risparmio).
 */
export type CardBar =
  | { kind: 'composition'; segments: BarSegment[] }
  | { kind: 'progress'; value: number; target: number; tone: ValueTone }

const sentimentColor: Record<Reading['sentiment'], string> = {
  good: 'text-total-in',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-total-out',
  neutral: 'text-muted-foreground',
}

const toneText: Record<ValueTone, string> = {
  in: 'text-total-in',
  out: 'text-total-out',
  allocation: 'text-[var(--total-allocation)]',
  muted: 'text-muted-foreground',
  neutral: 'text-foreground',
}

/**
 * Bar fill ramp per tone: index 0 = solid (dominant segment), 1+ = progressively lighter
 * shades of the SAME hue. A single-hue ramp keeps the emphasised block dominant instead of
 * a noisy multi-colour bar — the mix reads as "how much is essential/recurring".
 */
const barRamp: Record<ValueTone, string[]> = {
  in: ['bg-total-in', 'bg-total-in/35', 'bg-total-in/20'],
  out: ['bg-total-out', 'bg-total-out/55', 'bg-total-out/30'],
  allocation: ['bg-[var(--total-allocation)]', 'bg-[var(--total-allocation)]/40', 'bg-[var(--total-allocation)]/20'],
  muted: ['bg-muted-foreground', 'bg-muted-foreground/40', 'bg-muted-foreground/20'],
  neutral: ['bg-foreground', 'bg-foreground/40', 'bg-foreground/20'],
}

function barShade(tone: ValueTone, step = 0): string {
  const ramp = barRamp[tone]
  return ramp[Math.min(step, ramp.length - 1)]
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

/**
 * Hero-value size step-down: a large number must never wrap to a second line, so long
 * values shrink the type instead of breaking. Thresholds tuned for the ~1/5-width card.
 */
function heroSizeClass(value: string): string {
  const len = value.length
  if (len <= 10) return 'text-2xl'
  if (len <= 13) return 'text-xl'
  if (len <= 16) return 'text-lg'
  return 'text-base'
}

/** Compact YoY delta chip (top-right). Arrow + signed %, coloured by good/bad direction. */
function DeltaChip({
  delta,
  goodWhenPositive,
  prevYear,
}: {
  delta: number
  goodWhenPositive: boolean
  prevYear: number
}) {
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : ''
  return (
    <span
      className={cn('shrink-0 font-mono text-xs font-medium tabular-nums', deltaColor(delta, goodWhenPositive))}
      title={`vs ${prevYear}`}
    >
      {arrow ? `${arrow} ` : ''}
      {formatDelta(delta)}
    </span>
  )
}

/** Stacked composition bar + a single dominant-segment legend line (rest on hover). */
function CompositionBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  // Dominant = largest segment (not first): under dashboard-wide filtering the first
  // key can be excluded, so position no longer implies dominance (260711-gfd).
  const dominant = segments.reduce<BarSegment | null>(
    (best, s) => (best === null || s.value > best.value ? s : best),
    null
  )
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {segments.map((s) => (
          <div
            key={s.label}
            className={barShade(s.tone, s.step)}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.display}`}
          />
        ))}
      </div>
      {dominant ? (
        <p className="flex items-center gap-1.5 text-xs">
          <span
            className={cn('inline-block size-2 shrink-0 rounded-full', barShade(dominant.tone, dominant.step))}
            aria-hidden="true"
          />
          <span className="min-w-0 truncate font-medium text-foreground">{dominant.label}</span>
          <span className="shrink-0 text-muted-foreground">{Math.round((dominant.value / total) * 100)}%</span>
        </p>
      ) : null}
    </div>
  )
}

/** Value-vs-target progress bar with a tick at the target (Tasso risparmio). */
function ProgressBar({ value, target, tone }: { value: number; target: number; tone: ValueTone }) {
  // Scale so both the value and the target tick stay on-bar with headroom.
  const max = Math.max(target * 1.4, value + 4, 1)
  const fillPct = Math.max(0, Math.min(100, (value / max) * 100))
  const tickPct = Math.max(0, Math.min(100, (target / max) * 100))
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full', barShade(tone, 0))} style={{ width: `${fillPct}%` }} />
      <div
        className="absolute top-0 h-full w-0.5 bg-foreground/50"
        style={{ left: `${tickPct}%` }}
        title={`Obiettivo ${target}%`}
        aria-hidden="true"
      />
    </div>
  )
}

/**
 * ReadingKpiCard — composition-first KPI card (option B, 260710-…).
 *
 * Anatomy: label + compact YoY delta chip (header) · headline hero value · one glanceable
 * visual (composition bar with dominant legend, or a value-vs-target progress bar) · an
 * optional reading. Diagnostic cards (Bilancio/Accantonato) carry a hero + reading only.
 */
export function ReadingKpiCard({
  label,
  hero,
  bar,
  reading,
  delta,
  goodWhenPositive = true,
  prevYear,
  className,
}: {
  label: string
  hero: { value: string; tone: ValueTone }
  bar?: CardBar | null
  reading?: Reading | null
  delta: number | null
  goodWhenPositive?: boolean
  prevYear: number
  className?: string
}) {
  return (
    <Card className={cn('min-h-32 rounded-lg py-0', className)}>
      <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-muted-foreground">{label}</p>
          {delta !== null ? (
            <DeltaChip delta={delta} goodWhenPositive={goodWhenPositive} prevYear={prevYear} />
          ) : null}
        </div>

        <div className="space-y-2.5">
          <p
            className={cn(
              'font-mono font-semibold leading-none tabular-nums whitespace-nowrap',
              heroSizeClass(hero.value),
              toneText[hero.tone]
            )}
          >
            {hero.value}
          </p>

          {bar?.kind === 'composition' ? <CompositionBar segments={bar.segments} /> : null}
          {bar?.kind === 'progress' ? <ProgressBar value={bar.value} target={bar.target} tone={bar.tone} /> : null}

          {reading ? (
            <p className={cn('text-xs font-medium leading-snug', sentimentColor[reading.sentiment])}>
              {reading.text}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

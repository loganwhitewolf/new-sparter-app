import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
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
  /** Full nature name — the accessible label and the legend/hover tooltip title. */
  label: string
  value: number
  display: string
  tone: ValueTone
  step?: number
  /** Legend glyph — the shared nature icon (also on the filter chips). */
  icon?: LucideIcon
  /** Legend icon colour — the nature's identity colour (matches the chip). */
  iconColor?: string
}

/**
 * The card's single glanceable visual. `composition` is a stacked proportion bar
 * (Entrate/Uscite mix); `sparkline` is a per-month trend line (Bilancio trajectory).
 */
export type CardBar =
  | { kind: 'composition'; segments: BarSegment[] }
  | { kind: 'sparkline'; points: number[]; tone: ValueTone }

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

/**
 * Stacked composition bar + a compact legend showing EVERY included segment as a
 * coloured nature icon + its share (260711-gfd follow-up). The icon glyph is the shared
 * nature symbol (also on the filter chips); the full name + amount live in the hover
 * title and an sr-only label so icon-only stays accessible.
 */
function CompositionBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
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
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {segments.map((s) => {
          const pct = Math.round((s.value / total) * 100)
          const Icon = s.icon
          return (
            <li
              key={s.label}
              className="flex items-center gap-1 text-xs tabular-nums"
              title={`${s.label} · ${pct}% · ${s.display}`}
            >
              {Icon ? (
                <Icon className="size-3.5 shrink-0" style={{ color: s.iconColor }} aria-hidden="true" />
              ) : null}
              <span className="text-muted-foreground">{pct}%</span>
              <span className="sr-only">{s.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Compact per-month trend line (Bilancio trajectory). The domain always includes zero so a
 * dashed zero baseline shows which months were positive (above) vs negative (below); the
 * polyline is tone-coloured via currentColor. Needs ≥2 points; renders nothing otherwise
 * (e.g. a single-month year). Decorative — the hero + reading carry the meaning.
 */
function Sparkline({ points, tone }: { points: number[]; tone: ValueTone }) {
  if (points.length < 2) return null
  const w = 100
  const h = 24
  // Anchor the scale on zero so the baseline is always meaningful (positive vs negative).
  const domainMin = Math.min(0, ...points)
  const domainMax = Math.max(0, ...points)
  const range = domainMax - domainMin || 1
  const step = w / (points.length - 1)
  const y = (v: number) => h - ((v - domainMin) / range) * h
  const line = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')
  const yZero = y(0).toFixed(1)
  return (
    <span className={cn('block', toneText[tone])} title="Andamento del bilancio mese per mese">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-full" preserveAspectRatio="none" aria-hidden="true">
        <line
          x1="0"
          y1={yZero}
          x2={w}
          y2={yZero}
          className="stroke-muted-foreground/40"
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  )
}

/**
 * ReadingKpiCard — composition-first KPI card (option B, 260710-…).
 *
 * Anatomy: label + compact YoY delta chip (header) · headline hero value · one glanceable
 * visual (composition bar with icon legend, or a per-month sparkline) · an optional
 * reading. Accantonato carries a hero + reading only.
 *
 * Content is TOP-aligned (not spread) so the hero value sits at the same height on every
 * card in the row — a card without a bar (Bilancio/Accantonato) lets its reading fall into
 * the bar's slot instead of dropping the hero to the bottom.
 */
export function ReadingKpiCard({
  label,
  hero,
  bar,
  caption,
  reading,
  delta,
  goodWhenPositive = true,
  prevYear,
  className,
}: {
  label: string
  hero: { value: string; tone: ValueTone }
  bar?: CardBar | null
  /** Optional line under the visual (e.g. Bilancio's "Tasso N% · obiettivo 20%"). */
  caption?: ReactNode
  reading?: Reading | null
  delta: number | null
  goodWhenPositive?: boolean
  prevYear: number
  className?: string
}) {
  return (
    <Card className={cn('min-h-32 rounded-lg py-0', className)}>
      <CardContent className="flex h-full flex-col gap-3 p-4">
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
          {bar?.kind === 'sparkline' ? <Sparkline points={bar.points} tone={bar.tone} /> : null}

          {caption ? <div>{caption}</div> : null}

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

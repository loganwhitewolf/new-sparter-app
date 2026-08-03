import type { CategoryDetailYearWindowData } from '@/lib/dal/category-detail-year-window'
import { computeComparison, resolveComparisonJudgement } from '@/lib/services/pace-and-projection'
import { toDecimal } from '@/lib/utils/decimal'

type Props = { data: CategoryDetailYearWindowData }

type ChartBar = {
  yearMonth: string
  label: string
  delta: string | null
}

const currencyFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

function formatAmount(value: string | number): string {
  const amount = typeof value === 'number' ? value : Number(value)
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

/** D-09: magnitude + word, never a sign glyph — used for both the legend and every bar's tooltip. */
function formatDeltaWords(delta: string, monthLabel: string, previousYearLabel: string): string {
  const decimalDelta = toDecimal(delta)
  const magnitude = formatAmount(decimalDelta.abs().toFixed(2))

  if (decimalDelta.isZero()) {
    return `${magnitude} invariato rispetto a ${monthLabel} ${previousYearLabel}`
  }
  const word = decimalDelta.isPositive() ? 'in più' : 'in meno'
  return `${magnitude} ${word} di ${monthLabel} ${previousYearLabel}`
}

function legendText(direction: 'in' | 'out', previousYearLabel: string): string {
  return direction === 'in'
    ? `Sopra la linea: incassato più che nel ${previousYearLabel}. Sotto: incassato meno.`
    : `Sopra la linea: speso più che nel ${previousYearLabel}. Sotto: speso meno.`
}

function barFill(delta: string | null, direction: 'in' | 'out'): string {
  if (delta === null) return 'var(--muted-foreground)'
  switch (resolveComparisonJudgement(delta, direction)) {
    case 'better':
      return 'var(--total-in)'
    case 'worse':
      return 'var(--total-out)'
    default:
      return 'var(--muted-foreground)'
  }
}

const width = 640
const height = 220
const paddingX = 28
const paddingY = 24
const baselineY = height / 2
const maxAmplitude = height / 2 - paddingY
const MIN_BAR_HEIGHT = 2

/**
 * Builds the chart's own bar series from `data.current.months`/`data.previousYear` — never a
 * second query (D-08): the SAME series the table renders. `delta` is `null` (a flat zero-height
 * marker, never omitted) whenever the previous year is unavailable, or either side's month has
 * no real amount — never a fabricated '0.00' comparison, per D-10's "never zero-fill an uncovered
 * month" precedent.
 */
function buildBars(data: CategoryDetailYearWindowData): ChartBar[] {
  return data.current.months.map((month, index): ChartBar => {
    if (data.previousYear.status !== 'available') {
      return { yearMonth: month.yearMonth, label: month.label, delta: null }
    }
    const previousMonth = data.previousYear.series.months[index]
    if (month.amount === null || !previousMonth || previousMonth.amount === null) {
      return { yearMonth: month.yearMonth, label: month.label, delta: null }
    }
    return {
      yearMonth: month.yearMonth,
      label: month.label,
      delta: computeComparison(month.amount, previousMonth.amount),
    }
  })
}

export function CategoryDetailDifferenceChart({ data }: Props) {
  const direction = data.category?.type ?? 'out'
  const [rowHeadYear] = data.window.from.split('-')
  const previousYearLabel = String(Number(rowHeadYear) - 1)
  const bars = buildBars(data)

  const maxAbsDelta = bars.reduce((max, bar) => {
    if (bar.delta === null) return max
    const abs = toDecimal(bar.delta).abs().toNumber()
    return abs > max ? abs : max
  }, 0)

  const innerWidth = width - paddingX * 2
  const step = bars.length > 0 ? innerWidth / bars.length : innerWidth
  const barWidth = Math.max(step * 0.55, 4)

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Differenza mese per mese rispetto al ${previousYearLabel}`}
          className="min-h-[220px] w-full min-w-[520px] overflow-visible"
          focusable="false"
        >
          <line x1={paddingX} x2={width - paddingX} y1={baselineY} y2={baselineY} stroke="var(--border)" strokeWidth="1" />
          {bars.map((bar, index) => {
            const x = paddingX + step * (index + 0.5) - barWidth / 2
            const magnitude = bar.delta !== null ? toDecimal(bar.delta).abs().toNumber() : 0
            const rawBarHeight = maxAbsDelta > 0 ? (magnitude / maxAbsDelta) * maxAmplitude : 0
            const barHeight = Math.max(rawBarHeight, MIN_BAR_HEIGHT)
            const isNegative = bar.delta !== null && toDecimal(bar.delta).isNegative()
            const y = isNegative ? baselineY : baselineY - barHeight
            const fill = barFill(bar.delta, direction)
            const tooltip =
              bar.delta !== null
                ? formatDeltaWords(bar.delta, bar.label, previousYearLabel)
                : `Nessun confronto disponibile per ${bar.label}`

            return (
              <g key={bar.yearMonth}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx="2" fill={fill}>
                  <title>{tooltip}</title>
                </rect>
                <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {bar.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="text-xs text-muted-foreground">{legendText(direction, previousYearLabel)}</p>
    </div>
  )
}

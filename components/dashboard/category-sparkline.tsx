'use client'

import { resolveBarFillStyle } from '@/components/dashboard/category-bar-fill'
import type { BarFillState } from '@/components/dashboard/category-bar-fill'
import type { CategorySparklinePoint } from '@/lib/dal/dashboard'

type PointState = BarFillState

type Props = {
  points: CategorySparklinePoint[]
  type: 'in' | 'out' | 'allocation'
  label?: string
  pointStates?: PointState[]
  estimatedHeightHint?: string | null
}

type ChartPoint = {
  x: number
  y: number
}

const width = 112
const height = 36
const padding = 3

// D-09: the allocation direction admits net-divestment months (negative amounts) — the
// clamp that used to flatten them to zero is removed. 'in'/'out' callers are unaffected: their
// query-level abs(sum(...)) never produces a negative value in the first place.
function parseAmount(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildPolylinePoints(points: CategorySparklinePoint[]): ChartPoint[] {
  const amounts = points.map((point) => parseAmount(point.amount))

  if (amounts.length === 0) {
    return []
  }

  const max = Math.max(...amounts)
  const min = Math.min(...amounts)
  const range = max - min
  const step = amounts.length > 1 ? (width - padding * 2) / (amounts.length - 1) : 0

  return amounts.map((amount, index) => {
    const normalized = range === 0 ? 0.5 : (amount - min) / range

    return {
      x: amounts.length === 1 ? width / 2 : padding + step * index,
      y: height - padding - normalized * (height - padding * 2),
    }
  })
}

// WR-02 gap-closure (83-05): whenever estimatedHeightHint is null, this fallback becomes the
// ONLY positive reference magnitude among referenceMagnitudes, so it always normalizes to 100%
// of itself regardless of its exact value — it exists solely to satisfy resolveBarFillStyle's own
// "never a flat/zero-height bar" contract above for the null-hint case.
const ESTIMATED_HEIGHT_FALLBACK = 1

/**
 * Resolves the reference magnitude an 'estimated' (future) bar normalizes against. When
 * estimatedHeightHint (the category's pace) is available, behavior is byte-identical to before
 * this fix. When it is null (insufficient pace-eligible Covered Months), falls back first to the
 * series' own observed covered/current magnitude, then to a fixed positive constant — never 0.
 */
function resolveEstimatedReference(
  points: CategorySparklinePoint[],
  pointStates: PointState[],
  estimatedHeightHint?: string | null
): number {
  if (estimatedHeightHint != null) {
    return Number(estimatedHeightHint)
  }

  const observedMagnitudes = points
    .map((point, index) => ({ state: pointStates[index], amount: point.amount }))
    .filter((entry) => entry.state !== 'estimated')
    .map((entry) => Math.abs(parseAmount(entry.amount)))
  const observedMax = observedMagnitudes.length > 0 ? Math.max(...observedMagnitudes) : 0

  return observedMax > 0 ? observedMax : ESTIMATED_HEIGHT_FALLBACK
}

export function CategorySparkline({
  points,
  type,
  label = 'Andamento mensile',
  pointStates,
  estimatedHeightHint,
}: Props) {
  const color =
    type === 'in' ? 'var(--total-in)' : type === 'allocation' ? 'var(--total-allocation)' : 'var(--total-out)'

  // Path B (D-06/CLIST-06): 4-state bar rendering, opted into only when pointStates is provided
  // and matches points 1:1. The single-point case ALWAYS stays on Path A's circle branch below,
  // regardless of pointStates, so CLIST-06's one-Covered-Month series never falls through here.
  const useBarRendering = points.length > 1 && pointStates !== undefined && pointStates.length === points.length

  if (useBarRendering && pointStates) {
    const estimatedReference = resolveEstimatedReference(points, pointStates, estimatedHeightHint)
    const referenceMagnitudes = points.map((point, index) => {
      const state = pointStates[index]
      const reference = state === 'estimated' ? estimatedReference : parseAmount(point.amount)
      return Math.abs(reference)
    })
    const max = Math.max(...referenceMagnitudes)

    return (
      <div role="img" aria-label={label} className="flex h-9 w-28 shrink-0 items-end gap-[2px]">
        {points.map((point, index) => {
          const state = pointStates[index]
          const rawAmount = parseAmount(point.amount)
          const heightPercent = max === 0 ? 0 : (referenceMagnitudes[index] / max) * 100
          const fillStyle = resolveBarFillStyle(state, heightPercent, color)
          // Negative-domain backstop (D-09/UI-SPEC E2): a divestment month must never read
          // identically to a same-height positive month. The marker sits on the track container,
          // always opacity 1, independent of the fill's own state opacity above.
          const isNegative = (state === 'covered' || state === 'current') && rawAmount < 0

          return (
            <div
              key={point.month}
              className="flex h-full flex-1 items-end"
              style={isNegative ? { borderTop: `2px solid ${color}`, opacity: 1 } : undefined}
            >
              <div className="w-full rounded-[1px]" style={fillStyle} />
            </div>
          )
        })}
      </div>
    )
  }

  const chartPoints = buildPolylinePoints(points)
  const path = chartPoints.map((point) => `${point.x},${point.y}`).join(' ')
  const isEmpty = chartPoints.length === 0

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="h-9 w-28 shrink-0 overflow-visible"
      focusable="false"
    >
      <line
        x1={padding}
        x2={width - padding}
        y1={height / 2}
        y2={height / 2}
        stroke="var(--border)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      {!isEmpty ? (
        <>
          <polyline
            points={path}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.25"
            vectorEffect="non-scaling-stroke"
          />
          {chartPoints.length === 1 ? (
            <circle cx={chartPoints[0].x} cy={chartPoints[0].y} r="2.5" fill={color} />
          ) : null}
        </>
      ) : null}
    </svg>
  )
}

'use client'

import type { CategorySparklinePoint } from '@/lib/dal/dashboard'

type Props = {
  points: CategorySparklinePoint[]
  type: 'in' | 'out'
  label?: string
}

type ChartPoint = {
  x: number
  y: number
}

const width = 112
const height = 36
const padding = 3

function parseAmount(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0
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

export function CategorySparkline({ points, type, label = 'Andamento mensile' }: Props) {
  const chartPoints = buildPolylinePoints(points)
  const color = type === 'in' ? 'var(--total-in)' : 'var(--total-out)'
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

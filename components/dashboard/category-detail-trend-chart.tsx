import { cn } from '@/lib/utils'
import type { CategoryDetailTrendPoint } from '@/lib/dal/dashboard'

type Props = {
  data: CategoryDetailTrendPoint[]
  type?: 'in' | 'out'
  label?: string
}

type ChartPoint = CategoryDetailTrendPoint & {
  value: number
}

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

const width = 640
const height = 220
const paddingX = 28
const paddingY = 20

function parseAmount(value: string): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.max(0, Math.abs(amount)) : 0
}

function formatAmount(value: string | number): string {
  const amount = typeof value === 'number' ? value : parseAmount(value)
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function buildChartPoints(data: CategoryDetailTrendPoint[]): Array<ChartPoint & { x: number; y: number }> {
  const points = data.map((point) => ({ ...point, value: parseAmount(point.amount) }))
  const max = Math.max(...points.map((point) => point.value), 0)
  const innerWidth = width - paddingX * 2
  const innerHeight = height - paddingY * 2
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0

  return points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? width / 2 : paddingX + step * index,
    y: max === 0 ? height - paddingY - innerHeight / 2 : height - paddingY - (point.value / max) * innerHeight,
  }))
}

function hasVisibleTrend(data: CategoryDetailTrendPoint[]): boolean {
  return data.some((point) => parseAmount(point.amount) > 0 || point.count > 0)
}

export function CategoryDetailTrendChart({
  data,
  type = 'out',
  label = 'Andamento mensile categoria',
}: Props) {
  if (data.length === 0 || !hasVisibleTrend(data)) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium">Nessun andamento disponibile</p>
          <p className="text-sm text-muted-foreground">
            Non ci sono movimenti per questa categoria nel periodo selezionato.
          </p>
        </div>
      </div>
    )
  }

  const points = buildChartPoints(data)
  const path = points.map((point) => `${point.x},${point.y}`).join(' ')
  const color = type === 'in' ? 'var(--total-in)' : 'var(--total-out)'

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={label}
          className="min-h-[220px] w-full min-w-[520px] overflow-visible"
          focusable="false"
        >
          <line
            x1={paddingX}
            x2={width - paddingX}
            y1={height - paddingY}
            y2={height - paddingY}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <polyline
            points={path}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point) => (
            <g key={point.month}>
              <circle cx={point.x} cy={point.y} r="4" fill={color} />
              <text
                x={point.x}
                y={height - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {point.label}
              </text>
              <title>{`${point.label}: ${formatAmount(point.value)} · ${point.count} movimenti`}</title>
            </g>
          ))}
        </svg>
      </div>

      <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3" aria-label="Dettaglio andamento mensile">
        {data.map((point) => (
          <li
            key={point.month}
            className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
          >
            <span className="truncate">{point.label}</span>
            <span className={cn('shrink-0 font-mono text-xs tabular-nums', type === 'in' ? 'text-total-in' : 'text-total-out')}>
              {formatAmount(point.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

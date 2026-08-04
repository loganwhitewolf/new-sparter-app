import { resolveBarFillStyle } from '@/components/dashboard/category-sparkline'
import type {
  CategoryDetailWindowMonth,
  CategoryDetailYearWindowData,
} from '@/lib/dal/category-detail-year-window'
import { toDecimal } from '@/lib/utils/decimal'

type Props = { data: CategoryDetailYearWindowData }

const currencyFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

function formatAmount(value: string | number): string {
  const amount = typeof value === 'number' ? value : toDecimal(value).toNumber()
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

/**
 * CDET-VIEW-01: the compact chart's own tooltip text, mirroring the table's cell content — never
 * a delta/comparison figure (that vocabulary is retired from the chart, confined to the table).
 */
function buildTooltip(month: CategoryDetailWindowMonth, year: number): string {
  if (month.state === 'uncovered') {
    return `${month.label}: non importato`
  }
  if (month.state === 'estimated') {
    return `${month.label} ${year}: ${formatAmount(month.amount ?? '0')} (proiezione)`
  }
  return `${month.label} ${year}: ${formatAmount(month.amount ?? '0')}`
}

/**
 * CDET-VIEW-01: the category detail page's top chart — compact monthly-amounts bars, reusing the
 * categories list sparkline's own per-state bar styling (resolveBarFillStyle) instead of
 * re-deriving fill/hatch logic. Renders exactly one column per `data.current.months` entry,
 * driven by the SAME series the table below renders (never a second query). Deliberately carries
 * zero delta/comparison rendering — that vocabulary is retired from the chart entirely
 * (CDET-VIEW-01) and confined to CategoryDetailTable.
 *
 * Deliberately NOT carried over from the sparkline's own negative-amount border marker: this
 * page's categories are always 'in'/'out' and a negative monthly total is a rare edge case, out
 * of scope for this rework — an explicit, not accidental, omission.
 */
export function CategoryDetailAmountsChart({ data }: Props) {
  const direction = data.category?.type ?? 'out'
  const color = direction === 'in' ? 'var(--total-in)' : 'var(--total-out)'
  const months = data.current.months

  const maxAbsAmount = months.reduce((max, month) => {
    if (month.amount === null) return max
    const abs = Math.abs(toDecimal(month.amount).toNumber())
    return abs > max ? abs : max
  }, 0)

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
      <div role="img" aria-label={`Andamento mensile ${data.category?.name ?? ''}`} className="flex h-16 items-end gap-1">
        {months.map((month) => {
          const heightPercent =
            maxAbsAmount > 0 && month.amount !== null
              ? (Math.abs(toDecimal(month.amount).toNumber()) / maxAbsAmount) * 100
              : 0
          const fillStyle = resolveBarFillStyle(month.state, heightPercent, color)

          return (
            <div
              key={month.yearMonth}
              data-month={month.yearMonth}
              data-state={month.state}
              title={buildTooltip(month, data.year)}
              className="flex h-full flex-1 items-end"
            >
              <div className="w-full rounded-[1px]" style={fillStyle} />
            </div>
          )
        })}
      </div>
      <div className="flex gap-1">
        {months.map((month) => (
          <span key={month.yearMonth} className="flex-1 text-center text-[10px] text-muted-foreground">
            {month.label}
          </span>
        ))}
      </div>
    </div>
  )
}

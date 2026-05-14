import { cn } from '@/lib/utils'
import type { CategoryDetailSubcategory } from '@/lib/dal/dashboard'

type Props = {
  subcategories: CategoryDetailSubcategory[]
  type?: 'in' | 'out'
}

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

function formatAmount(value: string): string {
  const amount = Number(value)
  return currencyFormatter.format(Number.isFinite(amount) ? Math.abs(amount) : 0)
}

function safePercentage(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 100)) : 0
}

function movementLabel(count: number): string {
  return count === 1 ? '1 movimento' : `${count} movimenti`
}

export function CategorySubcategoryBreakdown({ subcategories, type = 'out' }: Props) {
  if (subcategories.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium">Nessuna sottocategoria nel periodo</p>
          <p className="text-sm text-muted-foreground">
            Aggiungi o categorizza movimenti per vedere la distribuzione interna.
          </p>
        </div>
      </div>
    )
  }

  const barColor = type === 'in' ? 'bg-[var(--total-in)]' : 'bg-[var(--total-out)]'

  return (
    <ul className="grid gap-3" aria-label="Ripartizione sottocategorie">
      {subcategories.map((subcategory) => {
        const percentage = safePercentage(subcategory.percentage)
        const count = Number.isFinite(subcategory.count) ? Math.max(0, subcategory.count) : 0

        return (
          <li key={subcategory.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground" title={subcategory.name}>
                    {subcategory.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {movementLabel(count)} · {percentage}% del totale categoria
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  {formatAmount(subcategory.amount)}
                </p>
              </div>

              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${percentage}% del totale categoria`}
              >
                <div className={cn('h-full rounded-full', barColor)} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

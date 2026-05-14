'use client'

import Link from 'next/link'
import { CategorySparkline } from '@/components/dashboard/category-sparkline'
import { buildDashboardCategoryDetailHref } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { CategoryRankingItem } from '@/lib/dal/dashboard'
import type { DashboardPreset } from '@/lib/validations/dashboard'

type Props = {
  data: CategoryRankingItem[]
  preset: DashboardPreset
  type: 'in' | 'out'
  defaultPreset?: DashboardPreset
}

const amountFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

function formatAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function movementLabel(count: number): string {
  return count === 1 ? '1 movimento' : `${count} movimenti`
}

export function CategoryRankingList({
  data,
  preset,
  type,
  defaultPreset = 'this-year',
}: Props) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium">Nessuna categoria nel periodo selezionato</p>
          <p className="text-sm text-muted-foreground">
            Cambia periodo o tipo movimento per visualizzare la classifica.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ol className="grid gap-3" aria-label="Classifica categorie">
      {data.map((category, index) => {
        const href = buildDashboardCategoryDetailHref(category.id, {
          preset,
          type,
          defaultPreset,
        })
        const percentage = Math.max(0, Math.min(category.percentage, 100))
        const barColor = type === 'in' ? 'bg-[var(--total-in)]' : 'bg-[var(--total-out)]'

        return (
          <li
            key={category.id}
            className="group rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/50"
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0 space-y-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={href}
                      className="block truncate text-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${category.name}: apri dettaglio categoria`}
                      title={category.name}
                    >
                      {category.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {movementLabel(category.count)} · {category.percentage}% del totale
                    </p>
                  </div>
                </div>

                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${category.percentage}% del totale`}
                >
                  <div
                    className={cn('h-full rounded-full', barColor)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold tabular-nums">
                    {formatAmount(category.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">Totale</p>
                </div>
                <CategorySparkline
                  points={category.sparkline}
                  type={type}
                  label={`Andamento mensile ${category.name}`}
                />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

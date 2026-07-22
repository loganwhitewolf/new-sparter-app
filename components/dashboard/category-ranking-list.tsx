'use client'

import Link from 'next/link'
import { CategorySparkline } from '@/components/dashboard/category-sparkline'
import { DeviationBadge } from '@/components/dashboard/deviation-badge'
import { buildDashboardCategoryDetailHref } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { toDecimal } from '@/lib/utils/decimal'
import type { CategoryRankingItem, DeviationData } from '@/lib/dal/dashboard'
import type { DashboardPreset, DashboardSort } from '@/lib/validations/dashboard'
import type { DeviationResult } from '@/lib/utils/dashboard'

type Props = {
  data: CategoryRankingItem[]
  preset: DashboardPreset
  type: 'in' | 'out'
  defaultPreset?: DashboardPreset
  sort?: DashboardSort
  deviations?: Map<number, DeviationData>
  tagId?: number
}

function deviationSortKey(item: CategoryRankingItem, deviations?: Map<number, DeviationData>): number {
  if (!deviations) return 3
  const entry = deviations.get(item.id)
  if (entry === undefined || entry.deviation === null) return entry?.isNew ? 1 : 2
  return 0
}

function compareItems(
  a: CategoryRankingItem,
  b: CategoryRankingItem,
  sort: DashboardSort,
  deviations?: Map<number, DeviationData>
): number {
  if (sort !== 'deviation' || !deviations) return 0
  const ka = deviationSortKey(a, deviations)
  const kb = deviationSortKey(b, deviations)
  if (ka !== kb) return ka - kb
  if (ka === 0) {
    const da = Math.abs(deviations.get(a.id)!.deviation as number)
    const db = Math.abs(deviations.get(b.id)!.deviation as number)
    if (da !== db) return db - da
  }
  return toDecimal(b.amount).comparedTo(toDecimal(a.amount))
}

function getDeviationValue(id: number, deviations?: Map<number, DeviationData>): DeviationResult {
  if (!deviations) return null
  const entry = deviations.get(id)
  if (!entry) return null
  if (entry.isNew) return 'new'
  return entry.deviation
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
  sort = 'amount',
  deviations,
  tagId,
}: Props) {
  const sortedData = sort === 'deviation' && deviations
    ? [...data].sort((a, b) => compareItems(a, b, sort, deviations))
    : data

  if (sortedData.length === 0) {
    // 68-06: a tag filter active with zero matching transactions in the browsed period
    // surfaces distinct copy (68-UI-SPEC.md Copywriting Contract) rather than the
    // generic "no categories in this period" message, which would misleadingly point
    // the user at the period/type filters instead of the active tag filter.
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium">
            {tagId
              ? 'Nessuna transazione con questo tag nel periodo selezionato'
              : 'Nessuna categoria nel periodo selezionato'}
          </p>
          <p className="text-sm text-muted-foreground">
            {tagId
              ? 'Cambia periodo o rimuovi il filtro tag per vedere altri dati.'
              : 'Cambia periodo o tipo movimento per visualizzare la classifica.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ol className="grid gap-3" aria-label="Classifica categorie">
      {sortedData.map((category, index) => {
        const href = buildDashboardCategoryDetailHref(category.id, {
          preset,
          type,
          defaultPreset,
          tag: tagId,
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
                {deviations ? (
                  <DeviationBadge
                    deviation={getDeviationValue(category.id, deviations)}
                    categoryType={type}
                  />
                ) : null}
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

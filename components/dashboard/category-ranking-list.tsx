'use client'

import Link from 'next/link'
import { CategorySparkline } from '@/components/dashboard/category-sparkline'
import { buildDashboardCategoryDetailHref } from '@/lib/routes'
import type { CategoryDirectionCopy } from '@/lib/services/category-direction-copy'
import { cn } from '@/lib/utils'
import { toDecimal } from '@/lib/utils/decimal'
import type { CategoryYearRankingItem } from '@/lib/dal/dashboard'
import type { CategoryYearSort } from '@/lib/validations/dashboard'
import type { LensPassthrough } from '@/lib/utils/search-params'

type Props = {
  data: CategoryYearRankingItem[]
  year: number
  direction: 'in' | 'out' | 'allocation'
  sort: CategoryYearSort
  // Phase 82 D-12+D-13 (review fix WR-03): forwarded into the row click-through href only —
  // never read for aggregation. See lib/routes.ts's DashboardCategoryFilters.lens comment.
  lens?: LensPassthrough
  copy: CategoryDirectionCopy
}

/**
 * D-08/CLIST-03: falls back to the row's own amount when its projection is null — never crashes,
 * never drops the row out of the list, never reverts the WHOLE list to amount-only order.
 */
export function compareByProjection(a: CategoryYearRankingItem, b: CategoryYearRankingItem): number {
  const aValue = toDecimal(a.projection ?? a.amount)
  const bValue = toDecimal(b.projection ?? b.amount)
  return bValue.comparedTo(aValue)
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

export function CategoryRankingList({ data, year, direction, sort, lens, copy }: Props) {
  // D-08: 'amount' trusts the DAL's own descending order; 'projection' reorders via
  // compareByProjection, which never crashes on a null projection (CLIST-03).
  const sortedData = sort === 'projection' ? [...data].sort(compareByProjection) : data

  if (sortedData.length === 0) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium">{copy.emptyStateHeading}</p>
          <p className="text-sm text-muted-foreground">
            {copy.emptyStateBody.replace('{year}', String(year))}
          </p>
        </div>
      </div>
    )
  }

  const barColor =
    direction === 'in'
      ? 'bg-[var(--total-in)]'
      : direction === 'allocation'
        ? 'bg-[var(--total-allocation)]'
        : 'bg-[var(--total-out)]'

  return (
    <ol
      className="grid gap-3"
      aria-label="Classifica categorie"
    >
      {sortedData.map((category, index) => {
        const percentage = Math.max(0, Math.min(category.percentage, 100))
        const shareLabel = copy.shareLabel.replace('{P}', String(category.percentage))
        const shareAriaLabel = shareLabel.replace(/^[·•]\s*/, '')

        return (
          <li
            key={category.id}
            className="group rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/50"
          >
            <div className="grid items-center gap-4 sm:grid-cols-[30px_minmax(0,1fr)_150px_150px_150px]">
              {/* Column 1 — rank badge */}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>

              {/* Column 2 — name, metadata, % bar */}
              <div className="min-w-0 space-y-2">
                {/* CR-01 (NEW), 83-VERIFICATION.md LOCKED DECISION: the allocation direction has
                    no detail page yet (Phase 84 scope) — its branch computes no href at all, so
                    no ?type=allocation URL the detail page can't honour is ever constructed. */}
                {direction === 'allocation' ? (
                  <span
                    className="block truncate text-base font-semibold text-foreground"
                    aria-disabled="true"
                    title={category.name}
                  >
                    {category.name} <span className="sr-only">{copy.rowAccessibleSuffix}</span>
                  </span>
                ) : (
                  // D-13/CLIST-07: the row's link carries the SAME year the row's own total was computed from —
                  // the coherence test "clicking a row must not change the numbers" holds by construction.
                  <Link
                    href={buildDashboardCategoryDetailHref(category.id, { year, type: direction, lens })}
                    className="block truncate text-base font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${category.name}: ${copy.rowAccessibleSuffix}`}
                    title={category.name}
                  >
                    {category.name}
                  </Link>
                )}
                <p className="text-xs text-muted-foreground">
                  {movementLabel(category.count)} {shareLabel}
                </p>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={shareAriaLabel}
                >
                  <div
                    className={cn('h-full rounded-full', barColor)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* Column 3 — 12-month sparkline, hidden on mobile per UI-SPEC */}
              <div className="hidden sm:block">
                <CategorySparkline
                  points={category.sparkline.map((point) => ({
                    month: point.month,
                    label: point.label,
                    amount: point.amount,
                  }))}
                  type={direction}
                  pointStates={category.sparkline.map((point) => point.state)}
                  estimatedHeightHint={category.pace}
                  label={`Andamento mensile ${category.name}`}
                />
              </div>

              {/* Column 4 — Totale (D-04, always present) */}
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">Totale</p>
                <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                  {formatAmount(category.amount)}
                </p>
              </div>

              {/* Column 5 — Proiezione (D-04/D-05/D-06/D-15): entirely absent when null — no
                  em-dash, no placeholder. The grid's 5th column stays reserved (empty) by its own
                  column definition; no extra div is rendered to hold that reservation. */}
              {category.projection !== null ? (
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground">A questo passo</p>
                  <p className="font-mono text-base font-medium tabular-nums text-muted-foreground">
                    <strong className="font-semibold text-foreground">
                      {formatAmount(category.projection)}
                    </strong>
                  </p>
                </div>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

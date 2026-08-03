import Link from 'next/link'
import { APP_ROUTES, buildDashboardCategoriesHref } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { LensPassthrough } from '@/lib/utils/search-params'
import type { CategoryYearDirection, CategoryYearSort } from '@/lib/validations/dashboard'

// Phase 83-04 (Rule 3 auto-fix): these local pieces of `app/(app)/dashboard/categories/page.tsx`
// were extracted into their own module because Next.js's App Router route-typing
// (.next/types/app/.../page.ts) rejects ANY named export from a page.tsx file beyond its
// allowed route exports (default/metadata/generateStaticParams/...) — `tsc --noEmit` fails with
// "Property 'DirectionFilter' is incompatible with index signature" otherwise. Moving them here
// keeps them directly testable (VALIDATION.md Wave-0 requirement) without violating that
// constraint.

// D-09: the direction filter's fixed, ordered option set — Uscite / Entrate / Accantonamenti,
// the last of which is reachable here for the first time (CLIST-04).
const DIRECTION_OPTIONS: Array<{ value: CategoryYearDirection; label: string }> = [
  { value: 'out', label: 'Uscite' },
  { value: 'in', label: 'Entrate' },
  { value: 'allocation', label: 'Accantonamenti' },
]

/** D-09: always exactly 3 links in fixed order, each always enabled (never disabled/hidden). */
export function DirectionFilter({
  year,
  direction,
  sort,
  lens,
}: {
  year: number
  direction: CategoryYearDirection
  sort: CategoryYearSort
  lens?: LensPassthrough
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Filtra per direzione">
      {DIRECTION_OPTIONS.map((option) => {
        const isActive = direction === option.value
        const href = buildDashboardCategoriesHref({ year, type: option.value, sort, lens })

        return (
          <Link
            key={option.value}
            href={href}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center rounded-md border px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </Link>
        )
      })}
    </div>
  )
}

/**
 * D-08/D-15: Totale (default) and Proiezione. Proiezione stays visible but becomes a disabled
 * `<span>` (never a `<Link>`, never hidden) whenever the year's pace-eligible Covered Months
 * (excluding the current/partial month) number fewer than MIN_COVERED_MONTHS_FOR_PACE — the
 * disabled state always carries a stated reason via `title` (UI-SPEC E5).
 */
export function SortToggle({
  year,
  direction,
  sort,
  lens,
  projectionSortAvailable,
}: {
  year: number
  direction: CategoryYearDirection
  sort: CategoryYearSort
  lens?: LensPassthrough
  projectionSortAvailable: boolean
}) {
  const options: Array<{ value: CategoryYearSort; label: string }> = [
    { value: 'amount', label: 'Totale' },
    { value: 'projection', label: 'Proiezione' },
  ]

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Ordina classifica">
      {options.map((option) => {
        const isDisabled = option.value === 'projection' && !projectionSortAvailable

        if (isDisabled) {
          return (
            <span
              key={option.value}
              aria-disabled="true"
              title="Serve un secondo mese importato per calcolare la proiezione."
              className="inline-flex cursor-not-allowed items-center rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground/60"
            >
              {option.label}
            </span>
          )
        }

        const isActive = sort === option.value
        const href = buildDashboardCategoriesHref({ year, type: direction, sort: option.value, lens })

        return (
          <Link
            key={option.value}
            href={href}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center rounded-md border px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </Link>
        )
      })}
    </div>
  )
}

/** Whole-account empty state — replaces the ENTIRE page (controls included) when the account has
 * zero transactions ever (`getYearsWithData('cassa')` returns `[]`, `resolveYear` returns null). */
export function NoYearsEmptyState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 text-center">
      <h1 className="text-xl font-semibold">Nessuna transazione registrata</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Importa un estratto conto per vedere le tue categorie qui.
      </p>
      <Link
        href={APP_ROUTES.import}
        className="mt-2 inline-flex items-center rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
      >
        Importa un estratto conto
      </Link>
    </div>
  )
}

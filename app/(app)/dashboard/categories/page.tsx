import Link from 'next/link'
import { Suspense } from 'react'
import { CategoryRankingList } from '@/components/dashboard/category-ranking-list'
import { CategoryRankingSkeleton } from '@/components/dashboard/category-ranking-skeleton'
import { DashboardFilters } from '@/components/dashboard/dashboard-filters'
import { LensSwitch } from '@/components/dashboard/lens-switch'
import { getCategoryDeviations, getCategoryRanking } from '@/lib/dal/dashboard'
import { resolveLedgerRowSource, type LedgerRowSource } from '@/lib/dal/dashboard-filters'
import { hasAmortizationPlans } from '@/lib/dal/amortization'
import { verifySession } from '@/lib/dal/auth'
import { buildDashboardCategoriesHref } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { parseLensParam, type Lens } from '@/lib/utils/search-params'
import {
  parseDashboardFilters,
  type DashboardFilters as ParsedDashboardFilters,
  type DashboardSort,
} from '@/lib/validations/dashboard'

const CATEGORIES_DEFAULT_PRESET = 'last-3-months' as const
const CATEGORIES_DEFAULT_SORT: DashboardSort = 'deviation'
const categoryTypeOptions = [
  { value: 'out' as const, label: 'Uscite' },
  { value: 'in' as const, label: 'Entrate' },
]

function CategoryFiltersFallback() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-[170px] animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
    </div>
  )
}

type CategoryDashboardFilters = ParsedDashboardFilters & {
  preset: typeof CATEGORIES_DEFAULT_PRESET | ParsedDashboardFilters['preset']
  type: 'in' | 'out'
  sort: DashboardSort
}

type Props = {
  searchParams: Promise<{
    preset?: string | string[]
    period?: string | string[]
    type?: string | string[]
    sort?: string | string[]
    lens?: string | string[]
  }>
}

function parseCategoryDashboardFilters(
  params: Awaited<Props['searchParams']>
): CategoryDashboardFilters {
  const filters = parseDashboardFilters(params, {
    defaultPreset: CATEGORIES_DEFAULT_PRESET,
    defaultSort: CATEGORIES_DEFAULT_SORT,
  })

  return {
    ...filters,
    type: filters.type === 'in' ? 'in' : 'out',
  }
}

function SortToggle({ filters, lens }: { filters: CategoryDashboardFilters; lens: Lens }) {
  const options: Array<{ value: DashboardSort; label: string }> = [
    { value: 'deviation', label: 'Deviazione' },
    { value: 'amount', label: 'Importo' },
  ]

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Ordina classifica">
      {options.map((option) => {
        const isActive = filters.sort === option.value
        const href = buildDashboardCategoriesHref({
          preset: filters.preset,
          type: filters.type,
          sort: option.value,
          defaultPreset: CATEGORIES_DEFAULT_PRESET,
          defaultSort: CATEGORIES_DEFAULT_SORT,
          lens,
        })
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

async function CategoryRankingContent({
  filters,
  ledgerRowSource,
  lens,
}: {
  filters: CategoryDashboardFilters
  ledgerRowSource: LedgerRowSource
  lens: Lens
}) {
  const [data, deviations] = await Promise.all([
    getCategoryRanking(filters, ledgerRowSource),
    getCategoryDeviations({ type: filters.type }, ledgerRowSource),
  ])

  return (
    <CategoryRankingList
      data={data}
      preset={filters.preset}
      type={filters.type}
      defaultPreset={CATEGORIES_DEFAULT_PRESET}
      sort={filters.sort}
      deviations={deviations}
      lens={lens}
    />
  )
}

export default async function DashboardCategoriesPage({ searchParams }: Props) {
  const { userId } = await verifySession()
  const params = await searchParams
  const filters = parseCategoryDashboardFilters(params)
  const lens = parseLensParam(params.lens)
  const ledgerRowSource = resolveLedgerRowSource(lens)
  const hasPlans = await hasAmortizationPlans(userId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1 text-xl font-semibold">
            Categorie
            {hasPlans && <LensSwitch lens={lens} />}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Classifica delle categorie per importo e andamento mensile.
          </p>
        </div>
      </div>

      <Suspense fallback={<CategoryFiltersFallback />}>
        <DashboardFilters
          preset={filters.preset}
          type={filters.type}
          defaultPreset={CATEGORIES_DEFAULT_PRESET}
          typeOptions={categoryTypeOptions}
        />
      </Suspense>

      <SortToggle filters={filters} lens={lens} />

      <Suspense fallback={<CategoryRankingSkeleton />}>
        <CategoryRankingContent filters={filters} ledgerRowSource={ledgerRowSource} lens={lens} />
      </Suspense>
    </div>
  )
}

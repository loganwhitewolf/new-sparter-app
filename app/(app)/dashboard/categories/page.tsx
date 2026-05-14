import { Suspense } from 'react'
import { CategoryRankingList } from '@/components/dashboard/category-ranking-list'
import { CategoryRankingSkeleton } from '@/components/dashboard/category-ranking-skeleton'
import { DashboardFilters } from '@/components/dashboard/dashboard-filters'
import { getCategoryRanking } from '@/lib/dal/dashboard'
import {
  parseDashboardFilters,
  type DashboardFilters as ParsedDashboardFilters,
} from '@/lib/validations/dashboard'

const CATEGORIES_DEFAULT_PRESET = 'this-year' as const
const categoryTypeOptions = [
  { value: 'out' as const, label: 'Uscite' },
  { value: 'in' as const, label: 'Entrate' },
]

function CategoryFiltersFallback() {
  return (
    <div className="flex flex-wrap items-center gap-2 pb-4" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-[170px] animate-pulse rounded-md bg-muted" />
    </div>
  )
}

type CategoryDashboardFilters = ParsedDashboardFilters & {
  preset: typeof CATEGORIES_DEFAULT_PRESET | ParsedDashboardFilters['preset']
  type: 'in' | 'out'
}

type Props = {
  searchParams: Promise<{
    preset?: string | string[]
    period?: string | string[]
    type?: string | string[]
  }>
}

function parseCategoryDashboardFilters(
  params: Awaited<Props['searchParams']>
): CategoryDashboardFilters {
  const filters = parseDashboardFilters(params, { defaultPreset: CATEGORIES_DEFAULT_PRESET })

  return {
    ...filters,
    type: filters.type === 'in' ? 'in' : 'out',
  }
}

async function CategoryRankingContent({ filters }: { filters: CategoryDashboardFilters }) {
  const data = await getCategoryRanking(filters)

  return (
    <CategoryRankingList
      data={data}
      preset={filters.preset}
      type={filters.type}
      defaultPreset={CATEGORIES_DEFAULT_PRESET}
    />
  )
}

export default async function DashboardCategoriesPage({ searchParams }: Props) {
  const params = await searchParams
  const filters = parseCategoryDashboardFilters(params)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Categorie</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Classifica delle categorie per importo e andamento mensile.
        </p>
      </div>

      <Suspense fallback={<CategoryFiltersFallback />}>
        <DashboardFilters
          preset={filters.preset}
          type={filters.type}
          defaultPreset={CATEGORIES_DEFAULT_PRESET}
          typeOptions={categoryTypeOptions}
        />
      </Suspense>

      <Suspense fallback={<CategoryRankingSkeleton />}>
        <CategoryRankingContent filters={filters} />
      </Suspense>
    </div>
  )
}

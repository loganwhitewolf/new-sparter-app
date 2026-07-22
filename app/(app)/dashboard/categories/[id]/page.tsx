import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { CategoryDetailEmptyState } from '@/components/dashboard/category-detail-empty-state'
import { CategoryDetailSkeleton } from '@/components/dashboard/category-detail-skeleton'
import { CategoryDetailSummary } from '@/components/dashboard/category-detail-summary'
import { CategoryDetailTrendChart } from '@/components/dashboard/category-detail-trend-chart'
import { CategorySubcategoryBreakdown } from '@/components/dashboard/category-subcategory-breakdown'
import { CategoryTopTransactions } from '@/components/dashboard/category-top-transactions'
import { DashboardFilters } from '@/components/dashboard/dashboard-filters'
import { getCategoryDeviations, getCategoryDetail } from '@/lib/dal/dashboard'
import { verifySession } from '@/lib/dal/auth'
import { buildDashboardCategoriesHref } from '@/lib/routes'
import {
  parseDashboardFilters,
  type DashboardFilters as ParsedDashboardFilters,
} from '@/lib/validations/dashboard'

const CATEGORY_DETAIL_DEFAULT_PRESET = 'last-3-months' as const
const categoryTypeOptions = [
  { value: 'out' as const, label: 'Uscite' },
  { value: 'in' as const, label: 'Entrate' },
]

type CategoryDetailFilters = ParsedDashboardFilters & {
  preset: typeof CATEGORY_DETAIL_DEFAULT_PRESET | ParsedDashboardFilters['preset']
  type: 'in' | 'out'
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    preset?: string | string[]
    period?: string | string[]
    type?: string | string[]
  }>
}

function CategoryFiltersFallback() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-[170px] animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
    </div>
  )
}

function parseCategoryId(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function parseCategoryDetailFilters(
  params: Awaited<Props['searchParams']>
): CategoryDetailFilters {
  const filters = parseDashboardFilters(params, {
    defaultPreset: CATEGORY_DETAIL_DEFAULT_PRESET,
  })

  return {
    ...filters,
    type: filters.type === 'in' ? 'in' : 'out',
  }
}

async function CategoryDetailContent({
  categoryId,
  filters,
  categoriesHref,
}: {
  categoryId: number | null
  filters: CategoryDetailFilters
  categoriesHref: string
}) {
  if (categoryId === null) {
    return <CategoryDetailEmptyState />
  }

  const [data, deviations] = await Promise.all([
    getCategoryDetail(categoryId, filters),
    getCategoryDeviations({ type: filters.type, categoryId }),
  ])

  if (data.category === null) {
    redirect(categoriesHref)
  }

  return (
    <div className="space-y-6">
      <CategoryDetailSummary summary={data.summary} type={filters.type} />

      <section className="space-y-3" aria-labelledby="category-detail-trend-heading">
        <div>
          <h2 id="category-detail-trend-heading" className="text-lg font-semibold">
            Andamento mensile
          </h2>
          <p className="text-sm text-muted-foreground">
            Totale mensile per {data.category.name} nel periodo selezionato.
          </p>
        </div>
        <CategoryDetailTrendChart
          data={data.trend}
          type={filters.type}
          label={`Andamento mensile categoria ${data.category.name}`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3" aria-labelledby="category-detail-top-transactions-heading">
          <div>
            <h2 id="category-detail-top-transactions-heading" className="text-lg font-semibold">
              Top 5 movimenti
            </h2>
            <p className="text-sm text-muted-foreground">
              Movimenti più rilevanti per importo assoluto.
            </p>
          </div>
          <CategoryTopTransactions transactions={data.topTransactions} />
        </section>

        <section className="space-y-3" aria-labelledby="category-detail-subcategories-heading">
          <div>
            <h2 id="category-detail-subcategories-heading" className="text-lg font-semibold">
              Sottocategorie
            </h2>
            <p className="text-sm text-muted-foreground">
              Distribuzione interna della categoria nel periodo.
            </p>
          </div>
          <CategorySubcategoryBreakdown
            subcategories={data.subcategories}
            type={filters.type}
            deviations={deviations}
          />
        </section>
      </div>
    </div>
  )
}

export default async function DashboardCategoryDetailPage({ params, searchParams }: Props) {
  await verifySession()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const categoryId = parseCategoryId(id)
  const filters = parseCategoryDetailFilters(query)

  const backHref = buildDashboardCategoriesHref({
    preset: filters.preset,
    type: filters.type,
    defaultPreset: CATEGORY_DETAIL_DEFAULT_PRESET,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <Link href={backHref} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Torna alle categorie
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Dettaglio categoria</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Andamento, movimenti principali e sottocategorie per il filtro selezionato.
          </p>
        </div>
      </div>

      <Suspense fallback={<CategoryFiltersFallback />}>
        <DashboardFilters
          preset={filters.preset}
          type={filters.type}
          defaultPreset={CATEGORY_DETAIL_DEFAULT_PRESET}
          typeOptions={categoryTypeOptions}
        />
      </Suspense>

      <Suspense fallback={<CategoryDetailSkeleton />}>
        <CategoryDetailContent
          categoryId={categoryId}
          filters={filters}
          categoriesHref={backHref}
        />
      </Suspense>
    </div>
  )
}

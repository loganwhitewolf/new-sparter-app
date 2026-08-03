import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { CategoryDetailDifferenceChart } from '@/components/dashboard/category-detail-difference-chart'
import { CategoryDetailEmptyState } from '@/components/dashboard/category-detail-empty-state'
import { CategoryDetailSkeleton } from '@/components/dashboard/category-detail-skeleton'
import { CategoryDetailTable } from '@/components/dashboard/category-detail-table'
import { CategoryDetailWindowControls } from '@/components/dashboard/category-detail-window-controls'
import { CategorySubcategoryBreakdown } from '@/components/dashboard/category-subcategory-breakdown'
import { CategoryTopTransactions } from '@/components/dashboard/category-top-transactions'
import { CategoryYearSelect } from '@/components/dashboard/category-year-select'
import { resolveYear } from '@/components/dashboard/overview/resolve-year'
import { verifySession } from '@/lib/dal/auth'
import { getCategoryDetailMeta, getCategoryDetailYearWindow } from '@/lib/dal/category-detail-year-window'
import { getYearsWithData } from '@/lib/dal/overview'
import { buildDashboardCategoriesHref } from '@/lib/routes'
import { extractLensPassthrough, parsePositiveIntParam } from '@/lib/utils/search-params'
import { parseCategoryDetailWindow, type CategoryDetailWindow } from '@/lib/validations/category-year-window'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    // D-01 (Phase 84): the detail page's own URL contract. `?type=` and `?preset=`/`?period=`
    // are no longer read by this page (D-06) — `lens` stays a raw back-link passthrough only.
    year?: string | string[]
    months?: string | string[]
    from?: string | string[]
    lens?: string | string[]
  }>
}

async function CategoryDetailContent({
  categoryId,
  year,
  window,
}: {
  categoryId: number
  year: number
  window: CategoryDetailWindow
}) {
  const data = await getCategoryDetailYearWindow(categoryId, year, window)
  return (
    <div className="flex flex-col gap-6">
      <CategoryDetailDifferenceChart data={data} />
      <CategoryDetailTable data={data} />
      <CategorySubcategoryBreakdown contributions={data.subcategories} year={year} type={data.category?.type} />
      <CategoryTopTransactions transactions={data.topTransactions} />
    </div>
  )
}

export default async function DashboardCategoryDetailPage({ params, searchParams }: Props) {
  await verifySession()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const categoryId = parsePositiveIntParam(id)

  if (categoryId === null) {
    return <CategoryDetailEmptyState />
  }

  // Phase 82 D-12+D-13 (review fix WR-03): raw, unvalidated passthrough — forwarded into the
  // back link only. Categories' own aggregation always reads cassa (D-12); this page never
  // resolves `lens` to a ledgerRowSource.
  const lens = extractLensPassthrough(query.lens)
  const years = await getYearsWithData('cassa')
  const year = resolveYear(Array.isArray(query.year) ? query.year[0] : query.year, years)

  if (year === null) {
    return <CategoryDetailEmptyState />
  }

  // Resolved BEFORE any Suspense boundary — a cheap single-row lookup, React-cache()-deduped
  // against the same call inside getCategoryDetailYearWindow.
  const meta = await getCategoryDetailMeta(categoryId)

  if (meta === null) {
    redirect(buildDashboardCategoriesHref({ year, lens }))
  }

  // D-06: the back-link uses the category's OWN direction, not a URL filter.
  const backHref = buildDashboardCategoriesHref({ year, type: meta.type, lens })
  const window = parseCategoryDetailWindow(year, { months: query.months, from: query.from })

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <Link
          href={backHref}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Torna alle categorie
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-1 text-xl font-semibold">{meta.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Andamento mensile, ritmo e confronto con la finestra omologa dell&apos;anno precedente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryYearSelect year={year} years={years} />
            <CategoryDetailWindowControls year={year} window={window} />
          </div>
        </div>
      </div>

      <Suspense fallback={<CategoryDetailSkeleton />}>
        <CategoryDetailContent categoryId={categoryId} year={year} window={window} />
      </Suspense>
    </div>
  )
}

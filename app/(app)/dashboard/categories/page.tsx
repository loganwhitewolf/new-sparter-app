import { Suspense } from 'react'
import { CategoryCoverageNudge } from '@/components/dashboard/category-coverage-nudge'
import {
  DirectionFilter,
  NoYearsEmptyState,
  SortToggle,
} from '@/components/dashboard/category-list-controls'
import { CategoryRankingList } from '@/components/dashboard/category-ranking-list'
import { CategoryYearRankingSkeleton } from '@/components/dashboard/category-year-ranking-skeleton'
import { CategoryYearSelect } from '@/components/dashboard/category-year-select'
import { resolveYear } from '@/components/dashboard/overview/resolve-year'
import { verifySession } from '@/lib/dal/auth'
import { getCategoryYearRanking } from '@/lib/dal/dashboard'
import { getCoveredMonthsInYear } from '@/lib/dal/covered-months'
import { getYearsWithData } from '@/lib/dal/overview'
import { resolveCategoryDirectionCopy } from '@/lib/services/category-direction-copy'
import { isPartialMonth, MIN_COVERED_MONTHS_FOR_PACE } from '@/lib/services/pace-and-projection'
import { extractLensPassthrough, type LensPassthrough } from '@/lib/utils/search-params'
import {
  parseCategoryYearDirection,
  parseCategoryYearSort,
  type CategoryYearDirection,
  type CategoryYearSort,
} from '@/lib/validations/dashboard'

// D-12: the Categories list's own URL contract — year is the ONLY container param (D-01). No
// `preset`/`period` key anywhere in this type, pin-by-construction, matching Phase 82's precedent
// for `?lens=` on this same page.
type Props = {
  searchParams: Promise<{
    year?: string | string[]
    type?: string | string[]
    sort?: string | string[]
    lens?: string | string[]
  }>
}

async function CategoryRankingContent({
  year,
  direction,
  sort,
  lens,
  coveredMonthCount,
}: {
  year: number
  direction: CategoryYearDirection
  sort: CategoryYearSort
  lens?: LensPassthrough
  coveredMonthCount: number
}) {
  const data = await getCategoryYearRanking(year, direction)

  return (
    <>
      <CategoryRankingList
        data={data}
        year={year}
        direction={direction}
        sort={sort}
        lens={lens}
        copy={resolveCategoryDirectionCopy(direction)}
      />
      {/* D-14/UI-SPEC E8: appears together with the resolved list, never during the skeleton —
          this component lives inside the same Suspense-resolved boundary as the list above. */}
      {coveredMonthCount === 1 ? <CategoryCoverageNudge coveredMonthCount={1} year={year} /> : null}
    </>
  )
}

export default async function DashboardCategoriesPage({ searchParams }: Props) {
  await verifySession()
  const params = await searchParams
  // Phase 82 D-12+D-13 (review fix WR-03): raw, unvalidated passthrough — forwarded through this
  // page's own hrefs so the tab nav's ?lens= survives a Categories round trip, WITHOUT being
  // consumed for aggregation. getCategoryYearRanking below never receives it — Categories always
  // reads cassa (D-12).
  const lens = extractLensPassthrough(params.lens)
  const years = await getYearsWithData('cassa')
  const year = resolveYear(Array.isArray(params.year) ? params.year[0] : params.year, years)
  const direction = parseCategoryYearDirection(params.type)
  const sort = parseCategoryYearSort(params.sort)

  if (year === null) {
    return <NoYearsEmptyState />
  }

  const coveredMonths = await getCoveredMonthsInYear(year)
  const paceEligibleCount = coveredMonths.filter((m) => !isPartialMonth(m.yearMonth)).length
  const projectionSortAvailable = paceEligibleCount >= MIN_COVERED_MONTHS_FOR_PACE
  const subheading = resolveCategoryDirectionCopy(direction).pageSubheading.replace('{year}', String(year))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1 text-xl font-semibold">Categorie</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
        </div>
        <CategoryYearSelect year={year} years={years} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DirectionFilter year={year} direction={direction} sort={sort} lens={lens} />
        <SortToggle
          year={year}
          direction={direction}
          sort={sort}
          lens={lens}
          projectionSortAvailable={projectionSortAvailable}
        />
      </div>

      <Suspense fallback={<CategoryYearRankingSkeleton />}>
        <CategoryRankingContent
          year={year}
          direction={direction}
          sort={sort}
          lens={lens}
          coveredMonthCount={coveredMonths.length}
        />
      </Suspense>
    </div>
  )
}

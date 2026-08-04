import { cn } from '@/lib/utils'

// D-07: the KPI-card header no longer exists (subsumed by the table's sticky summary column) —
// this skeleton mirrors the new layout: chart above the table, subcategory table below. Bars use
// the `animate-pulse` placeholder-grid convention established by category-year-ranking-skeleton.tsx.
const TABLE_MONTH_PLACEHOLDER_COUNT = 12
const TABLE_ROW_COUNT = 3 // current / previous-year / Differenza
const SUBCATEGORY_ROW_COUNT = 4

export function CategoryDetailSkeleton() {
  return (
    <div className="space-y-6" aria-label="Caricamento dettaglio categoria">
      {/* Chart placeholder (CDET-VIEW-01, 260804-br9) — compact bar-height rectangles matching
          CategoryDetailAmountsChart's own h-16 geometry, so the loading skeleton doesn't
          visually jump when the real compact chart mounts. */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex h-16 items-center gap-3" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, index) => {
            const isAbove = index % 2 === 0
            return (
              <div key={index} className="flex h-full flex-1 flex-col justify-center">
                <div
                  className={cn('animate-pulse rounded-md bg-muted', isAbove ? 'self-end' : 'self-start')}
                  style={{ height: `${20 + (index % 4) * 14}px` }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Table placeholder — sticky first column + N month-column placeholders + summary column,
          3 row-height bars (current / previous-year / Differenza, D-11/D-12). */}
      <div className="overflow-x-auto rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid min-w-[1040px] gap-3" aria-hidden="true">
          {Array.from({ length: TABLE_ROW_COUNT }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid items-center gap-2"
              style={{ gridTemplateColumns: `148px repeat(${TABLE_MONTH_PLACEHOLDER_COUNT}, minmax(0, 1fr)) 168px` }}
            >
              <div className="h-4 animate-pulse rounded-md bg-muted" />
              {Array.from({ length: TABLE_MONTH_PLACEHOLDER_COUNT }).map((_, colIndex) => (
                <div key={colIndex} className="h-4 animate-pulse rounded-md bg-muted" />
              ))}
              <div className="h-4 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Subcategory table placeholder (D-16) — name / weight bar / amount / contribution columns. */}
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm" aria-hidden="true">
        {Array.from({ length: SUBCATEGORY_ROW_COUNT }).map((_, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_140px_120px_140px] items-center gap-4">
            <div className="h-4 animate-pulse rounded-md bg-muted" />
            <div className="h-1.5 animate-pulse rounded-full bg-muted" />
            <div className="ml-auto h-4 w-20 animate-pulse rounded-md bg-muted" />
            <div className="ml-auto h-4 w-24 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

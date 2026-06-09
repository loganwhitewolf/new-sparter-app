/**
 * Skeleton fallback for the overview page data section (KPIs + chart).
 * Co-located here so Plan 04 can delete the old overview-skeleton.tsx
 * without affecting this page.
 */
export function OverviewPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* KPI cards row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
      {/* Chart area */}
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  )
}

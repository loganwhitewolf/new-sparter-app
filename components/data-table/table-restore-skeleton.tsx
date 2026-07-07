/**
 * TableRestoreSkeleton — shown in place of a data table while a saved
 * sessionStorage filter set is being restored into the URL on bare mount
 * (quick task 260707-fy4). Prevents the unfiltered SSR render from flashing
 * before the filtered refetch lands. Mirrors the toolbar + rows layout of
 * the dashboard skeletons (see breakdown-skeleton.tsx).
 */
export function TableRestoreSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-56 bg-muted animate-pulse rounded-md" />
        <div className="h-9 w-40 bg-muted animate-pulse rounded-md" />
        <div className="h-9 w-28 bg-muted animate-pulse rounded-md" />
      </div>
      <div className="rounded-md border p-4">
        <div className="space-y-3">
          <div className="h-7 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-7 w-11/12 bg-muted animate-pulse rounded-md" />
          <div className="h-7 w-4/5 bg-muted animate-pulse rounded-md" />
          <div className="h-7 w-5/6 bg-muted animate-pulse rounded-md" />
          <div className="h-7 w-3/4 bg-muted animate-pulse rounded-md" />
          <div className="h-7 w-2/3 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  )
}

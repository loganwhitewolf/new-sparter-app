export function BreakdownSkeleton() {
  return (
    <div className="min-h-[360px] rounded-md border p-4">
      <div className="mb-6 flex flex-wrap gap-2">
        <div className="h-9 w-56 bg-muted animate-pulse rounded-md" />
        <div className="h-9 w-40 bg-muted animate-pulse rounded-md" />
      </div>
      <div className="space-y-3">
        <div className="h-7 w-11/12 bg-muted animate-pulse rounded-md" />
        <div className="h-7 w-4/5 bg-muted animate-pulse rounded-md" />
        <div className="h-7 w-3/5 bg-muted animate-pulse rounded-md" />
        <div className="h-7 w-2/3 bg-muted animate-pulse rounded-md" />
        <div className="h-7 w-1/2 bg-muted animate-pulse rounded-md" />
      </div>
    </div>
  )
}

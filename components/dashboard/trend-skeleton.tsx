export function TrendSkeleton() {
  return (
    <div className="min-h-[360px] rounded-md border p-4">
      <div className="mb-6 flex items-end gap-3">
        {Array.from({ length: 8 }).map((_, groupIndex) => (
          <div key={groupIndex} className="flex flex-1 items-end gap-1">
            <div className="h-24 flex-1 bg-muted animate-pulse rounded-md" />
            <div className="h-16 flex-1 bg-muted animate-pulse rounded-md" />
            <div className="h-20 flex-1 bg-muted animate-pulse rounded-md" />
            <div className="h-10 flex-1 bg-muted animate-pulse rounded-md" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-8 w-20 bg-muted animate-pulse rounded-md" />
        <div className="h-8 w-20 bg-muted animate-pulse rounded-md" />
        <div className="h-8 w-36 bg-muted animate-pulse rounded-md" />
        <div className="h-8 w-24 bg-muted animate-pulse rounded-md" />
      </div>
    </div>
  )
}

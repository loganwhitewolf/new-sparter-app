export function TagRankingSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Caricamento classifica tag">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0 space-y-2">
              <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded-md bg-muted" />
            </div>

            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

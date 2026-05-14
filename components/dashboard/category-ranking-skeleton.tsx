export function CategoryRankingSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Caricamento classifica categorie">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0 space-y-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
                  <div className="h-3 w-28 animate-pulse rounded-md bg-muted" />
                </div>
              </div>
              <div className="h-2 animate-pulse rounded-full bg-muted" />
            </div>

            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <div className="space-y-2 text-right">
                <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
                <div className="ml-auto h-3 w-12 animate-pulse rounded-md bg-muted" />
              </div>
              <div className="h-12 w-28 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

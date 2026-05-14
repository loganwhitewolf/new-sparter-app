export function CategoryDetailSkeleton() {
  return (
    <div className="space-y-6" aria-label="Caricamento dettaglio categoria">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="min-h-28 rounded-lg border bg-card p-4 shadow-sm">
            <div className="h-3 w-24 animate-pulse rounded-md bg-muted" />
            <div className="mt-6 h-7 w-32 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>

      <div className="min-h-[300px] rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-6 h-4 w-44 animate-pulse rounded-md bg-muted" />
        <div className="flex h-48 items-end gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="flex-1 animate-pulse rounded-md bg-muted"
              style={{ height: `${40 + (index % 4) * 24}px` }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((section) => (
          <div key={section} className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
                <div className="mt-3 h-3 w-1/2 animate-pulse rounded-md bg-muted" />
                <div className="mt-4 h-2 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

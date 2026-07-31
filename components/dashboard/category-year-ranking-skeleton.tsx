// New sibling to (not a modification of) category-ranking-skeleton.tsx — that component stays
// completely untouched, since it is also used by components/dashboard/tag-ranking-list.tsx, which
// this phase does not touch.
//
// The desktop row shape below is the LOCKED 5-column grid from UI-SPEC's
// `## Row Structure and Layout`: rank badge, name+metadata+bar block, 12-bar sparkline, Totale,
// Proiezione. The Proiezione (5th) column placeholder is rendered UNCONDITIONALLY — the skeleton
// never knows in advance whether the resolved data will show a projection (< 2 Covered Months
// renders no projection pair at all, D-15), so reserving the column here is what keeps the
// skeleton-to-real-row transition from shifting layout (UI-SPEC E6 backstop).
const SKELETON_ROW_COUNT = 6

export function CategoryYearRankingSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Caricamento classifica categorie">
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-[30px_minmax(0,1fr)_150px_150px_150px] sm:items-center">
            {/* Column 1 — rank badge */}
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />

            {/* Column 2 — name, metadata, % bar */}
            <div className="min-w-0 space-y-2">
              <div className="h-4 w-3/5 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded-md bg-muted" />
              <div className="h-1.5 w-2/5 animate-pulse rounded-full bg-muted" />
            </div>

            {/* Column 3 — 12-bar sparkline placeholder */}
            <div className="flex h-9 w-full items-end gap-[2px]" aria-hidden="true">
              {Array.from({ length: 12 }).map((_, barIndex) => (
                <div key={barIndex} className="h-full flex-1 animate-pulse rounded-[1px] bg-muted" />
              ))}
            </div>

            {/* Column 4 — Totale placeholder */}
            <div className="space-y-1.5 text-right">
              <div className="ml-auto h-3 w-10 animate-pulse rounded-md bg-muted" />
              <div className="ml-auto h-4 w-16 animate-pulse rounded-md bg-muted" />
            </div>

            {/* Column 5 — Proiezione placeholder, ALWAYS reserved (backstop: layout stability) */}
            <div className="space-y-1.5 text-right">
              <div className="ml-auto h-3 w-16 animate-pulse rounded-md bg-muted" />
              <div className="ml-auto h-4 w-16 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

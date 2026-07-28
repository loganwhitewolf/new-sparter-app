import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlatformYearCoverageRow } from '@/lib/dal/transactions'
import { formatDayMonthRange, yearProgressPercent } from '@/lib/utils/date'

/** Floor width so a single-day-only platform still renders a visible fill, not a 0px sliver. */
const MIN_FILL_WIDTH_PERCENT = 1.5

/**
 * Import-section coverage dashboard (GBH-01): one range-bar row per platform with at
 * least one transaction in `year`, ordered most-behind-first (from getPlatformYearCoverage).
 * Renders nothing when there is no coverage — never an empty card (locked decision).
 */
export function PlatformYearCoverageSection({
  coverage,
  year,
}: {
  coverage: PlatformYearCoverageRow[]
  year: number
}) {
  if (coverage.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Copertura {year} per piattaforma</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {coverage.map((row) => {
          const start = yearProgressPercent(row.firstTransactionAt, year)
          const width = Math.max(
            yearProgressPercent(row.lastTransactionAt, year) - start,
            MIN_FILL_WIDTH_PERCENT,
          )

          return (
            <div key={row.platformId} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm md:w-36">{row.platformName}</span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 rounded-full bg-primary"
                  style={{ left: `${start}%`, width: `${width}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums md:w-36">
                {formatDayMonthRange(row.firstTransactionAt, row.lastTransactionAt)}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

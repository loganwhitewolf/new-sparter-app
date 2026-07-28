'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PlatformYearCoverageRow } from '@/lib/dal/transactions'
import { formatDayMonthRange, yearProgressPercent } from '@/lib/utils/date'

/** Floor width so a single-day-only platform still renders a visible fill, not a 0px sliver. */
const MIN_FILL_WIDTH_PERCENT = 1.5

function CoverageYearSelect({ year, years }: { year: number; years: string[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function update(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('coverageYear', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Select value={String(year)} onValueChange={update}>
      <SelectTrigger
        aria-label="Anno copertura"
        className="h-auto w-auto gap-1 rounded-full border px-3 py-1 text-sm font-medium"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={y}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Import-section coverage dashboard (GBH-01): one range-bar row per platform with at
 * least one transaction in `year`, ordered most-behind-first (from getPlatformYearCoverage).
 * Renders nothing when there are no years with data. When years exist but the selected
 * year has no coverage, keeps the card + year select and shows an empty message so the
 * user can switch year without losing the control.
 */
export function PlatformYearCoverageSection({
  coverage,
  year,
  years,
}: {
  coverage: PlatformYearCoverageRow[]
  year: number
  years: string[]
}) {
  if (years.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <CardTitle>Copertura per piattaforma</CardTitle>
          <CoverageYearSelect year={year} years={years} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {coverage.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna copertura per {year}</p>
        ) : (
          coverage.map((row) => {
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
          })
        )}
      </CardContent>
    </Card>
  )
}

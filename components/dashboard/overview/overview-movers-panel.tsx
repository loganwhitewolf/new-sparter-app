'use client'
import { Loader2 } from 'lucide-react'
import type { MonthOverMonthChange } from '@/lib/dal/overview'
import type { OverviewChartPoint } from '@/lib/dal/overview'
import { formatMoverLine, splitMovers } from './overview-movers-format'

// Italian month names indexed 0–11.
const MONTH_NAMES = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
]

type Props = {
  year: number
  selectedMonth: number
  movers: MonthOverMonthChange[]
  isPending: boolean
  data: OverviewChartPoint[]
}

/**
 * Presentational panel displaying top-movers for a given month.
 *
 * No fetching — all state lives in OverviewMoversSection (the shared parent).
 * Receives pre-computed movers and isPending flag to show loading state.
 */
export function OverviewMoversPanel({ year, selectedMonth, movers, isPending }: Props) {
  // Derive heading: e.g. "Maggio 2025 vs Aprile 2025" (D-02).
  // Year-crossing: when selectedMonth is 0 (January), prev is December of previous year.
  const currentMonthName = MONTH_NAMES[selectedMonth]
  const prevMonthName = selectedMonth === 0 ? 'Dicembre' : MONTH_NAMES[selectedMonth - 1]
  const prevYear = selectedMonth === 0 ? year - 1 : year

  const { increases, savings } = splitMovers(movers)

  return (
    <section aria-labelledby="movers-heading" className="space-y-3">
      <h2 id="movers-heading" className="text-sm font-medium text-muted-foreground">
        {currentMonthName} {year} vs {prevMonthName} {prevYear}
      </h2>

      {isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : movers.length === 0 ? (
        /* D-07: empty state — first month or all deltas below €15 noise floor (MOVE-05) */
        <p className="text-sm text-muted-foreground">
          Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15.
        </p>
      ) : (
        /* Two-column layout: increases left, savings right — no scrolling needed */
        <div className="grid grid-cols-2 gap-4">
          {/* D-02: "Dove hai speso di più" — red, hidden when empty (MOVE-02) */}
          <div>
            {increases.length > 0 && (
              <>
                <p className="text-xs font-semibold text-[var(--total-out)] mb-1">
                  Dove hai speso di più
                </p>
                <ul className="space-y-0.5">
                  {increases.map((m) => (
                    <li key={m.categoryId} className="text-sm text-foreground">
                      {formatMoverLine(m)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* D-02: "Dove hai risparmiato" — green, hidden when empty (MOVE-02) */}
          <div>
            {savings.length > 0 && (
              <>
                <p className="text-xs font-semibold text-[var(--total-in)] mb-1">
                  Dove hai risparmiato
                </p>
                <ul className="space-y-0.5">
                  {savings.map((m) => (
                    <li key={m.categoryId} className="text-sm text-foreground">
                      {formatMoverLine(m)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

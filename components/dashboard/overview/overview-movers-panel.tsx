'use client'
import { Loader2 } from 'lucide-react'
import type { MonthOverMonthChange } from '@/lib/dal/overview'
import { formatMoverAmount, splitMovers } from './overview-movers-format'

// Italian month names indexed 0–11 (lowercase for use in running text).
const MONTH_NAMES = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
]

type Props = {
  year: number
  selectedMonth: number
  movers: MonthOverMonthChange[]
  isPending: boolean
}

/**
 * Presentational panel displaying top-movers for a given month.
 *
 * No fetching — all state lives in OverviewMoversSection (the shared parent).
 * Receives pre-computed movers and isPending flag to show loading state.
 * Layout: two-column table (increases left, savings right) with name and amount per row.
 */
export function OverviewMoversPanel({ year, selectedMonth, movers, isPending }: Props) {
  // Derive heading strings for D-02: current month vs previous month (year-crossing for January).
  const currentMonthName = MONTH_NAMES[selectedMonth]
  const prevMonthName = selectedMonth === 0 ? 'dicembre' : MONTH_NAMES[selectedMonth - 1]
  const prevYear = selectedMonth === 0 ? year - 1 : year

  const { increases, savings } = splitMovers(movers)

  return (
    <section aria-labelledby="movers-heading" className="space-y-3">
      <p id="movers-heading" className="text-sm text-muted-foreground">
        Spese di{' '}
        <strong className="font-semibold text-foreground">{currentMonthName}</strong>{' '}
        rispetto a {prevMonthName}
        {selectedMonth === 0 ? ` ${prevYear}` : ''}
      </p>

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
        /* Two-column table layout: increases left, savings right, no scrolling needed */
        <div className="grid grid-cols-2 divide-x divide-border">
          {/* D-02: "Dove hai speso di più" — red header, hidden when empty (MOVE-02) */}
          <div className="pr-4">
            {increases.length > 0 && (
              <>
                <p className="text-xs font-semibold text-[var(--total-out)] mb-2">
                  Dove hai speso di più
                </p>
                <ul className="divide-y divide-border/40">
                  {increases.map((m) => (
                    <li
                      key={m.categoryId}
                      className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
                    >
                      <span className="text-sm truncate mr-2">{m.name}</span>
                      <span className="text-sm font-medium whitespace-nowrap text-right shrink-0">
                        {formatMoverAmount(m)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* D-02: "Dove hai risparmiato" — green header, hidden when empty (MOVE-02) */}
          <div className="pl-4">
            {savings.length > 0 && (
              <>
                <p className="text-xs font-semibold text-[var(--total-in)] mb-2">
                  Dove hai risparmiato
                </p>
                <ul className="divide-y divide-border/40">
                  {savings.map((m) => (
                    <li
                      key={m.categoryId}
                      className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
                    >
                      <span className="text-sm truncate mr-2">{m.name}</span>
                      <span className="text-sm font-medium whitespace-nowrap text-right shrink-0">
                        {formatMoverAmount(m)}
                      </span>
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

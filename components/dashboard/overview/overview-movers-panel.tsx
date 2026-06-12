'use client'
import { Loader2 } from 'lucide-react'
import type { MonthOverMonthChange } from '@/lib/dal/overview'
import { takeTopMovers, moverAmountTone, moverQualifier, splitMovers } from './overview-movers-format'
import { formatEur } from './format'

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
  // D-02: direction determines heading copy and layout (in/out = per-category; allocation = per-nature).
  direction: 'in' | 'out' | 'allocation'
}

/**
 * Presentational panel displaying top-movers for a given month.
 *
 * No fetching — all state lives in OverviewMoversSection (the shared parent).
 * Receives pre-computed movers and isPending flag to show loading state.
 *
 * D-02: direction-aware heading (in=income/out=spending/allocation=savings).
 * D-03: allocation movers are per-nature (savings/investment, max 2 rows).
 * D-04: allocation empty state shows Italian copy for empty month.
 */
export function OverviewMoversPanel({ year, selectedMonth, movers, isPending, direction }: Props) {
  // Derive heading strings for D-02: current month vs previous month (year-crossing for January).
  const currentMonthName = MONTH_NAMES[selectedMonth]
  const prevMonthName = selectedMonth === 0 ? 'dicembre' : MONTH_NAMES[selectedMonth - 1]
  const prevYear = selectedMonth === 0 ? year - 1 : year
  const prevSuffix = selectedMonth === 0 ? ` ${prevYear}` : ''

  // D-02: direction-specific heading copy.
  const headingCopy =
    direction === 'in'
      ? `Entrate di ${currentMonthName} rispetto a ${prevMonthName}${prevSuffix}`
      : direction === 'allocation'
        ? `Accantonamenti di ${currentMonthName} rispetto a ${prevMonthName}${prevSuffix}`
        : `Spese di ${currentMonthName} rispetto a ${prevMonthName}${prevSuffix}`

  // D-04: direction-specific empty state copy.
  const emptyStateCopy =
    direction === 'allocation'
      ? `Nessun accantonamento in ${currentMonthName}.`
      : direction === 'in'
        ? 'Nessuna variazione significativa nelle entrate.'
        : 'Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15.'

  if (direction === 'allocation') {
    // D-03: allocation movers are per-nature (at most 2 rows: Risparmio + Investimento).
    // The DAL populates m.name = nature label (e.g. "Risparmio", "Investimento") for allocation grain.
    return (
      <section aria-labelledby="movers-heading" className="space-y-3">
        <p id="movers-heading" className="text-sm text-muted-foreground">
          {headingCopy.split(currentMonthName).map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>{part}<strong className="font-semibold text-foreground">{currentMonthName}</strong></span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>

        {isPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Caricamento in corso" />
          </div>
        ) : movers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyStateCopy}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {movers.slice(0, 2).map((m, idx) => (
              <li
                key={m.natureCode ?? m.name ?? idx}
                className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
              >
                <span className="text-sm truncate mr-2">{m.name}</span>
                <span className="text-sm font-medium whitespace-nowrap text-right shrink-0">
                  {/* D-03: positive Δ in green (more allocated = good), negative in red */}
                  <span className={Number(m.delta) >= 0 ? 'text-[var(--total-in)]' : 'text-[var(--total-out)]'}>
                    {Number(m.delta) >= 0 ? '+' : ''}{formatEur(Number(m.delta))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  // IN and OUT movers — per-category layout (existing behavior, direction-aware heading).
  // FRU-FIX-01(a): cap to top 5 before partitioning (DAL already sorts by |delta| desc)
  const { increases, savings } = splitMovers(takeTopMovers(movers))

  // Direction-specific sub-header copy.
  const increasesLabel = direction === 'in' ? 'Entrate in aumento' : 'Dove hai speso di più'
  const savingsLabel = direction === 'in' ? 'Entrate in calo' : 'Dove hai risparmiato'

  return (
    <section aria-labelledby="movers-heading" className="space-y-3">
      <p id="movers-heading" className="text-sm text-muted-foreground">
        {headingCopy.split(currentMonthName).map((part, i, arr) =>
          i < arr.length - 1 ? (
            <span key={i}>{part}<strong className="font-semibold text-foreground">{currentMonthName}</strong></span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>

      {isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Caricamento in corso" />
        </div>
      ) : movers.length === 0 ? (
        /* D-07: empty state — first month or all deltas below €15 noise floor (MOVE-05) */
        <p className="text-sm text-muted-foreground">{emptyStateCopy}</p>
      ) : (
        /* Two-column table layout: increases left, savings right, no scrolling needed */
        <div className="grid grid-cols-2 divide-x divide-border">
          {/* D-02: increases column — hidden when empty (MOVE-02) */}
          <div className="pr-4">
            {increases.length > 0 && (
              <>
                <p className="text-xs font-semibold text-foreground mb-2">
                  {increasesLabel}
                </p>
                <ul className="divide-y divide-border/40">
                  {increases.map((m) => (
                    <li
                      key={m.categoryId ?? m.name}
                      className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
                    >
                      <span className="text-sm truncate mr-2">{m.name}</span>
                      {/* FRU-FIX-01(b): colored euro amount + FRU-FIX-01(c): muted qualifier */}
                      <span className="text-sm font-medium whitespace-nowrap text-right shrink-0">
                        <span className={moverAmountTone(m) === 'increase' ? 'text-[var(--total-out)]' : 'text-[var(--total-in)]'}>
                          {formatEur(Math.abs(Number(m.delta)))}
                        </span>
                        {' '}
                        <span className="text-xs text-muted-foreground">{moverQualifier(m)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* D-02: savings/decrease column — hidden when empty (MOVE-02) */}
          <div className="pl-4">
            {savings.length > 0 && (
              <>
                <p className="text-xs font-semibold text-foreground mb-2">
                  {savingsLabel}
                </p>
                <ul className="divide-y divide-border/40">
                  {savings.map((m) => (
                    <li
                      key={m.categoryId ?? m.name}
                      className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
                    >
                      <span className="text-sm truncate mr-2">{m.name}</span>
                      {/* FRU-FIX-01(b): colored euro amount + FRU-FIX-01(c): muted qualifier */}
                      <span className="text-sm font-medium whitespace-nowrap text-right shrink-0">
                        <span className={moverAmountTone(m) === 'increase' ? 'text-[var(--total-out)]' : 'text-[var(--total-in)]'}>
                          {formatEur(Math.abs(Number(m.delta)))}
                        </span>
                        {' '}
                        <span className="text-xs text-muted-foreground">{moverQualifier(m)}</span>
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

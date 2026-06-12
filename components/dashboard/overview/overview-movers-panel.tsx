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
  moversIn: MonthOverMonthChange[]
  moversOut: MonthOverMonthChange[]
  moversAllocation: MonthOverMonthChange[]
  isPending: boolean
}

// ─── Single-direction column ──────────────────────────────────────────────────

type DirectionColumnProps = {
  direction: 'in' | 'out' | 'allocation'
  movers: MonthOverMonthChange[]
  currentMonthName: string
  prevMonthName: string
  prevSuffix: string
  isPending: boolean
}

/**
 * Renders a single direction column (Entrate / Uscite / Accantonamenti) within the
 * 3-column movers layout. Self-contained: heading, empty state, and rows.
 */
function DirectionColumn({
  direction,
  movers,
  currentMonthName,
  prevMonthName,
  prevSuffix,
  isPending,
}: DirectionColumnProps) {
  const headingCopy =
    direction === 'in'
      ? `Entrate di ${currentMonthName} rispetto a ${prevMonthName}${prevSuffix}`
      : direction === 'allocation'
        ? `Accantonamenti di ${currentMonthName} rispetto a ${prevMonthName}${prevSuffix}`
        : `Spese di ${currentMonthName} rispetto a ${prevMonthName}${prevSuffix}`

  const emptyStateCopy =
    direction === 'allocation'
      ? `Nessun accantonamento in ${currentMonthName}.`
      : direction === 'in'
        ? 'Nessuna variazione significativa nelle entrate.'
        : 'Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15.'

  const headingWithBold = headingCopy.split(currentMonthName).map((part, i, arr) =>
    i < arr.length - 1 ? (
      <span key={i}>{part}<strong className="font-semibold text-foreground">{currentMonthName}</strong></span>
    ) : (
      <span key={i}>{part}</span>
    )
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{headingWithBold}</p>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Caricamento in corso" />
        </div>
      </div>
    )
  }

  // Allocation direction: per-nature rows (max 2: Risparmio + Investimento).
  if (direction === 'allocation') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{headingWithBold}</p>
        {movers.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyStateCopy}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {movers.slice(0, 2).map((m, idx) => (
              <li
                key={m.natureCode ?? m.name ?? idx}
                className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
              >
                <span className="text-xs truncate mr-2">{m.name}</span>
                <span className="text-xs font-medium whitespace-nowrap text-right shrink-0">
                  {/* Positive Δ = green (more allocated = good), negative = red */}
                  <span className={Number(m.delta) >= 0 ? 'text-[var(--total-in)]' : 'text-[var(--total-out)]'}>
                    {Number(m.delta) >= 0 ? '+' : ''}{formatEur(Number(m.delta))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // IN and OUT directions: per-category two-sub-column layout (increases / savings).
  const { increases, savings } = splitMovers(takeTopMovers(movers))

  const increasesLabel = direction === 'in' ? 'Entrate in aumento' : 'Dove hai speso di più'
  const savingsLabel = direction === 'in' ? 'Entrate in calo' : 'Dove hai risparmiato'

  if (movers.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{headingWithBold}</p>
        <p className="text-xs text-muted-foreground">{emptyStateCopy}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{headingWithBold}</p>
      {increases.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1.5">{increasesLabel}</p>
          <ul className="divide-y divide-border/40">
            {increases.map((m) => (
              <li
                key={m.categoryId ?? m.name}
                className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
              >
                <span className="text-xs truncate mr-2">{m.name}</span>
                <span className="text-xs font-medium whitespace-nowrap text-right shrink-0">
                  <span className={moverAmountTone(m) === 'increase' ? 'text-[var(--total-out)]' : 'text-[var(--total-in)]'}>
                    {formatEur(Math.abs(Number(m.delta)))}
                  </span>
                  {' '}
                  <span className="text-xs text-muted-foreground">{moverQualifier(m)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {savings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1.5">{savingsLabel}</p>
          <ul className="divide-y divide-border/40">
            {savings.map((m) => (
              <li
                key={m.categoryId ?? m.name}
                className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
              >
                <span className="text-xs truncate mr-2">{m.name}</span>
                <span className="text-xs font-medium whitespace-nowrap text-right shrink-0">
                  <span className={moverAmountTone(m) === 'increase' ? 'text-[var(--total-out)]' : 'text-[var(--total-in)]'}>
                    {formatEur(Math.abs(Number(m.delta)))}
                  </span>
                  {' '}
                  <span className="text-xs text-muted-foreground">{moverQualifier(m)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

/**
 * Presentational panel displaying top-movers for all 3 directions simultaneously
 * in a 3-column layout (Entrate | Uscite | Accantonamenti).
 *
 * No fetching — all state lives in OverviewMoversSection (the shared parent).
 * Receives 3 pre-computed movers arrays and isPending flag to show loading state.
 */
export function OverviewMoversPanel({
  year,
  selectedMonth,
  moversIn,
  moversOut,
  moversAllocation,
  isPending,
}: Props) {
  const currentMonthName = MONTH_NAMES[selectedMonth]
  const prevMonthName = selectedMonth === 0 ? 'dicembre' : MONTH_NAMES[selectedMonth - 1]
  const prevYear = selectedMonth === 0 ? year - 1 : year
  const prevSuffix = selectedMonth === 0 ? ` ${prevYear}` : ''

  const shared = { currentMonthName, prevMonthName, prevSuffix, isPending }

  return (
    <section aria-labelledby="movers-panel-heading" className="space-y-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:divide-x md:divide-border">
        <div className="md:pr-4">
          <p className="text-xs font-semibold text-[var(--total-in)] mb-2 uppercase tracking-wide">Entrate</p>
          <DirectionColumn direction="in" movers={moversIn} {...shared} />
        </div>
        <div className="md:px-4">
          <p className="text-xs font-semibold text-[var(--total-out)] mb-2 uppercase tracking-wide">Uscite</p>
          <DirectionColumn direction="out" movers={moversOut} {...shared} />
        </div>
        <div className="md:pl-4">
          <p className="text-xs font-semibold text-[var(--total-allocation)] mb-2 uppercase tracking-wide">Accantonamenti</p>
          <DirectionColumn direction="allocation" movers={moversAllocation} {...shared} />
        </div>
      </div>
    </section>
  )
}

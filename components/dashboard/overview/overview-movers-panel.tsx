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

type MoverListProps = {
  movers: MonthOverMonthChange[]
  emptyStateCopy: string
  toneOnIncrease: 'out' | 'in'
}

function MoverList({ movers, emptyStateCopy, toneOnIncrease }: MoverListProps) {
  if (movers.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyStateCopy}</p>
  }
  return (
    <ul className="divide-y divide-border/40">
      {movers.map((m, idx) => (
        <li
          key={m.categoryId ?? m.natureCode ?? m.name ?? idx}
          className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
        >
          <span className="text-xs truncate mr-2">{m.name}</span>
          <span className="text-xs font-medium whitespace-nowrap text-right shrink-0">
            <span className={moverAmountTone(m) === 'increase' ? `text-[var(--total-${toneOnIncrease})]` : (toneOnIncrease === 'out' ? 'text-[var(--total-in)]' : 'text-[var(--total-out)]')}>
              {formatEur(Math.abs(Number(m.delta)))}
            </span>
            {' '}
            <span className="text-xs text-muted-foreground">{moverQualifier(m)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

 /**
  * Presentational panel displaying top-movers for a selected month in a 4-column layout:
 * Income changes | Savings movers | Higher spending movers | Allocation movers
  *
  * The OUT movers are pre-split by the parent into increases/savings so each gets
  * its own column. No fetching — all state lives in OverviewMoversSection.
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

  const { increases: outIncreases, savings: outSavings } = splitMovers(takeTopMovers(moversOut))
  const topIn = takeTopMovers(moversIn)
  const topAllocation = moversAllocation.slice(0, 2)

  const monthLabel = (
    <>
      <strong className="font-semibold text-foreground">{currentMonthName}</strong>
      {' '}rispetto a {prevMonthName}{prevSuffix}
    </>
  )

  if (isPending) {
    return (
      <section className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Caricamento in corso" />
      </section>
    )
  }

  return (
    <section aria-label="Variazioni del mese selezionato" className="space-y-2">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4 md:divide-x md:divide-border">

        {/* Column 1: Variazioni di entrate */}
        <div className="md:pr-4">
          <p className="text-xs font-semibold text-[var(--total-in)] mb-1 uppercase tracking-wide">Variazioni di entrate</p>
          <p className="text-xs text-muted-foreground mb-2">{monthLabel}</p>
          <MoverList
            movers={topIn}
            emptyStateCopy="Nessuna variazione significativa nelle entrate."
            toneOnIncrease="in"
          />
        </div>

        {/* Column 2: Dove hai risparmiato (OUT decreases) */}
        <div className="md:px-4">
          <p className="text-xs font-semibold text-[var(--total-in)] mb-1 uppercase tracking-wide">Dove hai risparmiato</p>
          <p className="text-xs text-muted-foreground mb-2">{monthLabel}</p>
          <MoverList
            movers={outSavings}
            emptyStateCopy="Nessun risparmio significativo questo mese."
            toneOnIncrease="out"
          />
        </div>

        {/* Column 3: Dove hai speso di più (OUT increases) */}
        <div className="md:px-4">
          <p className="text-xs font-semibold text-[var(--total-out)] mb-1 uppercase tracking-wide">Dove hai speso di più</p>
          <p className="text-xs text-muted-foreground mb-2">{monthLabel}</p>
          <MoverList
            movers={outIncreases}
            emptyStateCopy="Nessuna spesa in aumento significativa."
            toneOnIncrease="out"
          />
        </div>

        {/* Column 4: Accantonamenti */}
        <div className="md:pl-4">
          <p className="text-xs font-semibold text-[var(--total-allocation)] mb-1 uppercase tracking-wide">Accantonamenti</p>
          <p className="text-xs text-muted-foreground mb-2">{monthLabel}</p>
          {topAllocation.length === 0 ? (
            <p className="text-xs text-muted-foreground">{`Nessun accantonamento in ${currentMonthName}.`}</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {topAllocation.map((m, idx) => (
                <li
                  key={m.natureCode ?? m.name ?? idx}
                  className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
                >
                  <span className="text-xs truncate mr-2">{m.name}</span>
                  <span className="text-xs font-medium whitespace-nowrap text-right shrink-0">
                    <span className={Number(m.delta) >= 0 ? 'text-[var(--total-in)]' : 'text-[var(--total-out)]'}>
                      {Number(m.delta) >= 0 ? '+' : ''}{formatEur(Math.abs(Number(m.delta)))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </section>
  )
}

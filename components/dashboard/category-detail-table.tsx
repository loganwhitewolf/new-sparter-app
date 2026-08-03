import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type {
  CategoryDetailWindowMonth,
  CategoryDetailYearWindowData,
} from '@/lib/dal/category-detail-year-window'
import {
  PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS,
  resolveComparisonJudgement,
  type ComparisonJudgement,
} from '@/lib/services/pace-and-projection'
import { cn } from '@/lib/utils'
import { toDecimal } from '@/lib/utils/decimal'

const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

function formatAmount(value: string): string {
  const amount = toDecimal(value).toNumber()
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0)
}

/** D-09/CONTEXT.md "Segno e verso dei confronti": magnitude + word, never a sign glyph. */
function formatDeltaWords(delta: string): string {
  const decimalDelta = toDecimal(delta)
  const magnitude = formatAmount(decimalDelta.abs().toFixed(2))

  if (decimalDelta.isZero()) return `${magnitude} invariato`
  return decimalDelta.isPositive() ? `${magnitude} in più` : `${magnitude} in meno`
}

function judgementClassName(judgement: ComparisonJudgement): string {
  switch (judgement) {
    case 'better':
      return 'text-[var(--total-in)]'
    case 'worse':
      return 'text-[var(--total-out)]'
    default:
      return 'text-muted-foreground'
  }
}

// D-19/84-PATTERNS.md: sticky columns have no other precedent in the codebase — treated as
// net-new work modeled directly on .scratch/dashboard-categories/detail-table.html.
const UNCOVERED_CELL_CLASSNAME =
  'bg-[repeating-linear-gradient(45deg,transparent_0_5px,rgba(113,113,122,0.10)_5px_10px)]'
const CURRENT_MONTH_CLASSNAME = 'bg-[#fff7ed] dark:bg-[#1c1207]'
const ESTIMATED_MONTH_CLASSNAME = 'italic text-muted-foreground'

function monthCellClassName(month: CategoryDetailWindowMonth): string {
  switch (month.state) {
    case 'current':
      return CURRENT_MONTH_CLASSNAME
    case 'estimated':
      return ESTIMATED_MONTH_CLASSNAME
    case 'uncovered':
      return UNCOVERED_CELL_CLASSNAME
    default:
      return ''
  }
}

const UNCOVERED_TITLE = 'Mese non importato: escluso dalle medie'

type Props = { data: CategoryDetailYearWindowData }

const PREVIOUS_YEAR_ROWHEAD_CLASSNAME = 'sticky left-0 z-20 min-w-[148px] bg-card font-normal text-muted-foreground'
const SUMMARY_CELL_CLASSNAME =
  'sticky right-0 z-20 min-w-[168px] border-l-2 border-foreground bg-muted align-top text-right'

/**
 * The category detail table (D-19, prototype variant A): row 1 is the current window (sticky
 * first column, sticky summary column, per-cell month-over-month delta); row 2 is the
 * previous-year homologous window (D-11) — plain amounts, no per-cell delta, or a stated-reason
 * line when the previous year has zero Covered Months inside the window; row 3 is "Differenza"
 * (D-12/CDET-07), rendered only when row 2 is available.
 */
export function CategoryDetailTable({ data }: Props) {
  const { category, window, current, previousYear } = data
  const [rowHeadYear] = window.from.split('-')
  const direction = category?.type ?? 'out'
  const windowLength = current.months.length
  const hasReducedDenominator = current.coveredMonthCountInWindow < windowLength
  const previousYearLabel = String(Number(rowHeadYear) - 1)

  return (
    <Table aria-label="Andamento categoria" className="min-w-[1040px] border-separate border-spacing-0">
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-20 min-w-[148px] bg-card text-left">
            {rowHeadYear}
          </TableHead>
          {current.months.map((month) => (
            <TableHead
              key={month.yearMonth}
              className={cn('text-right tabular-nums', monthCellClassName(month))}
              title={month.state === 'uncovered' ? UNCOVERED_TITLE : undefined}
            >
              {month.label}
            </TableHead>
          ))}
          <TableHead className="sticky right-0 z-20 min-w-[168px] border-l-2 border-foreground bg-muted text-right">
            Anno
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="sticky left-0 z-20 min-w-[148px] bg-card font-medium">
            {category?.name ?? '—'}
          </TableCell>
          {current.months.map((month, index) => {
            if (month.state === 'uncovered') {
              return (
                <TableCell
                  key={month.yearMonth}
                  className={cn('text-right tabular-nums', UNCOVERED_CELL_CLASSNAME)}
                  title={UNCOVERED_TITLE}
                >
                  non importato
                </TableCell>
              )
            }

            const judgement =
              month.monthOverMonthDelta !== null
                ? resolveComparisonJudgement(month.monthOverMonthDelta, direction)
                : null
            // The window's first column has no in-window predecessor at all (D-01 must-have) —
            // never a delta, never "nessun confronto", regardless of the DAL's null value.
            const showDeltaLine = index > 0 && month.state !== 'estimated'

            return (
              <TableCell
                key={month.yearMonth}
                className={cn('text-right tabular-nums', monthCellClassName(month))}
              >
                {month.amount !== null ? formatAmount(month.amount) : null}
                {showDeltaLine && month.monthOverMonthDelta !== null ? (
                  <span
                    className={cn('block text-[11px]', judgement ? judgementClassName(judgement) : '')}
                  >
                    {formatDeltaWords(month.monthOverMonthDelta)}
                  </span>
                ) : null}
                {showDeltaLine && month.monthOverMonthDelta === null && month.amount !== null ? (
                  <span className="block text-[11px] text-muted-foreground">nessun confronto</span>
                ) : null}
              </TableCell>
            )
          })}
          <TableCell className={SUMMARY_CELL_CLASSNAME}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span>Totale</span>
              <b className="font-mono tabular-nums">{formatAmount(current.total)}</b>
            </div>
            {hasReducedDenominator ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Mese non importato: {current.uncoveredMonthLabels.join(', ')}
              </p>
            ) : null}
            <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs">
              <span>Media/mese</span>
              <b className="font-mono tabular-nums">{formatAmount(current.average)}</b>
            </div>
            {hasReducedDenominator ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                su {current.coveredMonthCountInWindow} mesi coperti
              </p>
            ) : null}
          </TableCell>
        </TableRow>

        {/* Row 2 — previous-year homologous window (D-11/CDET-02): plain amounts, muted, no
            per-cell delta; a stated-reason line replaces the row entirely when unavailable —
            never a silent gap. */}
        {previousYear.status === 'available' ? (
          <TableRow>
            <TableCell className={PREVIOUS_YEAR_ROWHEAD_CLASSNAME}>{previousYearLabel} (stessa finestra)</TableCell>
            {previousYear.series.months.map((month) => (
              <TableCell key={month.yearMonth} className="text-right tabular-nums text-muted-foreground">
                {month.amount !== null ? formatAmount(month.amount) : 'non importato'}
              </TableCell>
            ))}
            <TableCell className={cn(SUMMARY_CELL_CLASSNAME, 'text-muted-foreground')}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span>Totale</span>
                <b className="font-mono tabular-nums">{formatAmount(previousYear.series.total)}</b>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs">
                <span>Media/mese</span>
                <b className="font-mono tabular-nums">{formatAmount(previousYear.series.average)}</b>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          <TableRow>
            <TableCell colSpan={windowLength + 2} className="text-sm text-muted-foreground">
              Nessun mese coperto nel {previousYearLabel} per questa finestra
            </TableCell>
          </TableRow>
        )}

        {/* Row 3 — Differenza (D-12/CDET-04/CDET-07): only when row 2 is available. Totale is
            gated by canShowPreviousYearTotalDifference (a stated reason when insufficient);
            Media ALWAYS renders as magnitude+word, regardless of that gate. */}
        {previousYear.status === 'available' ? (
          <TableRow>
            <TableCell className="sticky left-0 z-20 min-w-[148px] bg-card font-normal">Differenza</TableCell>
            <TableCell colSpan={windowLength} className="text-left align-middle text-[12px] text-muted-foreground">
              Il confronto mese per mese si legge dalle due righe sopra; la sintesi è nella colonna Anno.
            </TableCell>
            <TableCell className={SUMMARY_CELL_CLASSNAME}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span>Totale — Rispetto al {previousYearLabel}</span>
                {previousYear.totalDifference.status === 'shown' ? (
                  <b
                    className={cn(
                      'font-mono tabular-nums',
                      judgementClassName(resolveComparisonJudgement(previousYear.totalDifference.value, direction)),
                    )}
                  >
                    {formatDeltaWords(previousYear.totalDifference.value)}
                  </b>
                ) : null}
              </div>
              {previousYear.totalDifference.status === 'insufficient' ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Dati insufficienti nel {previousYearLabel}: {previousYear.totalDifference.coveredMonthCount} mesi
                  coperti su {PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS} richiesti
                </p>
              ) : null}
              <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs">
                <span>Media/mese — Rispetto al {previousYearLabel}</span>
                <b
                  className={cn(
                    'font-mono tabular-nums',
                    judgementClassName(resolveComparisonJudgement(previousYear.averageDifference, direction)),
                  )}
                >
                  {formatDeltaWords(previousYear.averageDifference)}
                </b>
              </div>
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  )
}

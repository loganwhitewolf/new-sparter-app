import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { CategoryDetailSubcategoryContribution } from '@/lib/dal/category-detail-year-window'
import { transactionsBySubcategoryHref } from '@/lib/routes'
import { resolveComparisonJudgement, type ComparisonJudgement } from '@/lib/services/pace-and-projection'
import { cn } from '@/lib/utils'
import { toDecimal } from '@/lib/utils/decimal'

type Props = {
  contributions: CategoryDetailSubcategoryContribution[]
  /**
   * The selected window's year (Rule 2 auto-add: the plan's props list omitted this, but the
   * "Totale {year}"/"nuova nel {year}"/"solo nel {year-1}" copy needs it — falling back to
   * `new Date().getFullYear()` would mislabel every past year the user can select via `?year=`).
   */
  year: number
  type?: 'in' | 'out'
  /**
   * NAV-01/D-01: both `categorySlug` and `backHref` must be present for a row to become a link —
   * the parent category's own detail-page href cannot be reconstructed from a subcategory row
   * alone. When either is omitted, every row falls back to today's plain text.
   */
  categorySlug?: string
  backHref?: string
}

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

function formatAmount(value: string): string {
  const amount = toDecimal(value).toNumber()
  return currencyFormatter.format(Number.isFinite(amount) ? Math.abs(amount) : 0)
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

function safePercentage(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 100)) : 0
}

/**
 * The `previous-only` suffix only (NAV-05/D-06): `current-only` no longer returns an inline
 * sentence here — it renders a "nuova" Badge+Tooltip instead (see `isNewInYear` below). Stays a
 * single, clearly-total function for the still-needed `previous-only` case.
 */
function presenceSuffix(presence: CategoryDetailSubcategoryContribution['presence'], year: number): string | null {
  if (presence === 'previous-only') return `— solo nel ${year - 1}`
  return null
}

/** NAV-05/D-06: a `current-only` row shows the "nuova" badge instead of the retired inline sentence. */
function isNewInYear(presence: CategoryDetailSubcategoryContribution['presence']): boolean {
  return presence === 'current-only'
}

/**
 * The subcategory contribution table (CDET-05/D-16): ordered by current-window weight, each row
 * carrying its contribution to the parent category's total difference (current - previous). The
 * Totale row is not decoration — it is the on-screen proof that the contributions sum EXACTLY to
 * the parent's own total difference, computed here by summing the already-provided
 * currentAmount/contribution strings via Decimal.js, never by re-deriving from previousYear.
 */
export function CategorySubcategoryBreakdown({
  contributions,
  year,
  type = 'out',
  categorySlug,
  backHref,
}: Props) {
  if (contributions.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium">Nessuna sottocategoria nel periodo</p>
          <p className="text-sm text-muted-foreground">
            Aggiungi o categorizza movimenti per vedere la distribuzione interna.
          </p>
        </div>
      </div>
    )
  }

  const barColor = type === 'in' ? 'bg-[var(--total-in)]' : 'bg-[var(--total-out)]'

  const totalCurrentAmount = contributions
    .reduce((sum, row) => sum.plus(toDecimal(row.currentAmount)), toDecimal(0))
    .toFixed(2)
  const totalContribution = contributions
    .reduce((sum, row) => sum.plus(toDecimal(row.contribution)), toDecimal(0))
    .toFixed(2)

  return (
    <div className="space-y-2">
      <Table aria-label="Ripartizione sottocategorie">
        <TableHeader>
          <TableRow>
            <TableHead>Sottocategoria</TableHead>
            <TableHead className="min-w-[140px]">Peso</TableHead>
            <TableHead className="text-right">Totale {year}</TableHead>
            <TableHead className="text-right">Contributo alla differenza</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contributions.map((row) => {
            const percentage = safePercentage(row.weightPercentage)
            const suffix = presenceSuffix(row.presence, year)
            const judgement = resolveComparisonJudgement(row.contribution, type)
            const isGone = row.presence === 'previous-only'

            return (
              <TableRow key={row.id} className={isGone ? 'text-muted-foreground' : undefined}>
                <TableCell className="max-w-0">
                  {categorySlug && backHref ? (
                    <Link
                      href={transactionsBySubcategoryHref(row.id, categorySlug, year, backHref)}
                      className="truncate underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      title={row.name}
                    >
                      {row.name}
                    </Link>
                  ) : (
                    <span className="truncate" title={row.name}>
                      {row.name}
                    </span>
                  )}
                  {isNewInYear(row.presence) ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="ml-1 align-middle">
                            nuova
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          questa spesa compare per la prima volta nel {year}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                  {suffix ? <span className="ml-1 text-xs text-muted-foreground">{suffix}</span> : null}
                </TableCell>
                <TableCell>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${percentage}% del totale categoria`}
                  >
                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${percentage}%` }} />
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatAmount(row.currentAmount)} · {percentage}%
                </TableCell>
                <TableCell
                  className={cn('text-right font-mono text-sm tabular-nums', judgementClassName(judgement))}
                >
                  {formatDeltaWords(row.contribution)}
                </TableCell>
              </TableRow>
            )
          })}
          <TableRow className="border-t-2 border-foreground font-semibold">
            <TableCell>Totale</TableCell>
            <TableCell />
            <TableCell className="text-right font-mono text-sm tabular-nums">
              {formatAmount(totalCurrentAmount)}
            </TableCell>
            <TableCell
              className={cn(
                'text-right font-mono text-sm tabular-nums',
                judgementClassName(resolveComparisonJudgement(totalContribution, type)),
              )}
            >
              {formatDeltaWords(totalContribution)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {/* CR-01 fix (84-REVIEW.md): this table's "Contributo alla differenza" sums to the RAW,
          non-projected difference (previousYear.rawTotalDifference) — never the pace/hybrid-
          projected "Differenza" shown in the table above. Without this qualifier the two figures
          look like the same number and can silently disagree whenever the window includes the
          current or a future month. */}
      <p className="text-xs text-muted-foreground">
        Confronto su mesi osservati: esclude le proiezioni sui mesi futuri della finestra.
      </p>
    </div>
  )
}

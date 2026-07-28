'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toDecimal } from '@/lib/utils/decimal'
import { amountToneClass } from '@/lib/utils/amount-tone'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import { DataTableToolbar, useToolbarSort } from '@/components/data-table/DataTableToolbar'
import { EmptyState } from '@/components/data-table/EmptyState'
import { HeaderSortButton } from '@/components/data-table/HeaderSortButton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AMORTIZATIONS_TABLE_CONFIG } from '@/lib/utils/amortizations-table-config'
import { transactionDetailHref } from '@/lib/routes'
import type { AmortizationPlanListRow } from '@/lib/dal/amortization'

type Props = {
  plans: AmortizationPlanListRow[]
  route: string
}

const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

// Signed currency for the Netto column — mirrors ReimbursementTable's own local
// formatSignedAmount helper exactly (components/reimbursements/reimbursement-table.tsx),
// including its non-finite fallback convention: on a bad upstream value, return the raw string
// suffixed with the currency code instead of silently coercing to €0.00, so the bug surfaces
// visibly rather than reading as a plausible amount.
function formatSignedAmount(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return `${value} EUR`
  }
  return amountFormatter.format(amount)
}

/**
 * resolveEffectiveStatusFilter (D-C1) — the registry defaults to showing open plans only. This
 * deliberately overrides the shared DataTableToolbar's generic "absent param = show all"
 * convention: only an EXPLICIT status=closed URL param reveals closed plans; every other input
 * (null, undefined, 'open', or any unrecognized value) resolves to 'open'. The toolbar's own
 * Select control may visually show "Tutte" selected while this function still resolves 'open' —
 * an accepted UI-SPEC tradeoff, not a bug to "fix" toward showing all plans by default.
 */
export function resolveEffectiveStatusFilter(statusParam: string | null): 'open' | 'closed' {
  return statusParam === 'closed' ? 'closed' : 'open'
}

/**
 * Pure sort helper (unit-testable without jsdom — mirrors sortReimbursementRows). Numeric
 * monetary keys use Decimal.comparedTo() for precision; remainingMonths is a plain numeric
 * subtraction (a count, not money — exempt from the Decimal.js rule); description uses
 * localeCompare; transactionDate (default) uses getTime() subtraction. Ties preserve input order
 * (Array.prototype.sort is spec-guaranteed stable).
 */
export function sortAmortizationRows(
  rows: AmortizationPlanListRow[],
  sort: string,
  dir: 'asc' | 'desc',
): AmortizationPlanListRow[] {
  const factor = dir === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    if (sort === 'description') {
      return factor * a.description.localeCompare(b.description)
    }
    if (sort === 'initialAmount') {
      return factor * toDecimal(a.initialAmount).comparedTo(toDecimal(b.initialAmount))
    }
    if (sort === 'consumedAmount') {
      return factor * toDecimal(a.consumedAmount).comparedTo(toDecimal(b.consumedAmount))
    }
    if (sort === 'netValue') {
      return factor * toDecimal(a.netValue).comparedTo(toDecimal(b.netValue))
    }
    if (sort === 'remainingMonths') {
      return factor * (a.remainingMonths - b.remainingMonths)
    }
    // 'transactionDate' (default)
    return factor * (a.transactionDate.getTime() - b.transactionDate.getTime())
  })
}

export function AmortizationTable({ plans, route }: Props) {
  const searchParams = useSearchParams()
  const { activeSort, activeDir, onSort } = useToolbarSort(route)

  const effectiveStatus = resolveEffectiveStatusFilter(searchParams.get('status'))
  const q = searchParams.get('q')?.trim().toLowerCase() ?? ''

  const filtered = plans.filter((row) => {
    if (row.status !== effectiveStatus) return false
    if (q && !row.displayTitle.toLowerCase().includes(q)) return false
    return true
  })

  const sortKey = activeSort ?? AMORTIZATIONS_TABLE_CONFIG.defaultSort.key
  const sortDir = activeSort ? activeDir : AMORTIZATIONS_TABLE_CONFIG.defaultSort.dir
  const sorted = sortAmortizationRows(filtered, sortKey, sortDir)

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar config={AMORTIZATIONS_TABLE_CONFIG} route={route} />

      {sorted.length === 0 ? (
        <EmptyState
          variant="no-result"
          message="Nessun ammortamento trovato"
          hint="Prova a modificare i filtri o la ricerca."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <HeaderSortButton
                column={{ key: 'description', label: 'Descrizione' }}
                activeSort={activeSort}
                activeDir={activeDir}
                onSort={onSort}
              />
              <HeaderSortButton
                column={{ key: 'transactionDate', label: 'Data' }}
                activeSort={activeSort}
                activeDir={activeDir}
                onSort={onSort}
              />
              <HeaderSortButton
                column={{ key: 'initialAmount', label: 'Importo iniziale' }}
                activeSort={activeSort}
                activeDir={activeDir}
                align="right"
                onSort={onSort}
              />
              <HeaderSortButton
                column={{ key: 'consumedAmount', label: 'Consumato' }}
                activeSort={activeSort}
                activeDir={activeDir}
                align="right"
                onSort={onSort}
              />
              <HeaderSortButton
                column={{ key: 'netValue', label: 'Netto' }}
                activeSort={activeSort}
                activeDir={activeDir}
                align="right"
                onSort={onSort}
              />
              <HeaderSortButton
                column={{ key: 'remainingMonths', label: 'Rate rimanenti' }}
                activeSort={activeSort}
                activeDir={activeDir}
                onSort={onSort}
              />
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.id}>
                {/* `max-w-0 w-full` + inner `truncate` is the shared no-horizontal-scroll
                    pattern (transaction-table.tsx, reimbursement-table.tsx): the description
                    column absorbs the leftover width and ellipsizes instead of widening the
                    table. D-D1: links to the amortized transaction's own detail page. */}
                <TableCell className="max-w-0 w-full">
                  <Link
                    href={transactionDetailHref(row.transactionId)}
                    className="block truncate text-sm font-medium hover:underline"
                    title={row.displayTitle}
                  >
                    {row.displayTitle}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {row.transactionDate.toLocaleDateString('it-IT')}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-mono tabular-nums text-sm">
                  {formatAbsoluteAmount(row.initialAmount)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-mono tabular-nums text-sm">
                  {formatAbsoluteAmount(row.consumedAmount)}
                </TableCell>
                <TableCell
                  className={`whitespace-nowrap text-right font-mono tabular-nums text-sm ${amountToneClass(row.netValue)}`}
                >
                  {formatSignedAmount(row.netValue)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  <div className="flex flex-col gap-1">
                    <span>
                      {row.remainingMonths}/{row.totalMonths}
                    </span>
                    <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${((row.totalMonths - row.remainingMonths) / row.totalMonths) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={row.status === 'open' ? 'default' : 'secondary'}>
                    {row.status === 'open' ? 'Aperto' : 'Chiuso'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

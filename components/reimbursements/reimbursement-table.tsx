'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toDecimal } from '@/lib/utils/decimal'
import { amountToneClass } from '@/lib/utils/amount-tone'
import { DataTableToolbar, useToolbarSort } from '@/components/data-table/DataTableToolbar'
import { EmptyState } from '@/components/data-table/EmptyState'
import { HeaderSortButton } from '@/components/data-table/HeaderSortButton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { REIMBURSEMENTS_TABLE_CONFIG } from '@/lib/utils/reimbursements-table-config'
import { expenseDetailHref, reimbursementHref } from '@/lib/routes'
import type { ReimbursementListRow } from '@/lib/dal/reimbursement'
import { formatResidualBadgeLabel, residualBadgeClassName } from '@/lib/utils/reimbursement-format'

type Props = {
  reimbursements: ReimbursementListRow[]
  route: string
}

const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

// Signed currency — keeps the leading minus so the Netto column reads as negative when still
// owed (the shared formatAbsoluteAmount strips the sign by design). Same local-helper pattern
// components/tags/tag-detail-report.tsx and the Plan 76-01 tracer page already use, rather than
// a new shared util.
//
// On non-finite input (WR-03): mirrors `formatAbsoluteAmount`'s convention
// (lib/utils/format-amount.ts) — returns the raw string suffixed with the currency code instead
// of silently coercing to €0.00, so a genuine upstream bug in residual computation surfaces as
// visibly wrong rather than reading as a plausible "Saldato"-shaped amount.
function formatSignedAmount(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return `${value} EUR`
  }
  return amountFormatter.format(amount)
}

/**
 * Pure sort helper (unit-testable without jsdom — mirrors the computeMergeEligibility-as-
 * standalone-export precedent in components/expenses/expense-table.tsx). `dir` applies to every
 * key uniformly; ties preserve input order (Array.prototype.sort is spec-guaranteed stable, and
 * the DAL already delivers a deterministic upstream order — no bespoke tie-break needed here).
 */
export function sortReimbursementRows(
  rows: ReimbursementListRow[],
  sort: string,
  dir: 'asc' | 'desc',
): ReimbursementListRow[] {
  const factor = dir === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    if (sort === 'title') {
      return factor * a.displayTitle.localeCompare(b.displayTitle)
    }
    if (sort === 'residual') {
      return factor * toDecimal(a.residual).comparedTo(toDecimal(b.residual))
    }
    // 'anchorDate' (default)
    return factor * (a.anchorDate.getTime() - b.anchorDate.getTime())
  })
}

export function ReimbursementTable({ reimbursements, route }: Props) {
  const searchParams = useSearchParams()
  const { activeSort, activeDir, onSort } = useToolbarSort(route)

  const q = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const status = searchParams.get('status')

  const filtered = reimbursements.filter((row) => {
    if (status && row.state !== status) return false
    if (q) {
      const matchesTitle = row.displayTitle.toLowerCase().includes(q)
      const matchesAnchor = row.anchorTitle.toLowerCase().includes(q)
      if (!matchesTitle && !matchesAnchor) return false
    }
    return true
  })

  const sortKey = activeSort ?? REIMBURSEMENTS_TABLE_CONFIG.defaultSort.key
  const sortDir = activeSort ? activeDir : REIMBURSEMENTS_TABLE_CONFIG.defaultSort.dir
  const sorted = sortReimbursementRows(filtered, sortKey, sortDir)

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar config={REIMBURSEMENTS_TABLE_CONFIG} route={route} />

      {sorted.length === 0 ? (
        <EmptyState variant="no-result" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <HeaderSortButton
                column={{ key: 'title', label: 'Titolo' }}
                activeSort={activeSort}
                activeDir={activeDir}
                onSort={onSort}
              />
              <TableHead>Ancora</TableHead>
              <HeaderSortButton
                column={{ key: 'residual', label: 'Netto' }}
                activeSort={activeSort}
                activeDir={activeDir}
                align="right"
                onSort={onSort}
              />
              <TableHead>Stato</TableHead>
              <HeaderSortButton
                column={{ key: 'anchorDate', label: 'Data' }}
                activeSort={activeSort}
                activeDir={activeDir}
                onSort={onSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={reimbursementHref(row.id)} className="text-sm font-medium hover:underline">
                    {row.displayTitle}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={expenseDetailHref(row.anchorExpenseId)}
                    className="text-sm text-muted-foreground hover:underline"
                  >
                    {row.anchorTitle}
                  </Link>
                </TableCell>
                <TableCell
                  className={`text-right font-mono tabular-nums text-sm ${amountToneClass(row.residual)}`}
                >
                  {formatSignedAmount(row.residual)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={residualBadgeClassName(row.state)}>
                    {formatResidualBadgeLabel(row.residual, row.state)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.anchorDate.toLocaleDateString('it-IT')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

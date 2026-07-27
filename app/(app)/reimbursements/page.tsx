import Link from 'next/link'
import { verifySession } from '@/lib/dal/auth'
import { getReimbursementList } from '@/lib/dal/reimbursement'
import { EmptyState } from '@/components/data-table/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { amountToneClass } from '@/lib/utils/amount-tone'
import { formatResidualBadgeLabel, residualBadgeClassName } from '@/lib/utils/reimbursement-format'
import { expenseDetailHref, reimbursementHref } from '@/lib/routes'

export const metadata = { title: 'Rimborsi' }

const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

// Signed currency — keeps the leading minus so the net column reads as negative when still owed
// (the shared formatAbsoluteAmount strips the sign by design; mirrors tag-detail-report.tsx's
// local formatSignedAmount).
function formatSignedAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0)
}

/**
 * Deliberately the thinnest real rendering (Phase 76 Plan 01 tracer): a plain shadcn Table
 * directly in this file, no interactive toolbar. Plan 76-02 extracts this into a client
 * `ReimbursementTable` component and layers search/filter/sort on top.
 */
export default async function ReimbursementsPage() {
  const { userId } = await verifySession()
  const reimbursements = await getReimbursementList(userId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rimborsi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tutti i rimborsi collegati alle tue spese, con il residuo ancora da saldare.
        </p>
      </div>

      {reimbursements.length === 0 ? (
        <EmptyState
          variant="no-data"
          message="Nessun rimborso"
          hint="Collega un rimborso a una spesa per vederlo qui."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titolo</TableHead>
              <TableHead>Spesa collegata</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reimbursements.map((row) => (
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

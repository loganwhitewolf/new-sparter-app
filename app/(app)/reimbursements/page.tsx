import { verifySession } from '@/lib/dal/auth'
import { getReimbursementList } from '@/lib/dal/reimbursement'
import { EmptyState } from '@/components/data-table/EmptyState'
import { ReimbursementTable } from '@/components/reimbursements/reimbursement-table'
import { APP_ROUTES } from '@/lib/routes'

export const metadata = { title: 'Rimborsi' }

/**
 * RSC list page (Phase 76 Plan 01 tracer, expanded in Plan 76-02): DB -> DAL -> real page.
 * Zero-reimbursement accounts render the account-level EmptyState('no-data') here; a non-empty
 * fetch mounts the full interactive ReimbursementTable (search/status filter/sort), which owns
 * its own filtered-to-zero EmptyState('no-result') internally.
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
          hint="Non hai ancora nessun rimborso collegato. Collega un rimborso dalla pagina di una spesa in uscita per vederlo qui."
        />
      ) : (
        <ReimbursementTable reimbursements={reimbursements} route={APP_ROUTES.reimbursements} />
      )}
    </div>
  )
}

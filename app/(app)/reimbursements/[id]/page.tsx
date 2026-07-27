import { notFound } from 'next/navigation'
import { ReimbursementDetailClient } from '@/components/reimbursements/reimbursement-detail-client'
import { verifySession } from '@/lib/dal/auth'
import {
  getReimbursement,
  getReimbursementAnchorTransaction,
  getReimbursementPanelDataById,
} from '@/lib/dal/reimbursement'
import { parsePositiveIntParam } from '@/lib/utils/search-params'

export const metadata = { title: 'Rimborso' }

type Props = {
  params: Promise<{ id: string }>
}

/**
 * Per-reimbursement detail page (Phase 76 Plan 05, RMB-11): header (editable title + status +
 * anchor link) over the reused Plan 75/76-04 `ReimbursementPanel` in its default full-management
 * variant — anchor, refunds, net, residual, and edit-title/add/remove/delete all in one place.
 *
 * IDOR guard (T-76-01, T-76-05): `getReimbursement(userId, reimbursementId)` scopes on BOTH
 * `reimbursement.userId = userId` AND `expenseId IS NOT NULL` in one WHERE clause — a
 * foreign-owned id AND a Group-anchored id resolve identically to `undefined`, routing to the
 * not-found handler below, mirroring `/tags/[id]`'s guard skeleton.
 */
export default async function ReimbursementDetailPage({ params }: Props) {
  const { userId } = await verifySession()
  const { id } = await params

  const reimbursementId = parsePositiveIntParam(id)
  if (reimbursementId === null) {
    notFound()
  }

  const reimbursement = await getReimbursement(userId, reimbursementId)
  if (!reimbursement) {
    notFound()
  }

  const [panelData, anchorTransaction] = await Promise.all([
    getReimbursementPanelDataById({ userId, reimbursementId }),
    getReimbursementAnchorTransaction({ userId, reimbursementId }),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <ReimbursementDetailClient
          reimbursement={reimbursement}
          panelData={panelData}
          anchorTransaction={anchorTransaction}
        />
      </div>
    </div>
  )
}

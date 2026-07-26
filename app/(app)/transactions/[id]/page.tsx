import { notFound } from 'next/navigation'
import { TransactionDetailClient } from '@/components/transactions/transaction-detail-client'
import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { getReimbursementPanelData, getRefundMembership } from '@/lib/dal/reimbursement'
import { getMostUsedSubcategories } from '@/lib/dal/subcategory-usage'
import { getTransactionForDetail } from '@/lib/dal/transactions'
import { getTags } from '@/lib/dal/tags'
import { getTransactionTagsForTransaction } from '@/lib/dal/transaction-tags'
import { toDecimal } from '@/lib/utils/decimal'

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await verifySession()

  const [tx, categories, mostUsed] = await Promise.all([
    getTransactionForDetail({ userId, id }),
    getCategories(),
    getMostUsedSubcategories(['in', 'out', 'transfer', 'allocation']),
  ])

  if (!tx) {
    notFound()
  }

  // D-07b: tag data fetched only after the ownership/404 guard — no wasted queries on a 404 path.
  //
  // Phase 75 Plan 04 gap-closure (fix 1): ADR 0018's anchor invariant is the anchor is ALWAYS the
  // outflow — an inflow can never be one. `getReimbursementPanelData` only ever resolves an ANCHOR
  // lookup, so calling it for an inflow that is itself a linked refund would resolve nothing and
  // wrongly render the "Aggiungi rimborso" CTA. Branch on direction up front: an outflow fetches
  // the anchor panel data as before; an inflow instead resolves `getRefundMembership` (read-only
  // "this transaction IS a refund" state, or undefined if it's an unrelated inflow).
  const isInflow = toDecimal(tx.amount).isPositive()

  const [currentTags, allTags, reimbursementPanelData, refundMembership] = await Promise.all([
    getTransactionTagsForTransaction(userId, id),
    getTags(userId),
    isInflow
      ? Promise.resolve(undefined)
      : getReimbursementPanelData({ userId, anchor: { transactionId: id } }),
    isInflow ? getRefundMembership({ userId, transactionId: id }) : Promise.resolve(undefined),
  ])

  return (
    <TransactionDetailClient
      transaction={tx}
      categories={categories}
      mostUsed={mostUsed}
      currentTags={currentTags}
      allTags={allTags}
      reimbursementPanelData={reimbursementPanelData}
      refundMembership={refundMembership}
    />
  )
}

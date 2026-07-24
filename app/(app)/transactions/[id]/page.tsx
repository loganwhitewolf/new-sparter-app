import { notFound } from 'next/navigation'
import { TransactionDetailClient } from '@/components/transactions/transaction-detail-client'
import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { getReimbursementPanelData } from '@/lib/dal/reimbursement'
import { getMostUsedSubcategories } from '@/lib/dal/subcategory-usage'
import { getTransactionForDetail } from '@/lib/dal/transactions'
import { getTags } from '@/lib/dal/tags'
import { getTransactionTagsForTransaction } from '@/lib/dal/transaction-tags'

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
  // reimbursementPanelData (Plan 75-04, D-02) is fetched the same way — anchor-scoped to this
  // transaction's own id, resolved server-side for ReimbursementPanel.
  const [currentTags, allTags, reimbursementPanelData] = await Promise.all([
    getTransactionTagsForTransaction(userId, id),
    getTags(userId),
    getReimbursementPanelData({ userId, anchor: { transactionId: id } }),
  ])

  return (
    <TransactionDetailClient
      transaction={tx}
      categories={categories}
      mostUsed={mostUsed}
      currentTags={currentTags}
      allTags={allTags}
      reimbursementPanelData={reimbursementPanelData}
    />
  )
}

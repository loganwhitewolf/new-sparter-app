import { notFound, redirect } from 'next/navigation'
import { FileDetailClient } from '@/components/import/file-detail-client'
import { verifySession } from '@/lib/dal/auth'
import { getFileDetailForUser } from '@/lib/dal/files'
import { getTransactionsByFileId } from '@/lib/dal/transactions'
import { APP_ROUTES } from '@/lib/routes'

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ fileId: string }>
}) {
  const { fileId } = await params
  const { userId } = await verifySession()

  const fileDetail = await getFileDetailForUser({ userId, fileId })

  if (!fileDetail) {
    notFound()
  }

  if (fileDetail.status !== 'imported') {
    // D-09: failed stays handled by the table (delete) — never rendered here.
    if (fileDetail.status === 'failed') {
      notFound()
    }

    // pending_upload should not normally be reachable from a file list row;
    // treat as a defensive fallback back to the import table.
    if (fileDetail.status === 'pending_upload') {
      redirect(APP_ROUTES.import)
    }

    // uploaded, analyzing, analyzed, importing — mid-workflow, send to the
    // analyze page which already knows how to route each of these statuses.
    redirect(`/import/${fileId}/analyze`)
  }

  const transactions = await getTransactionsByFileId({ userId, fileId })

  return <FileDetailClient file={fileDetail} transactions={transactions} />
}

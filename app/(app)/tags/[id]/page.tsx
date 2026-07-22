import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { TagDetailReport } from '@/components/tags/tag-detail-report'
import { ArchiveTagDialog, EditTagDialog } from '@/components/tags/tag-mutation-dialogs'
import { verifySession } from '@/lib/dal/auth'
import { getTag, getTagDetail } from '@/lib/dal/tags'
import { formatOptionalDateRange } from '@/lib/utils/date'
import { parsePositiveIntParam } from '@/lib/utils/search-params'

export const metadata = { title: 'Tag' }

type Props = {
  params: Promise<{ id: string }>
}

export default async function TagDetailPage({ params }: Props) {
  const { userId } = await verifySession()
  const { id } = await params

  const tagId = parsePositiveIntParam(id)
  if (tagId === null) {
    notFound()
  }

  // IDOR boundary (T-69-01): a tag not owned by the session user resolves to null → notFound()
  // before any detail query runs. getTagDetail is additionally scoped by transaction.userId.
  const tag = await getTag(userId, tagId)
  if (tag === null) {
    notFound()
  }

  const detail = await getTagDetail(userId, tagId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{tag.name}</h1>
              {tag.archived && <Badge variant="secondary">Archiviato</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{formatOptionalDateRange(tag.dateRangeStart, tag.dateRangeEnd)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <EditTagDialog tag={tag} />
            {!tag.archived && <ArchiveTagDialog tag={tag} />}
          </div>
        </header>

        <TagDetailReport detail={detail} tagId={tag.id} />
      </div>
    </div>
  )
}

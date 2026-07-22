import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { TagDetailReport } from '@/components/tags/tag-detail-report'
import { ArchiveTagDialog, EditTagDialog } from '@/components/tags/tag-mutation-dialogs'
import { verifySession } from '@/lib/dal/auth'
import { getTag, getTagDetail, type TagRow } from '@/lib/dal/tags'

export const metadata = { title: 'Tag' }

type Props = {
  params: Promise<{ id: string }>
}

// Positive-int guard (T-69-02): reject any malformed/overflow id before it reaches the DAL.
// Mirrors parseCategoryId in app/(app)/dashboard/categories/[id]/page.tsx.
function parseTagId(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

// Same wording as the former tag-settings-panel detail (D4): "Nessun intervallo" when either
// bound is null; otherwise the it-IT range.
function formatDateRange(tag: TagRow): string {
  if (!tag.dateRangeStart || !tag.dateRangeEnd) return 'Nessun intervallo'
  const start = tag.dateRangeStart.toLocaleDateString('it-IT')
  const end = tag.dateRangeEnd.toLocaleDateString('it-IT')
  return `${start} — ${end}`
}

export default async function TagDetailPage({ params }: Props) {
  const { userId } = await verifySession()
  const { id } = await params

  const tagId = parseTagId(id)
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
            <p className="mt-1 text-sm text-muted-foreground">{formatDateRange(tag)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <EditTagDialog tag={tag} />
            {!tag.archived && <ArchiveTagDialog tag={tag} />}
          </div>
        </header>

        <TagDetailReport detail={detail} />
      </div>
    </div>
  )
}

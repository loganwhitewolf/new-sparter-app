import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TagRow } from '@/lib/dal/tags'
import { tagDetail } from '@/lib/routes'
import { CreateTagDialog } from './tag-mutation-dialogs'

type Props = {
  tags: TagRow[]
}

function formatDateRange(tag: TagRow): string {
  if (!tag.dateRangeStart || !tag.dateRangeEnd) return 'Nessun intervallo'
  const start = tag.dateRangeStart.toLocaleDateString('it-IT')
  const end = tag.dateRangeEnd.toLocaleDateString('it-IT')
  return `${start} — ${end}`
}

// Index row: the whole item is a link to the dedicated tag page (/tags/[id]); the inline detail
// pane was refolded into that page (D2). Name truncates; archived tags stay listed with a badge.
function TagListItem({ tag }: { tag: TagRow }) {
  return (
    <Link
      href={tagDetail(tag.id)}
      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{tag.name}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{formatDateRange(tag)}</span>
      </span>
      {tag.archived && (
        <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
          Archiviato
        </Badge>
      )}
    </Link>
  )
}

// /tags is an index (D2): a single-column list of links into /tags/[id]. Detail (KPI + count +
// breakdown + tx list) and Edit/Archive now live on the dedicated page (see tag-detail-report.tsx
// and app/(app)/tags/[id]/page.tsx). Archived tags stay visible, grouped under "Archiviati" (D-04).
export function TagSettingsPanel({ tags }: Props) {
  const activeTags = tags.filter((t) => !t.archived)
  const archivedTags = tags.filter((t) => t.archived)

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Gestione tag</CardTitle>
        </div>
        <CreateTagDialog />
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nessun tag disponibile. Crea il primo tag per iniziare a organizzare le tue
            transazioni.
          </div>
        ) : (
          <nav className="flex flex-col gap-2" aria-label="Tag">
            {activeTags.map((tag) => (
              <TagListItem key={tag.id} tag={tag} />
            ))}
            {archivedTags.length > 0 && (
              <>
                <p className="mt-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Archiviati
                </p>
                {archivedTags.map((tag) => (
                  <TagListItem key={tag.id} tag={tag} />
                ))}
              </>
            )}
          </nav>
        )}
      </CardContent>
    </Card>
  )
}

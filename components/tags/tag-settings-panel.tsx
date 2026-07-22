'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { TagRow } from '@/lib/dal/tags'
import { ArchiveTagDialog, CreateTagDialog, EditTagDialog } from './tag-mutation-dialogs'

type Props = {
  tags: TagRow[]
}

function formatDateRange(tag: TagRow): string {
  if (!tag.dateRangeStart || !tag.dateRangeEnd) return 'Nessun intervallo'
  const start = tag.dateRangeStart.toLocaleDateString('it-IT')
  const end = tag.dateRangeEnd.toLocaleDateString('it-IT')
  return `${start} — ${end}`
}

function TagListItem({
  tag,
  isSelected,
  onSelect,
}: {
  tag: TagRow
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground font-medium',
      )}
      aria-current={isSelected ? 'true' : undefined}
    >
      <span className="truncate">{tag.name}</span>
      {tag.archived && (
        <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
          Archiviato
        </Badge>
      )}
    </button>
  )
}

// D-01: mirrors CategorySettingsPanel's sidebar+detail layout, simplified (no hierarchy, every
// tag is user-owned). D-04: archived tags stay visible and selectable, badged "Archiviato".
export function TagSettingsPanel({ tags }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(tags.length > 0 ? tags[0].id : null)
  const selectedTag = tags.find((t) => t.id === selectedId) ?? null
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
          <div className="grid grid-cols-[200px_1fr] gap-6 min-h-[300px]">
            <div className="border-r pr-4">
              <nav className="flex flex-col gap-1" aria-label="Tag">
                {activeTags.map((tag) => (
                  <TagListItem
                    key={tag.id}
                    tag={tag}
                    isSelected={selectedId === tag.id}
                    onSelect={() => setSelectedId(tag.id)}
                  />
                ))}
                {archivedTags.length > 0 && (
                  <>
                    <p className="mt-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Archiviati
                    </p>
                    {archivedTags.map((tag) => (
                      <TagListItem
                        key={tag.id}
                        tag={tag}
                        isSelected={selectedId === tag.id}
                        onSelect={() => setSelectedId(tag.id)}
                      />
                    ))}
                  </>
                )}
              </nav>
            </div>
            <div className="min-w-0">
              {selectedTag ? (
                <section aria-labelledby="tag-detail-heading">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 id="tag-detail-heading" className="text-lg font-semibold">
                          {selectedTag.name}
                        </h3>
                        {selectedTag.archived && <Badge variant="secondary">Archiviato</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateRange(selectedTag)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <EditTagDialog tag={selectedTag} />
                      {!selectedTag.archived && <ArchiveTagDialog tag={selectedTag} />}
                    </div>
                  </div>
                </section>
              ) : (
                <p className="text-sm text-muted-foreground">Seleziona un tag dalla lista.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { TagDetail, TagRow } from '@/lib/dal/tags'
import { getTagDetailAction } from '@/lib/actions/tags'
import { ArchiveTagDialog, CreateTagDialog, EditTagDialog } from './tag-mutation-dialogs'

type Props = {
  tags: TagRow[]
}

const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

// Signed currency — keeps the leading minus so the net / outflow rows read as negative;
// color (--total-in/--total-out) reinforces direction. Mirrors tag-ranking-list's formatter.
function formatSignedAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function formatAbsoluteAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Math.abs(Number.isFinite(amount) ? amount : 0))
}

function formatTxDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('it-IT')
}

// Sign-based tone (a tag has no fixed direction) — same rule as tag-ranking-list's totalTone.
function toneClass(value: string): string {
  return Number(value) >= 0 ? 'text-[var(--total-in)]' : 'text-[var(--total-out)]'
}

function transactionCountLabel(count: number): string {
  return count === 1 ? '1 transazione inclusa' : `${count} transazioni incluse`
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-base font-semibold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

// On-demand detail: fetched via server action when the selected tag changes. `key={tag.id}` on
// the caller remounts this per tag; the `cancelled` guard also drops any in-flight response for a
// tag the user has since navigated away from (race-safe rapid selection).
function TagDetailView({ tagId }: { tagId: number }) {
  const [detail, setDetail] = useState<TagDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // `key={tag.id}` on the caller remounts this per tag, so the effect runs once per mount and
  // the initial loading/failed state is already correct — no synchronous reset needed here.
  useEffect(() => {
    let cancelled = false

    getTagDetailAction(tagId)
      .then((result) => {
        if (cancelled) return
        if (result.error || !result.detail) {
          setFailed(true)
          setDetail(null)
        } else {
          setDetail(result.detail)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tagId])

  if (loading) {
    return <p className="mt-4 text-sm text-muted-foreground">Caricamento del dettaglio…</p>
  }

  if (failed || !detail) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Non è stato possibile caricare il dettaglio. Riprova.
      </p>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Entrate"
          value={formatAbsoluteAmount(detail.inflow)}
          tone="text-[var(--total-in)]"
        />
        <StatCard
          label="Uscite"
          value={formatAbsoluteAmount(detail.outflow)}
          tone="text-[var(--total-out)]"
        />
        <StatCard
          label="Valore finale"
          value={formatSignedAmount(detail.net)}
          tone={toneClass(detail.net)}
        />
      </div>

      <p className="text-sm text-muted-foreground">{transactionCountLabel(detail.count)}</p>

      {detail.transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna transazione inclusa per questo tag.
        </p>
      ) : (
        <ul className="max-h-[420px] divide-y overflow-y-auto rounded-md border">
          {detail.transactions.map((tx) => (
            <li
              key={tx.transactionId}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatTxDate(tx.occurredAt)}
                </span>
                <span className="truncate">{tx.subCategoryName}</span>
              </div>
              <span className={cn('shrink-0 font-medium tabular-nums', toneClass(tx.amount))}>
                {formatSignedAmount(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
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
                  <TagDetailView key={selectedTag.id} tagId={selectedTag.id} />
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

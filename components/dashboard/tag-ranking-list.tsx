'use client'

import Link from 'next/link'
import { ArchiveTagDialog } from '@/components/tags/tag-mutation-dialogs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TagTotalItem } from '@/lib/dal/tags'

type Props = {
  items: TagTotalItem[]
}

const amountFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

function formatAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function movementLabel(count: number): string {
  return count === 1 ? '1 movimento' : `${count} movimenti`
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('it-IT')
}

// Caption format locked by UI-SPEC: "{count} movimenti · {minDate}–{maxDate}". A tag with zero
// matching transactions (minDate/maxDate both null) renders just the count, no date range.
function captionText(item: TagTotalItem): string {
  const label = movementLabel(item.count)
  if (!item.minDate || !item.maxDate) return label
  return `${label} · ${formatDate(item.minDate)}–${formatDate(item.maxDate)}`
}

// Sign-based tone rule (a tag has no fixed direction, unlike CategoryRankingList's fixed
// type === 'in' ? ... : ... bar-color rule) — copied from OverviewMoversPanel's allocation
// column tone rule.
function totalTone(total: string): string {
  return Number(total) >= 0 ? 'text-[var(--total-in)]' : 'text-[var(--total-out)]'
}

export function TagRankingList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
        <p className="text-base font-medium text-foreground">Nessun tag creato</p>
        <p className="max-w-sm text-sm">
          Crea un tag per raggruppare le transazioni di un viaggio, evento o progetto.{' '}
          <Link href="/tags" className="text-primary underline-offset-4 hover:underline">
            Vai alla sezione Tag
          </Link>
        </p>
      </div>
    )
  }

  return (
    <ol className="grid gap-3" aria-label="Classifica tag">
      {items.map((item) => (
        <li
          key={item.tagId}
          className="group rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/50"
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/transactions?tag=${item.tagId}`}
                  className="block truncate text-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${item.name}: apri transazioni`}
                  title={item.name}
                >
                  {item.name}
                </Link>
                {item.archived && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Archiviato
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{captionText(item)}</p>
            </div>

            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <p
                className={cn(
                  'font-mono text-sm font-semibold tabular-nums',
                  totalTone(item.total)
                )}
              >
                {formatAmount(item.total)}
              </p>
              <ArchiveTagDialog
                tag={{
                  id: item.tagId,
                  name: item.name,
                  archived: item.archived,
                  userId: '',
                  normalizedName: '',
                  dateRangeStart: null,
                  dateRangeEnd: null,
                  createdAt: new Date(0),
                  updatedAt: new Date(0),
                }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

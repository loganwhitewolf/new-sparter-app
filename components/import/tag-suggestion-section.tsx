'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { confirmTagSuggestionAction } from '@/lib/actions/tag-suggestions'
import type { TagSuggestionGroup } from '@/lib/services/tag-suggestions'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type CardProps = {
  group: TagSuggestionGroup
}

// D-08b: one independently-confirmable card per tag with matches. Pre-checked (mirrors
// TagCreationSuggestionsDialog, Plan 67-08) — the user deselects rows they don't want, then
// confirms via confirmTagSuggestionAction (Plan 67-05), which re-delegates to the
// ownership-verified bulkAssignTags (Plan 67-04). Confirming does NOT remove the card or reload
// the page — other tags' cards on the same screen may still be pending confirmation.
function TagSuggestionCard({ group }: CardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(group.matches.map((m) => m.transactionId))
  const [isPending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)

  function toggle(transactionId: string) {
    setSelectedIds((prev) =>
      prev.includes(transactionId) ? prev.filter((id) => id !== transactionId) : [...prev, transactionId],
    )
  }

  function handleConfirm() {
    const fd = new FormData()
    fd.set('tagId', String(group.tagId))
    fd.set('transactionIds', JSON.stringify(selectedIds))

    startTransition(async () => {
      const result = await confirmTagSuggestionAction({ error: null }, fd)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${selectedIds.length} transazioni aggiunte al tag "${group.tagName}".`)
      setConfirmed(true)
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{`Tag: ${group.tagName}`}</CardTitle>
        <Badge variant="secondary">{group.matches.length}</Badge>
      </CardHeader>
      <CardContent>
        {confirmed ? (
          <p className="text-sm text-muted-foreground">Confermato.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {group.matches.map((match) => (
                <label
                  key={match.transactionId}
                  className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(match.transactionId)}
                    onChange={() => toggle(match.transactionId)}
                    disabled={isPending}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">
                    {match.occurredAt.toLocaleDateString('it-IT')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {match.customTitle ?? match.description}
                  </span>
                  <span className="shrink-0 text-sm font-medium">
                    {formatAbsoluteAmount(match.amount, match.currency)}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              {selectedIds.length === 0 ? (
                <Button type="button" disabled={isPending} onClick={() => setConfirmed(true)}>
                  Salta
                </Button>
              ) : (
                <Button type="button" disabled={isPending} onClick={handleConfirm}>
                  {`Conferma (${selectedIds.length})`}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type Props = {
  groups: TagSuggestionGroup[]
}

// D-08b: the "Suggerimenti tag" block on the existing post-import summary screen — a sibling of
// the pattern-suggestions block, never a separate route/dialog/nudge. TAG-03 empty edge: when no
// tag has any in-range unconfirmed match, this renders nothing at all (not an empty section).
export function TagSuggestionSection({ groups }: Props) {
  if (groups.length === 0) return null

  return (
    <section aria-label="Suggerimenti tag" className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Suggerimenti tag</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Queste transazioni importate rientrano nell&apos;intervallo di uno o più tuoi tag.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <TagSuggestionCard key={group.tagId} group={group} />
        ))}
      </div>
    </section>
  )
}

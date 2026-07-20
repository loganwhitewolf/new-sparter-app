'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { confirmTagSuggestionAction } from '@/lib/actions/tag-suggestions'
import type { TagSuggestionGroup } from '@/lib/services/tag-suggestions'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: TagSuggestionGroup
}

// D-08a: opens fully pre-checked over a newly-created tag's date-range matches. The user
// deselects rows they don't want, then confirms — only the remaining selection is assigned via
// confirmTagSuggestionAction (Plan 67-05), which re-delegates to the ownership-verified
// bulkAssignTags (Plan 67-04). Deselecting down to zero swaps the confirm button to a plain
// "Salta" close, never a forced empty submission.
export function TagCreationSuggestionsDialog({ open, onOpenChange, group }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    group.matches.map((m) => m.transactionId),
  )
  const [isPending, startTransition] = useTransition()

  // Reset to fully pre-checked whenever this dialog is re-opened for a (possibly different) tag.
  useEffect(() => {
    setSelectedIds(group.matches.map((m) => m.transactionId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.tagId])

  function toggle(transactionId: string) {
    setSelectedIds((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId],
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
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{`Transazioni per "${group.tagName}"`}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Abbiamo trovato {group.matches.length} transazioni nell&apos;intervallo di questo tag.
          Deseleziona quelle che non c&apos;entrano.
        </p>
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
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          {selectedIds.length === 0 ? (
            <Button type="button" disabled={isPending} onClick={() => onOpenChange(false)}>
              Salta
            </Button>
          ) : (
            <Button type="button" disabled={isPending} onClick={handleConfirm}>
              {`Conferma (${selectedIds.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { bulkAssignTagsAction, bulkRemoveTagsAction } from '@/lib/actions/transaction-tags'
import type { TagRow } from '@/lib/dal/tags'

type Mode = 'assign' | 'remove'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionIds: string[]
  tags: TagRow[]
  onSuccess: (result: { mode: Mode; tagIds: number[] }) => void
}

export function BulkAssignTagsDialog({
  open,
  onOpenChange,
  transactionIds,
  tags,
  onSuccess,
}: Props) {
  const [mode, setMode] = useState<Mode>('assign')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSelectedTagIds([])
      setError(null)
      setMode('assign')
    }
  }, [open])

  function toggleTag(tagId: number) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  function handleConfirm() {
    if (selectedTagIds.length === 0) {
      setError('Seleziona almeno un tag.')
      return
    }

    const fd = new FormData()
    fd.set('transactionIds', JSON.stringify(transactionIds))
    fd.set('tagIds', JSON.stringify(selectedTagIds))

    startTransition(async () => {
      const action = mode === 'assign' ? bulkAssignTagsAction : bulkRemoveTagsAction
      const result = await action({ error: null }, fd)
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success(
        mode === 'assign'
          ? `${selectedTagIds.length} tag assegnati a ${transactionIds.length} transazioni.`
          : `${selectedTagIds.length} tag rimossi da ${transactionIds.length} transazioni.`,
      )
      onSuccess({ mode, tagIds: selectedTagIds })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assegna tag</DialogTitle>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as Mode)
            setSelectedTagIds([])
            setError(null)
          }}
        >
          <TabsList>
            <TabsTrigger value="assign">Assegna</TabsTrigger>
            <TabsTrigger value="remove">Rimuovi</TabsTrigger>
          </TabsList>

          <TabsContent value="assign">
            <TagCheckboxList
              tags={tags}
              selectedTagIds={selectedTagIds}
              isPending={isPending}
              onToggle={toggleTag}
            />
          </TabsContent>
          <TabsContent value="remove">
            <TagCheckboxList
              tags={tags}
              selectedTagIds={selectedTagIds}
              isPending={isPending}
              onToggle={toggleTag}
            />
          </TabsContent>
        </Tabs>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            type="button"
            variant={mode === 'remove' ? 'destructive' : 'default'}
            disabled={isPending || selectedTagIds.length === 0}
            onClick={handleConfirm}
          >
            {mode === 'assign' ? `Assegna (${selectedTagIds.length})` : `Rimuovi (${selectedTagIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TagCheckboxList({
  tags,
  selectedTagIds,
  isPending,
  onToggle,
}: {
  tags: TagRow[]
  selectedTagIds: number[]
  isPending: boolean
  onToggle: (tagId: number) => void
}) {
  if (tags.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Nessun tag disponibile — creane uno da Impostazioni → Tag.
      </p>
    )
  }

  return (
    <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {tags.map((tag) => (
        <label key={tag.id} className="flex items-center gap-2 p-2">
          <input
            type="checkbox"
            checked={selectedTagIds.includes(tag.id)}
            onChange={() => onToggle(tag.id)}
            disabled={isPending}
            className="h-4 w-4"
          />
          <span className="text-sm">{tag.name}</span>
          {tag.archived && (
            <Badge variant="secondary" className="ml-auto text-[10px]">
              Archiviato
            </Badge>
          )}
        </label>
      ))}
    </div>
  )
}

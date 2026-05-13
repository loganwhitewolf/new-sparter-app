'use client'

import { useRef, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteStaleFileAction } from '@/lib/actions/import'
import type { ImportListRow } from '@/lib/dal/imports'

type Props = {
  importRow: ImportListRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: (fileId: string) => void
}

function getImportDisplayName(row: ImportListRow) {
  return row.displayName?.trim() || row.originalName
}

export function ImportStaleDeleteDialog({ importRow, open, onOpenChange, onDeleted }: Props) {
  const [isPending, setIsPending] = useState(false)
  const inFlightRef = useRef(false)
  const displayName = getImportDisplayName(importRow)

  async function handleDelete() {
    if (inFlightRef.current) return

    inFlightRef.current = true
    setIsPending(true)

    try {
      const fd = new FormData()
      fd.set('fileId', importRow.id)
      const result = await deleteStaleFileAction({ error: null }, fd)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Importazione eliminata.')
        onDeleted(importRow.id)
        onOpenChange(false)
      }
    } catch {
      toast.error("Impossibile eliminare l'importazione. Riprova.")
    } finally {
      inFlightRef.current = false
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
            Elimina importazione
          </DialogTitle>
          <DialogDescription>
            Elimina il file &ldquo;{displayName}&rdquo;. Nessuna transazione sarà eliminata perché l&apos;importazione non è stata completata.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={isPending}>
              Annulla
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Eliminazione…</span>
              </>
            ) : (
              'Elimina'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

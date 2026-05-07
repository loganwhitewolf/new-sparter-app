'use client'

import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Input } from '@/components/ui/input'
import { updateImportDisplayNameAction } from '@/lib/actions/import'
import type { ImportListRow } from '@/lib/dal/imports'

type Props = {
  importRow: ImportListRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (fileId: string, displayName: string | null) => void
}

function getImportDisplayName(row: ImportListRow) {
  return row.displayName?.trim() || row.originalName
}

export function ImportRenameDialog({ importRow, open, onOpenChange, onSuccess }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsPending(true)
    setError(null)

    try {
      const result = await updateImportDisplayNameAction({ error: null }, formData)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      const rawDisplayName = formData.get('displayName')
      const normalizedDisplayName = typeof rawDisplayName === 'string' && rawDisplayName.trim()
        ? rawDisplayName.trim()
        : null

      onSuccess(importRow.id, normalizedDisplayName)
      toast.success('Importazione rinominata.')
      onOpenChange(false)
    } catch {
      const safeError = 'Si è verificato un errore. Riprova tra qualche secondo.'
      setError(safeError)
      toast.error(safeError)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rinomina importazione</DialogTitle>
          <DialogDescription>
            Aggiungi un nome riconoscibile allo storico importazioni. Il nome file originale resta disponibile nella riga.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="fileId" value={importRow.id} />
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="import-display-name">
              Nome importazione
            </label>
            <Input
              id="import-display-name"
              name="displayName"
              defaultValue={importRow.displayName ?? ''}
              placeholder={importRow.originalName}
              maxLength={255}
              disabled={isPending}
              aria-describedby="import-display-name-help"
            />
            <p id="import-display-name-help" className="text-xs text-muted-foreground">
              Lascia vuoto per mostrare di nuovo il nome file originale: {getImportDisplayName(importRow)}.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                Annulla
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Salvataggio…</span>
                </>
              ) : (
                'Salva nome'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

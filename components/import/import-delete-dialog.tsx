'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ImportDeleteImpactSummary } from '@/components/import/import-delete-impact-summary'
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
import {
  deleteImportAction,
  previewImportDeletionAction,
  type ImportActionState,
} from '@/lib/actions/import'
import type { ImportListRow } from '@/lib/dal/imports'
import type { ImportDeletePreview, ImportDeleteResult } from '@/lib/services/import-deletion'

type Props = {
  importRow: ImportListRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: (fileId: string) => void
}

function getImportDisplayName(row: ImportListRow) {
  return row.displayName?.trim() || row.originalName
}

function formDataFor(fileId: string) {
  const formData = new FormData()
  formData.set('fileId', fileId)
  return formData
}

export function ImportDeleteDialog({ importRow, open, onOpenChange, onDeleted }: Props) {
  const [preview, setPreview] = useState<ImportDeletePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPreviewPending, setIsPreviewPending] = useState(false)
  const [isDeletePending, setIsDeletePending] = useState(false)
  const previewRequestIdRef = useRef(0)
  const deleteInFlightRef = useRef(false)
  const previewInFlightRef = useRef(false)
  const displayName = getImportDisplayName(importRow)
  const isDeletable = importRow.status === 'imported'

  const loadPreview = useCallback(async () => {
    if (!isDeletable || previewInFlightRef.current) {
      return
    }

    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    previewInFlightRef.current = true
    setIsPreviewPending(true)
    setPreview(null)
    setPreviewError(null)
    setDeleteError(null)

    try {
      const result = await previewImportDeletionAction(formDataFor(importRow.id))

      if (previewRequestIdRef.current !== requestId) {
        return
      }

      if (result.error || !result.data) {
        const safeError = result.error ?? 'Impossibile calcolare l’impatto dell’eliminazione. Riprova.'
        setPreviewError(safeError)
        toast.error(safeError)
        return
      }

      setPreview(result.data)
    } catch {
      if (previewRequestIdRef.current !== requestId) {
        return
      }

      const safeError = 'Impossibile calcolare l’impatto dell’eliminazione. Riprova.'
      setPreviewError(safeError)
      toast.error(safeError)
    } finally {
      if (previewRequestIdRef.current === requestId) {
        previewInFlightRef.current = false
        setIsPreviewPending(false)
      }
    }
  }, [importRow.id, isDeletable])

  useEffect(() => {
    if (!open || !isDeletable) {
      return
    }

    const previewTimer = window.setTimeout(() => {
      void loadPreview()
    }, 0)

    return () => window.clearTimeout(previewTimer)
  }, [isDeletable, loadPreview, open])

  async function handleDelete() {
    if (!preview || isPreviewPending || isDeletePending || deleteInFlightRef.current) {
      return
    }

    deleteInFlightRef.current = true
    setIsDeletePending(true)
    setDeleteError(null)

    try {
      const result: ImportActionState<ImportDeleteResult> = await deleteImportAction(
        { error: null },
        formDataFor(importRow.id),
      )

      if (result.data?.deletedFileId) {
        onDeleted(result.data.deletedFileId)
        if (result.error) {
          toast.warning(result.error)
        } else {
          toast.success('Importazione eliminata.')
        }
        onOpenChange(false)
        return
      }

      const safeError = result.error ?? 'Impossibile eliminare l’importazione. Riprova.'
      setDeleteError(safeError)
      toast.error(safeError)
    } catch {
      const safeError = 'Impossibile eliminare l’importazione. Riprova.'
      setDeleteError(safeError)
      toast.error(safeError)
    } finally {
      deleteInFlightRef.current = false
      setIsDeletePending(false)
    }
  }

  const statusError = isDeletable
    ? null
    : 'Questa importazione non può essere eliminata in questo stato.'
  const visiblePreviewError = statusError ?? previewError
  const confirmDisabled = !preview || Boolean(visiblePreviewError) || isPreviewPending || isDeletePending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
            Elimina importazione
          </DialogTitle>
          <DialogDescription id="import-delete-description">
            Operazione definitiva: eliminerà l’importazione {displayName} e le transazioni collegate solo dopo la conferma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" aria-describedby="import-delete-description">
          {isPreviewPending ? (
            <div
              className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground"
              aria-live="polite"
              aria-atomic="true"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Calcolo dell’impatto in corso…</span>
            </div>
          ) : null}

          {preview ? <ImportDeleteImpactSummary preview={preview} /> : null}

          {visiblePreviewError ? (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{visiblePreviewError}</AlertDescription>
            </Alert>
          ) : null}

          {deleteError ? (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          ) : null}

          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Confermando elimini definitivamente il file importato e le transazioni collegate. Le spese manuali o override vuote vengono preservate quando la cronologia lo richiede.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={isDeletePending}>
              Annulla
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmDisabled}
            aria-disabled={confirmDisabled}
          >
            {isDeletePending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Eliminazione…</span>
              </>
            ) : (
              'Elimina definitivamente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

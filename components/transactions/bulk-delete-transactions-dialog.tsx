'use client'

import { useActionState, useEffect, useRef } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { bulkDeleteTransactions } from '@/lib/actions/transactions'
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  onSuccess: () => void
}

export function BulkDeleteTransactionsDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: Props) {
  const [state, formAction, isPending] = useActionState(bulkDeleteTransactions, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success(
        selectedIds.length === 1
          ? 'Transazione eliminata.'
          : `${selectedIds.length} transazioni eliminate.`,
      )
      submittedRef.current = false
      onSuccess()
    }
  }, [state, selectedIds.length, onSuccess])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Elimina transazioni</DialogTitle>
          <DialogDescription className="sr-only">
            Conferma l&apos;eliminazione delle transazioni selezionate. Le spese collegate verranno
            aggiornate o rimosse se non restano movimenti.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            submittedRef.current = true
            formAction(fd)
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="ids" value={JSON.stringify(selectedIds)} />

          <p className="text-sm text-muted-foreground">
            Stai per eliminare <strong>{selectedIds.length} transazioni</strong>. Le spese
            aggregate collegate verranno ricalcolate; se non restano movimenti, la spesa può essere
            rimossa (tranne i casi con categorizzazione manuale registrata).
          </p>

          {state.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annulla
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending || selectedIds.length === 0}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Elimina definitivamente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

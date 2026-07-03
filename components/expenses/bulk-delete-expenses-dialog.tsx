'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { bulkDeleteExpenses } from '@/lib/actions/expenses'
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
  linkedTransactionCount: number
  onSuccess: () => void
}

export function BulkDeleteExpensesDialog({
  open,
  onOpenChange,
  selectedIds,
  linkedTransactionCount,
  onSuccess,
}: Props) {
  const [deleteLinkedTransactions, setDeleteLinkedTransactions] = useState(false)
  const [state, formAction, isPending] = useActionState(bulkDeleteExpenses, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setDeleteLinkedTransactions(false)
    }
  }, [open])

  const expenseLabel = useMemo(
    () => (selectedIds.length === 1 ? 'spesa' : 'spese'),
    [selectedIds.length],
  )

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success(
        selectedIds.length === 1
          ? 'Spesa eliminata.'
          : `${selectedIds.length} spese eliminate.`,
      )
      submittedRef.current = false
      onSuccess()
    }
  }, [state, selectedIds.length, onSuccess])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Elimina spese</DialogTitle>
          <DialogDescription className="sr-only">
            Conferma l&apos;eliminazione delle spese selezionate e, opzionalmente, delle transazioni
            collegate.
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
          <input
            type="hidden"
            name="deleteLinkedTransactions"
            value={deleteLinkedTransactions ? 'true' : 'false'}
          />

          <p className="text-sm text-muted-foreground">
            Stai per eliminare <strong>{selectedIds.length} {expenseLabel}</strong>.
            {linkedTransactionCount > 0
              ? ' Puoi scegliere se eliminare anche le transazioni collegate.'
              : ' Non ci sono transazioni collegate alle spese selezionate.'}
          </p>

          {linkedTransactionCount > 0 ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={deleteLinkedTransactions}
                onChange={(event) => setDeleteLinkedTransactions(event.target.checked)}
              />
              <span>
                Elimina anche{' '}
                <strong>
                  {linkedTransactionCount}{' '}
                  {linkedTransactionCount === 1 ? 'transazione collegata' : 'transazioni collegate'}
                </strong>
              </span>
            </label>
          ) : null}

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
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending || selectedIds.length === 0}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Elimina definitivamente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

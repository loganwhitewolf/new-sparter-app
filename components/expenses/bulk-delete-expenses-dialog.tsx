'use client'

import { useActionState, useEffect, useRef } from 'react'
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
  onSuccess: () => void
}

export function BulkDeleteExpensesDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: Props) {
  const [state, formAction, isPending] = useActionState(bulkDeleteExpenses, { error: null })
  const submittedRef = useRef(false)

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
            Conferma l&apos;eliminazione delle spese selezionate. Le transazioni collegate resteranno
            senza spesa aggregata.
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
            Stai per eliminare <strong>{selectedIds.length} spese</strong>. Le transazioni associate
            non vengono cancellate: resteranno in elenco senza spesa collegata.
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

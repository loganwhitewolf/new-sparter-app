'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { removeAmortizationPlan } from '@/lib/actions/amortization'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  onSuccess: () => void
}

/**
 * D-09 undo confirmation dialog. Mirrors DetachExpenseDialog's single-action structure. Confirming
 * atomically deletes the plan + instalments and reverses the detach (reverseDetachTx); on failure
 * the dialog stays open and the source plan/transaction are left untouched (atomic).
 */
export function RemoveAmortizationDialog({ open, onOpenChange, planId, onSuccess }: Props) {
  const [pending, setPending] = useState(false)

  async function handleConfirm() {
    setPending(true)
    const result = await removeAmortizationPlan({ planId })
    setPending(false)

    if (result.error) {
      toast.error(`Errore nel rimuovere la spesa dilazionata: ${result.error}`)
      return
    }

    toast.success('Spesa dilazionata rimossa. Transazione ripristinata.')
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rimuovi spesa dilazionata</DialogTitle>
          <DialogDescription>
            Questa azione eliminerà la pianificazione e tutte le rate associate. La transazione
            tornerà nella spesa condivisa per descrizione.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Annulla
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rimuovi spesa dilazionata'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

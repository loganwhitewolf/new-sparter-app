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
import { closePlanAction } from '@/lib/actions/amortization-lifecycle'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  onSuccess: () => void
}

/**
 * D-01 close/collapse confirmation dialog. Structurally identical to RemoveAmortizationDialog
 * (single confirm Dialog, pending state, toast.error/toast.success) — but a neutral/outline
 * confirm variant, not destructive: closing collapses future instalments onto the closure month,
 * it never deletes the plan.
 */
export function CloseAmortizationDialog({ open, onOpenChange, planId, onSuccess }: Props) {
  const [pending, setPending] = useState(false)

  async function handleConfirm() {
    setPending(true)
    const result = await closePlanAction({ planId })
    setPending(false)

    if (result.error) {
      toast.error(`Errore nel chiudere l'ammortamento: ${result.error}`)
      return
    }

    toast.success('Ammortamento chiuso.')
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chiudi ammortamento</DialogTitle>
          <DialogDescription>
            Le rate future verranno raggruppate in un&apos;unica rata nel mese corrente. Le rate
            già passate non verranno modificate.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Annulla
            </Button>
          </DialogClose>
          <Button type="button" variant="outline" onClick={handleConfirm} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Chiudi ammortamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

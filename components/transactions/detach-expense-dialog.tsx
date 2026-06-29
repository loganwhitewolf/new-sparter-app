'use client'

import { useEffect, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { detachTransaction } from '@/lib/actions/transactions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: string
  defaultTitle: string
  onSuccess: (result: { newExpenseId: string; newExpenseTitle: string }) => void
}

export function DetachExpenseDialog({
  open,
  onOpenChange,
  transactionId,
  defaultTitle,
  onSuccess,
}: Props) {
  const [title, setTitle] = useState(defaultTitle)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle)
    }
  }, [open, defaultTitle])

  async function handleConfirm() {
    const trimmed = title.trim()
    if (!trimmed) {
      toast.error('Il titolo della spesa è obbligatorio.')
      return
    }

    setPending(true)
    const result = await detachTransaction({ transactionId, title: trimmed })
    setPending(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Transazione separata in una nuova spesa.')
    onOpenChange(false)
    onSuccess({ newExpenseId: result.newExpenseId, newExpenseTitle: result.newExpenseTitle })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Separa in spesa dedicata</DialogTitle>
          <DialogDescription>
            Crea una nuova spesa con questa transazione. Potrai categorizzarla subito dopo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="detach-expense-title">
            Titolo spesa
          </label>
          <Input
            id="detach-expense-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
            autoFocus
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Annulla
            </Button>
          </DialogClose>
          <Button type="button" onClick={() => void handleConfirm()} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Conferma'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

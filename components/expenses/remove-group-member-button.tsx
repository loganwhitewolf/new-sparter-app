'use client'

import { useState } from 'react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { removeExpenseFromGroupAction } from '@/lib/actions/expenses'

type Props = {
  groupId: number
  expenseId: string
  expenseTitle: string
  onSuccess: () => void
}

/**
 * GRP-07/D-07: per-member "remove from group" control on the group detail
 * page's member rows. Confirms via a Dialog, then calls
 * removeExpenseFromGroupAction; on success the freed member becomes a
 * standalone expense (no more group-row collapsing) and the parent refreshes
 * so the member list/count updates — including the auto-dissolve case where
 * the group itself may no longer exist.
 */
export function RemoveGroupMemberButton({ groupId, expenseId, expenseTitle, onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleRemove() {
    setPending(true)
    const fd = new FormData()
    fd.set('groupId', String(groupId))
    fd.set('expenseId', expenseId)
    const result = await removeExpenseFromGroupAction({ error: null }, fd)
    setPending(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Spesa rimossa dal gruppo.')
    setOpen(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label={`Rimuovi ${expenseTitle} dal gruppo`}>
          Rimuovi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rimuovere questa spesa dal gruppo?</DialogTitle>
          <DialogDescription>
            &ldquo;{expenseTitle}&rdquo; diventerà una spesa indipendente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Annulla</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleRemove} disabled={pending}>
            Rimuovi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

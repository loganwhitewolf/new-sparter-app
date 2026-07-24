'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Link2, Trash2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { deleteReimbursementAction, removeRefundAction } from '@/lib/actions/transaction-pairs'
import type { ReimbursementPanelData } from '@/lib/dal/reimbursement'
import type { ReimbursementResidualState } from '@/lib/services/reimbursement'
import { transactionDetailHref } from '@/lib/routes'
import { toDecimal } from '@/lib/utils/decimal'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type Props = {
  /**
   * The anchor this panel is mounted for — a transaction (`/transactions/[id]`, D-02) or an
   * Expense Group (Group detail, D-03). Not read directly by this component today (the RSC page
   * already resolved `data` for it); kept on the props contract because both hosts pass it and a
   * future addition (e.g. an anchor-aware empty-state message) may need it without a signature
   * change.
   */
  anchor: { transactionId: string } | { groupId: number }
  data: ReimbursementPanelData | undefined
  /** Opens the host's RefundPickerDialog (Plan 75-04 Task 2) — the host owns that dialog's state. */
  onAddRefund: () => void
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(date: Date): string {
  return dateFormatter.format(new Date(date))
}

/**
 * Maps a reimbursement's residual + state to the Italian label the surface renders inline (D-04):
 * `'owed'` -> "Ancora dovuti €N", `'settled'` -> "Saldato", `'surplus'` -> "Surplus di €N".
 * Extracted as a standalone pure function so it is unit-testable without jsdom (this repo has
 * none) — mirrors the `formatNet`/`formatCounterpartAmount` precedent in the existing pairing UI.
 */
export function formatResidualLabel(residual: string, state: ReimbursementResidualState): string {
  if (state === 'settled') {
    return 'Saldato'
  }
  const abs = formatAbsoluteAmount(toDecimal(residual).abs().toFixed(2))
  return state === 'owed' ? `Ancora dovuti ${abs}` : `Surplus di ${abs}`
}

function stateBadgeLabel(state: ReimbursementResidualState): string {
  if (state === 'settled') return 'Saldato'
  if (state === 'owed') return 'Da saldare'
  return 'Surplus'
}

/**
 * Reusable reimbursement management panel (D-03): a single component mounted on BOTH
 * `/transactions/[id]` (anchor = the outflow transaction) and the Expense Group detail page
 * (anchor = the Group) — not a second implementation per host.
 *
 * Renders an empty/CTA state when `data` is `undefined` ("nothing linked yet" is a normal,
 * common state, never an error), or the net/residual/status line + ordered refund list + add/
 * remove/delete actions when a reimbursement exists.
 */
export function ReimbursementPanel({ data, onAddRefund }: Props) {
  const router = useRouter()
  const [removePendingId, setRemovePendingId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)

  async function handleRemoveRefund(refundTransactionId: string) {
    setRemovePendingId(refundTransactionId)
    const fd = new FormData()
    fd.set('transactionId', refundTransactionId)
    const result = await removeRefundAction({ error: null }, fd)
    setRemovePendingId(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Rimborso scollegato.')
      router.refresh()
    }
  }

  async function handleDeleteReimbursement(reimbursementId: number) {
    setDeletePending(true)
    const fd = new FormData()
    fd.set('reimbursementId', String(reimbursementId))
    const result = await deleteReimbursementAction({ error: null }, fd)
    setDeletePending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setDeleteOpen(false)
      toast.success('Rimborso eliminato.')
      router.refresh()
    }
  }

  if (!data) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed p-3">
        <span className="text-sm text-muted-foreground">Nessun rimborso collegato.</span>
        <Button type="button" variant="outline" size="sm" onClick={onAddRefund}>
          <Link2 className="h-4 w-4" />
          Aggiungi rimborso
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{formatResidualLabel(data.residual, data.state)}</span>
        <Badge variant="outline">{stateBadgeLabel(data.state)}</Badge>
      </div>

      <ul className="flex flex-col gap-2">
        {data.refunds.map((refund) => (
          <li
            key={refund.id}
            className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={transactionDetailHref(refund.id)}
                className="block truncate text-primary underline-offset-4 hover:underline"
              >
                {refund.customTitle?.trim() || refund.description}
              </Link>
              <span className="block text-xs text-muted-foreground">{formatDate(refund.occurredAt)}</span>
            </div>
            <span className="shrink-0 font-mono tabular-nums text-xs">
              {formatAbsoluteAmount(refund.amount)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={removePendingId === refund.id}
              onClick={() => void handleRemoveRefund(refund.id)}
            >
              <Unlink className="h-4 w-4" />
              Scollega
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onAddRefund}>
          <Link2 className="h-4 w-4" />
          Aggiungi rimborso
        </Button>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Elimina rimborso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminare il rimborso?</DialogTitle>
              <DialogDescription>
                {data.refunds.length > 1
                  ? `Tutti i ${data.refunds.length} rimborsi collegati verranno scollegati e torneranno alla loro categoria originale.`
                  : 'Il rimborso collegato verrà scollegato e tornerà alla sua categoria originale.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Annulla
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDeleteReimbursement(data.reimbursementId)}
                disabled={deletePending}
              >
                Elimina
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

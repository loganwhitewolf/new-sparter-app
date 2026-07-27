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
import type { ReimbursementPanelData, RefundMembership } from '@/lib/dal/reimbursement'
import type { ReimbursementResidualState } from '@/lib/services/reimbursement'
import { reimbursementHref, transactionDetailHref } from '@/lib/routes'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import { formatResidualAbsoluteAmount } from '@/lib/utils/reimbursement-format'

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
  /**
   * `'summary'` (D-09): compact read-only rendering used on `/transactions/[id]` once a
   * reimbursement already exists — residual label + status Badge + refund list (no "Scollega"
   * per refund), plus a single "Gestisci rimborso" link to `/reimbursements/[id]` in place of the
   * add/remove/delete controls. `'management'` (default): the full pre-Phase-76 body, unchanged —
   * reused verbatim by the dedicated `/reimbursements/[id]` page (Plan 76-05). Only affects the
   * "reimbursement already exists" branch; the empty-state "Aggiungi rimborso" CTA below is
   * identical in both variants.
   */
  variant?: 'summary' | 'management'
  /**
   * Called (in place of `router.refresh()`) when the reimbursement this panel manages ceases to
   * exist — i.e. it was deleted, or its last refund was unlinked. On `/reimbursements/[id]` the
   * host passes a navigation to the list, since refreshing a now-deleted reimbursement's RSC page
   * would `notFound()` → 404 (Phase 76 UAT gap #1). Omitted on surfaces that stay put after a
   * mutation (e.g. the `/transactions/[id]` summary variant, which has no remove/delete controls).
   */
  onGone?: () => void
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
 *
 * Cross-reference (WR-01): the money-formatting core is shared with
 * `lib/utils/reimbursement-format.ts`'s `formatResidualBadgeLabel` via
 * `formatResidualAbsoluteAmount`, but this panel intentionally uses different wording ("Ancora
 * dovuti €N" / "Surplus di €N") than that file's badge copy ("Dovuti €N" / "Surplus €N") — this
 * component renders a summary line, not a `/reimbursements` table/detail badge. If one surface's
 * copy changes, check whether the other should too.
 */
export function formatResidualLabel(residual: string, state: ReimbursementResidualState): string {
  if (state === 'settled') {
    return 'Saldato'
  }
  const abs = formatResidualAbsoluteAmount(residual)
  return state === 'owed' ? `Ancora dovuti ${abs}` : `Surplus di ${abs}`
}

/**
 * Cross-reference (WR-01): a THIRD, deliberately terser wording for the same residual+state
 * mapping — used only for this panel's compact status Badge ("Da saldare" / "Saldato" /
 * "Surplus"), distinct from both `formatResidualLabel` above (the inline summary text on this
 * same panel) and `lib/utils/reimbursement-format.ts`'s `formatResidualBadgeLabel` (the
 * `/reimbursements` table/detail badge text). If the product copy for a state changes, check all
 * three call sites.
 */
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
export function ReimbursementPanel({ data, onAddRefund, variant = 'management', onGone }: Props) {
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
      // Removing the LAST refund dissolves the reimbursement — refreshing the detail RSC page
      // would then 404 (UAT gap #1). Let the host navigate away instead.
      if (onGone && data?.refunds.length === 1) {
        onGone()
      } else {
        router.refresh()
      }
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
      // The reimbursement no longer exists — refreshing its detail page would 404 (UAT gap #1).
      if (onGone) {
        onGone()
      } else {
        router.refresh()
      }
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
            {variant === 'management' ? (
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
            ) : null}
          </li>
        ))}
      </ul>

      {variant === 'summary' ? (
        <Link href={reimbursementHref(data.reimbursementId)}>
          <Button type="button" variant="outline" size="sm">
            Gestisci rimborso
          </Button>
        </Link>
      ) : (
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
      )}
    </div>
  )
}

type RefundMembershipCardProps = {
  /** The refund transaction's own id — passed to `removeRefundAction` on "Scollega". */
  transactionId: string
  membership: RefundMembership
}

/**
 * Read-only state (Phase 75 Plan 04 gap-closure, fix 1): rendered instead of `ReimbursementPanel`
 * when the CURRENT transaction is itself a linked refund, never an anchor (ADR 0018 — the anchor
 * is always the outflow). No "Aggiungi rimborso" CTA, since a refund can never host its own
 * reimbursement — only "Scollega" (`removeRefundAction`, which reverts this refund to its pre-link
 * baseline, D-10).
 */
export function RefundMembershipCard({ transactionId, membership }: RefundMembershipCardProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleUnlink() {
    setPending(true)
    const fd = new FormData()
    fd.set('transactionId', transactionId)
    const result = await removeRefundAction({ error: null }, fd)
    setPending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Rimborso scollegato.')
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <span className="text-sm">
        Rimborso di{' '}
        <Link
          href={membership.anchorHref}
          className="text-primary underline-offset-4 hover:underline"
        >
          «{membership.title}»
        </Link>
      </span>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => void handleUnlink()}
        >
          <Unlink className="h-4 w-4" />
          Scollega
        </Button>
      </div>
    </div>
  )
}

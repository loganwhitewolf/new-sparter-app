import Link from 'next/link'
import { Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { reimbursementHref } from '@/lib/routes'

/**
 * Compact inline indicator for a transactions-table row: signals that the transaction is part of
 * a reimbursement (as anchor or refund) AND links straight to that reimbursement's dedicated
 * management page (Phase 76 Plan 03, D-06) — the full net/residual/refund breakdown lives there,
 * not in a popover on this row.
 *
 * Mirrors TransactionTagsChip's `shrink-0` placement so it stays visible after a truncated title,
 * sharing the title's line alongside the tags chip. Uses Link2 to match the reimbursement
 * iconography in ReimbursementPanel (the detail-page surface).
 */
export function ReimbursementRowIndicator({ reimbursementId }: { reimbursementId: number }) {
  return (
    <Link href={reimbursementHref(reimbursementId)}>
      <Badge
        variant="outline"
        className="shrink-0 cursor-pointer px-1.5 hover:bg-muted"
        aria-label="Rimborso collegato"
        title="Clicca per gestire il rimborso"
      >
        <Link2 className="size-3" aria-hidden="true" />
      </Badge>
    </Link>
  )
}

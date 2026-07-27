import { Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/**
 * Compact inline indicator for a transactions-table row: signals that the transaction is part of
 * a reimbursement (as anchor or refund) with NO detail popover — the full net/residual/refund
 * breakdown lives on the transaction detail page (Phase 75 Plan 04 gap-closure; replaces the old
 * 1:1 TransactionPairPopover, which was stale after the 1:N model and carried a dead link).
 *
 * Mirrors TransactionTagsChip's `shrink-0` placement so it stays visible after a truncated title,
 * sharing the title's line alongside the tags chip. Uses Link2 to match the reimbursement
 * iconography in ReimbursementPanel (the detail-page surface).
 */
export function ReimbursementRowIndicator() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 px-1.5"
      aria-label="Rimborso collegato"
      title="Rimborso collegato"
    >
      <Link2 className="size-3" aria-hidden="true" />
    </Badge>
  )
}

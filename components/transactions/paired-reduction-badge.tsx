import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { transactionDetailHref } from '@/lib/routes'

/**
 * Compact inline badge for a transactions-table row that is the COUNTERPART (sale/refund inflow) of
 * a pairing — an amortization-sale realization or a v2.8 reimbursement, both the same
 * reimbursement/reimbursement_refund path (D-N1). It signals that this positive amount is not a
 * standalone asset but a reduction of another transaction, and links straight to that ANCHOR
 * transaction's own detail page (D-N3).
 *
 * This is a deliberate sibling of ReimbursementRowIndicator, not an extension of it: the link
 * target and semantic intent differ — ReimbursementRowIndicator opens the reimbursement management
 * page (`/reimbursements/[id]`), whereas this badge opens the anchor TRANSACTION
 * (`transactionDetailHref`). An amortization sale does not warrant a reimbursement-management deep
 * link the way a reimbursement does, and merging the two behind a branching prop would be more
 * complex than a plain sibling that leaves ReimbursementRowIndicator's call sites/tests untouched.
 *
 * Mirrors ReimbursementRowIndicator's `shrink-0` placement so it survives a truncated title on the
 * same flex row.
 */
export function PairedReductionBadge({
  anchorTransactionId,
  anchorLabel,
}: {
  anchorTransactionId: string
  anchorLabel: string | null
}) {
  const label = anchorLabel?.trim() || 'transazione collegata'
  const truncated = label.length > 18 ? `${label.slice(0, 18)}…` : label

  return (
    <Link href={transactionDetailHref(anchorTransactionId)}>
      <Badge
        variant="outline"
        className="shrink-0 max-w-40 cursor-pointer truncate text-muted-foreground hover:bg-muted"
        aria-label={`Riduzione di ${label}`}
        title={`Apri la transazione collegata: ${label}`}
      >
        riduzione di {truncated}
      </Badge>
    </Link>
  )
}

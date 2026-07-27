'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReimbursementPanel } from '@/components/transactions/reimbursement-panel'
import { RefundPickerDialog } from '@/components/transactions/refund-picker-dialog'
import { ReimbursementTitleEdit } from '@/components/reimbursements/reimbursement-title-edit'
import type {
  ReimbursementAnchorTransaction,
  ReimbursementHeader,
  ReimbursementPanelData,
} from '@/lib/dal/reimbursement'
import { expenseDetailHref } from '@/lib/routes'
import { formatResidualBadgeLabel, residualBadgeClassName } from '@/lib/utils/reimbursement-format'

type Props = {
  reimbursement: ReimbursementHeader
  panelData: ReimbursementPanelData | undefined
  anchorTransaction: ReimbursementAnchorTransaction | undefined
}

/** D-07 KPI card (mirrors tag-detail-report.tsx's KpiCard Card pattern) for the residual status. */
function StatusCard({ panelData }: { panelData: ReimbursementPanelData | undefined }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-xs font-normal text-muted-foreground">Stato</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {panelData ? (
          <Badge className={residualBadgeClassName(panelData.state)}>
            {formatResidualBadgeLabel(panelData.residual, panelData.state)}
          </Badge>
        ) : (
          // Defensive fallback (Task 1's doc comment): panelData can theoretically race-vanish
          // between the two server reads on the page, though never in practice for a genuine
          // Expense-anchored reimbursement reaching this component.
          <Badge className="border-0 bg-muted text-muted-foreground">Nessun rimborso collegato</Badge>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * `/reimbursements/[id]`'s client shell (Phase 76 Plan 05, RMB-11): header (editable title, D-07
 * KPI status card, anchor link) over the reused Plan 75/76-04 `ReimbursementPanel` in its default
 * full-management variant — the canonical place every other surface now points to (D-06).
 */
export function ReimbursementDetailClient({ reimbursement, panelData, anchorTransaction }: Props) {
  const router = useRouter()
  const [refundPickerOpen, setRefundPickerOpen] = useState(false)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3">
        <ReimbursementTitleEdit
          id={reimbursement.id}
          title={reimbursement.title}
          anchorTitle={reimbursement.anchorTitle}
          onSuccess={() => router.refresh()}
        />
        <Link
          href={expenseDetailHref(reimbursement.anchorExpenseId)}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {reimbursement.anchorTitle}
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatusCard panelData={panelData} />
      </div>

      {/* Default 'management' variant (no `variant` prop) — the full add/remove/delete body,
          unchanged from Plan 76-04, reused verbatim here (D-06). */}
      <ReimbursementPanel
        anchor={{ transactionId: anchorTransaction?.id ?? '' }}
        data={panelData}
        onAddRefund={() => setRefundPickerOpen(true)}
      />

      {/* Guarded on anchorTransaction being defined: it always will be for a genuine
          Expense-anchored reimbursement reaching this component (Plan 75-01's D-08
          unconditionally freezes at least one anchor transaction on every CREATE) — absence is
          an unreachable defensive case, not a real UI branch. */}
      {anchorTransaction ? (
        <RefundPickerDialog
          open={refundPickerOpen}
          onOpenChange={setRefundPickerOpen}
          anchor={{
            transactionId: anchorTransaction.id,
            amount: anchorTransaction.amount,
            occurredAt: anchorTransaction.occurredAt,
          }}
          onLinked={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}

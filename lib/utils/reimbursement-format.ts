/**
 * Pure, DB/server-free display helpers for reimbursement surfaces (Phase 76, D-03/D-10). No
 * server-only imports — usable from both RSC pages and client components (`ReimbursementPanel`
 * and friends).
 */
import { toDecimal } from '@/lib/utils/decimal'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import type { ReimbursementResidualState } from '@/lib/services/reimbursement'

/**
 * Row/page title fallback (D-03): an explicit non-empty `reimbursement.title` always wins; an
 * empty (or whitespace-only) title falls back to the anchor's own title so the row still reads
 * as something recognizable ("la cena da X").
 */
export function resolveReimbursementDisplayTitle(title: string, anchorTitle: string): string {
  return title.trim() || anchorTitle
}

/**
 * User-facing Italian status + amount label (D-10): "Saldato" for settled, "Dovuti €X" for owed,
 * "Surplus €X" for surplus — the exact combined badge-text vocabulary locked in 76-CONTEXT.md.
 */
export function formatResidualBadgeLabel(residual: string, state: ReimbursementResidualState): string {
  if (state === 'settled') {
    return 'Saldato'
  }

  const absoluteAmount = formatAbsoluteAmount(toDecimal(residual).abs().toFixed(2))
  return state === 'owed' ? `Dovuti ${absoluteAmount}` : `Surplus ${absoluteAmount}`
}

/**
 * Badge color classes matching the existing amber/emerald colored-badge convention
 * (components/expenses/expense-table.tsx Stato column) — owed=amber, settled=emerald,
 * surplus=blue (a third, distinct state needs its own hue).
 */
export function residualBadgeClassName(state: ReimbursementResidualState): string {
  if (state === 'owed') {
    return 'border-0 bg-amber-100 text-amber-700'
  }
  if (state === 'settled') {
    return 'border-0 bg-emerald-100 text-emerald-700'
  }
  return 'border-0 bg-blue-100 text-blue-700'
}

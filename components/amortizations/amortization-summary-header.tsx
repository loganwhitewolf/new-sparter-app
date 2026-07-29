'use client'

import { toDecimal } from '@/lib/utils/decimal'
import type { AmortizationPlanListRow } from '@/lib/dal/amortization'

const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

/**
 * computeTotalOpenResidual (D-B1) — the sum of netValue across every OPEN plan, via Decimal.js
 * (a cross-row JS aggregation over already-fetched DECIMAL-as-string values, unlike Task 1's
 * single-row SQL-side arithmetic — this one MUST use toDecimal/.plus(), never native +/-/*).
 * Closed plans are excluded; zero open plans (all closed, or an empty array) resolves to exactly
 * '0.00', never NaN or an empty string.
 */
export function computeTotalOpenResidual(plans: AmortizationPlanListRow[]): string {
  const total = plans
    .filter((plan) => plan.status === 'open')
    .reduce((sum, plan) => sum.plus(toDecimal(plan.netValue)), toDecimal('0'))

  return total.toFixed(2)
}

/**
 * AmortizationSummaryHeader (D-B1) — the registry's single aggregate KPI: total open net
 * residual. Mounted only when the account has at least one plan of any status (Task 1's
 * plans.length > 0 branch), so an all-closed account still shows this card with '€0,00'.
 *
 * Non-finite fallback mirrors formatSignedAmount's convention (Task 1's Netto column formatter,
 * itself mirroring components/reimbursements/reimbursement-table.tsx): on a bad upstream value,
 * render the raw computed value suffixed with the currency code instead of silently coercing to
 * €0,00, so a genuine upstream bug surfaces visibly.
 */
export function AmortizationSummaryHeader({ plans }: { plans: AmortizationPlanListRow[] }) {
  const totalOpenResidual = computeTotalOpenResidual(plans)
  const amount = Number(totalOpenResidual)
  const formattedAmount = Number.isFinite(amount)
    ? amountFormatter.format(amount)
    : `${totalOpenResidual} EUR`

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">Netto residuo aperto</p>
      <p className="text-2xl font-semibold tracking-tight">{formattedAmount}</p>
    </div>
  )
}

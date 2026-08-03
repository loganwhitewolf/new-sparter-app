import 'server-only'

import { randomUUID } from 'node:crypto'
import type Decimal from 'decimal.js'
import { and, asc, eq, gte } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import { amortizationInstalment, amortizationPlan, transaction } from '@/lib/db/schema'
import { applySignedDeltaToOpenPlanTx } from '@/lib/services/amortization-plan-amount'
import { materializeInstalments } from '@/lib/services/amortization-math'
import { createPairTx } from '@/lib/services/transaction-pairs'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

export type AmortizationLifecycleErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'PLAN_NOT_OPEN'
  | 'TRANSACTION_NOT_FOUND'
  | 'OVER_RESIDUAL'
  | 'SELF_LINK'

export class AmortizationLifecycleError extends Error {
  readonly code: AmortizationLifecycleErrorCode

  constructor(code: AmortizationLifecycleErrorCode, message: string) {
    super(message)
    this.name = 'AmortizationLifecycleError'
    this.code = code
  }
}

type OpenPlan = {
  id: string
  transactionId: string
  status: string
  totalAmount: string
}

/**
 * Ownership-scoped SELECT (mirrors amortization-activation.ts's own loadOpenPlanForOwner-shaped
 * pattern, T-78-01): a foreign-owned or nonexistent planId resolves to the SAME generic
 * PLAN_NOT_FOUND message — no ownership-enumeration signal. PLAN_NOT_OPEN is a distinct failure,
 * only reachable once ownership is established. `totalAmount` is the plan's authoritative base
 * (D-04 snapshot note) — loaded here so 78-02's reducePlanTx never needs a second query for it.
 */
async function loadOpenPlanForOwner(
  tx: DbOrTx,
  input: { userId: string; planId: string },
): Promise<OpenPlan> {
  const rows = await tx
    .select({
      id: amortizationPlan.id,
      transactionId: amortizationPlan.transactionId,
      status: amortizationPlan.status,
      totalAmount: amortizationPlan.totalAmount,
    })
    .from(amortizationPlan)
    .where(and(eq(amortizationPlan.id, input.planId), eq(amortizationPlan.userId, input.userId)))
    .limit(1)

  const plan = rows[0]
  if (!plan) {
    throw new AmortizationLifecycleError('PLAN_NOT_FOUND', 'Pianificazione non trovata.')
  }
  if (plan.status !== 'open') {
    throw new AmortizationLifecycleError('PLAN_NOT_OPEN', 'Questo piano è già chiuso.')
  }

  return plan
}

type FutureInstalment = {
  id: string
  instalmentNumber: number
  amount: string
  occurredAt: Date
  expenseId: string
}

/**
 * Loads every instalment whose occurredAt is on/after boundaryMonthStart (D-01, inclusive
 * adjacency edge — an instalment scheduled exactly in the closure month is collapsed, not
 * preserved). Ordered by occurredAt ascending so callers get a deterministic first element.
 */
async function loadFutureInstalments(
  tx: DbOrTx,
  input: { planId: string; boundaryMonthStart: Date },
): Promise<FutureInstalment[]> {
  return tx
    .select({
      id: amortizationInstalment.id,
      instalmentNumber: amortizationInstalment.instalmentNumber,
      amount: amortizationInstalment.amount,
      occurredAt: amortizationInstalment.occurredAt,
      expenseId: amortizationInstalment.expenseId,
    })
    .from(amortizationInstalment)
    .where(
      and(
        eq(amortizationInstalment.planId, input.planId),
        gte(amortizationInstalment.occurredAt, input.boundaryMonthStart),
      ),
    )
    .orderBy(asc(amortizationInstalment.occurredAt))
}

/** The start (local midnight, day 1) of the calendar month containing `now()` — D-03's residual
 * boundary is always anchored to TODAY, never a date derived from the plan itself. */
function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export type ClosePlanInput = {
  userId: string
  planId: string
  closureMonth: Date
}

export type ClosePlanResult = {
  closureInstalmentId: string | null
  remainingValue: string
}

/**
 * Shared collapse core (D-01/D-02, 78-01 + 78-02): collapses every remaining (future) instalment
 * of an already-loaded, already-open `plan` onto ONE closure-month instalment. `extraAmount` is
 * added to the collapsed remaining sum BEFORE it is written — zero for a plain close (closePlanTx),
 * the linked sale's signed Decimal amount for a realize-via-sale close (realizePlanTx, D-02). Never
 * reads plan.expenseId (no such column) — the closure instalment's expenseId is taken from the
 * first deleted future instalment (every instalment of one plan shares the SAME Standalone
 * Expense id, Phase 77 D-13). Runs entirely against the passed-in `tx`.
 */
async function collapseAndCloseTx(
  tx: DbOrTx,
  input: { userId: string; plan: OpenPlan; closureMonth: Date; extraAmount: Decimal },
): Promise<ClosePlanResult> {
  const closureMonthStart = new Date(
    input.closureMonth.getFullYear(),
    input.closureMonth.getMonth(),
    1,
  )

  const futureInstalments = await loadFutureInstalments(tx, {
    planId: input.plan.id,
    boundaryMonthStart: closureMonthStart,
  })

  if (futureInstalments.length === 0) {
    // Empty-input edge: every instalment already occurred before the closure month — close the
    // plan, write NO instalment row (no phantom zero-amount instalment), regardless of
    // `extraAmount` (realizePlanTx's zero-remaining case: the sale is still linked separately by
    // its own caller — nothing left here to net it against).
    await tx
      .update(amortizationPlan)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(amortizationPlan.id, input.plan.id))

    return { closureInstalmentId: null, remainingValue: '0.00' }
  }

  const remainingSum = futureInstalments.reduce(
    (acc, instalment) => acc.plus(toDecimal(instalment.amount)),
    toDecimal('0'),
  )
  const finalAmount = remainingSum.plus(input.extraAmount)

  await tx
    .delete(amortizationInstalment)
    .where(
      and(
        eq(amortizationInstalment.planId, input.plan.id),
        gte(amortizationInstalment.occurredAt, closureMonthStart),
      ),
    )

  // Reclaims the first cancelled slot — deterministic, always free since those rows were just
  // deleted, no extra query needed.
  const closureInstalmentNumber = Math.min(
    ...futureInstalments.map((instalment) => instalment.instalmentNumber),
  )
  const closureInstalmentId = randomUUID()

  await tx.insert(amortizationInstalment).values({
    id: closureInstalmentId,
    userId: input.userId,
    planId: input.plan.id,
    instalmentNumber: closureInstalmentNumber,
    expenseId: futureInstalments[0]!.expenseId,
    amount: toDbDecimal(finalAmount),
    occurredAt: input.closureMonth,
  })

  await tx
    .update(amortizationPlan)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(eq(amortizationPlan.id, input.plan.id))

  return { closureInstalmentId, remainingValue: toDbDecimal(finalAmount) }
}

/**
 * D-01/AMORT-04: closes an open plan, collapsing every remaining (future) instalment onto ONE
 * closure-month instalment holding their Decimal-summed value; past instalments are never read,
 * deleted, or rewritten. Thin wrapper around the shared `collapseAndCloseTx` core with
 * `extraAmount = 0` — realizePlanTx (D-02) is the other caller, adding the linked sale's amount.
 */
export async function closePlanTx(tx: DbOrTx, input: ClosePlanInput): Promise<ClosePlanResult> {
  const plan = await loadOpenPlanForOwner(tx, { userId: input.userId, planId: input.planId })
  return collapseAndCloseTx(tx, {
    userId: input.userId,
    plan,
    closureMonth: input.closureMonth,
    extraAmount: toDecimal('0'),
  })
}

export type RealizePlanInput = {
  userId: string
  planId: string
  saleTransactionId: string
}

export type RealizePlanResult = ClosePlanResult & {
  saleTransactionId: string
}

/**
 * D-02/AMORT-05: closes an open plan by linking a REAL sale transaction and netting it against
 * the closure month (an explicit exception to Mondo Netto's cost-month netting, ADR 0019 §8). The
 * closure month is always the sale's OWN occurredAt (D-02a). The closure instalment's amount is a
 * direct Decimal write — (Decimal sum of collapsed instalments).plus(sale's SIGNED amount) — via
 * `collapseAndCloseTx`'s `extraAmount`; the sale's link is written SEPARATELY below (the sole call
 * site in this whole file, v2.8 reuse) against the plan's ORIGINAL transaction. Two independent
 * write paths, one per lens: the accrual lens nets at the closure month (the materialized amount
 * above), the cash lens nets at the original transaction's own month (the existing v2.8 Mondo
 * Netto mechanism, unmodified) — never the same sale netted twice within one lens (ADR 0019 §10,
 * T-78-08 reuses that mechanism's own ownership/self-pair/sign-invariant guards unmodified).
 *
 * Over-recovery (sale magnitude > remaining magnitude) correctly flips the closure instalment's
 * sign to positive (income) — never blocked, never clamped (D-02, v2.8 surplus-first-class
 * precedent). A zero-remaining plan (fully consumed before the sale's month) still links the sale
 * below even though no closure instalment row is created.
 */
export async function realizePlanTx(
  tx: DbOrTx,
  input: RealizePlanInput,
): Promise<RealizePlanResult> {
  const plan = await loadOpenPlanForOwner(tx, { userId: input.userId, planId: input.planId })

  // Sale transaction: ownership-scoped load (T-78-05) — a foreign-owned or nonexistent
  // saleTransactionId resolves to the SAME generic message, never a silent cross-user net.
  const saleRows = await tx
    .select({ id: transaction.id, amount: transaction.amount, occurredAt: transaction.occurredAt, userId: transaction.userId })
    .from(transaction)
    .where(eq(transaction.id, input.saleTransactionId))
    .limit(1)

  const sale = saleRows[0]
  if (!sale || sale.userId !== input.userId) {
    throw new AmortizationLifecycleError('TRANSACTION_NOT_FOUND', 'Transazione non trovata.')
  }

  const collapseResult = await collapseAndCloseTx(tx, {
    userId: input.userId,
    plan,
    closureMonth: sale.occurredAt,
    extraAmount: toDecimal(sale.amount),
  })

  // Link the sale for cash-lens/bookkeeping purposes (reuses v2.8's anchor resolution — sign-based:
  // the plan's original transaction is the negative-amount anchor, the sale resolves as the
  // positive-amount refund — and self-pair guard UNMODIFIED, T-78-08). reducePlanTx also links its
  // refund the same way (see below) — closePlanTx is the only lifecycle path that never links.
  await createPairTx(tx, {
    userId: input.userId,
    anchor: { transactionId: plan.transactionId },
    counterpartId: input.saleTransactionId,
  })

  return { ...collapseResult, saleTransactionId: input.saleTransactionId }
}

export type ReducePlanInput = {
  userId: string
  planId: string
  refundTransactionId: string
}

export type ReducePlanResult = {
  newTotalAmount: string
  reSpreadInstalments: Array<{ id: string; instalmentNumber: number; amount: string; occurredAt: Date }>
}

/**
 * D-03/AMORT-06: reduces an open plan's base by a partial-refund transaction's amount and
 * re-spreads the remaining (not-yet-occurred) instalments proportionally — the plan STAYS open.
 * The refund is linked via the same v2.8 mechanism realizePlanTx uses (createPairTx, anchored on
 * the plan's original transaction) — the plan simply stays open instead of closing. Residual is
 * the Decimal-absolute sum of instalments with occurredAt on/after
 * the start of the CURRENT calendar month (today, never a date derived from the plan itself) —
 * an amount exceeding it is a realization, not a partial reduction, and is rejected with a
 * message redirecting to "chiudi con vendita/rimborso" BEFORE any delete/insert/update. An amount exactly
 * equal to the residual is the ALLOWED boundary (every re-spread instalment materializes to
 * 0.00). Re-spread reuses `materializeInstalments` unchanged, anchored at the earliest cancelled
 * future instalment's own date — the remainder lands there (the "month of reduction").
 */
export async function reducePlanTx(tx: DbOrTx, input: ReducePlanInput): Promise<ReducePlanResult> {
  const plan = await loadOpenPlanForOwner(tx, { userId: input.userId, planId: input.planId })

  // Self-link rejection (T-78-07) BEFORE any other check — a refund transaction cannot be the
  // plan's own original transaction.
  if (input.refundTransactionId === plan.transactionId) {
    throw new AmortizationLifecycleError(
      'SELF_LINK',
      'La transazione del rimborso non può essere la transazione originale del piano.',
    )
  }

  // Refund transaction: ownership-scoped load (T-78-06) — the refund's amount is ALWAYS read
  // server-side from this row, never trusted as a client-supplied string.
  const refundRows = await tx
    .select({ id: transaction.id, amount: transaction.amount, userId: transaction.userId })
    .from(transaction)
    .where(eq(transaction.id, input.refundTransactionId))
    .limit(1)

  const refundTx = refundRows[0]
  if (!refundTx || refundTx.userId !== input.userId) {
    throw new AmortizationLifecycleError('TRANSACTION_NOT_FOUND', 'Transazione non trovata.')
  }

  const boundaryMonthStart = startOfCurrentMonth()
  const futureInstalments = await loadFutureInstalments(tx, {
    planId: plan.id,
    boundaryMonthStart,
  })

  const residual = futureInstalments.reduce(
    (acc, instalment) => acc.plus(toDecimal(instalment.amount).abs()),
    toDecimal('0'),
  )
  const refundAmount = toDecimal(refundTx.amount)
  const refundMagnitude = refundAmount.abs()

  if (refundMagnitude.gt(residual)) {
    throw new AmortizationLifecycleError(
      'OVER_RESIDUAL',
      `Il rimborso di €${refundMagnitude.toFixed(2)} supera il residuo di €${residual.toFixed(2)} del piano — usa "chiudi con vendita/rimborso".`,
    )
  }

  // Link the refund exactly like realizePlanTx links its sale — same anchor shape, same v2.8
  // mechanism — the only difference is the plan stays open here instead of closing.
  await createPairTx(tx, {
    userId: input.userId,
    anchor: { transactionId: plan.transactionId },
    counterpartId: input.refundTransactionId,
  })

  // Amount + future re-spread shared with unlink reverse (amortization-plan-amount.ts).
  return applySignedDeltaToOpenPlanTx(tx, {
    userId: input.userId,
    plan: { id: plan.id, totalAmount: plan.totalAmount },
    signedDelta: refundAmount,
    boundaryMonthStart,
  })
}

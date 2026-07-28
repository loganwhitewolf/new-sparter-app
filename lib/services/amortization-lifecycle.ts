import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, asc, eq, gte } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import { amortizationInstalment, amortizationPlan } from '@/lib/db/schema'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

export type AmortizationLifecycleErrorCode = 'PLAN_NOT_FOUND' | 'PLAN_NOT_OPEN'

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
}

/**
 * Ownership-scoped SELECT (mirrors amortization-activation.ts's own loadOpenPlanForOwner-shaped
 * pattern, T-78-01): a foreign-owned or nonexistent planId resolves to the SAME generic
 * PLAN_NOT_FOUND message — no ownership-enumeration signal. PLAN_NOT_OPEN is a distinct failure,
 * only reachable once ownership is established.
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
 * D-01/AMORT-04: closes an open plan, collapsing every remaining (future) instalment onto ONE
 * closure-month instalment holding their Decimal-summed value; past instalments are never read,
 * deleted, or rewritten. Runs entirely against the passed-in `tx` — the delete, the closure
 * insert (when non-empty), and the plan status update either all commit or all roll back
 * together with whatever `db.transaction` the caller wraps this in.
 */
export async function closePlanTx(tx: DbOrTx, input: ClosePlanInput): Promise<ClosePlanResult> {
  const plan = await loadOpenPlanForOwner(tx, { userId: input.userId, planId: input.planId })

  const closureMonthStart = new Date(
    input.closureMonth.getFullYear(),
    input.closureMonth.getMonth(),
    1,
  )

  const futureInstalments = await loadFutureInstalments(tx, {
    planId: plan.id,
    boundaryMonthStart: closureMonthStart,
  })

  if (futureInstalments.length === 0) {
    // Empty-input edge: every instalment already occurred before the closure month — close the
    // plan, write NO instalment row (no phantom zero-amount row).
    await tx
      .update(amortizationPlan)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(amortizationPlan.id, plan.id))

    return { closureInstalmentId: null, remainingValue: '0.00' }
  }

  const remainingSum = futureInstalments.reduce(
    (acc, instalment) => acc.plus(toDecimal(instalment.amount)),
    toDecimal('0'),
  )

  await tx
    .delete(amortizationInstalment)
    .where(
      and(
        eq(amortizationInstalment.planId, plan.id),
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
    planId: plan.id,
    instalmentNumber: closureInstalmentNumber,
    // Every instalment of one plan carries the SAME Standalone Expense id (Phase 77 D-13).
    expenseId: futureInstalments[0]!.expenseId,
    amount: toDbDecimal(remainingSum),
    occurredAt: input.closureMonth,
  })

  await tx
    .update(amortizationPlan)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(eq(amortizationPlan.id, plan.id))

  return { closureInstalmentId, remainingValue: toDbDecimal(remainingSum) }
}

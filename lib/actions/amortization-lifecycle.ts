'use server'

import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import { ClosePlanSchema, RealizePlanSchema, ReimbursePlanSchema } from '@/lib/validations/amortization'
import {
  AmortizationLifecycleError,
  closePlanTx,
  realizePlanTx,
  reducePlanTx,
} from '@/lib/services/amortization-lifecycle'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'

export type ClosePlanActionResult = {
  error: string | null
}

/**
 * D-01/D-02a: closes an open plan, collapsing every remaining instalment onto a single
 * closure-month instalment. closureMonth defaults to the close action's OWN moment (D-02a's
 * scrap rule) — no client-supplied date in this minimal surface; realize-via-sale supplies its
 * own closureMonth in a later plan. Mirrors removeAmortizationPlan's exact
 * try/catch/revalidate shape.
 */
export async function closePlanAction(input: { planId: string }): Promise<ClosePlanActionResult> {
  const parsed = ClosePlanSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    await db.transaction((tx) =>
      closePlanTx(tx, {
        userId,
        planId: parsed.data.planId,
        closureMonth: new Date(),
      }),
    )
    revalidateCategorizationSurfaces()
    return { error: null }
  } catch (error) {
    if (error instanceof AmortizationLifecycleError) {
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
}

export type RealizePlanActionResult = {
  error: string | null
}

/**
 * D-02/AMORT-05: "chiudi per vendita" — closes an open plan by linking a real sale transaction,
 * netting against the closure month (the sale's own occurredAt). Mirrors closePlanAction's exact
 * try/catch/revalidate shape.
 */
export async function realizePlanAction(input: {
  planId: string
  saleTransactionId: string
}): Promise<RealizePlanActionResult> {
  const parsed = RealizePlanSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    await db.transaction((tx) =>
      realizePlanTx(tx, {
        userId,
        planId: parsed.data.planId,
        saleTransactionId: parsed.data.saleTransactionId,
      }),
    )
    revalidateCategorizationSurfaces()
    return { error: null }
  } catch (error) {
    if (error instanceof AmortizationLifecycleError) {
      return { error: error.message }
    }
    if (error instanceof Error) {
      // createPairTx's own ownership/self-pair/sign-invariant errors (T-78-08) bubble verbatim.
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
}

export type ReimbursePlanActionResult = {
  error: string | null
}

/**
 * D-03/AMORT-06: "rimborso parziale" — reduces an open plan's base by a refund transaction's
 * amount and re-spreads the remaining instalments; the plan stays open. Mirrors closePlanAction's
 * exact try/catch/revalidate shape.
 */
export async function reimbursePlanAction(input: {
  planId: string
  refundTransactionId: string
}): Promise<ReimbursePlanActionResult> {
  const parsed = ReimbursePlanSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    await db.transaction((tx) =>
      reducePlanTx(tx, {
        userId,
        planId: parsed.data.planId,
        refundTransactionId: parsed.data.refundTransactionId,
      }),
    )
    revalidateCategorizationSurfaces()
    return { error: null }
  } catch (error) {
    if (error instanceof AmortizationLifecycleError) {
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
}

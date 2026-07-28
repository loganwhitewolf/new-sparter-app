'use server'

import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import { ClosePlanSchema } from '@/lib/validations/amortization'
import { AmortizationLifecycleError, closePlanTx } from '@/lib/services/amortization-lifecycle'
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

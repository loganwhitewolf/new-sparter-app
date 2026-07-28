'use server'

import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import { CreateAmortizationPlanSchema } from '@/lib/validations/amortization'
import { ActivatePlanError, activatePlanTx } from '@/lib/services/amortization-activation'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'

export type CreateAmortizationPlanResult = {
  planId: string
  expenseId: string
  instalments: Array<{ date: Date; amount: string }>
  error: string | null
}

export async function createAmortizationPlan(input: {
  transactionId: string
  months: number
}): Promise<CreateAmortizationPlanResult> {
  const parsed = CreateAmortizationPlanSchema.safeParse(input)
  if (!parsed.success) {
    return {
      planId: '',
      expenseId: '',
      instalments: [],
      error: parsed.error.issues[0]?.message ?? 'Dati non validi.',
    }
  }

  const { userId } = await verifySession()

  try {
    const result = await db.transaction((tx) =>
      activatePlanTx(tx, {
        userId,
        transactionId: parsed.data.transactionId,
        months: parsed.data.months,
      }),
    )
    revalidateCategorizationSurfaces()
    return {
      planId: result.planId,
      expenseId: result.expenseId,
      instalments: result.instalments,
      error: null,
    }
  } catch (error) {
    if (error instanceof ActivatePlanError) {
      return { planId: '', expenseId: '', instalments: [], error: error.message }
    }
    return {
      planId: '',
      expenseId: '',
      instalments: [],
      error: 'Si è verificato un errore. Riprova tra qualche secondo.',
    }
  }
}

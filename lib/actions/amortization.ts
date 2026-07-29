'use server'

import { and, eq } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'
import { db } from '@/lib/db'
import { amortizationPlan } from '@/lib/db/schema'
import {
  CreateAmortizationPlanSchema,
  RemoveAmortizationPlanSchema,
} from '@/lib/validations/amortization'
import { ActivatePlanError, activatePlanTx } from '@/lib/services/amortization-activation'
import { DetachTransactionError, reverseDetachTx } from '@/lib/services/transaction-detach'
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

export type RemoveAmortizationPlanResult = {
  error: string | null
}

/**
 * D-09 undo: loads the plan's transactionId (scoped to the caller's own userId — a foreign
 * planId resolves to "not found") and calls reverseDetachTx inside the SAME db.transaction
 * (WR-03 review-fix) — the ownership lookup used to run as a standalone query BEFORE the write
 * transaction, leaving a TOCTOU window (e.g. a duplicate "Rimuovi ammortamento" click from a
 * second tab) with no atomicity guarantee of its own. Moving both queries into one tx makes the
 * lookup's scoping authoritative rather than a redundant early-exit optimization; reverseDetachTx
 * itself still re-validates id/userId/transactionId (defense-in-depth, unchanged).
 */
export async function removeAmortizationPlan(input: {
  planId: string
}): Promise<RemoveAmortizationPlanResult> {
  const parsed = RemoveAmortizationPlanSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    await db.transaction(async (tx) => {
      const planRows = await tx
        .select({ transactionId: amortizationPlan.transactionId })
        .from(amortizationPlan)
        .where(and(eq(amortizationPlan.id, parsed.data.planId), eq(amortizationPlan.userId, userId)))
        .limit(1)

      const plan = planRows[0]
      if (!plan) {
        throw new DetachTransactionError('PLAN_NOT_FOUND', 'Pianificazione non trovata.')
      }

      await reverseDetachTx(tx, {
        userId,
        transactionId: plan.transactionId,
        planId: parsed.data.planId,
      })
    })
    revalidateCategorizationSurfaces()
    return { error: null }
  } catch (error) {
    if (error instanceof DetachTransactionError) {
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
}

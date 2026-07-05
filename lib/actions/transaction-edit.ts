'use server'
import { verifySession } from '@/lib/dal/auth'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'
import { updateTransaction } from '@/lib/services/transaction-edit'
import { UpdateTransactionSchema } from '@/lib/validations/transaction-edit'
import type { ActionState } from '@/lib/validations/expense'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

export async function updateTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = UpdateTransactionSchema.safeParse({
    id: formData.get('id'),
    amount: formData.get('amount') || undefined,
    occurredAt: formData.get('occurredAt') || undefined,
    customTitle: formData.has('customTitle') ? formData.get('customTitle') : undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { userId } = await verifySession()

  let occurredAt: Date | undefined
  if (parsed.data.occurredAt !== undefined) {
    occurredAt = new Date(parsed.data.occurredAt)
    if (Number.isNaN(occurredAt.getTime())) {
      return { error: 'Data non valida.' }
    }
  }

  try {
    await updateTransaction({
      userId,
      transactionId: parsed.data.id,
      amount:
        parsed.data.amount !== undefined
          ? toDbDecimal(toDecimal(parsed.data.amount.replace(',', '.')))
          : undefined,
      occurredAt,
      customTitle: parsed.data.customTitle,
    })
  } catch (error) {
    // The service's Italian pair-guard/not-found/ownership messages must
    // reach the caller verbatim (DET-03) — this differs from createTransaction's
    // generic catch-all.
    return { error: (error as Error).message }
  }

  revalidateCategorizationSurfaces()
  return { error: null }
}

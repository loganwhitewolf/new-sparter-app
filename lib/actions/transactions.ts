'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import { UpdateTransactionCustomTitleSchema } from '@/lib/validations/transactions'
import { updateTransactionCustomTitle as updateTransactionCustomTitleDAL } from '@/lib/dal/transactions'
import { db } from '@/lib/db'
import type { ActionState } from '@/lib/validations/expense'

export async function updateTransactionCustomTitle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = UpdateTransactionCustomTitleSchema.safeParse({
    id: formData.get('id'),
    customTitle: formData.get('customTitle'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { userId } = await verifySession()
  try {
    await updateTransactionCustomTitleDAL(
      db,
      parsed.data.id,
      userId,
      parsed.data.customTitle,
    )
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidatePath('/transazioni')
  return { error: null }
}

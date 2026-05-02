'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import {
  CreatePatternSchema,
  UpdatePatternSchema,
  type ActionState,
} from '@/lib/validations/pattern'
import {
  createPattern,
  updatePattern,
  deletePattern,
} from '@/lib/dal/patterns'

function requirePaidPlan(plan: string): ActionState | null {
  if (plan === 'free') {
    return { error: 'I pattern personalizzati richiedono un piano Basic o Pro.' }
  }
  return null
}

export async function createPatternAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, subscriptionPlan } = await verifySession()

  const planError = requirePaidPlan(subscriptionPlan)
  if (planError) return planError

  const parsed = CreatePatternSchema.safeParse({
    pattern: formData.get('pattern'),
    subCategoryId: formData.get('subCategoryId') ? Number(formData.get('subCategoryId')) : undefined,
    amountSign: formData.get('amountSign'),
    confidence: formData.get('confidence') ? Number(formData.get('confidence')) : undefined,
    description: (formData.get('description') as string) || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await createPattern({ ...parsed.data, userId })
  } catch (err) {
    if (err instanceof Error && /invalid/i.test(err.message)) {
      return { error: 'Pattern regex non valido.' }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/impostazioni/pattern')
  return { error: null }
}

export async function updatePatternAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, subscriptionPlan } = await verifySession()

  const planError = requirePaidPlan(subscriptionPlan)
  if (planError) return planError

  const id = Number(formData.get('id'))
  if (!id || isNaN(id)) return { error: 'ID pattern mancante.' }

  const parsed = UpdatePatternSchema.safeParse({
    pattern: formData.get('pattern') || undefined,
    subCategoryId: formData.get('subCategoryId') ? Number(formData.get('subCategoryId')) : undefined,
    amountSign: formData.get('amountSign') || undefined,
    confidence: formData.get('confidence') ? Number(formData.get('confidence')) : undefined,
    description: (formData.get('description') as string) || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    const updated = await updatePattern(id, userId, parsed.data)
    if (!updated) return { error: 'Pattern non trovato o accesso negato.' }
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/impostazioni/pattern')
  return { error: null }
}

export async function deletePatternAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()

  const id = Number(formData.get('id'))
  if (!id || isNaN(id)) return { error: 'ID pattern mancante.' }

  try {
    const deleted = await deletePattern(id, userId)
    if (!deleted) return { error: 'Pattern non trovato o accesso negato.' }
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/impostazioni/pattern')
  return { error: null }
}

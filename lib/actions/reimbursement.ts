'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import { updateReimbursementTitle } from '@/lib/dal/reimbursement'
import { UpdateReimbursementTitleSchema } from '@/lib/validations/reimbursement'
import type { ActionState } from '@/lib/validations/expense'
import { APP_ROUTES, reimbursementHref } from '@/lib/routes'

/**
 * Server action: `/reimbursements/[id]`'s inline edit-title submission (Phase 76 Plan 05, RMB-11).
 * Organizationally a new, reimbursement-property-focused module distinct from
 * lib/actions/transaction-pairs.ts's linking-mechanics actions (per 76-CONTEXT.md's canonical_refs
 * explicitly allowing "a reimbursement action module").
 *
 * Security gates (T-76-02):
 *  1. Zod parse validates input shape before any auth or DB access.
 *  2. verifySession() establishes caller identity.
 *  3. updateReimbursementTitle's own UPDATE WHERE clause re-validates reimbursement.userId
 *     ownership — a tampered FormData reimbursementId pointing at another user's row updates zero
 *     rows and throws, never mutating a foreign reimbursement.
 */
export async function updateReimbursementTitleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = UpdateReimbursementTitleSchema.safeParse({
    reimbursementId: formData.get('reimbursementId'),
    title: formData.get('title'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    await updateReimbursementTitle({
      userId,
      reimbursementId: parsed.data.reimbursementId,
      title: parsed.data.title,
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  // Both the detail page (this edit) and the list (which also shows the title) need a refresh.
  revalidatePath(reimbursementHref(parsed.data.reimbursementId))
  revalidatePath(APP_ROUTES.reimbursements)

  return { error: null }
}

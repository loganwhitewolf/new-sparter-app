'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import {
  CreatePairSchema,
  DeletePairSchema,
  DeleteReimbursementSchema,
  LoadCounterpartsSchema,
} from '@/lib/validations/transaction-pairs'
import {
  createPair,
  deletePairByTransactionId,
  deleteReimbursementForAnchor,
} from '@/lib/services/transaction-pairs'
import { getEligibleCounterparts, type CounterpartRow } from '@/lib/dal/transaction-pairs'
import type { ActionState } from '@/lib/validations/expense'

/**
 * ActionState-compatible result for pair creation. On success it also carries the
 * resolved secondary (refund) transaction id and, when the refund expense inherited
 * the spend's subcategory (decision 2), that subCategoryId — so the client can
 * repaint the refund row as categorized without a full reload.
 */
export type CreatePairActionState = ActionState & {
  pairedSecondaryId?: string
  pairedSubCategoryId?: number
}

/**
 * Server action: link two transactions as a 1:1 pair (e.g. expense ↔ reimbursement).
 *
 * Security gates (T-50-03, T-50-04):
 *  1. Zod parse validates input shape before any auth or DB access.
 *  2. verifySession() establishes caller identity.
 *  3. createPair service validates both transaction.userId === sessionUserId (T-50-01/D-01).
 *
 * Surfaces ownership / double-link error messages to the caller via `{ error }`.
 */
export async function createTransactionPairAction(
  _prev: CreatePairActionState,
  formData: FormData,
): Promise<CreatePairActionState> {
  const parsed = CreatePairSchema.safeParse({
    transactionId: formData.get('transactionId'),
    counterpartId: formData.get('counterpartId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  let result: Awaited<ReturnType<typeof createPair>>
  try {
    result = await createPair({
      userId,
      anchor: { transactionId: parsed.data.transactionId },
      counterpartId: parsed.data.counterpartId,
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/transactions')
  revalidatePath('/overview')

  return {
    error: null,
    pairedSecondaryId: result.secondaryTransactionId,
    pairedSubCategoryId: result.inheritedSubCategoryId,
  }
}

/**
 * Server action: load eligible counterparts for a given reference transaction.
 *
 * Called from the client-side CounterpartPickerDialog to re-fetch the list when the
 * date range changes. The DAL function is `server-only` so it cannot be called directly
 * from the client; this thin action bridges that boundary.
 *
 * Security: verifySession() is embedded inside getEligibleCounterparts (T-50-01).
 * Input is validated with LoadCounterpartsSchema before reaching the DAL (WR-02);
 * the candidate list is `userId`-scoped, so referenceAmount only drives the sign filter.
 */
export async function loadEligibleCounterpartsAction(params: {
  referenceId: string
  referenceAmount: string
  dateFrom: Date
  dateTo: Date
}): Promise<{ counterparts: CounterpartRow[] } | { error: string }> {
  const parsed = LoadCounterpartsSchema.safeParse(params)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  try {
    // Action↔DAL seam (Phase 75 Plan 02): the DAL's getEligibleCounterparts takes a
    // excludeTransactionIds SET (D-06 — a Group anchor excludes every member transaction), while
    // this action's own external contract stays the D-07 quick-action's single referenceId — a
    // one-element array wrapping it, localized to this one seam.
    const counterparts = await getEligibleCounterparts({
      excludeTransactionIds: [parsed.data.referenceId],
      referenceAmount: parsed.data.referenceAmount,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
    })
    return { counterparts }
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore nel caricamento delle transazioni disponibili.' }
  }
}

/**
 * Server action: unlink a transaction pair by either transaction in the pair.
 *
 * Security gates (T-50-03, T-50-04):
 *  1. Zod parse validates input shape.
 *  2. verifySession() establishes caller identity.
 *  3. deletePairByTransactionId service validates transaction.userId === sessionUserId (T-50-01).
 */
export async function deleteTransactionPairAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = DeletePairSchema.safeParse({
    transactionId: formData.get('transactionId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    await deletePairByTransactionId({
      userId,
      transactionId: parsed.data.transactionId,
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/transactions')
  revalidatePath('/overview')

  return { error: null }
}

/**
 * Server action: D-09's "remove a single refund" lifecycle action. `deletePairByTransactionId`'s
 * refund-side branch already restores baseline (D-10) before removing the link, so this reuses
 * `deleteTransactionPairAction` directly rather than duplicating an identical thin wrapper —
 * `RemoveRefundSchema` is an alias of `DeletePairSchema` (same bare-transactionId shape).
 */
export const removeRefundAction = deleteTransactionPairAction

/**
 * Server action: D-09's "delete the whole reimbursement" lifecycle action — detaches every
 * linked refund (restoring each one's baseline, D-10) and removes the reimbursement row.
 *
 * Security gates (T-75-07, T-75-08):
 *  1. Zod parse validates input shape (DeleteReimbursementSchema — a coerced positive integer
 *     id).
 *  2. verifySession() establishes caller identity.
 *  3. deleteReimbursementForAnchor validates reimbursement.userId === sessionUserId and restores
 *     every refund inside one db.transaction before deleting (T-75-08).
 */
export async function deleteReimbursementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = DeleteReimbursementSchema.safeParse({
    reimbursementId: formData.get('reimbursementId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    await deleteReimbursementForAnchor({
      userId,
      reimbursementId: parsed.data.reimbursementId,
    })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/transactions')
  revalidatePath('/overview')

  return { error: null }
}

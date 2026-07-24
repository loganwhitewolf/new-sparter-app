'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import {
  CreateMultiRefundSchema,
  CreatePairSchema,
  DeletePairSchema,
  DeleteReimbursementSchema,
  LoadCounterpartsSchema,
  LoadGroupOccurrenceIntervalSchema,
  LoadGroupRefundCandidatesSchema,
} from '@/lib/validations/transaction-pairs'
import {
  createPair,
  createPairTx,
  deletePairByTransactionId,
  deleteReimbursementForAnchor,
  type CreatePairAnchor,
} from '@/lib/services/transaction-pairs'
import {
  getEligibleCounterparts,
  getGroupMemberTransactionIds,
  getGroupOccurrenceInterval,
  type CounterpartRow,
  type GroupOccurrenceInterval,
} from '@/lib/dal/transaction-pairs'
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

/**
 * Server action: D-05's multi-select add-refund submission — links N selected counterpart
 * transactions to one anchor in a SINGLE `db.transaction` (T-75-10). A failure on any one link
 * (foreign-owned id, already-paired, wrong sign, self-pair) rolls back the WHOLE batch — never a
 * partial success with some refunds linked and others not.
 *
 * Security gates (T-75-10):
 *  1. Zod parse validates the discriminated anchor shape + non-empty counterpartIds (Edge
 *     RMB-08/empty) before any auth or DB access.
 *  2. verifySession() establishes caller identity.
 *  3. Every `createPairTx` call re-validates ownership of its own transaction/group id against
 *     `userId` — a tampered FormData carrying a foreign-owned id throws inside the shared
 *     transaction, rolling back every link already made in this submission.
 */
export async function createMultiRefundAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CreateMultiRefundSchema.safeParse({
    transactionId: formData.get('transactionId') || undefined,
    groupId: formData.get('groupId') || undefined,
    counterpartIds: formData.getAll('counterpartIds'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  const anchor: CreatePairAnchor = parsed.data.transactionId
    ? { transactionId: parsed.data.transactionId }
    : { groupId: parsed.data.groupId! }

  try {
    await db.transaction(async (tx) => {
      for (const counterpartId of parsed.data.counterpartIds) {
        await createPairTx(tx, { userId, anchor, counterpartId })
      }
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
 * Server action: resolves a Group anchor's occurrence interval (D-06) — the window source
 * `RefundPickerDialog`'s Group-anchor mode uses to default its ±90-day candidate range. Bridges
 * the `server-only` `getGroupOccurrenceInterval` DAL call to the client-side dialog.
 */
export async function loadGroupOccurrenceIntervalAction(params: {
  groupId: number
}): Promise<{ interval: GroupOccurrenceInterval | undefined } | { error: string }> {
  const parsed = LoadGroupOccurrenceIntervalSchema.safeParse(params)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    const interval = await getGroupOccurrenceInterval({ userId, groupId: parsed.data.groupId })
    return { interval }
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore nel caricamento del periodo del gruppo.' }
  }
}

/**
 * Server action: loads eligible refund candidates for a Group anchor (D-06) — mirrors
 * `loadEligibleCounterpartsAction`'s bridging role for the D-07 quick action, but resolves the
 * Group's OWN member transaction ids server-side (`getGroupMemberTransactionIds`) as the
 * exclusion set instead of a single `referenceId`, so a group's own members are never offered as
 * candidate refunds for themselves.
 *
 * A Group anchor is always an outflow (RMB-03 invariant, enforced by `assertOutflowAnchorAmount`
 * inside `createPairTx` regardless of anchor shape) — `getEligibleCounterparts`'s sign filter only
 * reads the SIGN of `referenceAmount`, never its magnitude, so a synthetic negative placeholder is
 * sufficient here (there is no single anchor amount for a multi-member Group to pass instead).
 */
export async function loadGroupRefundCandidatesAction(params: {
  groupId: number
  dateFrom: Date
  dateTo: Date
}): Promise<{ counterparts: CounterpartRow[] } | { error: string }> {
  const parsed = LoadGroupRefundCandidatesSchema.safeParse(params)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { userId } = await verifySession()

  try {
    const excludeTransactionIds = await getGroupMemberTransactionIds({
      userId,
      groupId: parsed.data.groupId,
    })
    const counterparts = await getEligibleCounterparts({
      excludeTransactionIds,
      referenceAmount: '-1',
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
    })
    return { counterparts }
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore nel caricamento delle transazioni disponibili.' }
  }
}

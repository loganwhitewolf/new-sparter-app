import 'server-only'

import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reimbursement, transaction } from '@/lib/db/schema'
import {
  applyExpenseReconciliation,
  buildReconcilePlan,
  loadAggregatesForExpenses,
  loadManualOrOverrideExpenseIds,
} from '@/lib/services/expense-reconciliation'
import { toDbDecimal, toDecimal } from '@/lib/utils/decimal'

/**
 * Service-level input — distinct from the Zod-inferred action-level type.
 * The action converts occurredAt (string) to Date and normalizes amount via
 * Decimal before calling this service, exactly as createTransaction does for
 * CreateTransactionSchema.
 */
export type UpdateTransactionInput = {
  userId: string
  transactionId: string
  amount?: string
  occurredAt?: Date
  customTitle?: string | null
}

/**
 * Builds the pair-guard rejection message (RMB-09, Phase 74).
 *
 * Naming a SPECIFIC blocking refund is not meaningful for an anchor edit — the
 * invariant is a SUM across all N refunds, not any single one — so the
 * reimbursement's own title is the actionable identifier when N>1. For a
 * refund-edit conflict the user already knows which refund they're editing,
 * so no further "which refund" disambiguation is needed there either.
 *
 * N<=1 keeps the exact, unchanged message from before Phase 74 (no regression
 * in the common case).
 */
export function buildPairGuardMessage(input: {
  refundCount: number
  reimbursementTitle: string
}): string {
  if (input.refundCount > 1) {
    return `Scollega prima il rimborso "${input.reimbursementTitle}"`
  }
  return 'Scollega prima il rimborso'
}

/**
 * Edits a transaction's amount, occurredAt, and/or customTitle atomically.
 *
 * Immutability (T-62-02): transactionHash, descriptionHash, and description
 * are never part of the allowlisted `.set()` payload — no code path in this
 * function can assign those columns.
 *
 * Reconciliation (DET-02 / T-62-04): when amount or occurredAt changes and the
 * transaction is linked to an expense, the expense's derived aggregates are
 * recomputed via the same reconciliation helpers used elsewhere, inside this
 * same db.transaction (tx, never db).
 *
 * Pair guard (DET-03 / T-62-03, T-62-01; repointed Phase 73, T-73-10, ADR 0018):
 * an amount edit on a transaction linked to a reimbursement (as anchor or
 * refund) that would break the reimbursement's opposite-sign/nonzero
 * invariant is rejected with the Italian message "Scollega prima il
 * rimborso" before any write runs. Generalizes the old 1:1 legacy-pair-table
 * single-counterpart check to a SUM over every OTHER linked refund (or, when
 * editing the anchor, every linked refund) — correct for any N, not a
 * scope-reduced N=1 special case. A reimbursement with zero linked refunds
 * imposes no guard (nothing to protect). RMB-09 (Phase 74) is about
 * UX/reconciliation choices beyond this block (e.g. distinguishing WHICH
 * refund broke the invariant when N>1) — not about this correctness check,
 * which already holds for any N. Ownership (T-62-01) is enforced by scoping
 * the initial SELECT to both id and userId — an absent or foreign-owned row
 * throws the same generic "Transazione non trovata." message (no user
 * enumeration).
 */
export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<{ success: true }> {
  if (input.amount === undefined && input.occurredAt === undefined && input.customTitle === undefined) {
    throw new Error('Nessun campo da modificare.')
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: transaction.id,
        userId: transaction.userId,
        amount: transaction.amount,
        expenseId: transaction.expenseId,
      })
      .from(transaction)
      .where(and(eq(transaction.id, input.transactionId), eq(transaction.userId, input.userId)))
      .limit(1)

    const row = rows[0]
    if (!row) {
      throw new Error('Transazione non trovata.')
    }

    if (input.amount !== undefined) {
      // Phase 73 (D-05/D-06, T-73-10, ADR 0018): a transaction can be linked as EITHER a
      // refund (reimbursement_refund.transaction_id = this id) OR the anchor of a
      // reimbursement (a reimbursement row's expense_id matches this transaction's expense_id
      // AND this transaction is the earliest transaction of that expense — the same Q3
      // tie-break used by effectiveAmount() in lib/dal/transaction-pairs-sql.ts). Both checks
      // run as correlated subqueries in a single SELECT to avoid an extra round trip.
      const roleRows = await tx
        .select({
          asRefundReimbursementId: sql<number | null>`(
            SELECT rr.reimbursement_id FROM reimbursement_refund rr
            WHERE rr.transaction_id = ${input.transactionId}
            LIMIT 1
          )`,
          asAnchorReimbursementId: sql<number | null>`(
            SELECT r.id FROM reimbursement r
            WHERE r.expense_id = ${row.expenseId}
            AND ${input.transactionId} = (
              SELECT t2.id FROM transaction t2
              WHERE t2.expense_id = ${row.expenseId}
              ORDER BY t2.occurred_at ASC, t2.id ASC
              LIMIT 1
            )
            LIMIT 1
          )`,
        })
        .from(transaction)
        .where(eq(transaction.id, input.transactionId))
        .limit(1)

      const roleRow = roleRows[0]
      const reimbursementId =
        roleRow?.asRefundReimbursementId ?? roleRow?.asAnchorReimbursementId ?? null
      const isRefundEdit = roleRow?.asRefundReimbursementId != null

      if (reimbursementId != null) {
        const newAmount = toDecimal(input.amount)

        if (isRefundEdit) {
          // Editing a refund: "other side" = the anchor's own amount + every OTHER refund's
          // amount (excluding the one being edited) — generalizes the old single-counterpart
          // lookup to a SUM, correct for any N.
          const sumRows = await tx
            .select({
              anchorAmount: sql<string | null>`(
                SELECT t2.amount FROM transaction t2
                WHERE t2.id = (
                  SELECT t3.id FROM transaction t3
                  WHERE t3.expense_id = ${reimbursement.expenseId}
                  ORDER BY t3.occurred_at ASC, t3.id ASC
                  LIMIT 1
                )
              )`,
              otherRefundsSum: sql<string | null>`(
                SELECT SUM(rt.amount::numeric)::text
                FROM reimbursement_refund rr
                INNER JOIN transaction rt ON rt.id = rr.transaction_id
                WHERE rr.reimbursement_id = ${reimbursement.id}
                  AND rr.transaction_id != ${input.transactionId}
              )`,
              reimbursementTitle: reimbursement.title,
              // Total N of linked refunds (not excluding the one being edited) —
              // the full count is what determines message ambiguity, RMB-09.
              refundCount: sql<number>`(
                SELECT COUNT(*)::int FROM reimbursement_refund rr
                WHERE rr.reimbursement_id = ${reimbursement.id}
              )`,
            })
            .from(reimbursement)
            .where(eq(reimbursement.id, reimbursementId))
            .limit(1)

          const sumRow = sumRows[0]
          const otherSum = toDecimal(sumRow?.anchorAmount ?? '0').plus(
            toDecimal(sumRow?.otherRefundsSum ?? '0'),
          )
          const oppositeSign =
            (newAmount.gt(0) && otherSum.lt(0)) || (newAmount.lt(0) && otherSum.gt(0))

          if (!oppositeSign) {
            throw new Error(
              buildPairGuardMessage({
                refundCount: sumRow?.refundCount ?? 0,
                reimbursementTitle: sumRow?.reimbursementTitle ?? '',
              }),
            )
          }
        } else {
          // Editing the anchor: "other side" = SUM of every linked refund. A reimbursement
          // with zero linked refunds (SUM over an empty set = NULL) has nothing to protect
          // and imposes no guard.
          const sumRows = await tx
            .select({
              refundsSum: sql<string | null>`(
                SELECT SUM(rt.amount::numeric)::text
                FROM reimbursement_refund rr
                INNER JOIN transaction rt ON rt.id = rr.transaction_id
                WHERE rr.reimbursement_id = ${reimbursementId}
              )`,
              reimbursementTitle: reimbursement.title,
              refundCount: sql<number>`(
                SELECT COUNT(*)::int FROM reimbursement_refund rr
                WHERE rr.reimbursement_id = ${reimbursementId}
              )`,
            })
            .from(reimbursement)
            .where(eq(reimbursement.id, reimbursementId))
            .limit(1)

          const sumRow = sumRows[0]
          const refundsSumRaw = sumRow?.refundsSum
          if (refundsSumRaw != null) {
            const otherSum = toDecimal(refundsSumRaw)
            const oppositeSign =
              (newAmount.gt(0) && otherSum.lt(0)) || (newAmount.lt(0) && otherSum.gt(0))

            if (!oppositeSign) {
              throw new Error(
                buildPairGuardMessage({
                  refundCount: sumRow?.refundCount ?? 0,
                  reimbursementTitle: sumRow?.reimbursementTitle ?? '',
                }),
              )
            }
          }
        }
      }
    }

    // The transaction table has no updatedAt column (schema.ts) — only
    // createdAt. The allowlist below is the only source of truth for what
    // this function can write; hashes/description are structurally absent.
    const updateSet: Record<string, unknown> = {}
    if (input.amount !== undefined) {
      updateSet.amount = toDbDecimal(toDecimal(input.amount))
    }
    if (input.occurredAt !== undefined) {
      updateSet.occurredAt = input.occurredAt
    }
    if (input.customTitle !== undefined) {
      updateSet.customTitle = input.customTitle
    }

    await tx
      .update(transaction)
      .set(updateSet)
      .where(and(eq(transaction.id, input.transactionId), eq(transaction.userId, input.userId)))

    if ((input.amount !== undefined || input.occurredAt !== undefined) && row.expenseId) {
      const expenseId = row.expenseId
      const aggregates = await loadAggregatesForExpenses(tx, {
        userId: input.userId,
        expenseIds: [expenseId],
      })
      const manualIds = await loadManualOrOverrideExpenseIds(tx, {
        userId: input.userId,
        affectedExpenseIds: [expenseId],
      })
      const plan = buildReconcilePlan([expenseId], aggregates, manualIds)
      await applyExpenseReconciliation(tx, plan, input.userId)
    }

    return { success: true }
  })
}

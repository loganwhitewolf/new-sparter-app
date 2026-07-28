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
        // Phase 78 (D-04, AMORT-07): correlated subquery mirroring
        // transactionListSelect.amortizationPlanId (lib/dal/transactions.ts) — same
        // no-extra-round-trip style, with the added open-status predicate this guard
        // needs. Non-null only when an OPEN amortization plan exists for this
        // transaction; a closed plan's totalAmount snapshot is frozen and no longer
        // needs this guard.
        amortizationPlanId: sql<string | null>`(
          SELECT ap.id FROM amortization_plan ap
          WHERE ap.transaction_id = ${transaction.id} AND ap.status = 'open'
        )`,
      })
      .from(transaction)
      .where(and(eq(transaction.id, input.transactionId), eq(transaction.userId, input.userId)))
      .limit(1)

    const row = rows[0]
    if (!row) {
      throw new Error('Transazione non trovata.')
    }

    // Phase 78 (D-04, AMORT-07): editing amount OR occurredAt (or both) on a
    // transaction with an OPEN amortization plan is blocked before any write, the
    // reimbursement pair-guard, or expense reconciliation runs — reconciling an
    // amount/date edit would require rewriting the purchase-month instalment, a
    // past/closed month, violating ADR 0019's "never rewrite a closed month"
    // invariant. Runs BEFORE the amount-only pair-guard block below (not nested
    // inside it) so it also covers occurredAt-only edits, which the pair-guard never
    // checked. Subcategory/title edits are unaffected — they never set amount or
    // occurredAt, so this predicate never fires for them. `!= null` (loose) treats a
    // pre-existing test's undefined amortizationPlanId the same as an explicit null.
    if (
      (input.amount !== undefined || input.occurredAt !== undefined) &&
      row.amortizationPlanId != null
    ) {
      throw new Error('Rimuovi ammortamento per modificare l\'importo o la data della transazione.')
    }

    if (input.amount !== undefined) {
      // Phase 73 (D-05/D-06, T-73-10, ADR 0018): a transaction can be linked as EITHER a
      // refund (reimbursement_refund.transaction_id = this id) OR the anchor of a
      // reimbursement. The anchor check has TWO shapes (Phase 74 CR-01, ADR 0018 D-01/D-02):
      // an Expense-shaped anchor (a reimbursement row's expense_id matches this transaction's
      // expense_id AND this transaction is the earliest transaction of that expense — the same
      // Q3 tie-break used by effectiveAmount() in lib/dal/transaction-pairs-sql.ts, unchanged
      // from Phase 73/before), OR a Group-shaped anchor (a reimbursement row's expense_group_id
      // matches the group this transaction's expense belongs to, via expense_group_membership —
      // every member transaction of the group is capable of triggering the guard, mirroring
      // effectiveAmount()'s member-set semantics, since a Group anchor is inherently
      // multi-transaction; there is no "earliest member" special-casing for this branch). Both
      // checks run as correlated subqueries in a single SELECT to avoid an extra round trip.
      const roleRows = await tx
        .select({
          asRefundReimbursementId: sql<number | null>`(
            SELECT rr.reimbursement_id FROM reimbursement_refund rr
            WHERE rr.transaction_id = ${input.transactionId}
            LIMIT 1
          )`,
          asAnchorReimbursementId: sql<number | null>`(
            SELECT r.id FROM reimbursement r
            WHERE (
              r.expense_id = ${row.expenseId}
              AND ${input.transactionId} = (
                SELECT t2.id FROM transaction t2
                WHERE t2.expense_id = ${row.expenseId}
                ORDER BY t2.occurred_at ASC, t2.id ASC
                LIMIT 1
              )
            ) OR r.expense_group_id = (
              SELECT egm.group_id FROM expense_group_membership egm
              WHERE egm.expense_id = ${row.expenseId}
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
          //
          // anchorAmount has TWO shapes (Phase 74 CR-02, ADR 0018 D-01/D-02), selected by which
          // XOR column is set on this reimbursement row:
          //  - Expense-shaped anchor: the earliest transaction of that expense (unchanged from
          //    Phase 73/before — the Expense-anchor path stays byte-identical).
          //  - Group-shaped anchor: reimbursement.expenseId is NULL here, so the old
          //    Expense-only subquery matched nothing and silently resolved to NULL (CR-02) —
          //    for a Group anchor the anchor is inherently multi-transaction, so its real
          //    outflow is ΣmemberOutflow across every member Expense's own transactions,
          //    resolved via expense_group_membership exactly as effectiveAmount()'s
          //    member_transactions CTE does (lib/dal/transaction-pairs-sql.ts), excluding any
          //    transaction that is itself a linked refund of some other reimbursement.
          //
          // IMPORTANT (discovered while proving this against real Postgres, Phase 74-04): every
          // reference to the anchor's own expense_id/expense_group_id below goes through the
          // `anchor` CTE as a WRAPPED scalar subquery `(SELECT ... FROM anchor)`, correlated by
          // the already-resolved `reimbursementId` JS value (a bound parameter) — NEVER a bare
          // Drizzle column proxy (`${reimbursement.expenseId}`) spliced directly into a nested
          // correlated subquery. A bare, unqualified column reference resolves to the INNERMOST
          // enclosing scope that has a same-named column, not necessarily the intended outer
          // `reimbursement` row: the old (pre-Phase-74-04, also pre-existing) shape --
          // `WHERE t3.expense_id = ${reimbursement.expenseId}` rendered as the bare identifier
          // `WHERE t3.expense_id = "expense_id"`, which Postgres binds to `t3.expense_id` itself
          // (a tautology, `t3.expense_id = t3.expense_id`, true for every row) since `t3` already
          // has its own "expense_id" column at that scope — silently returning an
          // arbitrary/globally-earliest transaction instead of the anchor's, for EVERY
          // Expense-anchored refund edit, group or not. Wrapping every reference in its own
          // `(SELECT ... FROM anchor)` subquery forces unambiguous resolution against the
          // single-row `anchor` CTE, closing this out for both anchor shapes.
          const sumRows = await tx
            .select({
              anchorAmount: sql<string | null>`(
                WITH anchor AS (
                  SELECT r.expense_id, r.expense_group_id FROM reimbursement r WHERE r.id = ${reimbursementId}
                )
                SELECT CASE
                  WHEN (SELECT expense_id FROM anchor) IS NOT NULL THEN (
                    SELECT t2.amount::text FROM transaction t2
                    WHERE t2.id = (
                      SELECT t3.id FROM transaction t3
                      WHERE t3.expense_id = (SELECT expense_id FROM anchor)
                      ORDER BY t3.occurred_at ASC, t3.id ASC
                      LIMIT 1
                    )
                  )
                  ELSE (
                    SELECT COALESCE(SUM(mt.amount::numeric), 0)::text
                    FROM expense_group_membership egm
                    INNER JOIN transaction mt ON mt.expense_id = egm.expense_id
                    WHERE egm.group_id = (SELECT expense_group_id FROM anchor)
                      AND NOT EXISTS (
                        SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = mt.id
                      )
                  )
                END
              )`,
              // NOTE: correlate via the already-resolved `reimbursementId` JS value (a bound
              // parameter), NOT a bare ${reimbursement.id} column reference — the latter is
              // ambiguous once this subquery's FROM list also carries an "id" column of its own
              // (reimbursement_refund.id and, once joined, transaction.id), which either throws
              // "column reference \"id\" is ambiguous" (this INNER JOIN'd fragment) or, worse,
              // silently binds to the wrong local "id" candidate with no join present (a
              // pre-existing bug in refundCount below, fixed alongside CR-02 since it sits in
              // the same query and the refund-edit branch cannot be proven correct without it —
              // confirmed by the first real-Postgres exercise of this code path, Phase 74-04).
              otherRefundsSum: sql<string | null>`(
                SELECT SUM(rt.amount::numeric)::text
                FROM reimbursement_refund rr
                INNER JOIN transaction rt ON rt.id = rr.transaction_id
                WHERE rr.reimbursement_id = ${reimbursementId}
                  AND rr.transaction_id != ${input.transactionId}
              )`,
              reimbursementTitle: reimbursement.title,
              // Total N of linked refunds (not excluding the one being edited) —
              // the full count is what determines message ambiguity, RMB-09.
              refundCount: sql<number>`(
                SELECT COUNT(*)::int FROM reimbursement_refund rr
                WHERE rr.reimbursement_id = ${reimbursementId}
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

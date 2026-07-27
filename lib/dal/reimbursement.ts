import 'server-only'

import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reimbursement, reimbursementRefund, transaction } from '@/lib/db/schema'
import {
  computeReimbursementResidual,
  deriveResidualFromAggregates,
  type ReimbursementResidualState,
} from '@/lib/services/reimbursement'
import { resolveReimbursementDisplayTitle } from '@/lib/utils/reimbursement-format'
import { expenseDetailHref, expenseGroupDetailHref } from '@/lib/routes'

/**
 * Raw Decimal-safe aggregates for one reimbursement: the anchor's own outflow sum and the sum
 * of every linked refund transaction. Both are DECIMAL-as-string (Drizzle convention) — callers
 * must go through toDecimal() before doing arithmetic (CLAUDE.md — Decimal.js for money).
 */
export type ReimbursementAggregates = {
  outflowSum: string
  refundSum: string
}

/**
 * Resolves the two raw sums `computeReimbursementResidual()` (lib/services/reimbursement.ts)
 * needs to derive the residual: `outflowSum` (the anchor's own spend) and `refundSum` (every
 * refund linked to it so far).
 *
 * IDOR-safe by construction (T-74-05): the WHERE clause scopes BOTH `r.id` and `r.userId`
 * together in the same query, not as a separate post-fetch check. A mismatched id/userId pair
 * (missing id OR a foreign-owned id) returns `undefined` — the same generic "not found" shape as
 * `updateTransaction`'s ownership check, so a caller can never distinguish "doesn't exist" from
 * "belongs to someone else" (no user enumeration).
 *
 * `outflowSum` (D-01/D-02, Phase 74, RMB-02, RMB-06):
 *  - Expense-anchored reimbursement (`expenseId IS NOT NULL`): the single Expense's own
 *    `totalAmount`.
 *  - Group-anchored reimbursement (`expenseGroupId` set): the SUM of `totalAmount` across every
 *    member Expense of the group, resolved via `expense_group_membership`.
 *
 * `refundSum`: the SUM of every linked refund transaction's `amount`, resolved by
 * `reimbursement_id` (not `expense_id` directly) so it covers Group anchors identically to
 * Expense anchors. `COALESCE(..., 0)` makes a reimbursement with zero linked refunds resolve to
 * `'0.00'`, never NULL (RMB-04/RMB-06 empty-refund case).
 */
export async function getReimbursementAggregates(input: {
  reimbursementId: number
  userId: string
}): Promise<ReimbursementAggregates | undefined> {
  // Written as one raw SQL statement with an explicit `r` alias for the outer `reimbursement`
  // row (same convention as effectiveAmount() in lib/dal/transaction-pairs-sql.ts) rather than
  // Drizzle's typed column proxies: `${reimbursement.id}`/`${reimbursement.expenseId}` render as
  // BARE quoted column names ("id", "expense_id"), not table-qualified — inside the correlated
  // subqueries below (which join tables that also have "id"/"expense_id" columns of their own,
  // e.g. reimbursement_refund + transaction both have "id"), that bare reference is ambiguous to
  // Postgres. An explicit `r.` prefix on every outer-row reference resolves it unambiguously.
  const result = await db.execute(sql`
    SELECT
      (
        CASE
          WHEN r.expense_id IS NOT NULL THEN (
            SELECT e.total_amount::text FROM expense e WHERE e.id = r.expense_id
          )
          ELSE (
            SELECT COALESCE(SUM(e2.total_amount::numeric), 0)::text
            FROM expense_group_membership egm
            INNER JOIN expense e2 ON e2.id = egm.expense_id
            WHERE egm.group_id = r.expense_group_id
          )
        END
      ) AS outflow_sum,
      (
        SELECT COALESCE(SUM(rt.amount::numeric), 0)::text
        FROM reimbursement_refund rr
        INNER JOIN transaction rt ON rt.id = rr.transaction_id
        WHERE rr.reimbursement_id = r.id
      ) AS refund_sum
    FROM reimbursement r
    WHERE r.id = ${input.reimbursementId} AND r.user_id = ${input.userId}
    LIMIT 1
  `)

  const row = result.rows[0] as { outflow_sum: string; refund_sum: string } | undefined
  if (!row) {
    return undefined
  }

  return { outflowSum: row.outflow_sum, refundSum: row.refund_sum }
}

/** One linked refund row, as rendered by the management panel (Phase 75 Plan 04). */
export type ReimbursementPanelRefund = {
  id: string
  description: string
  customTitle: string | null
  amount: string
  occurredAt: Date
}

/**
 * The full read model `ReimbursementPanel` (components/transactions/reimbursement-panel.tsx)
 * renders — either for a transaction anchor (`/transactions/[id]`, D-02) or a Group anchor
 * (Expense Group detail, D-03). One reusable shape for both hosts.
 */
export type ReimbursementPanelData = {
  reimbursementId: number
  title: string
  refunds: ReimbursementPanelRefund[]
  residual: string
  state: ReimbursementResidualState
}

/**
 * Resolves the panel's full read model for either anchor shape (D-01/D-02/D-03, Phase 75 Plan
 * 04): the linked reimbursement (if any), its refunds in deterministic order, and the net/
 * residual/status the surface shows inline (D-04).
 *
 * Anchor resolution mirrors `createPairTx`'s create-or-append lookup (Plan 75-02) — same lookup
 * shape, read-only here:
 *  - `{ transactionId }`: resolve the transaction's `expense_id` (ownership-scoped to `userId`),
 *    then find the reimbursement anchored on that Expense.
 *  - `{ groupId }`: find the reimbursement anchored directly on that Expense Group.
 *
 * Returns `undefined` — never throws — both when nothing is linked yet (a normal, common state
 * the panel renders as its empty/CTA state) and when the anchor/reimbursement is foreign-owned
 * (IDOR-safe by construction: every lookup is scoped to `userId`).
 *
 * Refund ordering (Edge RMB-08/ordering, T-73-11 convention): `reimbursement_refund.created_at
 * ASC, transaction_id ASC` — never left to unspecified DB row order.
 *
 * Residual/state is NEVER re-derived here — `computeReimbursementResidual` (lib/services/
 * reimbursement.ts, D-04) is the single source of truth for that computation; this function only
 * assembles the read model around it.
 */
export async function getReimbursementPanelData(input: {
  userId: string
  anchor: { transactionId: string } | { groupId: number }
}): Promise<ReimbursementPanelData | undefined> {
  let reimbursementRows: { id: number; title: string }[]

  if ('transactionId' in input.anchor) {
    const txRows = await db
      .select({ expenseId: transaction.expenseId })
      .from(transaction)
      .where(and(eq(transaction.id, input.anchor.transactionId), eq(transaction.userId, input.userId)))
      .limit(1)

    const txExpenseId = txRows[0]?.expenseId
    if (!txExpenseId) {
      return undefined
    }

    reimbursementRows = await db
      .select({ id: reimbursement.id, title: reimbursement.title })
      .from(reimbursement)
      .where(and(eq(reimbursement.expenseId, txExpenseId), eq(reimbursement.userId, input.userId)))
      .limit(1)
  } else {
    // Dormant branch (Phase 75 Plan 04 gap-closure, fix 2): the Expense-Group anchor has no UI
    // entry point anymore — a Group unifies the SAME expense across platforms, not a bundle of
    // DIFFERENT expenses to reimburse, so it never served the "reimburse a whole trip" case. Kept
    // alive at the DAL/service layer (never called from any page today) pending a future
    // trip-reimbursement design, most likely tag-anchored rather than Group-anchored.
    reimbursementRows = await db
      .select({ id: reimbursement.id, title: reimbursement.title })
      .from(reimbursement)
      .where(
        and(eq(reimbursement.expenseGroupId, input.anchor.groupId), eq(reimbursement.userId, input.userId)),
      )
      .limit(1)
  }

  const reimbursementRow = reimbursementRows[0]
  if (!reimbursementRow) {
    return undefined
  }

  const [refundRows, residualResult] = await Promise.all([
    db
      .select({
        id: transaction.id,
        description: transaction.description,
        customTitle: transaction.customTitle,
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
      })
      .from(reimbursementRefund)
      .innerJoin(transaction, eq(transaction.id, reimbursementRefund.transactionId))
      .where(eq(reimbursementRefund.reimbursementId, reimbursementRow.id))
      .orderBy(asc(reimbursementRefund.createdAt), asc(reimbursementRefund.transactionId)),
    computeReimbursementResidual({ reimbursementId: reimbursementRow.id, userId: input.userId }),
  ])

  // residualResult can only be undefined here if the reimbursement vanished between the two
  // reads above (a real race, not an ownership mismatch — reimbursementRow was already resolved
  // scoped to userId) — treat identically to "nothing linked" rather than throwing.
  if (!residualResult) {
    return undefined
  }

  return {
    reimbursementId: reimbursementRow.id,
    title: reimbursementRow.title,
    refunds: refundRows,
    residual: residualResult.residual,
    state: residualResult.state,
  }
}

/**
 * The read-only "this transaction IS a linked refund" state (Phase 75 Plan 04 gap-closure, fix 1).
 * `anchorHref` links to the anchor's own detail page (the Expense, or — for the dormant Group
 * anchor — the Expense Group) so the surface can point back at what this refund is reimbursing.
 */
export type RefundMembership = {
  reimbursementId: number
  title: string
  anchorHref: string
}

/**
 * Resolves whether `transactionId` is itself a linked refund (a row in `reimbursement_refund`),
 * as opposed to an anchor. ADR 0018's invariant is that the anchor is ALWAYS the outflow — an
 * inflow transaction can never be an anchor, so `/transactions/[id]` must render a different,
 * read-only state for a refund rather than `getReimbursementPanelData`'s CTA/manage-panel shape
 * (which only resolves anchor lookups and would otherwise return `undefined` for a refund,
 * incorrectly rendering the "Aggiungi rimborso" CTA on a transaction that can never host one).
 *
 * IDOR-safe by construction: scoped through `reimbursement.userId = userId` in the same join (not
 * a separate post-fetch check) — a foreign-owned or non-existent transactionId resolves to
 * `undefined`, identical to "not a refund."
 */
export async function getRefundMembership(input: {
  userId: string
  transactionId: string
}): Promise<RefundMembership | undefined> {
  const rows = await db
    .select({
      id: reimbursement.id,
      title: reimbursement.title,
      expenseId: reimbursement.expenseId,
      expenseGroupId: reimbursement.expenseGroupId,
    })
    .from(reimbursementRefund)
    .innerJoin(reimbursement, eq(reimbursement.id, reimbursementRefund.reimbursementId))
    .where(
      and(eq(reimbursementRefund.transactionId, input.transactionId), eq(reimbursement.userId, input.userId)),
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    return undefined
  }

  return {
    reimbursementId: row.id,
    title: row.title,
    anchorHref:
      row.expenseGroupId != null ? expenseGroupDetailHref(row.expenseGroupId) : expenseDetailHref(row.expenseId!),
  }
}

/** One row of the `/reimbursements` list (Phase 76 Plan 01, RMB-10/RMB-11). */
export type ReimbursementListRow = {
  id: number
  title: string
  displayTitle: string
  anchorExpenseId: string
  anchorTitle: string
  anchorDate: Date
  outflowSum: string
  refundSum: string
  residual: string
  state: ReimbursementResidualState
}

/**
 * Lists every reimbursement for `userId`, Expense-anchored only (T-76-05 — the WHERE clause
 * hard-filters `r.expense_id IS NOT NULL`, a Group-anchored reimbursement can never be returned
 * even though the dormant Group branch still exists at the schema/service layer). Ordered by the
 * anchor's own reconciliation date (`e.first_transaction_at`, the SAME earliest-transaction
 * convention Phase 73's Q3 tie-break nets by) descending, with a deterministic `id DESC` tie-break
 * for two reimbursements sharing the identical anchor date (RMB-10 ordering — never left to
 * unspecified DB row order).
 *
 * Written as one raw SQL statement with an explicit `r` alias (same convention as
 * getReimbursementAggregates above, to avoid the identical ambiguous-bare-column-name bug
 * documented there — `reimbursement_refund` and `transaction` both have an `id` column).
 *
 * Per-row residual/state is derived via `deriveResidualFromAggregates` — the SAME pure function
 * `computeReimbursementResidual` delegates to — so this list can never numerically diverge from
 * the single-id lookup (RMB-11 precision). `displayTitle` is resolved via
 * `resolveReimbursementDisplayTitle` (D-03 fallback).
 *
 * IDOR-safe by construction (T-76-04): the WHERE clause scopes exclusively on
 * `r.user_id = userId`, resolved server-side from the verified session, never from a
 * client-supplied filter.
 */
export async function getReimbursementList(userId: string): Promise<ReimbursementListRow[]> {
  const result = await db.execute(sql`
    SELECT
      r.id,
      r.title,
      e.id AS anchor_expense_id,
      e.title AS anchor_title,
      e.total_amount::text AS outflow_sum,
      e.first_transaction_at AS anchor_date,
      (
        SELECT COALESCE(SUM(rt.amount::numeric), 0)::text
        FROM reimbursement_refund rr
        INNER JOIN transaction rt ON rt.id = rr.transaction_id
        WHERE rr.reimbursement_id = r.id
      ) AS refund_sum
    FROM reimbursement r
    INNER JOIN expense e ON e.id = r.expense_id
    WHERE r.user_id = ${userId} AND r.expense_id IS NOT NULL
    ORDER BY e.first_transaction_at DESC, r.id DESC
  `)

  const rows = result.rows as {
    id: number
    title: string
    anchor_expense_id: string
    anchor_title: string
    outflow_sum: string
    anchor_date: string
    refund_sum: string
  }[]

  return rows.map((row) => {
    const { residual, state } = deriveResidualFromAggregates({
      outflowSum: row.outflow_sum,
      refundSum: row.refund_sum,
    })

    return {
      id: row.id,
      title: row.title,
      displayTitle: resolveReimbursementDisplayTitle(row.title, row.anchor_title),
      anchorExpenseId: row.anchor_expense_id,
      anchorTitle: row.anchor_title,
      anchorDate: new Date(row.anchor_date),
      outflowSum: row.outflow_sum,
      refundSum: row.refund_sum,
      residual,
      state,
    }
  })
}

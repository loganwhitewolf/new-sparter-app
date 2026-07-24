import 'server-only'

import { cache } from 'react'
import { and, eq, gte, lte, lt, gt, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expense, expenseGroup, expenseGroupMembership, transaction } from '@/lib/db/schema'
import { verifySession } from '@/lib/dal/auth'
import { toDecimal } from '@/lib/utils/decimal'

/**
 * A single row returned by getEligibleCounterparts.
 * Carries the fields the CounterpartPickerDialog needs to render each option.
 */
export type CounterpartRow = {
  id: string
  description: string
  customTitle: string | null
  amount: string
  occurredAt: Date
}

/**
 * Return transactions eligible as counterparts for the given reference transaction(s).
 *
 * Filters applied (D-13 / D-14 / T-50-01):
 *  - eq(transaction.userId, userId)                    — session-scoped; no cross-user enumeration
 *  - opposite sign                                      — if referenceAmount < 0 → amount > 0, and vice versa
 *  - gte(occurredAt, dateFrom)                           — configurable ±90-day window
 *  - lte(occurredAt, dateTo)
 *  - notInArray(transaction.id, excludeTransactionIds)   — self-exclusion (Phase 75 Plan 02, D-06:
 *    generalized from a single referenceId to a set — a Group anchor's own member transactions
 *    must never be picked as refunds for themselves)
 *  - NOT EXISTS reimbursement_refund/reimbursement — already-paired exclusion (D-14)
 *
 * Wrapped in `cache` because this query is session-scoped and called from RSC context.
 * The sign decision uses Decimal.js — never native JS comparison on DECIMAL strings.
 */
export const getEligibleCounterparts = cache(
  async (params: {
    excludeTransactionIds: string[]
    referenceAmount: string
    dateFrom: Date
    dateTo: Date
  }): Promise<CounterpartRow[]> => {
    const { userId } = await verifySession()

    // Determine sign filter via Decimal.js (project hard rule — never native comparison
    // on DECIMAL string values returned by Drizzle). A pair must net against the
    // reference, so a positive reference wants negative counterparts and vice versa.
    // A zero reference (CR-03) has no opposite-sign counterpart — return no rows
    // rather than falling through to a binary else-branch that treats 0 as positive.
    const refDecimal = toDecimal(params.referenceAmount)
    const signFilter = refDecimal.gt(0)
      ? lt(transaction.amount, '0')
      : refDecimal.lt(0)
        ? gt(transaction.amount, '0')
        : sql`false`

    // Already-paired exclusion (D-14, Phase 73 repoint, ADR 0018): exclude a
    // transaction already linked as a refund (present in reimbursement_refund)
    // OR whose expense_id already has a reimbursement (already an anchor).
    // The anchor check is intentionally at the Expense level, matching the
    // reimbursement_expenseId_unique partial index invariant that guarantees at
    // most one reimbursement per expenseId — no per-transaction tie-break needed.
    const notAlreadyPaired = sql`NOT EXISTS (
      SELECT 1 FROM reimbursement_refund rr
      WHERE rr.transaction_id = ${transaction.id}
    ) AND NOT EXISTS (
      SELECT 1 FROM reimbursement r
      WHERE r.expense_id = ${transaction.expenseId}
    )`

    return db
      .select({
        id: transaction.id,
        description: transaction.description,
        customTitle: transaction.customTitle,
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, userId),
          notInArray(transaction.id, params.excludeTransactionIds),
          signFilter,
          gte(transaction.occurredAt, params.dateFrom),
          lte(transaction.occurredAt, params.dateTo),
          notAlreadyPaired,
        ),
      ) as Promise<CounterpartRow[]>
  },
)

export type GroupOccurrenceInterval = {
  first: Date
  last: Date
}

/**
 * Resolves an Expense Group's occurrence interval — the earliest and latest `occurredAt` across
 * every member transaction (Phase 75 Plan 02, D-06). This is the midpoint/interval source Plan
 * 75-04's multi-select picker uses to compute its ±90-day candidate window for a Group anchor
 * (offset from `first`/`last`, not a single reference date, since a Group can span multiple
 * months).
 *
 * Ownership-scoped to `userId` via `expenseGroup.userId` (mirrors `getExpenseGroupForDetail`'s
 * join chain: expense_group_membership → expense → transaction). Returns `undefined` for an
 * empty group (no members) or a foreign-owned groupId — same not-found convention as
 * `getReimbursementAggregates`.
 */
export const getGroupOccurrenceInterval = cache(
  async (input: { userId: string; groupId: number }): Promise<GroupOccurrenceInterval | undefined> => {
    const rows = await db
      .select({
        first: sql<Date | null>`min(${transaction.occurredAt})`,
        last: sql<Date | null>`max(${transaction.occurredAt})`,
      })
      .from(expenseGroupMembership)
      .innerJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))
      .innerJoin(expense, eq(expenseGroupMembership.expenseId, expense.id))
      .innerJoin(transaction, eq(transaction.expenseId, expense.id))
      .where(and(eq(expenseGroupMembership.groupId, input.groupId), eq(expenseGroup.userId, input.userId)))

    const row = rows[0]
    if (!row || row.first === null || row.last === null) {
      return undefined
    }

    return {
      first: row.first instanceof Date ? row.first : new Date(row.first),
      last: row.last instanceof Date ? row.last : new Date(row.last),
    }
  },
)

/**
 * Resolves every member transaction id of an Expense Group (Phase 75 Plan 04) — the D-06
 * self-exclusion set `RefundPickerDialog`'s Group-anchor mode passes to `getEligibleCounterparts`
 * so a group's own member transactions are never offered as candidate refunds for themselves
 * (a group anchor never writes to `reimbursement.expenseId`, so `getEligibleCounterparts`'s
 * already-anchor exclusion — keyed on `expense_id` — cannot catch this on its own).
 *
 * Ownership-scoped to `userId` via `expenseGroup.userId`, mirroring `getGroupOccurrenceInterval`'s
 * join chain. Returns an empty array for an empty/foreign groupId (never throws).
 */
export const getGroupMemberTransactionIds = cache(
  async (input: { userId: string; groupId: number }): Promise<string[]> => {
    const rows = await db
      .select({ id: transaction.id })
      .from(expenseGroupMembership)
      .innerJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))
      .innerJoin(expense, eq(expenseGroupMembership.expenseId, expense.id))
      .innerJoin(transaction, eq(transaction.expenseId, expense.id))
      .where(and(eq(expenseGroupMembership.groupId, input.groupId), eq(expenseGroup.userId, input.userId)))

    return rows.map((r) => r.id)
  },
)

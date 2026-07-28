import 'server-only'

import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { expense } from '@/lib/db/schema'

// Shared dashboard-aggregation predicates (Phase 77 incidental cleanup) — extracted out of the
// identical private copies that used to live separately in lib/dal/dashboard.ts and
// lib/dal/overview.ts (ADR 0019 Consequences).

export const DASHBOARD_TOTAL_EXPENSE_STATUSES = ['1', '2', '3'] as const

export type DateScopedSource = {
  userId: PgColumn
  occurredAt: PgColumn
}

/**
 * Date-range + ownership WHERE fragment. Generalized (Phase 77, D-11 seam) to accept ANY row
 * source exposing userId/occurredAt columns — `transaction` (legacy call sites not yet migrated
 * to the ledger_entry seam, unchanged behavior) or `ledgerEntryCash` (the new seam). The source
 * param replaces the old hardcoded `transactionTable` reference.
 */
export function dateScopedTransactions(
  source: DateScopedSource,
  userId: string,
  from: Date,
  to: Date,
) {
  return and(eq(source.userId, userId), gte(source.occurredAt, from), lte(source.occurredAt, to))
}

/**
 * Expense-status inclusion filter for dashboard totals. Operates on the `expense` table only —
 * untouched by the ledger_entry seam (an aggregation's expense join is unaffected by which row
 * source supplies the transaction/instalment amount).
 */
export function expenseStatusIncludedInDashboardTotals() {
  return inArray(expense.status, [...DASHBOARD_TOTAL_EXPENSE_STATUSES])
}

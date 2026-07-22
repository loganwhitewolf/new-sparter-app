import 'server-only'

import { sql } from 'drizzle-orm'

import { transaction as transactionTable } from '@/lib/db/schema'

/**
 * WHERE clause fragment: narrow to transactions carrying a specific tag.
 *
 * `transaction_tag` is a genuine N:M table — a transaction may carry N tags
 * (Phase 67). This predicate ALWAYS uses EXISTS, never a JOIN: joining
 * `transaction_tag` against `transaction` fans out one row per tag for any
 * multi-tag transaction, silently duplicating amounts in every downstream
 * SUM/COUNT (see 68-RESEARCH.md Pitfall 1). An EXISTS subquery scoped to a
 * single `tagId` never fans out, regardless of how many tags a transaction has.
 *
 * Usage: add to the `and(...)` in any query's WHERE clause that must narrow
 * by tag, alongside dateScopedTransactions()/isNotSecondary() where applicable.
 *
 * Returns `undefined` when `tagId` is falsy — the caller's `and(...)` drops
 * `undefined` conditions automatically (same idiom as `typeFilter`/`categoryScope`
 * in lib/dal/dashboard.ts).
 */
export function tagScopedTransactions(tagId?: number) {
  if (!tagId) return undefined

  return sql`EXISTS (
    SELECT 1 FROM transaction_tag tt
    WHERE tt.transaction_id = ${transactionTable.id}
      AND tt.tag_id = ${tagId}
  )`
}

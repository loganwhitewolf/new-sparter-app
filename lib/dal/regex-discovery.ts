import 'server-only'
import { db } from '@/lib/db'
import {
  expense,
  expenseClassificationHistory,
  file,
  importFormatVersion,
  platform,
} from '@/lib/db/schema'
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'

export type UncategorizedExpenseForDiscovery = {
  id: string
  title: string
  descriptionHash: string | null
  descriptionStripPattern: string | null
}

/**
 * Fetches the persisted uncategorized expense set (Set B) for a single user
 * scoped to a single platform via the standard expense → platform join chain.
 *
 * Set B is defined by `subCategoryId IS NULL` — the authoritative signal used
 * by applyNewPatternToExpenses (lib/services/pattern-application.ts line 38).
 * This mirrors that filter exactly, covering all uncategorized statuses.
 *
 * The caller (lib/services/regex-discovery.ts) is responsible for auth;
 * userId is passed as a plain parameter following the same convention as
 * loadActivePatterns in lib/services/categorization.ts.
 *
 * No cache() — called from a service, not a React Server Component.
 * No DbOrTx — discovery is post-commit, never inside a transaction.
 */
export async function getUncategorizedExpensesForDiscovery(
  userId: string,
  platformId: number,
): Promise<UncategorizedExpenseForDiscovery[]> {
  return db
    .select({
      id: expense.id,
      title: expense.title,
      descriptionHash: expense.descriptionHash,
      descriptionStripPattern: platform.descriptionStripPattern,
    })
    .from(expense)
    .leftJoin(file, eq(expense.importedFromFileId, file.id))
    .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(
      and(
        eq(expense.userId, userId),
        eq(platform.id, platformId),
        isNull(expense.subCategoryId),
      ),
    )
}

/**
 * Returns the subset of description hashes the user has manually categorized before.
 *
 * Check 2 (RDISC-04) must query classification history, not current expense state:
 * the expense table is unique by userId + descriptionHash, so an uncategorized
 * candidate row cannot coexist with a currently categorized row for the same hash.
 */
export async function getManuallyCategorizedHashes(
  userId: string,
  descriptionHashes: string[],
): Promise<Set<string>> {
  const hashes = [...new Set(descriptionHashes)]
  if (hashes.length === 0) return new Set()

  const rows = await db
    .selectDistinct({ descriptionHash: expense.descriptionHash })
    .from(expenseClassificationHistory)
    .innerJoin(expense, eq(expenseClassificationHistory.expenseId, expense.id))
    .where(
      and(
        eq(expenseClassificationHistory.userId, userId),
        eq(expenseClassificationHistory.source, 'manual'),
        isNotNull(expense.descriptionHash),
        inArray(expense.descriptionHash, hashes),
      ),
    )

  return new Set(
    rows
      .map(row => row.descriptionHash)
      .filter((hash): hash is string => hash !== null),
  )
}

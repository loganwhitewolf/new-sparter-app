import 'server-only'
import { db } from '@/lib/db'
import { expense, file, importFormatVersion, platform } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

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

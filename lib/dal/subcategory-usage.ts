import 'server-only'
import { and, count, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { category, expense, subCategory } from '@/lib/db/schema'

export type MostUsedSubcategory = {
  subCategoryId: number
  name: string
  categoryName: string
}

/**
 * Returns up to 6 subcategories most frequently assigned to the current user's
 * expenses. Category type filtering removed — category.type column no longer exists
 * (Phase 46). Direction-aware filtering deferred to Phase 49.
 * TODO(Phase 49): re-add direction filter via nature→direction join when direction semantics land
 */
export async function getMostUsedSubcategories(
  // TODO(Phase 49): restore allowedTypes filter via direction.code once direction join is available
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _allowedTypes?: string[],
): Promise<MostUsedSubcategory[]> {
  const { userId } = await verifySession()

  const rows = await db
    .select({
      subCategoryId: subCategory.id,
      name: subCategory.name,
      categoryName: category.name,
      useCount: count(expense.id),
    })
    .from(expense)
    .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .innerJoin(category, eq(subCategory.categoryId, category.id))
    .where(
      and(
        eq(expense.userId, userId),
        isNotNull(expense.subCategoryId),
        // TODO(Phase 49): inArray(direction.code, allowedDirections) once direction join lands
      ),
    )
    .groupBy(subCategory.id, subCategory.name, category.name)
    .orderBy(desc(count(expense.id)))
    .limit(6)

  return rows.map((r) => ({
    subCategoryId: r.subCategoryId,
    name: r.name,
    categoryName: r.categoryName,
  }))
}

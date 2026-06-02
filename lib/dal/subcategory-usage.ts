import 'server-only'
import { and, count, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { category, expense, subCategory } from '@/lib/db/schema'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

export type MostUsedSubcategory = {
  subCategoryId: number
  name: string
  categoryName: string
}

/**
 * Returns up to 6 subcategories most frequently assigned to the current user's
 * expenses, scoped to the given category types. Returns [] when the user has no
 * categorized expenses matching the allowed types (cold-start / onboarding).
 */
export async function getMostUsedSubcategories(
  allowedTypes: Array<CategoryWithSubCategories['type']>,
): Promise<MostUsedSubcategory[]> {
  const { userId } = await verifySession()

  if (allowedTypes.length === 0) return []

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
        inArray(category.type, allowedTypes),
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

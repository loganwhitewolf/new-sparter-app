import 'server-only'
import { and, count, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { category, direction, expense, nature, subCategory } from '@/lib/db/schema'

export type MostUsedSubcategory = {
  subCategoryId: number
  name: string
  categoryName: string
}

/**
 * Returns up to 6 subcategories most frequently assigned to the current user's expenses.
 * When `allowedDirections` is provided, restricts results to subcategories whose
 * effective nature resolves to one of the given direction codes via the nature→direction join.
 */
export async function getMostUsedSubcategories(
  allowedDirections?: string[],
): Promise<MostUsedSubcategory[]> {
  const { userId } = await verifySession()

  const baseSelect = {
    subCategoryId: subCategory.id,
    name: subCategory.name,
    categoryName: category.name,
    useCount: count(expense.id),
  }

  const groupOrder = {
    groupBy: [subCategory.id, subCategory.name, category.name] as const,
    orderBy: desc(count(expense.id)),
    limit: 6,
  }

  if (allowedDirections && allowedDirections.length > 0) {
    const rows = await db
      .select(baseSelect)
      .from(expense)
      .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .innerJoin(category, eq(subCategory.categoryId, category.id))
      .innerJoin(nature, eq(subCategory.natureId, nature.id))
      .innerJoin(direction, eq(nature.directionId, direction.id))
      .where(
        and(
          eq(expense.userId, userId),
          isNotNull(expense.subCategoryId),
          inArray(direction.code, allowedDirections),
        ),
      )
      .groupBy(subCategory.id, subCategory.name, category.name)
      .orderBy(groupOrder.orderBy)
      .limit(groupOrder.limit)

    return rows.map((r) => ({
      subCategoryId: r.subCategoryId,
      name: r.name,
      categoryName: r.categoryName,
    }))
  }

  const rows = await db
    .select(baseSelect)
    .from(expense)
    .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .innerJoin(category, eq(subCategory.categoryId, category.id))
    .where(
      and(
        eq(expense.userId, userId),
        isNotNull(expense.subCategoryId),
      ),
    )
    .groupBy(subCategory.id, subCategory.name, category.name)
    .orderBy(groupOrder.orderBy)
    .limit(groupOrder.limit)

  return rows.map((r) => ({
    subCategoryId: r.subCategoryId,
    name: r.name,
    categoryName: r.categoryName,
  }))
}

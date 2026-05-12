import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { category, subCategory, userSubcategoryOverride } from '@/lib/db/schema'
import { and, asc, eq, isNull, or } from 'drizzle-orm'

export type CategoryWithSubCategories = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out' | 'system'
  userId: string | null
  isOwned: boolean
  subCategories: Array<{
    id: number
    name: string
    slug: string
    originalName: string
    userId: string | null
    isOwned: boolean
    hasOverride: boolean
    customName: string | null
  }>
}

const getCategoriesForUser = cache(async (userId: string): Promise<CategoryWithSubCategories[]> => {
  const rows = await db
    .select({
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      categoryType: category.type,
      categoryUserId: category.userId,
      subCategoryId: subCategory.id,
      subCategoryName: subCategory.name,
      subCategorySlug: subCategory.slug,
      subCategoryUserId: subCategory.userId,
      overrideCustomName: userSubcategoryOverride.customName,
    })
    .from(category)
    .leftJoin(
      subCategory,
      and(
        eq(subCategory.categoryId, category.id),
        eq(subCategory.isActive, true),
        or(isNull(subCategory.userId), eq(subCategory.userId, userId)),
      ),
    )
    .leftJoin(
      userSubcategoryOverride,
      and(
        eq(userSubcategoryOverride.subCategoryId, subCategory.id),
        eq(userSubcategoryOverride.userId, userId),
      ),
    )
    .where(
      and(
        eq(category.isActive, true),
        or(isNull(category.userId), eq(category.userId, userId)),
      ),
    )
    .orderBy(
      asc(category.displayOrder),
      asc(category.id),
      asc(subCategory.displayOrder),
      asc(subCategory.id),
    )

  // Group flat rows into nested structure without additional per-category queries.
  const map = new Map<number, CategoryWithSubCategories>()
  for (const row of rows) {
    if (!map.has(row.categoryId)) {
      map.set(row.categoryId, {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
        type: row.categoryType,
        userId: row.categoryUserId,
        isOwned: row.categoryUserId === userId,
        subCategories: [],
      })
    }

    if (row.subCategoryId !== null) {
      map.get(row.categoryId)!.subCategories.push({
        id: row.subCategoryId,
        name: row.overrideCustomName ?? row.subCategoryName!,
        slug: row.subCategorySlug!,
        originalName: row.subCategoryName!,
        userId: row.subCategoryUserId,
        isOwned: row.subCategoryUserId === userId,
        hasOverride: row.overrideCustomName !== null,
        customName: row.overrideCustomName,
      })
    }
  }

  return Array.from(map.values())
})

export async function getCategories(): Promise<CategoryWithSubCategories[]> {
  const session = await verifySession()
  return getCategoriesForUser(session.userId)
}

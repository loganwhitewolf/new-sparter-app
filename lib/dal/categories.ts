import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { category, subCategory } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

export type CategoryWithSubCategories = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out' | 'system'
  subCategories: Array<{ id: number; name: string; slug: string }>
}

export const getCategories = cache(async (): Promise<CategoryWithSubCategories[]> => {
  const rows = await db
    .select({
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      categoryType: category.type,
      subCategoryId: subCategory.id,
      subCategoryName: subCategory.name,
      subCategorySlug: subCategory.slug,
    })
    .from(category)
    .leftJoin(subCategory, eq(subCategory.categoryId, category.id))
    .where(eq(category.isActive, true))
    .orderBy(asc(category.displayOrder), asc(subCategory.displayOrder))

  // Group flat rows into nested structure
  const map = new Map<number, CategoryWithSubCategories>()
  for (const row of rows) {
    if (!map.has(row.categoryId)) {
      map.set(row.categoryId, {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
        type: row.categoryType,
        subCategories: [],
      })
    }
    if (row.subCategoryId !== null) {
      map.get(row.categoryId)!.subCategories.push({
        id: row.subCategoryId,
        name: row.subCategoryName!,
        slug: row.subCategorySlug!,
      })
    }
  }
  return Array.from(map.values())
})

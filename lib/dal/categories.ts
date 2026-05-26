import 'server-only'
import { cache } from 'react'
import { db, type DbOrTx } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { category, expense, subCategory, userSubcategoryOverride } from '@/lib/db/schema'
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import type { FlowNature } from '@/lib/utils/nature-labels'

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
    effectiveNature: FlowNature | null
  }>
}

export type CategoryMutationErrorCode =
  | 'not_found'
  | 'system_row'
  | 'duplicate'
  | 'linked_expenses'

export class CategoryMutationError extends Error {
  constructor(
    public readonly code: CategoryMutationErrorCode,
    message: string,
    public readonly count?: number,
  ) {
    super(message)
    this.name = 'CategoryMutationError'
  }
}

function isUniqueConflict(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505',
  )
}

async function mapDuplicate<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new CategoryMutationError('duplicate', 'Duplicate category name')
    }
    throw error
  }
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
      effectiveNature: sql<FlowNature | null>`coalesce(${userSubcategoryOverride.nature}, ${subCategory.nature})`,
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
        effectiveNature: row.effectiveNature,
      })
    }
  }

  return Array.from(map.values())
})

export async function getCategories(): Promise<CategoryWithSubCategories[]> {
  const session = await verifySession()
  return getCategoriesForUser(session.userId)
}

export async function createUserCategory(
  input: { userId: string, name: string, slug: string, type: 'in' | 'out' },
  database: DbOrTx = db,
) {
  const rows = await mapDuplicate(
    database
      .insert(category)
      .values({
        userId: input.userId,
        name: input.name,
        slug: input.slug,
        type: input.type,
        isActive: true,
      })
      .returning(),
  )

  return rows[0] ?? null
}

export async function renameUserCategory(
  id: number,
  userId: string,
  input: { name: string, slug: string },
  database: DbOrTx = db,
) {
  const rows = await mapDuplicate(
    database
      .update(category)
      .set({ name: input.name, slug: input.slug })
      .where(
        and(
          eq(category.id, id),
          eq(category.userId, userId),
          eq(category.isActive, true),
        ),
      )
      .returning(),
  )

  return rows[0] ?? null
}

export async function deleteUserCategory(
  id: number,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
  const rows = await database
    .update(category)
    .set({ isActive: false })
    .where(
      and(
        eq(category.id, id),
        eq(category.userId, userId),
        eq(category.isActive, true),
      ),
    )
    .returning({ id: category.id })

  return rows.length > 0
}

export async function createUserSubcategory(
  input: { userId: string, categoryId: number, name: string, slug: string, nature: FlowNature },
  database: DbOrTx = db,
) {
  const categoryRows = await database
    .select({ id: category.id })
    .from(category)
    .where(
      and(
        eq(category.id, input.categoryId),
        eq(category.isActive, true),
        or(isNull(category.userId), eq(category.userId, input.userId)),
      ),
    )

  if (!categoryRows[0]) {
    throw new CategoryMutationError('not_found', 'Category not found')
  }

  const rows = await mapDuplicate(
    database
      .insert(subCategory)
      .values({
        userId: input.userId,
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        isActive: true,
        nature: input.nature,
      })
      .returning(),
  )

  return rows[0] ?? null
}

export async function upsertSubcategoryNatureOverride(
  { userId, subCategoryId, nature }: { userId: string; subCategoryId: number; nature: FlowNature | null },
  database: DbOrTx = db,
) {
  const rows = await database
    .insert(userSubcategoryOverride)
    .values({ userId, subCategoryId, nature, customName: null })
    .onConflictDoUpdate({
      target: [userSubcategoryOverride.userId, userSubcategoryOverride.subCategoryId],
      set: { nature, updatedAt: new Date() },
    })
    .returning()

  return rows[0] ?? null
}

export async function renameUserSubcategory(
  id: number,
  userId: string,
  input: { name: string, slug: string },
  database: DbOrTx = db,
) {
  const rows = await mapDuplicate(
    database
      .update(subCategory)
      .set({ name: input.name, slug: input.slug })
      .where(
        and(
          eq(subCategory.id, id),
          eq(subCategory.userId, userId),
          eq(subCategory.isActive, true),
        ),
      )
      .returning(),
  )

  return rows[0] ?? null
}

export async function upsertSystemSubcategoryOverride(
  userId: string,
  subCategoryId: number,
  customName: string | null,
  database: DbOrTx = db,
) {
  const rows = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(
      and(
        eq(subCategory.id, subCategoryId),
        isNull(subCategory.userId),
        eq(subCategory.isActive, true),
      ),
    )

  if (!rows[0]) {
    throw new CategoryMutationError('not_found', 'System subcategory not found')
  }

  const overrideRows = await database
    .insert(userSubcategoryOverride)
    .values({ userId, subCategoryId, customName })
    .onConflictDoUpdate({
      target: [userSubcategoryOverride.userId, userSubcategoryOverride.subCategoryId],
      set: { customName, updatedAt: new Date() },
    })
    .returning()

  return overrideRows[0] ?? null
}

export async function countLinkedExpensesForSubcategory(
  userId: string,
  subCategoryId: number,
  database: DbOrTx = db,
): Promise<number> {
  const rows = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        eq(expense.subCategoryId, subCategoryId),
      ),
    )

  return Number(rows[0]?.count ?? 0)
}

export async function isSubCategoryVisibleToUser(
  subCategoryId: number,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
  const rows = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .leftJoin(category, eq(category.id, subCategory.categoryId))
    .where(
      and(
        eq(subCategory.id, subCategoryId),
        eq(subCategory.isActive, true),
        or(isNull(subCategory.userId), eq(subCategory.userId, userId)),
        eq(category.isActive, true),
        or(isNull(category.userId), eq(category.userId, userId)),
      ),
    )
    .limit(1)

  return rows.length > 0
}

export async function deleteUserSubcategory(
  id: number,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
  const linkedExpenses = await countLinkedExpensesForSubcategory(userId, id, database)
  if (linkedExpenses > 0) {
    throw new CategoryMutationError(
      'linked_expenses',
      `Subcategory has ${linkedExpenses} linked expenses`,
      linkedExpenses,
    )
  }

  const rows = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(
      and(
        eq(subCategory.id, id),
        eq(subCategory.userId, userId),
        eq(subCategory.isActive, true),
      ),
    )
    .returning({ id: subCategory.id })

  return rows.length > 0
}

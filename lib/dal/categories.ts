import 'server-only'
import { cache } from 'react'
import { db, type DbOrTx } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { category, expense, nature, subCategory, userSubcategoryOverride } from '@/lib/db/schema'
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import type { FlowNature } from '@/lib/utils/nature-labels'

export type CategoryWithSubCategories = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out' | 'allocation' | 'transfer' | null
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

const CATEGORY_SLUG_UNIQUE = new Set([
  'category_user_slug_unique',
  'category_system_slug_unique',
])

const SUBCATEGORY_SLUG_UNIQUE = new Set([
  'sub_category_user_category_slug_unique',
  'sub_category_system_category_slug_unique',
])

function pgConstraintError(error: unknown): { code?: string; constraint?: string } {
  if (!error || typeof error !== 'object') return {}
  const candidate = error as { code?: unknown; constraint?: unknown }
  return {
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    constraint: typeof candidate.constraint === 'string' ? candidate.constraint : undefined,
  }
}

function isUniqueConstraint(error: unknown, constraint: string) {
  const meta = pgConstraintError(error)
  return meta.code === '23505' && meta.constraint === constraint
}

function isSlugUniqueConflict(error: unknown, slugConstraints: Set<string>) {
  const meta = pgConstraintError(error)
  return meta.code === '23505' && meta.constraint !== undefined && slugConstraints.has(meta.constraint)
}

async function mapSlugDuplicate<T>(operation: Promise<T>, slugConstraints: Set<string>): Promise<T> {
  try {
    return await operation
  } catch (error) {
    if (isSlugUniqueConflict(error, slugConstraints)) {
      throw new CategoryMutationError('duplicate', 'Duplicate category name')
    }
    throw error
  }
}

async function syncCategoryIdSequence(database: DbOrTx) {
  // Seeds insert system categories with explicit ids and historically omitted setval.
  // A stale category_id_seq yields 23505 on category_pkey for every user create.
  await database.execute(
    sql`select setval('category_id_seq', coalesce((select max(${category.id}) from ${category}), 0) + 1, false)`,
  )
}

const getCategoriesForUser = cache(async (userId: string): Promise<CategoryWithSubCategories[]> => {
  const rows = await db
    .select({
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      categoryUserId: category.userId,
      subCategoryId: subCategory.id,
      subCategoryName: subCategory.name,
      subCategorySlug: subCategory.slug,
      subCategoryUserId: subCategory.userId,
      overrideCustomName: userSubcategoryOverride.customName,
      overrideNatureId: userSubcategoryOverride.natureId,
      subCategoryNatureId: subCategory.natureId,
      // Resolved nature.code — coalesce override natureId → sub natureId, then join nature
      effectiveNatureCode: sql<FlowNature | null>`(
        SELECT n.code FROM nature n
        WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
        LIMIT 1
      )`,
      // Direction code derived from the effective nature via the nature→direction FK chain
      categoryType: sql<'in' | 'out' | 'allocation' | 'transfer' | null>`(
        SELECT d.code FROM direction d
        INNER JOIN nature n ON n.direction_id = d.id
        WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
        LIMIT 1
      )`,
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
        effectiveNature: row.effectiveNatureCode,
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
  // TODO(Phase 49): type field removed — direction semantics derived from nature in Phase 49
  input: { userId: string, name: string, slug: string },
  database: DbOrTx = db,
) {
  const insertOnce = () =>
    mapSlugDuplicate(
      database
        .insert(category)
        .values({
          userId: input.userId,
          name: input.name,
          slug: input.slug,
          isActive: true,
        })
        .returning(),
      CATEGORY_SLUG_UNIQUE,
    )

  try {
    const rows = await insertOnce()
    return rows[0] ?? null
  } catch (error) {
    if (!isUniqueConstraint(error, 'category_pkey')) throw error
    await syncCategoryIdSequence(database)
    const rows = await insertOnce()
    return rows[0] ?? null
  }
}

export async function renameUserCategory(
  id: number,
  userId: string,
  input: { name: string, slug: string },
  database: DbOrTx = db,
) {
  const rows = await mapSlugDuplicate(
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
    CATEGORY_SLUG_UNIQUE,
  )

  return rows[0] ?? null
}

export async function countLinkedExpensesForCategory(
  userId: string,
  categoryId: number,
  database: DbOrTx = db,
): Promise<number> {
  const rows = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(expense)
    .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .where(
      and(
        eq(expense.userId, userId),
        eq(subCategory.categoryId, categoryId),
      ),
    )

  return Number(rows[0]?.count ?? 0)
}

export async function deleteUserCategory(
  id: number,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
  // Same guard as subcategory delete — any expense on any child blocks the category.
  const linkedExpenses = await countLinkedExpensesForCategory(userId, id, database)
  if (linkedExpenses > 0) {
    throw new CategoryMutationError(
      'linked_expenses',
      `Category has ${linkedExpenses} linked expenses`,
      linkedExpenses,
    )
  }

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

  if (rows.length === 0) return false

  // Soft-delete personal children so they do not linger as active orphans.
  // Category row first: if ownership check fails we never touch subcategories.
  await database
    .update(subCategory)
    .set({ isActive: false })
    .where(
      and(
        eq(subCategory.categoryId, id),
        eq(subCategory.userId, userId),
        eq(subCategory.isActive, true),
      ),
    )
    .returning({ id: subCategory.id })

  return true
}

export async function createUserSubcategory(
  // TODO(Phase 49): accept natureId (number) instead of nature (FlowNature string) once lookup is wired
  input: { userId: string, categoryId: number, name: string, slug: string, natureId?: number | null },
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

  const rows = await mapSlugDuplicate(
    database
      .insert(subCategory)
      .values({
        userId: input.userId,
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        isActive: true,
        natureId: input.natureId ?? null,
      })
      .returning(),
    SUBCATEGORY_SLUG_UNIQUE,
  )

  return rows[0] ?? null
}

export async function upsertSubcategoryNatureOverride(
  { userId, subCategoryId, natureId }: { userId: string; subCategoryId: number; natureId: number | null },
  database: DbOrTx = db,
) {
  const rows = await database
    .insert(userSubcategoryOverride)
    .values({ userId, subCategoryId, natureId, customName: null })
    .onConflictDoUpdate({
      target: [userSubcategoryOverride.userId, userSubcategoryOverride.subCategoryId],
      set: { natureId, updatedAt: new Date() },
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
  const rows = await mapSlugDuplicate(
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
    SUBCATEGORY_SLUG_UNIQUE,
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

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
  /** false = soft-disabled; still visible in settings, hidden from pickers. */
  isActive: boolean
  subCategories: Array<{
    id: number
    name: string
    slug: string
    originalName: string
    userId: string | null
    isOwned: boolean
    isActive: boolean
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
  | 'parent_inactive'

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

const getCategoriesForUser = cache(async (
  userId: string,
  includeInactive: boolean,
): Promise<CategoryWithSubCategories[]> => {
  const rows = await db
    .select({
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      categoryUserId: category.userId,
      categoryIsActive: category.isActive,
      subCategoryId: subCategory.id,
      subCategoryName: subCategory.name,
      subCategorySlug: subCategory.slug,
      subCategoryUserId: subCategory.userId,
      subCategoryIsActive: subCategory.isActive,
      overrideCustomName: userSubcategoryOverride.customName,
      overrideNatureId: userSubcategoryOverride.natureId,
      subCategoryNatureId: subCategory.natureId,
      // Resolved nature.code — coalesce override natureId → sub natureId, then join nature
      effectiveNatureCode: sql<FlowNature | null>`(
        SELECT n.code FROM nature n
        WHERE n.id = COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})
        LIMIT 1
      )`,
      // Stored direction on personal categories (preferred for sidebar grouping)
      storedDirectionCode: sql<'in' | 'out' | 'allocation' | 'transfer' | null>`(
        SELECT d.code FROM direction d
        WHERE d.id = ${category.directionId}
        LIMIT 1
      )`,
      // Fallback: direction derived from the effective nature via nature→direction
      derivedDirectionCode: sql<'in' | 'out' | 'allocation' | 'transfer' | null>`(
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
        // Settings view (includeInactive=true) still hides disabled GLOBAL subcategories — only
        // the user's own soft-disabled rows should surface for reactivation. Without the
        // eq(userId, userId) branch this dropped the isActive filter entirely, exposing every
        // globally-retired system subcategory to every user.
        ...(includeInactive
          ? [or(eq(subCategory.isActive, true), eq(subCategory.userId, userId))]
          : [eq(subCategory.isActive, true)]),
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
        // Same rule as the subCategory join above (quick 260804-br9 follow-up): the settings
        // view still hides disabled GLOBAL categories — only the user's own soft-disabled
        // categories surface, for reactivation. No currently-seeded system category is
        // disabled, so this had no live symptom yet, but the bare isActive-drop was exactly the
        // subcategory bug's shape and would leak the first global category ever retired.
        ...(includeInactive
          ? [or(eq(category.isActive, true), eq(category.userId, userId))]
          : [eq(category.isActive, true)]),
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
        type: row.storedDirectionCode ?? row.derivedDirectionCode,
        userId: row.categoryUserId,
        isOwned: row.categoryUserId === userId,
        isActive: row.categoryIsActive,
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
        isActive: row.subCategoryIsActive ?? true,
        hasOverride: row.overrideCustomName !== null,
        customName: row.overrideCustomName,
        effectiveNature: row.effectiveNatureCode,
      })
    }
  }

  return Array.from(map.values())
})

/** Active taxonomy for pickers / categorization (inactive personal rows excluded). */
export async function getCategories(): Promise<CategoryWithSubCategories[]> {
  const session = await verifySession()
  return getCategoriesForUser(session.userId, false)
}

/** Settings management view — includes soft-disabled personal categories/subcategories. */
export async function getCategoriesForSettings(): Promise<CategoryWithSubCategories[]> {
  const session = await verifySession()
  return getCategoriesForUser(session.userId, true)
}

export async function createUserCategory(
  input: { userId: string, name: string, slug: string, directionId: number },
  database: DbOrTx = db,
) {
  await purgeInactiveOwnedCategoryBySlug(input.userId, input.slug, database)

  const insertOnce = () =>
    mapSlugDuplicate(
      database
        .insert(category)
        .values({
          userId: input.userId,
          name: input.name,
          slug: input.slug,
          directionId: input.directionId,
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

/**
 * Soft-hide a personal category (and its personal children). Allowed even with linked expenses —
 * historical spending keeps its subcategory FKs; the taxonomy just stops appearing in pickers.
 */
export async function deactivateUserCategory(
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

  if (rows.length === 0) return false

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

  return true
}

/**
 * Re-enable a personal category. Owned children stay as-is (reactivate separately).
 */
export async function reactivateUserCategory(
  id: number,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
  const rows = await database
    .update(category)
    .set({ isActive: true })
    .where(
      and(
        eq(category.id, id),
        eq(category.userId, userId),
        eq(category.isActive, false),
      ),
    )
    .returning({ id: category.id })

  return rows.length > 0
}

/**
 * Hard-delete a personal category. Blocked when any child subcategory has linked expenses.
 * DB cascade removes child subcategories; frees the (userId, slug) unique slot for recreate.
 */
export async function deleteUserCategory(
  id: number,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
  const linkedExpenses = await countLinkedExpensesForCategory(userId, id, database)
  if (linkedExpenses > 0) {
    throw new CategoryMutationError(
      'linked_expenses',
      `Category has ${linkedExpenses} linked expenses`,
      linkedExpenses,
    )
  }

  const rows = await database
    .delete(category)
    .where(
      and(
        eq(category.id, id),
        eq(category.userId, userId),
      ),
    )
    .returning({ id: category.id })

  return rows.length > 0
}

/** Remove an inactive owned category with the same slug so recreate is not blocked by soft-delete leftovers. */
async function purgeInactiveOwnedCategoryBySlug(
  userId: string,
  slug: string,
  database: DbOrTx,
): Promise<void> {
  const inactive = await database
    .select({ id: category.id })
    .from(category)
    .where(
      and(
        eq(category.userId, userId),
        eq(category.slug, slug),
        eq(category.isActive, false),
      ),
    )
    .limit(1)

  if (!inactive[0]) return

  const linkedExpenses = await countLinkedExpensesForCategory(userId, inactive[0].id, database)
  if (linkedExpenses > 0) {
    throw new CategoryMutationError(
      'duplicate',
      'Inactive category with this slug still has linked expenses',
      linkedExpenses,
    )
  }

  await database
    .delete(category)
    .where(
      and(
        eq(category.id, inactive[0].id),
        eq(category.userId, userId),
      ),
    )
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

  await purgeInactiveOwnedSubcategoryBySlug(
    input.userId,
    input.categoryId,
    input.slug,
    database,
  )

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

/**
 * Soft-hide a personal subcategory. Allowed even with linked expenses.
 */
export async function deactivateUserSubcategory(
  id: number,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
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

export async function reactivateUserSubcategory(
  id: number,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
  const parent = await database
    .select({
      categoryId: subCategory.categoryId,
      categoryActive: category.isActive,
    })
    .from(subCategory)
    .innerJoin(category, eq(category.id, subCategory.categoryId))
    .where(
      and(
        eq(subCategory.id, id),
        eq(subCategory.userId, userId),
        eq(subCategory.isActive, false),
      ),
    )
    .limit(1)

  if (!parent[0]) return false
  if (!parent[0].categoryActive) {
    throw new CategoryMutationError(
      'parent_inactive',
      'Reactivate the parent category before reactivating this subcategory',
    )
  }

  const rows = await database
    .update(subCategory)
    .set({ isActive: true })
    .where(
      and(
        eq(subCategory.id, id),
        eq(subCategory.userId, userId),
        eq(subCategory.isActive, false),
      ),
    )
    .returning({ id: subCategory.id })

  return rows.length > 0
}

/**
 * Hard-delete a personal subcategory. Blocked when linked expenses exist.
 */
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
    .delete(subCategory)
    .where(
      and(
        eq(subCategory.id, id),
        eq(subCategory.userId, userId),
      ),
    )
    .returning({ id: subCategory.id })

  return rows.length > 0
}

async function purgeInactiveOwnedSubcategoryBySlug(
  userId: string,
  categoryId: number,
  slug: string,
  database: DbOrTx,
): Promise<void> {
  const inactive = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(
      and(
        eq(subCategory.userId, userId),
        eq(subCategory.categoryId, categoryId),
        eq(subCategory.slug, slug),
        eq(subCategory.isActive, false),
      ),
    )
    .limit(1)

  if (!inactive[0]) return

  const linkedExpenses = await countLinkedExpensesForSubcategory(userId, inactive[0].id, database)
  if (linkedExpenses > 0) {
    throw new CategoryMutationError(
      'duplicate',
      'Inactive subcategory with this slug still has linked expenses',
      linkedExpenses,
    )
  }

  await database
    .delete(subCategory)
    .where(
      and(
        eq(subCategory.id, inactive[0].id),
        eq(subCategory.userId, userId),
      ),
    )
}

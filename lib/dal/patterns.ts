import 'server-only'
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { categorizationPattern, category, subCategory } from '@/lib/db/schema'
import type { CreatePatternInput, UpdatePatternInput } from '@/lib/validations/pattern'
import { normalizePatternInput } from '@/lib/validations/pattern'

function errorCauseCode(error: unknown): string {
  const cause = typeof error === 'object' && error !== null && 'cause' in error
    ? (error as { cause?: unknown }).cause
    : undefined

  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return ''
  }

  const code = (cause as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

/**
 * Returns the category `type` of the parent category for the given subcategory,
 * scoped to categories/subcategories visible to the requesting user.
 * Returns null if the subcategory does not exist or is not visible.
 *
 * Used by pattern actions to derive amountSign server-side (ADR 0008, T-39-10).
 */
export async function getCategoryTypeForSubCategory(
  subCategoryId: number,
  userId: string,
  database: DbOrTx = db,
): Promise<'in' | 'out' | 'system' | 'transfer' | null> {
  const rows = await database
    .select({ type: category.type })
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

  const row = rows[0]
  if (!row) return null
  return row.type
}

export type PatternRow = {
  id: number
  userId: string | null
  pattern: string
  subCategoryId: number
  amountSign: 'positive' | 'negative' | 'any'
  confidence: string
  priority: number
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export async function getUserPatterns(userId: string, database: DbOrTx = db): Promise<PatternRow[]> {
  const rows = await database
    .select()
    .from(categorizationPattern)
    .where(
      and(
        eq(categorizationPattern.isActive, true),
        or(
          isNull(categorizationPattern.userId),
          eq(categorizationPattern.userId, userId),
        ),
      ),
    )
    .orderBy(
      sql`case when ${categorizationPattern.userId} is null then 1 else 0 end`,
      asc(categorizationPattern.priority),
    )
  return rows as PatternRow[]
}

export async function getPatternById(id: number, userId: string, database: DbOrTx = db): Promise<PatternRow | null> {
  const rows = await database
    .select()
    .from(categorizationPattern)
    .where(
      and(
        eq(categorizationPattern.id, id),
        eq(categorizationPattern.userId, userId),
        eq(categorizationPattern.isActive, true),
      ),
    )
  return (rows[0] as PatternRow | undefined) ?? null
}

export async function createPattern(
  input: CreatePatternInput & { userId: string },
  database: DbOrTx = db,
): Promise<PatternRow> {
  const normalizedPattern = normalizePatternInput(input.pattern)

  try {
    const rows = await database
      .insert(categorizationPattern)
      .values({
        userId: input.userId,
        pattern: normalizedPattern,
        subCategoryId: input.subCategoryId,
        amountSign: input.amountSign,
        confidence: input.confidence.toFixed(2),
        priority: 100,
        description: input.description ?? null,
        isActive: true,
      })
      .returning()
    return rows[0] as PatternRow
  } catch (err) {
    // Unique violation: the row may be a soft-deleted user pattern — reactivate it.
    // If the conflict is on a system pattern or another user's pattern, re-throw.
    if (errorCauseCode(err) === '23505') {
      const reactivated = await database
        .update(categorizationPattern)
        .set({ isActive: true, updatedAt: new Date() })
        .where(
          and(
            eq(categorizationPattern.pattern, normalizedPattern),
            eq(categorizationPattern.subCategoryId, input.subCategoryId),
            eq(categorizationPattern.amountSign, input.amountSign),
            eq(categorizationPattern.userId, input.userId),
            eq(categorizationPattern.isActive, false),
          ),
        )
        .returning()
      if (reactivated[0]) return reactivated[0] as PatternRow
    }
    throw err
  }
}

export async function updatePattern(
  id: number,
  userId: string,
  input: UpdatePatternInput,
  database: DbOrTx = db,
): Promise<PatternRow | null> {
  const normalizedPattern = input.pattern === undefined ? undefined : normalizePatternInput(input.pattern)

  const updates: Partial<typeof categorizationPattern.$inferInsert> = { updatedAt: new Date() }
  if (normalizedPattern !== undefined) updates.pattern = normalizedPattern
  if (input.subCategoryId !== undefined) updates.subCategoryId = input.subCategoryId
  if (input.amountSign !== undefined) updates.amountSign = input.amountSign
  if (input.confidence !== undefined) updates.confidence = input.confidence.toFixed(2)
  if (input.description !== undefined) updates.description = input.description

  const rows = await database
    .update(categorizationPattern)
    .set(updates)
    .where(
      and(
        eq(categorizationPattern.id, id),
        eq(categorizationPattern.userId, userId),
        eq(categorizationPattern.isActive, true),
      ),
    )
    .returning()
  return (rows[0] as PatternRow | undefined) ?? null
}

export async function deletePattern(
  id: number,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
  // Soft-delete: set isActive = false, scoped to the calling user's patterns only
  const rows = await database
    .update(categorizationPattern)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(categorizationPattern.id, id),
        eq(categorizationPattern.userId, userId),
        eq(categorizationPattern.isActive, true),
      ),
    )
    .returning({ id: categorizationPattern.id })
  return rows.length > 0
}

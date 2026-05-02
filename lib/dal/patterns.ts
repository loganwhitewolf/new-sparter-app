import 'server-only'
import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { categorizationPattern } from '@/lib/db/schema'
import type { CreatePatternInput, UpdatePatternInput } from '@/lib/validations/pattern'

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
    .orderBy(asc(categorizationPattern.priority))
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
  // Validate regex before insert — a bad regex would silently break categorization
  new RegExp(input.pattern, 'i')

  const rows = await database
    .insert(categorizationPattern)
    .values({
      userId: input.userId,
      pattern: input.pattern,
      subCategoryId: input.subCategoryId,
      amountSign: input.amountSign,
      confidence: input.confidence.toFixed(2),
      priority: 100,
      description: input.description ?? null,
      isActive: true,
    })
    .returning()
  return rows[0] as PatternRow
}

export async function updatePattern(
  id: number,
  userId: string,
  input: UpdatePatternInput,
  database: DbOrTx = db,
): Promise<PatternRow | null> {
  if (input.pattern) {
    new RegExp(input.pattern, 'i')
  }

  const updates: Partial<typeof categorizationPattern.$inferInsert> = { updatedAt: new Date() }
  if (input.pattern !== undefined) updates.pattern = input.pattern
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

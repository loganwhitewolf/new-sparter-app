import 'server-only'
import { cache } from 'react'
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { file, importFormatVersion, platform } from '@/lib/db/schema'
import type { ParsedImportFilters } from '@/lib/validations/import'

export const IMPORT_LIST_LIMIT = 50

export type ImportPagination = {
  limit?: number
  offset?: number
}

export const importListSelect = {
  id: file.id,
  displayName: file.displayName,
  originalName: file.originalName,
  status: file.status,
  platformId: platform.id,
  platformName: platform.name,
  platformSlug: platform.slug,
  uploadedAt: file.uploadedAt,
  analyzedAt: file.analyzedAt,
  importStartedAt: file.importStartedAt,
  importedAt: file.importedAt,
  rowCount: file.rowCount,
  importedCount: file.importedCount,
  duplicateCount: file.duplicateCount,
  positiveTotal: file.positiveTotal,
  negativeTotal: file.negativeTotal,
  referenceStartedAt: file.referenceStartedAt,
  referenceEndedAt: file.referenceEndedAt,
  errorMessage: file.errorMessage,
}

export const importListOrderTimestamp = sql<Date>`coalesce(${file.importedAt}, ${file.uploadedAt}, ${file.createdAt})`

export type ImportListRow = {
  id: string
  displayName: string | null
  originalName: string
  status: (typeof file.$inferSelect)['status']
  platformId: number | null
  platformName: string | null
  platformSlug: string | null
  uploadedAt: Date | null
  analyzedAt: Date | null
  importStartedAt: Date | null
  importedAt: Date | null
  rowCount: number
  importedCount: number
  duplicateCount: number
  positiveTotal: string
  negativeTotal: string
  referenceStartedAt: Date | null
  referenceEndedAt: Date | null
  errorMessage: string | null
}

export type UpdateImportDisplayNameParams = {
  userId: string
  fileId: string
  displayName: string | null
}

export type ImportDisplayNameRow = {
  id: string
  displayName: string | null
  updatedAt: Date
}

export async function updateImportDisplayName(
  database: DbOrTx = db,
  input: UpdateImportDisplayNameParams,
): Promise<ImportDisplayNameRow | null> {
  const normalizedDisplayName = input.displayName?.trim() || null
  const rows = await database
    .update(file)
    .set({
      displayName: normalizedDisplayName,
      updatedAt: new Date(),
    })
    .where(and(eq(file.id, input.fileId), eq(file.userId, input.userId)))
    .returning({
      id: file.id,
      displayName: file.displayName,
      updatedAt: file.updatedAt,
    })

  return rows[0] ?? null
}

export const getImportRows = cache(
  async (
    filters: ParsedImportFilters = {},
    pagination: ImportPagination = {},
  ): Promise<ImportListRow[]> => {
    const { userId } = await verifySession()
    const limit = pagination.limit ?? IMPORT_LIST_LIMIT
    const offset = pagination.offset ?? 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [eq(file.userId, userId)]

    if (filters.q) {
      const pattern = `%${filters.q}%`
      conditions.push(or(ilike(file.displayName, pattern), ilike(file.originalName, pattern)))
    }

    if (filters.importedFromDate) {
      conditions.push(gte(file.importedAt, filters.importedFromDate))
    }

    if (filters.importedToDate) {
      conditions.push(lte(file.importedAt, filters.importedToDate))
    }

    if (filters.referenceToDate) {
      conditions.push(lte(file.referenceStartedAt, filters.referenceToDate))
    }

    if (filters.referenceFromDate) {
      conditions.push(gte(file.referenceEndedAt, filters.referenceFromDate))
    }

    return db
      .select(importListSelect)
      .from(file)
      .leftJoin(
        importFormatVersion,
        eq(file.importFormatVersionId, importFormatVersion.id),
      )
      .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
      .where(and(...conditions))
      .orderBy(desc(importListOrderTimestamp), desc(file.createdAt))
      .limit(limit)
      .offset(offset)
  },
)

export const getImports = getImportRows

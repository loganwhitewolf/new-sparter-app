import 'server-only'
import { cache } from 'react'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { file, importFormatVersion, platform } from '@/lib/db/schema'

export const IMPORT_LIST_LIMIT = 50

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

export const getImportRows = cache(async (): Promise<ImportListRow[]> => {
  const { userId } = await verifySession()

  return db
    .select(importListSelect)
    .from(file)
    .leftJoin(
      importFormatVersion,
      eq(file.importFormatVersionId, importFormatVersion.id),
    )
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(and(eq(file.userId, userId)))
    .orderBy(desc(importListOrderTimestamp), desc(file.createdAt))
    .limit(IMPORT_LIST_LIMIT)
})

export const getImports = getImportRows

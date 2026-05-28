import 'server-only'
import { cache } from 'react'
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { file, importFormatVersion, platform, transaction } from '@/lib/db/schema'
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

// ─────────────────────────────────────────────────────────────────────────────
// File covered months query — R-OB-10 / D-10
// Display-only label; months-covered is never stored (ADR-0006).
// ─────────────────────────────────────────────────────────────────────────────

/** The date range covered by all transactions in a given import file. */
export type FileCoveredMonths = {
  firstMonth: Date
  lastMonth: Date
}

/**
 * Returns the DATE_TRUNC('month', MIN/MAX(transaction.occurredAt)) for the given fileId.
 * Enforces ownership via innerJoin on the file table (T-38-04):
 * a guessed fileId belonging to another user returns null.
 * Returns null when there are no transactions for the file.
 */
export const getFileCoveredMonths = cache(
  async (fileId: string, userId: string): Promise<FileCoveredMonths | null> => {
    const rows = await db
      .select({
        firstMonth: sql<Date>`date_trunc('month', min(${transaction.occurredAt}))`,
        lastMonth: sql<Date>`date_trunc('month', max(${transaction.occurredAt}))`,
      })
      .from(transaction)
      .innerJoin(file, eq(transaction.fileId, file.id))
      .where(
        and(
          eq(transaction.fileId, fileId),
          eq(file.userId, userId),
        ),
      )

    const row = rows[0]
    if (!row || row.firstMonth === null || row.lastMonth === null) {
      return null
    }

    return {
      firstMonth: row.firstMonth instanceof Date ? row.firstMonth : new Date(row.firstMonth),
      lastMonth: row.lastMonth instanceof Date ? row.lastMonth : new Date(row.lastMonth),
    }
  },
)

import 'server-only'
import { cache } from 'react'
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { expense, file, importFormatVersion, platform, transaction } from '@/lib/db/schema'
import type { ParsedImportFilters } from '@/lib/validations/import'

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

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

export type ImportSort =
  | 'displayName'
  | 'status'
  | 'platform'
  | 'importedAt'
  | 'rowCount'
  | 'positiveTotal'
  | 'negativeTotal'
  | 'referenceStartedAt'

export type ImportSortDirection = 'asc' | 'desc'

/** Matches "File" column label (displayName when set, else originalName). */
export const importDisplayNameSortKey = sql<string>`LOWER(COALESCE(NULLIF(TRIM(${file.displayName}), ''), ${file.originalName}))`

/** Matches "Importo" column on negativeTotal (absolute value, D-20). */
export const importNegativeTotalAbsSortKey = sql`ABS(${file.negativeTotal}::numeric)`

/** Matches "Totale entrate" column (absolute value). */
export const importPositiveTotalAbsSortKey = sql`ABS(${file.positiveTotal}::numeric)`

/** Rows showing "—" in the platform column (no joined platform name). */
export const importPlatformMissingBucket = sql<number>`CASE WHEN ${platform.name} IS NULL THEN 1 ELSE 0 END`

/** Matches "Piattaforma" column label when a platform name exists (case-insensitive). */
export const importPlatformSortKey = sql<string>`LOWER(${platform.name})`

/** Matches "Stato" badge labels (Italian, case-insensitive). Cast enum to text for CASE branches. */
export const importStatusSortKey = sql<string>`LOWER(
  CASE ${file.status}::text
    WHEN 'pending_upload' THEN 'in attesa'
    WHEN 'uploaded' THEN 'caricato'
    WHEN 'analyzing' THEN 'in analisi'
    WHEN 'analyzed' THEN 'analizzato'
    WHEN 'importing' THEN 'importazione'
    WHEN 'imported' THEN 'importato'
    WHEN 'failed' THEN 'errore'
    ELSE ${file.status}::text
  END
)`

/** Matches "Periodo" column — earliest reference boundary available. */
export const importReferencePeriodSortKey = sql<Date>`coalesce(${file.referenceStartedAt}, ${file.referenceEndedAt})`

export function getImportSortColumn(sort: ImportSort) {
  switch (sort) {
    case 'displayName':
      return importDisplayNameSortKey
    case 'status':
      return importStatusSortKey
    case 'platform':
      return importPlatformSortKey
    case 'importedAt':
      return importListOrderTimestamp
    case 'rowCount':
      return file.rowCount
    case 'positiveTotal':
      return importPositiveTotalAbsSortKey
    case 'negativeTotal':
      return importNegativeTotalAbsSortKey
    case 'referenceStartedAt':
      return importReferencePeriodSortKey
    default: {
      const _exhaustive: never = sort
      return _exhaustive
    }
  }
}

export function buildImportOrderBy({
  sort = 'importedAt',
  dir = 'desc',
}: Pick<ParsedImportFilters, 'sort' | 'dir'> = {}) {
  const effectiveSort: ImportSort = sort ?? 'importedAt'

  // Missing platform rows ("—") stay last in both ASC and DESC via bucket 0/1.
  if (effectiveSort === 'platform') {
    return dir === 'asc'
      ? [asc(importPlatformMissingBucket), asc(importPlatformSortKey), asc(file.id)]
      : [asc(importPlatformMissingBucket), desc(importPlatformSortKey), desc(file.id)]
  }

  const column = getImportSortColumn(effectiveSort)

  // Tie-break on id so OFFSET pagination never returns the same file twice.
  return dir === 'asc'
    ? [asc(column), asc(file.id)]
    : [desc(column), desc(file.id)]
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
      const pattern = `%${escapeLikePattern(filters.q)}%`
      conditions.push(or(ilike(file.displayName, pattern), ilike(file.originalName, pattern)))
    }

    if (filters.fileId) {
      conditions.push(eq(file.id, filters.fileId))
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

    // Wave 4: platform slug filter (T-40-09 mitigated — slug allowlist enforced in parser)
    if (filters.platform) {
      conditions.push(eq(platform.slug, filters.platform))
    }

    // Wave 4: processing status bucket — 3 buckets (D-22)
    if (filters.statusBucket === 'imported') {
      conditions.push(eq(file.status, 'imported'))
    } else if (filters.statusBucket === 'pending') {
      // All transient states that are "in progress" or "uploaded but not imported"
      conditions.push(
        inArray(file.status, ['uploaded', 'analyzing', 'analyzed', 'importing', 'pending_upload']),
      )
    } else if (filters.statusBucket === 'failed') {
      conditions.push(eq(file.status, 'failed'))
    }

    // Wave 4: coverage months — TO_CHAR(referenceStartedAt, 'YYYY-MM')
    // IMPORTANT: The length > 0 guard must stay. Drizzle's or() with zero arguments
    // produces an invalid SQL fragment and throws at runtime.
    if (filters.months && filters.months.length > 0) {
      conditions.push(
        or(...filters.months.map((ym) => sql`TO_CHAR(${file.referenceStartedAt}, 'YYYY-MM') = ${ym}`)),
      )
    }

    // Wave 4: amount ABS on negativeTotal (D-20)
    if (filters.amountMin !== undefined) {
      conditions.push(sql`ABS(${file.negativeTotal}::numeric) >= ${filters.amountMin}::numeric`)
    }
    if (filters.amountMax !== undefined) {
      conditions.push(sql`ABS(${file.negativeTotal}::numeric) <= ${filters.amountMax}::numeric`)
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
      .orderBy(...buildImportOrderBy(filters))
      .limit(limit)
      .offset(offset)
  },
)

export const getImports = getImportRows

// ─────────────────────────────────────────────────────────────────────────────
// Latest import summary for onboarding steps 2 and 3 — R-OB-05, R-OB-06
// ─────────────────────────────────────────────────────────────────────────────

export type LatestImportSummary = {
  fileId: string
  fileName: string
  importedCount: number
  autoCategorizedCount: number
  uncategorizedCount: number
  positiveTotal: string
  negativeTotal: string
  firstMonth: Date | null
  lastMonth: Date | null
}

/**
 * Returns aggregate stats for the user's most recent imported file.
 * All expense counts are scoped to the file (T-38-07: WHERE userId = $1).
 * Month range is derived via getFileCoveredMonths which enforces ownership.
 * Returns null when the user has no imported files yet (defensive path for step=3).
 */
export const getLatestImportSummaryForUser = cache(
  async (userId: string): Promise<LatestImportSummary | null> => {
    // Fetch the latest imported file for this user (ordered by importedAt desc)
    const fileRows = await db
      .select({
        id: file.id,
        displayName: file.displayName,
        originalName: file.originalName,
        importedCount: file.importedCount,
        positiveTotal: file.positiveTotal,
        negativeTotal: file.negativeTotal,
      })
      .from(file)
      .where(and(eq(file.userId, userId), isNotNull(file.importedAt)))
      .orderBy(desc(file.importedAt))
      .limit(1)

    const latestFile = fileRows[0]
    if (!latestFile) return null

    // Count auto-categorized expenses (subCategoryId IS NOT NULL) for this file
    const categorisedRows = await db
      .select({
        autoCategorizedCount: count(),
      })
      .from(expense)
      .where(
        and(
          eq(expense.importedFromFileId, latestFile.id),
          eq(expense.userId, userId),
          isNotNull(expense.subCategoryId),
        ),
      )

    const autoCategorizedCount = categorisedRows[0]?.autoCategorizedCount ?? 0
    const uncategorizedCount = Math.max(0, latestFile.importedCount - autoCategorizedCount)

    // Derive month range using the same ownership-enforcing query as getFileCoveredMonths
    const monthRange = await getFileCoveredMonths(latestFile.id, userId)

    return {
      fileId: latestFile.id,
      fileName: latestFile.displayName ?? latestFile.originalName,
      importedCount: latestFile.importedCount,
      autoCategorizedCount,
      uncategorizedCount,
      positiveTotal: latestFile.positiveTotal,
      negativeTotal: latestFile.negativeTotal,
      firstMonth: monthRange?.firstMonth ?? null,
      lastMonth: monthRange?.lastMonth ?? null,
    }
  },
)

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

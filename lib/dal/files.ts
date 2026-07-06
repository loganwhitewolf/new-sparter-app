import 'server-only'
import { cache } from 'react'
import { and, eq, isNotNull } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { file, importFormatVersion, platform } from '@/lib/db/schema'

export type FileRow = typeof file.$inferSelect
export type FileStatus = FileRow['status']

export type CreateFileRecordInput = {
  id?: string
  userId: string
  originalName: string
  objectKey: string
  mimeType: string
  sizeBytes: number
  contentHash?: string | null
  displayName?: string | null
  rowCount?: number
  importedCount?: number
  duplicateCount?: number
  positiveTotal?: string
  negativeTotal?: string
  referenceStartedAt?: Date | null
  referenceEndedAt?: Date | null
}

export async function createFileRecord(input: CreateFileRecordInput, database: DbOrTx = db): Promise<FileRow> {
  const rows = await database
    .insert(file)
    .values({
      id: input.id ?? crypto.randomUUID(),
      userId: input.userId,
      originalName: input.originalName,
      displayName: input.displayName ?? null,
      contentHash: input.contentHash ?? null,
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: 'pending_upload',
      rowCount: input.rowCount ?? 0,
      importedCount: input.importedCount ?? 0,
      duplicateCount: input.duplicateCount ?? 0,
      positiveTotal: input.positiveTotal ?? '0.00',
      negativeTotal: input.negativeTotal ?? '0.00',
      referenceStartedAt: input.referenceStartedAt ?? null,
      referenceEndedAt: input.referenceEndedAt ?? null,
      errorMessage: null,
    })
    .returning()

  const created = rows[0]
  if (!created) throw new Error('Failed to create file record')
  return created
}

export async function getFileForUser(
  input: { userId: string; fileId: string },
  database: DbOrTx = db,
): Promise<FileRow | null> {
  const rows = await database
    .select()
    .from(file)
    .where(and(eq(file.id, input.fileId), eq(file.userId, input.userId)))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Resolves the platformId for a file that belongs to the given user.
 *
 * Joins file → importFormatVersion → platform to traverse the ownership chain.
 * Returns null when:
 * - the file does not exist or does not belong to userId (ownership guard)
 * - the file has no importFormatVersionId (pending/failed upload)
 * - the importFormatVersion has no platformId
 *
 * Callers must treat null as "cannot resolve platform" and must NOT fall back to
 * user-wide apply (APPLY-02 locked decision).
 */
export async function getPlatformIdForUserFile(
  input: { userId: string; fileId: string },
  database: DbOrTx = db,
): Promise<number | null> {
  const rows = await database
    .select({ platformId: platform.id })
    .from(file)
    .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(and(eq(file.id, input.fileId), eq(file.userId, input.userId)))
    .limit(1)

  return rows[0]?.platformId ?? null
}

export type FileDetailContextRow = FileRow & { platformName: string | null }

/**
 * Ownership-scoped detail query for `/import/[fileId]` (DET-08, DET-09).
 * Returns every `FileRow` column plus the resolved platform name in one
 * round-trip via the same file → importFormatVersion → platform join chain
 * as `getPlatformIdForUserFile`, so the file detail page never needs a
 * second query to display platform context. Supersedes `getFileForUser` for
 * that page.
 */
export const getFileDetailForUser = cache(
  async ({
    userId,
    fileId,
  }: {
    userId: string
    fileId: string
  }): Promise<FileDetailContextRow | null> => {
    const rows = await db
      .select({
        id: file.id,
        userId: file.userId,
        importFormatVersionId: file.importFormatVersionId,
        originalName: file.originalName,
        displayName: file.displayName,
        contentHash: file.contentHash,
        objectKey: file.objectKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        status: file.status,
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
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        platformName: platform.name,
      })
      .from(file)
      .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
      .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
      .where(and(eq(file.id, fileId), eq(file.userId, userId)))
      .limit(1)

    return rows[0] ?? null
  },
)

export async function findFileByContentHash(
  input: { userId: string; contentHash: string },
  database: DbOrTx = db,
): Promise<FileRow | null> {
  const rows = await database
    .select()
    .from(file)
    .where(
      and(
        eq(file.userId, input.userId),
        isNotNull(file.contentHash),
        eq(file.contentHash, input.contentHash),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

export async function markFileUploaded(
  input: {
    userId: string
    fileId: string
    uploadedAt?: Date
    importFormatVersionId?: number | null
  },
  database: DbOrTx = db,
): Promise<FileRow | null> {
  const rows = await database
    .update(file)
    .set({
      status: 'uploaded',
      uploadedAt: input.uploadedAt ?? new Date(),
      importFormatVersionId: input.importFormatVersionId,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(file.id, input.fileId), eq(file.userId, input.userId)))
    .returning()

  return rows[0] ?? null
}

export async function markFileFailed(
  input: { userId: string; fileId: string; errorMessage: string },
  database: DbOrTx = db,
): Promise<FileRow | null> {
  const rows = await database
    .update(file)
    .set({
      status: 'failed',
      errorMessage: input.errorMessage.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(and(eq(file.id, input.fileId), eq(file.userId, input.userId)))
    .returning()

  return rows[0] ?? null
}

export async function updateFileAnalysisState(
  input: {
    userId: string
    fileId: string
    status: Extract<FileStatus, 'analyzing' | 'analyzed' | 'failed'>
    rowCount?: number
    importedCount?: number
    duplicateCount?: number
    positiveTotal?: string
    negativeTotal?: string
    referenceStartedAt?: Date | null
    referenceEndedAt?: Date | null
    importFormatVersionId?: number | null
    errorMessage?: string | null
    analyzedAt?: Date | null
  },
  database: DbOrTx = db,
): Promise<FileRow | null> {
  const rows = await database
    .update(file)
    .set({
      status: input.status,
      rowCount: input.rowCount,
      importedCount: input.importedCount,
      duplicateCount: input.duplicateCount,
      positiveTotal: input.positiveTotal,
      negativeTotal: input.negativeTotal,
      referenceStartedAt: input.referenceStartedAt,
      referenceEndedAt: input.referenceEndedAt,
      importFormatVersionId: input.importFormatVersionId,
      errorMessage: input.errorMessage ?? null,
      analyzedAt: input.analyzedAt ?? (input.status === 'analyzed' ? new Date() : undefined),
      updatedAt: new Date(),
    })
    .where(and(eq(file.id, input.fileId), eq(file.userId, input.userId)))
    .returning()

  return rows[0] ?? null
}

export async function updateFileImportState(
  input: {
    userId: string
    fileId: string
    status: Extract<FileStatus, 'importing' | 'imported' | 'failed'>
    rowCount?: number
    importedCount?: number
    duplicateCount?: number
    positiveTotal?: string
    negativeTotal?: string
    referenceStartedAt?: Date | null
    referenceEndedAt?: Date | null
    importStartedAt?: Date | null
    importedAt?: Date | null
    importFormatVersionId?: number | null
    errorMessage?: string | null
  },
  database: DbOrTx = db,
): Promise<FileRow | null> {
  const rows = await database
    .update(file)
    .set({
      status: input.status,
      rowCount: input.rowCount,
      importedCount: input.importedCount,
      duplicateCount: input.duplicateCount,
      positiveTotal: input.positiveTotal,
      negativeTotal: input.negativeTotal,
      referenceStartedAt: input.referenceStartedAt,
      referenceEndedAt: input.referenceEndedAt,
      importStartedAt: input.importStartedAt,
      importedAt: input.importedAt,
      importFormatVersionId: input.importFormatVersionId,
      errorMessage: input.errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(file.id, input.fileId), eq(file.userId, input.userId)))
    .returning()

  return rows[0] ?? null
}

export function buildUserImportObjectKey(input: { userId: string; fileId: string; originalName: string }) {
  const extension = input.originalName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''
  const safeExtension = ['.csv', '.xlsx'].includes(extension) ? extension : ''
  return `users/${encodeURIComponent(input.userId)}/imports/${input.fileId}${safeExtension}`
}

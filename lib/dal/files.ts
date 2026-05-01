import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { file } from '@/lib/db/schema'

export type FileRow = typeof file.$inferSelect
export type FileStatus = FileRow['status']

export type CreateFileRecordInput = {
  id?: string
  userId: string
  originalName: string
  objectKey: string
  mimeType: string
  sizeBytes: number
}

export async function createFileRecord(input: CreateFileRecordInput, database: DbOrTx = db): Promise<FileRow> {
  const rows = await database
    .insert(file)
    .values({
      id: input.id ?? crypto.randomUUID(),
      userId: input.userId,
      originalName: input.originalName,
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: 'pending_upload',
      rowCount: 0,
      duplicateCount: 0,
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
    duplicateCount?: number
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
      duplicateCount: input.duplicateCount,
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
    duplicateCount?: number
    importStartedAt?: Date | null
    importedAt?: Date | null
    errorMessage?: string | null
  },
  database: DbOrTx = db,
): Promise<FileRow | null> {
  const rows = await database
    .update(file)
    .set({
      status: input.status,
      rowCount: input.rowCount,
      duplicateCount: input.duplicateCount,
      importStartedAt: input.importStartedAt,
      importedAt: input.importedAt,
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

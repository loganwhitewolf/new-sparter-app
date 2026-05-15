import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal/auth'
import { buildUserImportObjectKey, createFileRecord, findFileByContentHash, markFileFailed } from '@/lib/dal/files'
import { logger, withLogContext } from '@/lib/logger'
import { createPresignedPutUrl } from '@/lib/services/r2'
import { InitiateUploadSchema } from '@/lib/validations/import'

export const runtime = 'nodejs'

type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

function errorResponse(status: number, code: string, message: string, details?: Record<string, unknown>) {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } }
  return NextResponse.json(body, { status })
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function errorCode(error: unknown, fallback: string) {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : fallback
}

function errorStatus(error: unknown, fallback = 500) {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : fallback
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function serviceError(error: unknown) {
  return errorResponse(
    errorStatus(error),
    errorCode(error, 'upload_initiate_failed'),
    errorMessage(error, 'Could not initiate upload. Please retry.'),
  )
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof verifySession>>
  try {
    session = await verifySession()
  } catch {
    return errorResponse(401, 'unauthorized', 'Sign in to upload import files.')
  }

  return withLogContext({ userId: session.userId, stage: 'upload_initiate' }, async () => {
    const parsed = InitiateUploadSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      logger.warn({
        event: 'upload_initiate_malformed',
        userId: session.userId,
        issueCount: parsed.error.issues.length,
      })
      return errorResponse(422, 'invalid_upload_request', 'Upload request is invalid.', {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    logger.info({
      event: 'upload_initiate_started',
      userId: session.userId,
      fileName: parsed.data.name,
      sizeBytes: parsed.data.size,
      contentType: parsed.data.type,
    })

    if (parsed.data.contentHash) {
      const existing = await findFileByContentHash({
        userId: session.userId,
        contentHash: parsed.data.contentHash,
      })
      if (existing) {
        logger.info({
          event: 'upload_initiate_duplicate',
          userId: session.userId,
          contentHash: parsed.data.contentHash,
          existingFileId: existing.id,
        })
        return errorResponse(409, 'duplicate_file', 'Hai già caricato questo file.', {
          existingFileId: existing.id,
        })
      }
    }

    let createdFile: Awaited<ReturnType<typeof createFileRecord>> | null = null
    try {
      const fileId = crypto.randomUUID()
      const objectKey = buildUserImportObjectKey({
        userId: session.userId,
        fileId,
        originalName: parsed.data.name,
      })

      createdFile = await createFileRecord({
        id: fileId,
        userId: session.userId,
        originalName: parsed.data.name,
        objectKey,
        mimeType: parsed.data.type,
        sizeBytes: parsed.data.size,
        contentHash: parsed.data.contentHash ?? null,
      })

      const signed = await createPresignedPutUrl({
        objectKey: createdFile.objectKey,
        contentType: parsed.data.type,
        contentLength: parsed.data.size,
      })

      logger.info({
        event: 'upload_initiate_succeeded',
        userId: session.userId,
        fileId: createdFile.id,
        objectKey: createdFile.objectKey,
        expiresIn: signed.expiresIn,
      })

      return NextResponse.json({
        file: {
          id: createdFile.id,
          originalName: createdFile.originalName,
          status: createdFile.status,
          sizeBytes: createdFile.sizeBytes,
          mimeType: createdFile.mimeType,
        },
        upload: {
          method: 'PUT',
          url: signed.url,
          expiresIn: signed.expiresIn,
          headers: { 'Content-Type': parsed.data.type },
        },
      })
    } catch (error) {
      if (createdFile) {
        await markFileFailed({
          userId: session.userId,
          fileId: createdFile.id,
          errorMessage: errorMessage(error, 'Upload initiate failed.'),
        }).catch((markError) => {
          logger.error({
            event: 'upload_initiate_mark_failed_error',
            userId: session.userId,
            fileId: createdFile?.id,
            objectKey: createdFile?.objectKey,
            code: errorCode(markError, 'mark_file_failed_error'),
            status: errorStatus(markError),
            error: errorMessage(markError, 'Could not mark initiated file as failed.'),
          })
        })
      }

      logger.error({
        event: 'upload_initiate_failed',
        userId: session.userId,
        fileId: createdFile?.id,
        objectKey: createdFile?.objectKey,
        code: errorCode(error, 'upload_initiate_failed'),
        status: errorStatus(error),
        error: errorMessage(error, 'Could not initiate upload. Please retry.'),
      })
      return serviceError(error)
    }
  })
}

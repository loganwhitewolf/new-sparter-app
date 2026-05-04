import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal/auth'
import { getFileForUser, markFileFailed, markFileUploaded } from '@/lib/dal/files'
import { logger, withLogContext } from '@/lib/logger'
import { headObject } from '@/lib/services/r2'
import { ConfirmUploadSchema } from '@/lib/validations/import'

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
    errorCode(error, 'upload_confirm_failed'),
    errorMessage(error, 'Could not confirm upload. Please retry.'),
  )
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof verifySession>>
  try {
    session = await verifySession()
  } catch {
    return errorResponse(401, 'unauthorized', 'Sign in to confirm import uploads.')
  }

  return withLogContext({ userId: session.userId, stage: 'upload_confirm' }, async () => {
    const parsed = ConfirmUploadSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      logger.warn({
        event: 'upload_confirm_malformed',
        userId: session.userId,
        issueCount: parsed.error.issues.length,
      })
      return errorResponse(422, 'invalid_confirm_request', 'Upload confirmation request is invalid.', {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    logger.info({
      event: 'upload_confirm_started',
      userId: session.userId,
      fileId: parsed.data.fileId,
    })

    const file = await getFileForUser({ userId: session.userId, fileId: parsed.data.fileId })
    if (!file) {
      logger.warn({
        event: 'upload_confirm_not_found',
        userId: session.userId,
        fileId: parsed.data.fileId,
      })
      return errorResponse(404, 'file_not_found', 'Import file was not found.')
    }
    if (parsed.data.contentType && file.mimeType && parsed.data.contentType !== file.mimeType) {
      await markFileFailed({
        userId: session.userId,
        fileId: file.id,
        errorMessage: 'Uploaded content type did not match the initiated upload.',
      })
      logger.warn({
        event: 'upload_confirm_mismatch',
        userId: session.userId,
        fileId: file.id,
        objectKey: file.objectKey,
        mismatch: 'request_content_type',
        expectedContentType: file.mimeType,
        actualContentType: parsed.data.contentType,
      })
      return errorResponse(409, 'content_type_mismatch', 'Uploaded content type does not match the initiated upload.')
    }

    try {
      const head = await headObject(file.objectKey)
      if (!head.eTag || head.contentLength === null) {
        await markFileFailed({
          userId: session.userId,
          fileId: file.id,
          errorMessage: 'Uploaded object metadata was incomplete.',
        })
        logger.warn({
          event: 'upload_confirm_malformed_metadata',
          userId: session.userId,
          fileId: file.id,
          objectKey: file.objectKey,
          hasETag: Boolean(head.eTag),
          hasContentLength: head.contentLength !== null,
        })
        return errorResponse(502, 'invalid_upload_metadata', 'Uploaded file metadata could not be verified.')
      }
      if (head.contentLength !== file.sizeBytes) {
        await markFileFailed({
          userId: session.userId,
          fileId: file.id,
          errorMessage: 'Uploaded object size did not match the initiated upload.',
        })
        logger.warn({
          event: 'upload_confirm_mismatch',
          userId: session.userId,
          fileId: file.id,
          objectKey: file.objectKey,
          mismatch: 'size',
          expectedSizeBytes: file.sizeBytes,
          actualSizeBytes: head.contentLength,
        })
        return errorResponse(409, 'size_mismatch', 'Uploaded file size does not match the initiated upload.')
      }
      if (head.contentType && file.mimeType && head.contentType !== file.mimeType) {
        await markFileFailed({
          userId: session.userId,
          fileId: file.id,
          errorMessage: 'Uploaded object content type did not match the initiated upload.',
        })
        logger.warn({
          event: 'upload_confirm_mismatch',
          userId: session.userId,
          fileId: file.id,
          objectKey: file.objectKey,
          mismatch: 'object_content_type',
          expectedContentType: file.mimeType,
          actualContentType: head.contentType,
        })
        return errorResponse(409, 'content_type_mismatch', 'Uploaded content type does not match the initiated upload.')
      }

      const uploaded = await markFileUploaded({ userId: session.userId, fileId: file.id })
      if (!uploaded) {
        logger.warn({
          event: 'upload_confirm_db_update_missing',
          userId: session.userId,
          fileId: file.id,
          objectKey: file.objectKey,
        })
        return errorResponse(404, 'file_not_found', 'Import file was not found.')
      }

      logger.info({
        event: 'upload_confirm_succeeded',
        userId: session.userId,
        fileId: uploaded.id,
        objectKey: file.objectKey,
        eTag: head.eTag,
        contentLength: head.contentLength,
        contentType: head.contentType,
      })

      return NextResponse.json({
        file: {
          id: uploaded.id,
          originalName: uploaded.originalName,
          status: uploaded.status,
          uploadedAt: uploaded.uploadedAt?.toISOString() ?? null,
          rowCount: uploaded.rowCount,
          duplicateCount: uploaded.duplicateCount,
          errorMessage: uploaded.errorMessage,
        },
      })
    } catch (error) {
      await markFileFailed({
        userId: session.userId,
        fileId: file.id,
        errorMessage: errorMessage(error, 'Upload confirmation failed.'),
      }).catch((markError) => {
        logger.error({
          event: 'upload_confirm_mark_failed_error',
          userId: session.userId,
          fileId: file.id,
          objectKey: file.objectKey,
          code: errorCode(markError, 'mark_file_failed_error'),
          status: errorStatus(markError),
          error: errorMessage(markError, 'Could not mark confirmed file as failed.'),
        })
      })

      logger.error({
        event: 'upload_confirm_failed',
        userId: session.userId,
        fileId: file.id,
        objectKey: file.objectKey,
        code: errorCode(error, 'upload_confirm_failed'),
        status: errorStatus(error),
        error: errorMessage(error, 'Could not confirm upload. Please retry.'),
      })
      return serviceError(error)
    }
  })
}

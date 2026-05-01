import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal/auth'
import { getFileForUser, markFileFailed, markFileUploaded } from '@/lib/dal/files'
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

function serviceError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'upload_confirm_failed'
  const status =
    typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500
  const message = error instanceof Error ? error.message : 'Could not confirm upload. Please retry.'
  return errorResponse(status, code, message)
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof verifySession>>
  try {
    session = await verifySession()
  } catch {
    return errorResponse(401, 'unauthorized', 'Sign in to confirm import uploads.')
  }

  const parsed = ConfirmUploadSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return errorResponse(422, 'invalid_confirm_request', 'Upload confirmation request is invalid.', {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }

  const file = await getFileForUser({ userId: session.userId, fileId: parsed.data.fileId })
  if (!file) {
    return errorResponse(404, 'file_not_found', 'Import file was not found.')
  }
  if (parsed.data.contentType && file.mimeType && parsed.data.contentType !== file.mimeType) {
    await markFileFailed({
      userId: session.userId,
      fileId: file.id,
      errorMessage: 'Uploaded content type did not match the initiated upload.',
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
      return errorResponse(502, 'invalid_upload_metadata', 'Uploaded file metadata could not be verified.')
    }
    if (head.contentLength !== file.sizeBytes) {
      await markFileFailed({
        userId: session.userId,
        fileId: file.id,
        errorMessage: 'Uploaded object size did not match the initiated upload.',
      })
      return errorResponse(409, 'size_mismatch', 'Uploaded file size does not match the initiated upload.')
    }
    if (head.contentType && file.mimeType && head.contentType !== file.mimeType) {
      await markFileFailed({
        userId: session.userId,
        fileId: file.id,
        errorMessage: 'Uploaded object content type did not match the initiated upload.',
      })
      return errorResponse(409, 'content_type_mismatch', 'Uploaded content type does not match the initiated upload.')
    }

    const uploaded = await markFileUploaded({ userId: session.userId, fileId: file.id })
    if (!uploaded) {
      return errorResponse(404, 'file_not_found', 'Import file was not found.')
    }

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
      errorMessage: error instanceof Error ? error.message : 'Upload confirmation failed.',
    }).catch(() => undefined)
    return serviceError(error)
  }
}

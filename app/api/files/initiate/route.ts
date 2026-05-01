import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal/auth'
import { buildUserImportObjectKey, createFileRecord, markFileFailed } from '@/lib/dal/files'
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

function serviceError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'upload_initiate_failed'
  const status =
    typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500
  const message = error instanceof Error ? error.message : 'Could not initiate upload. Please retry.'
  return errorResponse(status, code, message)
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof verifySession>>
  try {
    session = await verifySession()
  } catch {
    return errorResponse(401, 'unauthorized', 'Sign in to upload import files.')
  }

  const parsed = InitiateUploadSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return errorResponse(422, 'invalid_upload_request', 'Upload request is invalid.', {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
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
    })

    const signed = await createPresignedPutUrl({
      objectKey: createdFile.objectKey,
      contentType: parsed.data.type,
      contentLength: parsed.data.size,
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
        headers: {
          'Content-Type': parsed.data.type,
        },
      },
    })
  } catch (error) {
    if (createdFile) {
      await markFileFailed({
        userId: session.userId,
        fileId: createdFile.id,
        errorMessage: error instanceof Error ? error.message : 'Upload initiate failed.',
      }).catch(() => undefined)
    }
    return serviceError(error)
  }
}

import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal/auth'
import { getFileForUser } from '@/lib/dal/files'
import { logger, withLogContext } from '@/lib/logger'
import { createPresignedGetUrl } from '@/lib/services/r2'
import { canDownloadImportFile } from '@/lib/utils/import-status'

export const runtime = 'nodejs'

type ApiErrorBody = {
  error: {
    code: string
    message: string
  }
}

function errorResponse(status: number, code: string, message: string) {
  const body: ApiErrorBody = { error: { code, message } }
  return NextResponse.json(body, { status })
}

function resolveDownloadFilename(file: { displayName: string | null; originalName: string }) {
  return file.displayName?.trim() || file.originalName
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  let session: Awaited<ReturnType<typeof verifySession>>
  try {
    session = await verifySession()
  } catch {
    return errorResponse(401, 'unauthorized', 'Accedi per scaricare il file.')
  }

  const { fileId } = await context.params
  if (!fileId?.trim()) {
    return errorResponse(400, 'invalid_file_id', 'ID file non valido.')
  }

  return withLogContext({ userId: session.userId, stage: 'file_download' }, async () => {
    const file = await getFileForUser({ userId: session.userId, fileId })
    if (!file) {
      return errorResponse(404, 'file_not_found', 'File non trovato.')
    }

    if (!canDownloadImportFile(file)) {
      return errorResponse(409, 'file_not_downloadable', 'Il file non è ancora disponibile per il download.')
    }

    const downloadFilename = resolveDownloadFilename(file)

    logger.info({
      event: 'file_download_started',
      userId: session.userId,
      fileId: file.id,
    })

    try {
      const signed = await createPresignedGetUrl({
        objectKey: file.objectKey,
        downloadFilename,
      })

      logger.info({
        event: 'file_download_succeeded',
        userId: session.userId,
        fileId: file.id,
        expiresIn: signed.expiresIn,
      })

      return NextResponse.json({
        download: {
          url: signed.url,
          expiresIn: signed.expiresIn,
          filename: downloadFilename,
        },
      })
    } catch (error) {
      logger.warn({
        event: 'file_download_failed',
        userId: session.userId,
        fileId: file.id,
        code: errorCode(error, 'file_download_failed'),
      })

      return errorResponse(
        errorStatus(error),
        errorCode(error, 'file_download_failed'),
        errorMessage(error, 'Impossibile preparare il download. Riprova.'),
      )
    }
  })
}

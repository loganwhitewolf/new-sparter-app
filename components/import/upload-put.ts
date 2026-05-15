const MAX_UPLOAD_PUT_ATTEMPTS = 3

export type UploadPutDiagnosticEventName =
  | 'upload_put_attempt'
  | 'upload_put_retrying'
  | 'upload_put_failed'

export type UploadPutDiagnosticEvent = {
  event: UploadPutDiagnosticEventName
  fileId: string
  attempt: number
  maxAttempts: number
  status?: number
  retryable?: boolean
  errorName?: string
  errorMessage?: string
}

export type UploadPutDiagnostics = (event: UploadPutDiagnosticEvent) => void | Promise<void>

export type UploadPutOptions = {
  fileId: string
  url: string
  file: File | Blob
  headers?: Record<string, string>
  fetchFn?: typeof fetch
  diagnostics?: UploadPutDiagnostics
  delay?: (attempt: number) => Promise<void> | void
}

export class UploadPutError extends Error {
  status?: number
  retryable: boolean
  attempt: number
  maxAttempts: number

  constructor(input: {
    message: string
    status?: number
    retryable: boolean
    attempt: number
    maxAttempts: number
    cause?: unknown
  }) {
    super(input.message, { cause: input.cause })
    this.name = 'UploadPutError'
    this.status = input.status
    this.retryable = input.retryable
    this.attempt = input.attempt
    this.maxAttempts = input.maxAttempts
  }
}

function defaultDelay(attempt: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, attempt * 500)
  })
}

function defaultDiagnostics(event: UploadPutDiagnosticEvent) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('upload-put-diagnostic', { detail: event }))
  }
}

function emitDiagnostics(diagnostics: UploadPutDiagnostics, event: UploadPutDiagnosticEvent) {
  try {
    const result = diagnostics(event)
    if (result && typeof result === 'object' && 'catch' in result && typeof result.catch === 'function') {
      result.catch(() => undefined)
    }
  } catch {
    // Diagnostics must never block the upload path.
  }
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : 'Error'
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'Upload PUT failed'
}

function isRetryableStatus(status: number) {
  return status >= 500 && status <= 599
}

export async function uploadFileToPresignedUrl({
  fileId,
  url,
  file,
  headers = {},
  fetchFn = fetch,
  diagnostics = defaultDiagnostics,
  delay = defaultDelay,
}: UploadPutOptions): Promise<void> {
  for (let attempt = 1; attempt <= MAX_UPLOAD_PUT_ATTEMPTS; attempt += 1) {
    emitDiagnostics(diagnostics, {
      event: 'upload_put_attempt',
      fileId,
      attempt,
      maxAttempts: MAX_UPLOAD_PUT_ATTEMPTS,
    })

    try {
      const response = await fetchFn(url, {
        method: 'PUT',
        headers,
        body: file,
      })

      if (response.ok) return

      const retryable = isRetryableStatus(response.status)
      if (retryable && attempt < MAX_UPLOAD_PUT_ATTEMPTS) {
        emitDiagnostics(diagnostics, {
          event: 'upload_put_retrying',
          fileId,
          attempt,
          maxAttempts: MAX_UPLOAD_PUT_ATTEMPTS,
          status: response.status,
          retryable,
          errorName: 'HttpError',
          errorMessage: `Upload PUT failed with status ${response.status}`,
        })
        await delay(attempt)
        continue
      }

      emitDiagnostics(diagnostics, {
        event: 'upload_put_failed',
        fileId,
        attempt,
        maxAttempts: MAX_UPLOAD_PUT_ATTEMPTS,
        status: response.status,
        retryable,
        errorName: 'HttpError',
        errorMessage: `Upload PUT failed with status ${response.status}`,
      })

      throw new UploadPutError({
        message: 'Caricamento su storage fallito. Riprova.',
        status: response.status,
        retryable,
        attempt,
        maxAttempts: MAX_UPLOAD_PUT_ATTEMPTS,
      })
    } catch (error) {
      if (error instanceof UploadPutError) throw error

      const retryable = true
      if (attempt < MAX_UPLOAD_PUT_ATTEMPTS) {
        emitDiagnostics(diagnostics, {
          event: 'upload_put_retrying',
          fileId,
          attempt,
          maxAttempts: MAX_UPLOAD_PUT_ATTEMPTS,
          retryable,
          errorName: errorName(error),
          errorMessage: errorMessage(error),
        })
        await delay(attempt)
        continue
      }

      emitDiagnostics(diagnostics, {
        event: 'upload_put_failed',
        fileId,
        attempt,
        maxAttempts: MAX_UPLOAD_PUT_ATTEMPTS,
        retryable,
        errorName: errorName(error),
        errorMessage: errorMessage(error),
      })

      throw new UploadPutError({
        message: 'Errore di rete durante il caricamento del file.',
        retryable,
        attempt,
        maxAttempts: MAX_UPLOAD_PUT_ATTEMPTS,
        cause: error,
      })
    }
  }
}

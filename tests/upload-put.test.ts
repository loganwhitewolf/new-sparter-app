import { describe, expect, it, vi } from 'vitest'

import { uploadFileToPresignedUrl, type UploadPutDiagnosticEvent } from '../components/import/upload-put'

function csvFile() {
  return new File(['date,amount\n2026-01-01,10\n'], 'fineco.csv', { type: 'text/csv' })
}

function response(status = 200) {
  return new Response(null, { status })
}

function makeFetch(results: Array<Response | Error>) {
  const fetchFn = vi.fn<typeof fetch>()
  for (const result of results) {
    if (result instanceof Error) {
      fetchFn.mockRejectedValueOnce(result)
    } else {
      fetchFn.mockResolvedValueOnce(result)
    }
  }
  return fetchFn
}

async function expectUploadFailure(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    name: 'UploadPutError',
    message: 'Caricamento su storage fallito. Riprova.',
  })
}

function diagnosticPayloads(events: UploadPutDiagnosticEvent[]) {
  return events.map((event) => JSON.stringify(event)).join('\n')
}

describe('uploadFileToPresignedUrl', () => {
  it('uploads successfully on the first PUT attempt', async () => {
    const fetchFn = makeFetch([response(200)])
    const diagnostics = vi.fn()

    await uploadFileToPresignedUrl({
      fileId: 'file-1',
      url: 'https://r2.example.test/signed-put-secret',
      file: csvFile(),
      headers: { 'Content-Type': 'text/csv' },
      fetchFn,
      diagnostics,
      delay: vi.fn(),
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledWith('https://r2.example.test/signed-put-secret', expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({
        'Content-Type': 'text/csv',
        'Content-Length': String(csvFile().size),
      }),
      body: expect.any(File),
    }))
    expect(diagnostics).toHaveBeenCalledWith(expect.objectContaining({
      event: 'upload_put_attempt',
      fileId: 'file-1',
      attempt: 1,
      maxAttempts: 3,
    }))
  })

  it('retries one network exception and then succeeds', async () => {
    const fetchFn = makeFetch([new TypeError('Failed to fetch'), response(200)])
    const diagnostics = vi.fn()
    const delay = vi.fn()

    await uploadFileToPresignedUrl({
      fileId: 'file-1',
      url: 'https://r2.example.test/signed-put-secret',
      file: csvFile(),
      fetchFn,
      diagnostics,
      delay,
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(delay).toHaveBeenCalledTimes(1)
    expect(diagnostics).toHaveBeenCalledWith(expect.objectContaining({
      event: 'upload_put_retrying',
      fileId: 'file-1',
      attempt: 1,
      maxAttempts: 3,
      retryable: true,
      errorName: 'TypeError',
      errorMessage: 'Failed to fetch',
    }))
  })

  it('retries two HTTP 503 responses and then succeeds', async () => {
    const fetchFn = makeFetch([response(503), response(503), response(200)])
    const diagnostics = vi.fn()

    await uploadFileToPresignedUrl({
      fileId: 'file-1',
      url: 'https://r2.example.test/signed-put-secret',
      file: csvFile(),
      fetchFn,
      diagnostics,
      delay: vi.fn(),
    })

    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(diagnostics).toHaveBeenCalledWith(expect.objectContaining({
      event: 'upload_put_retrying',
      status: 503,
      retryable: true,
      attempt: 1,
    }))
    expect(diagnostics).toHaveBeenCalledWith(expect.objectContaining({
      event: 'upload_put_retrying',
      status: 503,
      retryable: true,
      attempt: 2,
    }))
  })

  it('fails HTTP 4xx responses without retrying', async () => {
    const fetchFn = makeFetch([response(403)])
    const diagnostics = vi.fn()

    await expectUploadFailure(uploadFileToPresignedUrl({
      fileId: 'file-1',
      url: 'https://r2.example.test/signed-put-secret',
      file: csvFile(),
      fetchFn,
      diagnostics,
      delay: vi.fn(),
    }))

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(diagnostics).toHaveBeenCalledWith(expect.objectContaining({
      event: 'upload_put_failed',
      status: 403,
      retryable: false,
      attempt: 1,
      maxAttempts: 3,
    }))
  })

  it('fails after exhausting retryable attempts', async () => {
    const fetchFn = makeFetch([response(503), response(503), response(503)])
    const diagnostics = vi.fn()

    await expectUploadFailure(uploadFileToPresignedUrl({
      fileId: 'file-1',
      url: 'https://r2.example.test/signed-put-secret',
      file: csvFile(),
      fetchFn,
      diagnostics,
      delay: vi.fn(),
    }))

    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(diagnostics).toHaveBeenCalledWith(expect.objectContaining({
      event: 'upload_put_failed',
      status: 503,
      retryable: true,
      attempt: 3,
      maxAttempts: 3,
    }))
  })

  it('never includes the presigned URL in diagnostic payloads and ignores diagnostic failures', async () => {
    const fetchFn = makeFetch([new Error('timeout'), response(200)])
    const events: UploadPutDiagnosticEvent[] = []
    const diagnostics = vi.fn((event: UploadPutDiagnosticEvent) => {
      events.push(event)
      throw new Error('diagnostic sink down')
    })

    await uploadFileToPresignedUrl({
      fileId: 'file-1',
      url: 'https://r2.example.test/signed-put-secret',
      file: csvFile(),
      fetchFn,
      diagnostics,
      delay: vi.fn(),
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(diagnostics).toHaveBeenCalled()
    expect(diagnosticPayloads(events)).not.toContain('signed-put-secret')
    expect(diagnosticPayloads(events)).not.toContain('https://r2.example.test')
  })
})

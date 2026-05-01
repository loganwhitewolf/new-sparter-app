import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  createFileRecord: vi.fn(),
  getFileForUser: vi.fn(),
  markFileFailed: vi.fn(),
  markFileUploaded: vi.fn(),
  createPresignedPutUrl: vi.fn(),
  headObject: vi.fn(),
}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/files', () => ({
  buildUserImportObjectKey: (input: { userId: string; fileId: string; originalName: string }) => {
    const extension = input.originalName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''
    return `users/${encodeURIComponent(input.userId)}/imports/${input.fileId}${extension}`
  },
  createFileRecord: mocks.createFileRecord,
  getFileForUser: mocks.getFileForUser,
  markFileFailed: mocks.markFileFailed,
  markFileUploaded: mocks.markFileUploaded,
}))

vi.mock('@/lib/services/r2', () => ({
  createPresignedPutUrl: mocks.createPresignedPutUrl,
  headObject: mocks.headObject,
}))

vi.mock('@/lib/validations/import', async () => {
  const actual = await vi.importActual<typeof import('../lib/validations/import')>('../lib/validations/import')
  return actual
})

const { POST: initiateUpload } = await import('../app/api/files/initiate/route')
const { POST: confirmUpload } = await import('../app/api/files/confirm/route')

const userSession = {
  userId: 'user-1',
  email: 'user@example.test',
  subscriptionPlan: 'free' as const,
  role: 'user' as const,
}

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/files/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function fileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'user-1',
    importFormatVersionId: null,
    originalName: 'fineco.csv',
    objectKey: 'users/user-1/imports/11111111-1111-4111-8111-111111111111.csv',
    mimeType: 'text/csv',
    sizeBytes: 128,
    status: 'pending_upload',
    uploadedAt: null,
    analyzedAt: null,
    importStartedAt: null,
    importedAt: null,
    rowCount: 0,
    duplicateCount: 0,
    errorMessage: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('file import upload API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue(userSession)
    mocks.createFileRecord.mockImplementation(async (input: { id: string; originalName: string; objectKey: string; mimeType: string; sizeBytes: number }) =>
      fileRow({
        id: input.id,
        originalName: input.originalName,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      }),
    )
    mocks.createPresignedPutUrl.mockResolvedValue({ url: 'https://r2.example.test/signed-put', expiresIn: 600 })
    mocks.getFileForUser.mockResolvedValue(fileRow())
    mocks.headObject.mockResolvedValue({
      contentLength: 128,
      contentType: 'text/csv',
      eTag: 'etag-1',
      lastModified: new Date('2026-01-01T00:01:00.000Z'),
    })
    mocks.markFileFailed.mockResolvedValue(fileRow({ status: 'failed', errorMessage: 'failed' }))
    mocks.markFileUploaded.mockResolvedValue(fileRow({
      status: 'uploaded',
      uploadedAt: new Date('2026-01-01T00:02:00.000Z'),
    }))
  })

  it('rejects malformed initiate payloads before creating file rows or presigned URLs', async () => {
    const response = await initiateUpload(jsonRequest({ name: 'statement.pdf', size: 0, type: 'application/pdf' }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error.code).toBe('invalid_upload_request')
    expect(body.error.details.issues.length).toBeGreaterThanOrEqual(1)
    expect(mocks.createFileRecord).not.toHaveBeenCalled()
    expect(mocks.createPresignedPutUrl).not.toHaveBeenCalled()
  })

  it('returns unauthorized initiate responses without anonymous file rows', async () => {
    mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))

    const response = await initiateUpload(jsonRequest({ name: 'fineco.csv', size: 128, type: 'text/csv' }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('unauthorized')
    expect(mocks.createFileRecord).not.toHaveBeenCalled()
  })

  it('keeps R2 configuration failures non-secret and records file error state', async () => {
    mocks.createPresignedPutUrl.mockRejectedValueOnce(
      Object.assign(new Error('Upload storage is not configured. Please try again later.'), {
        code: 'r2_configuration_missing',
        status: 503,
      }),
    )

    const response = await initiateUpload(jsonRequest({ name: 'fineco.csv', size: 128, type: 'text/csv' }))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toEqual({
      code: 'r2_configuration_missing',
      message: 'Upload storage is not configured. Please try again later.',
    })
    expect(JSON.stringify(body)).not.toContain('ACCESS_KEY')
    expect(JSON.stringify(body)).not.toContain('signed-put')
    expect(mocks.markFileFailed).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      errorMessage: 'Upload storage is not configured. Please try again later.',
    }))
  })

  it('creates a user-scoped pending file row and returns a presigned PUT contract', async () => {
    const response = await initiateUpload(jsonRequest({ name: 'fineco.csv', size: 128, type: 'text/csv' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.createFileRecord).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      originalName: 'fineco.csv',
      objectKey: expect.stringMatching(/^users\/user-1\/imports\/.+\.csv$/),
      mimeType: 'text/csv',
      sizeBytes: 128,
    }))
    expect(mocks.createPresignedPutUrl).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'text/csv',
      contentLength: 128,
    }))
    expect(body.file).toMatchObject({
      originalName: 'fineco.csv',
      status: 'pending_upload',
      sizeBytes: 128,
      mimeType: 'text/csv',
    })
    expect(body.upload).toEqual({
      method: 'PUT',
      url: 'https://r2.example.test/signed-put',
      expiresIn: 600,
      headers: { 'Content-Type': 'text/csv' },
    })
  })

  it('treats cross-user or missing file ids as not found during confirm', async () => {
    mocks.getFileForUser.mockResolvedValueOnce(null)

    const response = await confirmUpload(jsonRequest({
      fileId: '11111111-1111-4111-8111-111111111111',
      contentType: 'text/csv',
    }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.code).toBe('file_not_found')
    expect(mocks.getFileForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      fileId: '11111111-1111-4111-8111-111111111111',
    })
    expect(mocks.headObject).not.toHaveBeenCalled()
  })

  it('rejects malformed confirm payloads before R2 HEAD', async () => {
    const response = await confirmUpload(jsonRequest({ fileId: 'not-a-uuid', contentType: 'text/csv' }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error.code).toBe('invalid_confirm_request')
    expect(mocks.getFileForUser).not.toHaveBeenCalled()
    expect(mocks.headObject).not.toHaveBeenCalled()
  })

  it('marks the file failed when R2 HEAD cannot verify the object', async () => {
    mocks.headObject.mockRejectedValueOnce(
      Object.assign(new Error('Uploaded object was not found. Please upload again.'), {
        code: 'r2_object_not_found',
        status: 404,
      }),
    )

    const response = await confirmUpload(jsonRequest({
      fileId: '11111111-1111-4111-8111-111111111111',
      contentType: 'text/csv',
    }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.code).toBe('r2_object_not_found')
    expect(mocks.markFileFailed).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      fileId: '11111111-1111-4111-8111-111111111111',
      errorMessage: 'Uploaded object was not found. Please upload again.',
    }))
  })

  it('treats missing R2 object metadata as confirm failure', async () => {
    mocks.headObject.mockResolvedValueOnce({ contentLength: null, contentType: 'text/csv', eTag: null, lastModified: null })

    const response = await confirmUpload(jsonRequest({
      fileId: '11111111-1111-4111-8111-111111111111',
      contentType: 'text/csv',
    }))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error.code).toBe('invalid_upload_metadata')
    expect(mocks.markFileFailed).toHaveBeenCalledWith(expect.objectContaining({
      errorMessage: 'Uploaded object metadata was incomplete.',
    }))
  })

  it('confirms a matching upload and preserves pending metadata until later processing', async () => {
    const response = await confirmUpload(jsonRequest({
      fileId: '11111111-1111-4111-8111-111111111111',
      contentType: 'text/csv',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.headObject).toHaveBeenCalledWith('users/user-1/imports/11111111-1111-4111-8111-111111111111.csv')
    expect(mocks.markFileUploaded).toHaveBeenCalledWith({
      userId: 'user-1',
      fileId: '11111111-1111-4111-8111-111111111111',
    })
    expect(body.file).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      originalName: 'fineco.csv',
      status: 'uploaded',
      uploadedAt: '2026-01-01T00:02:00.000Z',
      rowCount: 0,
      duplicateCount: 0,
      errorMessage: null,
    })
  })
})

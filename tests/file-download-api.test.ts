import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileRow } from '@/lib/dal/files'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getFileForUser: vi.fn(),
  createPresignedGetUrl: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/files', () => ({
  getFileForUser: mocks.getFileForUser,
}))

vi.mock('@/lib/services/r2', () => ({
  createPresignedGetUrl: mocks.createPresignedGetUrl,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
  },
  withLogContext: (_context: unknown, callback: () => unknown) => callback(),
}))

const { GET } = await import('@/app/api/files/[fileId]/download/route')

function makeFile(overrides: Partial<FileRow> = {}): FileRow {
  return {
    id: 'file-1',
    userId: 'user-1',
    originalName: 'estratto.csv',
    displayName: 'Estratto Gennaio',
    contentHash: 'hash-1',
    objectKey: 'users/user-1/imports/file-1.csv',
    mimeType: 'text/csv',
    sizeBytes: 128,
    status: 'imported',
    rowCount: 10,
    importedCount: 10,
    duplicateCount: 0,
    positiveTotal: '0.00',
    negativeTotal: '100.00',
    referenceStartedAt: null,
    referenceEndedAt: null,
    importFormatVersionId: 1,
    errorMessage: null,
    importedAt: new Date('2026-01-01T00:00:00.000Z'),
    uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('GET /api/files/[fileId]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
    mocks.getFileForUser.mockResolvedValue(makeFile())
    mocks.createPresignedGetUrl.mockResolvedValue({
      url: 'https://r2.example.test/object.csv?signature=secret',
      expiresIn: 600,
    })
  })

  it('returns a presigned download URL scoped to the authenticated user file', async () => {
    const response = await GET(new Request('http://localhost/api/files/file-1/download'), {
      params: Promise.resolve({ fileId: 'file-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      download: {
        url: 'https://r2.example.test/object.csv?signature=secret',
        expiresIn: 600,
        filename: 'Estratto Gennaio',
      },
    })
    expect(mocks.getFileForUser).toHaveBeenCalledWith({ userId: 'user-1', fileId: 'file-1' })
    expect(mocks.createPresignedGetUrl).toHaveBeenCalledWith({
      objectKey: 'users/user-1/imports/file-1.csv',
      downloadFilename: 'Estratto Gennaio',
    })
    expect(JSON.stringify(mocks.loggerInfo.mock.calls)).not.toContain('signature=secret')
  })

  it('rejects pending uploads before presigning', async () => {
    mocks.getFileForUser.mockResolvedValue(makeFile({ status: 'pending_upload' }))

    const response = await GET(new Request('http://localhost/api/files/file-1/download'), {
      params: Promise.resolve({ fileId: 'file-1' }),
    })

    expect(response.status).toBe(409)
    expect(mocks.createPresignedGetUrl).not.toHaveBeenCalled()
  })

  it('returns 404 when the file does not belong to the user', async () => {
    mocks.getFileForUser.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/api/files/file-1/download'), {
      params: Promise.resolve({ fileId: 'file-1' }),
    })

    expect(response.status).toBe(404)
    expect(mocks.createPresignedGetUrl).not.toHaveBeenCalled()
  })
})

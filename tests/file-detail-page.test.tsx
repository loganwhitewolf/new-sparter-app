import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// ---------------------------------------------------------------------------
// /import/[fileId] RSC page — ownership gate + status-based redirect
// ---------------------------------------------------------------------------

const pageMocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getFileDetailForUser: vi.fn(),
  getTransactionsByFileId: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('notFound')
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: pageMocks.notFound,
  redirect: pageMocks.redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: pageMocks.verifySession,
}))

vi.mock('@/lib/dal/files', () => ({
  getFileDetailForUser: pageMocks.getFileDetailForUser,
}))

vi.mock('@/lib/dal/transactions', () => ({
  getTransactionsByFileId: pageMocks.getTransactionsByFileId,
}))

vi.mock('@/components/import/file-detail-client', () => ({
  FileDetailClient: (props: { file: { id: string }; transactions: unknown[] }) =>
    createElement('div', { 'data-testid': 'file-detail-client' }, props.file.id),
}))

const USER_ID = 'user-1'
const FILE_ID = '11111111-1111-4111-8111-111111111111'
const NON_OWNED_ID = '22222222-2222-4222-8222-222222222222'

function makeFileDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: FILE_ID,
    userId: USER_ID,
    importFormatVersionId: 1,
    originalName: 'estratto_conto.csv',
    displayName: null,
    contentHash: 'hash-1',
    objectKey: 'users/user-1/imports/file-1.csv',
    mimeType: 'text/csv',
    sizeBytes: 1024,
    status: 'imported' as const,
    uploadedAt: new Date('2026-03-01T00:00:00.000Z'),
    analyzedAt: new Date('2026-03-01T00:01:00.000Z'),
    importStartedAt: new Date('2026-03-01T00:02:00.000Z'),
    importedAt: new Date('2026-03-01T00:03:00.000Z'),
    rowCount: 42,
    importedCount: 40,
    duplicateCount: 2,
    positiveTotal: '120.00',
    negativeTotal: '-980.50',
    referenceStartedAt: new Date('2026-02-01T00:00:00.000Z'),
    referenceEndedAt: new Date('2026-02-28T00:00:00.000Z'),
    errorMessage: null,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:03:00.000Z'),
    platformName: 'Intesa SP',
    ...overrides,
  }
}

async function renderFileDetailPage(fileId = FILE_ID) {
  const { default: FileDetailPage } = await import('../app/(app)/import/[fileId]/page')
  const element = await FileDetailPage({ params: Promise.resolve({ fileId }) })
  return renderToStaticMarkup(createElement(() => element))
}

describe('/import/[fileId] page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pageMocks.notFound.mockImplementation(() => {
      throw new Error('notFound')
    })
    pageMocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`)
    })

    pageMocks.verifySession.mockResolvedValue({ userId: USER_ID })
    pageMocks.getFileDetailForUser.mockResolvedValue(makeFileDetailRow())
    pageMocks.getTransactionsByFileId.mockResolvedValue([])
  })

  it('renders FileDetailClient for an imported, owned file', async () => {
    const html = await renderFileDetailPage()

    expect(html).toContain('file-detail-client')
    expect(html).toContain(FILE_ID)
  })

  it('calls notFound() when getFileDetailForUser resolves null (non-existent or non-owned file)', async () => {
    pageMocks.getFileDetailForUser.mockResolvedValue(null)

    await expect(renderFileDetailPage(NON_OWNED_ID)).rejects.toThrow('notFound')
    expect(pageMocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('calls notFound() when file.status is failed', async () => {
    pageMocks.getFileDetailForUser.mockResolvedValue(makeFileDetailRow({ status: 'failed' }))

    await expect(renderFileDetailPage()).rejects.toThrow('notFound')
    expect(pageMocks.notFound).toHaveBeenCalledTimes(1)
  })

  it.each(['uploaded', 'analyzing', 'analyzed', 'importing'])(
    'redirects to /import/{fileId}/analyze for status=%s',
    async (status) => {
      pageMocks.getFileDetailForUser.mockResolvedValue(makeFileDetailRow({ status }))

      await expect(renderFileDetailPage()).rejects.toThrow(`redirect:/import/${FILE_ID}/analyze`)
      expect(pageMocks.redirect).toHaveBeenCalledWith(`/import/${FILE_ID}/analyze`)
    },
  )

  it('redirects to APP_ROUTES.import for status=pending_upload (defensive fallback)', async () => {
    pageMocks.getFileDetailForUser.mockResolvedValue(makeFileDetailRow({ status: 'pending_upload' }))

    await expect(renderFileDetailPage()).rejects.toThrow('redirect:/import')
    expect(pageMocks.redirect).toHaveBeenCalledWith('/import')
  })

  it('makes exactly one call to getFileDetailForUser and one call to getTransactionsByFileId for an imported file', async () => {
    await renderFileDetailPage()

    expect(pageMocks.getFileDetailForUser).toHaveBeenCalledTimes(1)
    expect(pageMocks.getFileDetailForUser).toHaveBeenCalledWith({ userId: USER_ID, fileId: FILE_ID })
    expect(pageMocks.getTransactionsByFileId).toHaveBeenCalledTimes(1)
    expect(pageMocks.getTransactionsByFileId).toHaveBeenCalledWith({ userId: USER_ID, fileId: FILE_ID })
  })

  it('does not call getTransactionsByFileId when the file is not imported', async () => {
    pageMocks.getFileDetailForUser.mockResolvedValue(makeFileDetailRow({ status: 'analyzed' }))

    await expect(renderFileDetailPage()).rejects.toThrow('redirect:')
    expect(pageMocks.getTransactionsByFileId).not.toHaveBeenCalled()
  })
})

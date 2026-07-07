import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any module imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  dbSelectChain: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    // Bypass React's request-scoped memoization so repeated calls within a
    // single test actually hit the mocked db chain again.
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  }
})

// String-keyed column stand-ins mirror tests/transaction-detail-dal.test.ts.
vi.mock('@/lib/db/schema', () => ({
  file: {
    id: 'file.id',
    userId: 'file.userId',
    importFormatVersionId: 'file.importFormatVersionId',
    originalName: 'file.originalName',
    displayName: 'file.displayName',
    contentHash: 'file.contentHash',
    objectKey: 'file.objectKey',
    mimeType: 'file.mimeType',
    sizeBytes: 'file.sizeBytes',
    status: 'file.status',
    uploadedAt: 'file.uploadedAt',
    analyzedAt: 'file.analyzedAt',
    importStartedAt: 'file.importStartedAt',
    importedAt: 'file.importedAt',
    rowCount: 'file.rowCount',
    importedCount: 'file.importedCount',
    duplicateCount: 'file.duplicateCount',
    positiveTotal: 'file.positiveTotal',
    negativeTotal: 'file.negativeTotal',
    referenceStartedAt: 'file.referenceStartedAt',
    referenceEndedAt: 'file.referenceEndedAt',
    errorMessage: 'file.errorMessage',
    createdAt: 'file.createdAt',
    updatedAt: 'file.updatedAt',
  },
  importFormatVersion: {
    id: 'importFormatVersion.id',
    platformId: 'importFormatVersion.platformId',
  },
  platform: {
    id: 'platform.id',
    name: 'platform.name',
    slug: 'platform.slug',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  isNotNull: (col: unknown) => ({ op: 'isNotNull', col }),
}))

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  }
  return chain
}

vi.mock('@/lib/db', () => {
  const db: Record<string, unknown> = {
    select: vi.fn(() => mocks.dbSelectChain()),
  }
  return { db }
})

const { getFileDetailForUser } = await import('@/lib/dal/files')

function makeFileDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'file-1',
    userId: 'user-1',
    importFormatVersionId: 3,
    originalName: 'estratto-conto.csv',
    displayName: null,
    contentHash: 'hash-1',
    objectKey: 'users/user-1/imports/file-1.csv',
    mimeType: 'text/csv',
    sizeBytes: 1024,
    status: 'imported',
    uploadedAt: new Date('2026-01-01'),
    analyzedAt: new Date('2026-01-01'),
    importStartedAt: new Date('2026-01-01'),
    importedAt: new Date('2026-01-01'),
    rowCount: 10,
    importedCount: 10,
    duplicateCount: 0,
    positiveTotal: '0.00',
    negativeTotal: '-100.00',
    referenceStartedAt: null,
    referenceEndedAt: null,
    errorMessage: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    platformName: 'Intesa SP',
    ...overrides,
  }
}

describe('getFileDetailForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the full file row plus platformName when owned by the user', async () => {
    const row = makeFileDetailRow()
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([row]))

    const result = await getFileDetailForUser({ userId: 'user-1', fileId: 'file-1' })

    expect(result).toEqual(row)
  })

  it('resolves platformName to null when the file has no importFormatVersionId', async () => {
    const row = makeFileDetailRow({ importFormatVersionId: null, platformName: null })
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([row]))

    const result = await getFileDetailForUser({ userId: 'user-1', fileId: 'file-1' })

    expect(result?.platformName).toBeNull()
  })

  it('returns null for a non-existent fileId, without throwing', async () => {
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([]))

    await expect(
      getFileDetailForUser({ userId: 'user-1', fileId: 'file-missing' }),
    ).resolves.toBeNull()
  })

  it('returns null when the file belongs to a different user, without throwing', async () => {
    mocks.dbSelectChain.mockReturnValue(makeSelectChain([]))

    await expect(
      getFileDetailForUser({ userId: 'user-OTHER', fileId: 'file-1' }),
    ).resolves.toBeNull()
  })

  it('scopes the query WHERE to both fileId and userId (ownership guard present)', async () => {
    const chain = makeSelectChain([makeFileDetailRow()])
    mocks.dbSelectChain.mockReturnValue(chain)

    await getFileDetailForUser({ userId: 'user-1', fileId: 'file-1' })

    expect(chain.where).toHaveBeenCalledTimes(1)
    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      op: string
      args: Array<{ op: string; left: unknown; right: unknown }>
    }
    expect(whereArg.op).toBe('and')
    const conditions = whereArg.args
    expect(
      conditions.some((c) => c.op === 'eq' && c.left === 'file.id' && c.right === 'file-1'),
    ).toBe(true)
    expect(
      conditions.some((c) => c.op === 'eq' && c.left === 'file.userId' && c.right === 'user-1'),
    ).toBe(true)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  selectedShapes: [] as unknown[],
  fromArgs: [] as unknown[],
  leftJoinArgs: [] as unknown[],
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[][],
  limitArgs: [] as number[],
  queryResult: [] as unknown[],
}))

function makeQueryChain() {
  const chain = {
    from: vi.fn((arg: unknown) => {
      mocks.fromArgs.push(arg)
      return chain
    }),
    leftJoin: vi.fn((table: unknown, condition: unknown) => {
      mocks.leftJoinArgs.push({ table, condition })
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return chain
    }),
    orderBy: vi.fn((...args: unknown[]) => {
      mocks.orderByArgs.push(args)
      return chain
    }),
    limit: vi.fn((arg: number) => {
      mocks.limitArgs.push(arg)
      return Promise.resolve(mocks.queryResult)
    }),
  }

  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/db', () => ({
  db: {
    select: (shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return makeQueryChain()
    },
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  desc: (column: unknown) => ({ op: 'desc', column }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: 'sql',
    strings: Array.from(strings),
    values,
  }),
}))
vi.mock('@/lib/db/schema', () => ({
  file: {
    id: 'file.id',
    userId: 'file.userId',
    importFormatVersionId: 'file.importFormatVersionId',
    originalName: 'file.originalName',
    displayName: 'file.displayName',
    objectKey: 'file.objectKey',
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

const {
  IMPORT_LIST_LIMIT,
  getImportRows,
  getImports,
  importListOrderTimestamp,
  importListSelect,
} = await import('../lib/dal/imports')

describe('imports DAL read model', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.fromArgs.length = 0
    mocks.leftJoinArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.limitArgs.length = 0
    mocks.queryResult = []
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it('exposes the bounded import list contract without sensitive storage fields', () => {
    expect(IMPORT_LIST_LIMIT).toBe(50)
    expect(importListSelect).toEqual({
      id: 'file.id',
      displayName: 'file.displayName',
      originalName: 'file.originalName',
      status: 'file.status',
      platformId: 'platform.id',
      platformName: 'platform.name',
      platformSlug: 'platform.slug',
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
    })
    expect(Object.keys(importListSelect)).not.toEqual(expect.arrayContaining([
      'objectKey',
      'mimeType',
      'sizeBytes',
      'userId',
    ]))
  })

  it('verifies the session internally, scopes rows to the current user, preserves missing metadata with left joins, and applies a hard limit', async () => {
    await getImportRows()

    expect(mocks.verifySession).toHaveBeenCalledTimes(1)
    expect(mocks.selectedShapes[0]).toBe(importListSelect)
    expect(mocks.fromArgs[0]).toMatchObject({ id: 'file.id', userId: 'file.userId' })
    expect(mocks.leftJoinArgs).toEqual([
      {
        table: { id: 'importFormatVersion.id', platformId: 'importFormatVersion.platformId' },
        condition: { op: 'eq', left: 'file.importFormatVersionId', right: 'importFormatVersion.id' },
      },
      {
        table: { id: 'platform.id', name: 'platform.name', slug: 'platform.slug' },
        condition: { op: 'eq', left: 'importFormatVersion.platformId', right: 'platform.id' },
      },
    ])
    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: [{ op: 'eq', left: 'file.userId', right: 'user-1' }],
    })
    expect(mocks.limitArgs).toEqual([IMPORT_LIST_LIMIT])
  })

  it('orders newest imports first using imported, uploaded, then created timestamps', async () => {
    expect(importListOrderTimestamp).toEqual({
      op: 'sql',
      strings: ['coalesce(', ', ', ', ', ')'],
      values: ['file.importedAt', 'file.uploadedAt', 'file.createdAt'],
    })

    await getImports()

    expect(mocks.orderByArgs[0]).toEqual([
      { op: 'desc', column: importListOrderTimestamp },
      { op: 'desc', column: 'file.createdAt' },
    ])
  })

  it('fails closed when there is no session and does not query imports anonymously', async () => {
    mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))

    await expect(getImportRows()).rejects.toThrow('NEXT_REDIRECT')

    expect(mocks.selectedShapes).toEqual([])
  })

  it('returns failed and metadata-less rows with nullable platform fields and a bounded error message', async () => {
    const boundedError = 'Parser could not detect platform'.padEnd(500, '.')
    mocks.queryResult = [
      {
        id: 'file-1',
        displayName: null,
        originalName: 'unknown.csv',
        status: 'failed',
        platformId: null,
        platformName: null,
        platformSlug: null,
        uploadedAt: new Date('2026-01-02T00:00:00.000Z'),
        analyzedAt: null,
        importStartedAt: null,
        importedAt: null,
        rowCount: 10,
        importedCount: 0,
        duplicateCount: 0,
        positiveTotal: '0.00',
        negativeTotal: '0.00',
        referenceStartedAt: null,
        referenceEndedAt: null,
        errorMessage: boundedError,
      },
    ]

    await expect(getImportRows()).resolves.toEqual(mocks.queryResult)
  })

  it('does not expose another user selector or sensitive object keys/raw diagnostics in returned rows', async () => {
    mocks.queryResult = [
      {
        id: 'file-1',
        displayName: 'January import',
        originalName: 'fineco.csv',
        status: 'imported',
        platformId: 1,
        platformName: 'Fineco',
        platformSlug: 'fineco',
        uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
        analyzedAt: new Date('2026-01-01T00:01:00.000Z'),
        importStartedAt: new Date('2026-01-01T00:02:00.000Z'),
        importedAt: new Date('2026-01-01T00:03:00.000Z'),
        rowCount: 100,
        importedCount: 95,
        duplicateCount: 5,
        positiveTotal: '1000.00',
        negativeTotal: '250.00',
        referenceStartedAt: new Date('2025-12-01T00:00:00.000Z'),
        referenceEndedAt: new Date('2025-12-31T00:00:00.000Z'),
        errorMessage: null,
      },
    ]

    const rows = await getImportRows()
    const serialized = JSON.stringify(rows)

    expect(getImportRows).toHaveLength(0)
    expect(serialized).not.toContain('users/user-1/imports')
    expect(serialized).not.toContain('objectKey')
    expect(serialized).not.toContain('rawRow')
    expect(serialized).not.toContain('stack')
  })
})

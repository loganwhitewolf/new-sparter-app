import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  selectedShapes: [] as unknown[],
  fromArgs: [] as unknown[],
  leftJoinArgs: [] as unknown[],
  innerJoinArgs: [] as unknown[],
  whereArgs: [] as unknown[],
  orderByArgs: [] as unknown[][],
  limitArgs: [] as number[],
  offsetArgs: [] as number[],
  queryResult: [] as unknown[],
  fileCoveredMonthsResult: [] as unknown[],
  updateTables: [] as unknown[],
  setArgs: [] as unknown[],
  updateWhereArgs: [] as unknown[],
  returningArgs: [] as unknown[],
  updateResult: [] as unknown[],
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
    innerJoin: vi.fn((table: unknown, condition: unknown) => {
      mocks.innerJoinArgs.push({ table, condition })
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
      return chain
    }),
    offset: vi.fn((arg: number) => {
      mocks.offsetArgs.push(arg)
      return Promise.resolve(mocks.queryResult)
    }),
  }

  return chain
}

// makeWhereTerminalChain: terminates at .where() for DAL functions without limit/offset
function makeWhereTerminalChain(finalValue: unknown[]) {
  const chain = {
    from: vi.fn((arg: unknown) => {
      mocks.fromArgs.push(arg)
      return chain
    }),
    leftJoin: vi.fn((table: unknown, condition: unknown) => {
      mocks.leftJoinArgs.push({ table, condition })
      return chain
    }),
    innerJoin: vi.fn((table: unknown, condition: unknown) => {
      mocks.innerJoinArgs.push({ table, condition })
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return Promise.resolve(finalValue)
    }),
  }
  return chain
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn((arg: unknown) => {
      mocks.setArgs.push(arg)
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.updateWhereArgs.push(arg)
      return chain
    }),
    returning: vi.fn((arg?: unknown) => {
      mocks.returningArgs.push(arg)
      return Promise.resolve(mocks.updateResult)
    }),
  }

  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: mocks.verifySession }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return makeQueryChain()
    }),
    update: (table: unknown) => {
      mocks.updateTables.push(table)
      return makeUpdateChain()
    },
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  asc: (column: unknown) => ({ op: 'asc', column }),
  desc: (column: unknown) => ({ op: 'desc', column }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  gte: (left: unknown, right: unknown) => ({ op: 'gte', left, right }),
  ilike: (left: unknown, right: unknown) => ({ op: 'ilike', left, right }),
  inArray: (left: unknown, right: unknown) => ({ op: 'inArray', left, right }),
  lte: (left: unknown, right: unknown) => ({ op: 'lte', left, right }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
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
  transaction: {
    id: 'transaction.id',
    userId: 'transaction.userId',
    fileId: 'transaction.fileId',
    occurredAt: 'transaction.occurredAt',
  },
}))

const {
  IMPORT_LIST_LIMIT,
  getImportRows,
  getImports,
  importListOrderTimestamp,
  importListSelect,
  updateImportDisplayName,
  getFileCoveredMonths,
  importNegativeTotalAbsSortKey,
  importPositiveTotalAbsSortKey,
  importPlatformMissingBucket,
  importPlatformSortKey,
  importStatusSortKey,
  importDisplayNameSortKey,
  importReferencePeriodSortKey,
  getImportSortColumn,
  buildImportOrderBy,
} = await import('../lib/dal/imports')

describe('imports DAL read model', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.fromArgs.length = 0
    mocks.leftJoinArgs.length = 0
    mocks.innerJoinArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.orderByArgs.length = 0
    mocks.limitArgs.length = 0
    mocks.offsetArgs.length = 0
    mocks.updateTables.length = 0
    mocks.setArgs.length = 0
    mocks.updateWhereArgs.length = 0
    mocks.returningArgs.length = 0
    mocks.queryResult = []
    mocks.fileCoveredMonthsResult = []
    mocks.updateResult = []
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
    expect(mocks.offsetArgs).toEqual([0])
  })

  it('scopes imports to a single file when fileId filter is set', async () => {
    const fileId = '11111111-1111-4111-8111-111111111111'
    await getImportRows({ fileId })

    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: [
        { op: 'eq', left: 'file.userId', right: 'user-1' },
        { op: 'eq', left: 'file.id', right: fileId },
      ],
    })
  })

  it('orders newest imports first using imported, uploaded, then created timestamps, with file.id as tiebreaker', async () => {
    expect(importListOrderTimestamp).toEqual({
      op: 'sql',
      strings: ['coalesce(', ', ', ', ', ')'],
      values: ['file.importedAt', 'file.uploadedAt', 'file.createdAt'],
    })

    await getImports()

    expect(mocks.orderByArgs[0]).toEqual([
      { op: 'desc', column: importListOrderTimestamp },
      { op: 'desc', column: 'file.id' },
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

  it('maps sort keys to DAL columns and expressions', () => {
    expect(getImportSortColumn('displayName')).toBe(importDisplayNameSortKey)
    expect(getImportSortColumn('importedAt')).toBe(importListOrderTimestamp)
    expect(getImportSortColumn('platform')).toBe(importPlatformSortKey)
    expect(getImportSortColumn('rowCount')).toBe('file.rowCount')
    expect(getImportSortColumn('positiveTotal')).toBe(importPositiveTotalAbsSortKey)
    expect(getImportSortColumn('negativeTotal')).toBe(importNegativeTotalAbsSortKey)
    expect(getImportSortColumn('referenceStartedAt')).toBe(importReferencePeriodSortKey)
    expect(getImportSortColumn('status')).toBe(importStatusSortKey)
  })

  it('builds orderBy clauses with ABS on negativeTotal for amount sort and ties on id', () => {
    const ascOrder = buildImportOrderBy({ sort: 'negativeTotal', dir: 'asc' })
    const descOrder = buildImportOrderBy({ sort: 'negativeTotal', dir: 'desc' })

    expect(ascOrder[0]).toEqual({ op: 'asc', column: importNegativeTotalAbsSortKey })
    expect(ascOrder[1]).toEqual({ op: 'asc', column: 'file.id' })
    expect(descOrder[0]).toEqual({ op: 'desc', column: importNegativeTotalAbsSortKey })
    expect(descOrder[1]).toEqual({ op: 'desc', column: 'file.id' })
  })

  it('orders platform sort with missing platform rows last in both directions', () => {
    const ascOrder = buildImportOrderBy({ sort: 'platform', dir: 'asc' })
    const descOrder = buildImportOrderBy({ sort: 'platform', dir: 'desc' })

    expect(ascOrder).toEqual([
      { op: 'asc', column: importPlatformMissingBucket },
      { op: 'asc', column: importPlatformSortKey },
      { op: 'asc', column: 'file.id' },
    ])
    expect(descOrder).toEqual([
      { op: 'asc', column: importPlatformMissingBucket },
      { op: 'desc', column: importPlatformSortKey },
      { op: 'desc', column: 'file.id' },
    ])
  })

  it('applies parsed sort and dir from filters to orderBy', async () => {
    await getImportRows({ sort: 'displayName', dir: 'asc' })

    expect(mocks.orderByArgs[0]).toEqual([
      { op: 'asc', column: importDisplayNameSortKey },
      { op: 'asc', column: 'file.id' },
    ])
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

  it('applies validated search, imported date filters, reference overlap filters, and explicit pagination', async () => {
    await getImportRows(
      {
        q: 'January Import',
        importedFromDate: new Date('2026-01-01T00:00:00.000Z'),
        importedToDate: new Date('2026-01-31T23:59:59.999Z'),
        referenceFromDate: new Date('2025-12-01T00:00:00.000Z'),
        referenceToDate: new Date('2025-12-31T23:59:59.999Z'),
      },
      { limit: 25, offset: 75 },
    )

    expect(mocks.limitArgs).toEqual([25])
    expect(mocks.offsetArgs).toEqual([75])
    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: expect.arrayContaining([
        { op: 'eq', left: 'file.userId', right: 'user-1' },
        {
          op: 'or',
          args: [
            { op: 'ilike', left: 'file.displayName', right: '%January Import%' },
            { op: 'ilike', left: 'file.originalName', right: '%January Import%' },
          ],
        },
        { op: 'gte', left: 'file.importedAt', right: new Date('2026-01-01T00:00:00.000Z') },
        { op: 'lte', left: 'file.importedAt', right: new Date('2026-01-31T23:59:59.999Z') },
        { op: 'lte', left: 'file.referenceStartedAt', right: new Date('2025-12-31T23:59:59.999Z') },
        { op: 'gte', left: 'file.referenceEndedAt', right: new Date('2025-12-01T00:00:00.000Z') },
      ]),
    })
  })

  it('keeps partial reference ranges bounded to overlap semantics', async () => {
    await getImportRows({ referenceFromDate: new Date('2026-02-01T00:00:00.000Z') })

    expect(mocks.whereArgs[0]).toEqual({
      op: 'and',
      args: expect.arrayContaining([
        { op: 'eq', left: 'file.userId', right: 'user-1' },
        { op: 'gte', left: 'file.referenceEndedAt', right: new Date('2026-02-01T00:00:00.000Z') },
      ]),
    })
  })

  it('updates an import display name through a file-id and user-id scoped write without exposing storage fields', async () => {
    const updatedRow = {
      id: 'file-1',
      displayName: 'January import',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    mocks.updateResult = [updatedRow]

    await expect(
      updateImportDisplayName(undefined, {
        userId: 'user-1',
        fileId: 'file-1',
        displayName: '  January import  ',
      }),
    ).resolves.toBe(updatedRow)

    expect(mocks.updateTables[0]).toMatchObject({ id: 'file.id', userId: 'file.userId' })
    expect(mocks.setArgs[0]).toEqual({
      displayName: 'January import',
      updatedAt: expect.any(Date),
    })
    expect(mocks.updateWhereArgs[0]).toEqual({
      op: 'and',
      args: [
        { op: 'eq', left: 'file.id', right: 'file-1' },
        { op: 'eq', left: 'file.userId', right: 'user-1' },
      ],
    })
    expect(mocks.returningArgs[0]).toEqual({
      id: 'file.id',
      displayName: 'file.displayName',
      updatedAt: 'file.updatedAt',
    })
    expect(JSON.stringify(mocks.returningArgs[0])).not.toContain('objectKey')
  })

  it('normalizes blank rename values to null and returns null for non-owned file ids', async () => {
    mocks.updateResult = []

    await expect(
      updateImportDisplayName(undefined, {
        userId: 'user-1',
        fileId: 'file-from-user-2',
        displayName: '   ',
      }),
    ).resolves.toBeNull()

    expect(mocks.setArgs[0]).toEqual({
      displayName: null,
      updatedAt: expect.any(Date),
    })
    expect(mocks.updateWhereArgs[0]).toEqual({
      op: 'and',
      args: [
        { op: 'eq', left: 'file.id', right: 'file-from-user-2' },
        { op: 'eq', left: 'file.userId', right: 'user-1' },
      ],
    })
  })

  // ── Wave 4: statusBucket 3-bucket processing filter (D-22) ─────────────────

  it("statusBucket 'imported' adds eq(file.status, 'imported')", async () => {
    await getImportRows({ statusBucket: 'imported' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toEqual(
      expect.arrayContaining([
        { op: 'eq', left: 'file.status', right: 'imported' },
      ]),
    )
  })

  it("statusBucket 'pending' adds inArray(file.status, all transient states)", async () => {
    await getImportRows({ statusBucket: 'pending' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const inArrayCondition = where.args.find(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'inArray',
    ) as { op: string; left: string; right: string[] } | undefined

    expect(inArrayCondition).toBeDefined()
    expect(inArrayCondition!.left).toBe('file.status')
    // Must include at minimum uploaded, analyzed, and pending_upload
    expect(inArrayCondition!.right).toEqual(
      expect.arrayContaining(['uploaded', 'analyzed', 'pending_upload']),
    )
    // Must NOT include 'imported' or 'failed'
    expect(inArrayCondition!.right).not.toContain('imported')
    expect(inArrayCondition!.right).not.toContain('failed')
  })

  it("statusBucket 'failed' adds eq(file.status, 'failed')", async () => {
    await getImportRows({ statusBucket: 'failed' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.args).toEqual(
      expect.arrayContaining([
        { op: 'eq', left: 'file.status', right: 'failed' },
      ]),
    )
  })

  // ── Wave 4: coverage months via referenceStartedAt TO_CHAR ─────────────────

  it('months filter adds OR(TO_CHAR(referenceStartedAt, YYYY-MM) = ym)', async () => {
    await getImportRows({ months: ['2026-04', '2026-05'] })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const monthsCondition = where.args.find(
      (arg) => {
        if (typeof arg !== 'object' || arg === null) return false
        const a = arg as { op?: string; args?: unknown[] }
        if (a.op !== 'or' || !Array.isArray(a.args)) return false
        return a.args.every(
          (inner) =>
            typeof inner === 'object' &&
            inner !== null &&
            (inner as { op?: string }).op === 'sql',
        )
      },
    ) as { op: string; args: { op: string; strings: string[]; values: unknown[] }[] } | undefined

    expect(monthsCondition).toBeDefined()
    expect(monthsCondition!.args).toHaveLength(2)
    // Each arg is a sql template node with YYYY-MM
    const sqlText = monthsCondition!.args[0].strings.join('')
    expect(sqlText).toContain('YYYY-MM')
    expect(monthsCondition!.args[0].values).toContain('2026-04')
    expect(monthsCondition!.args[1].values).toContain('2026-05')
  })

  // ── Wave 4: amount ABS on negativeTotal ────────────────────────────────────

  it('amountMin adds ABS(negativeTotal::numeric) >= amountMin::numeric condition', async () => {
    await getImportRows({ amountMin: '100' })

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    const amountCondition = where.args.find(
      (arg) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { op?: string }).op === 'sql' &&
        ((arg as { strings?: string[] }).strings ?? []).join('').includes('ABS'),
    ) as { op: string; strings: string[]; values: unknown[] } | undefined

    expect(amountCondition).toBeDefined()
    expect(amountCondition!.strings.join('')).toContain('>=')
    expect(amountCondition!.values).toContain('100')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getFileCoveredMonths — R-OB-10 / D-10
// ─────────────────────────────────────────────────────────────────────────────

describe('getFileCoveredMonths (R-OB-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedShapes.length = 0
    mocks.fromArgs.length = 0
    mocks.leftJoinArgs.length = 0
    mocks.innerJoinArgs.length = 0
    mocks.whereArgs.length = 0
    mocks.fileCoveredMonthsResult = []
    mocks.verifySession.mockResolvedValue({ userId: 'user-1' })
  })

  it("executes a query with DATE_TRUNC('month', MIN(transaction.occurredAt)) and DATE_TRUNC('month', MAX(transaction.occurredAt)) (R-OB-10)", async () => {
    const { db } = await import('@/lib/db')
    const terminalChain = makeWhereTerminalChain([{ firstMonth: null, lastMonth: null }])
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementationOnce((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return terminalChain
    })

    await getFileCoveredMonths('file-1', 'user-1')

    const shape = mocks.selectedShapes[0] as Record<string, { op: string; strings: string[] }>
    // firstMonth SQL fragment must include date_trunc and min
    expect(shape.firstMonth.op).toBe('sql')
    const firstSql = shape.firstMonth.strings.join('').toLowerCase()
    expect(firstSql).toContain('date_trunc')
    expect(firstSql).toContain('min')
    // lastMonth SQL fragment must include date_trunc and max
    expect(shape.lastMonth.op).toBe('sql')
    const lastSql = shape.lastMonth.strings.join('').toLowerCase()
    expect(lastSql).toContain('date_trunc')
    expect(lastSql).toContain('max')
  })

  it('filters by transaction.fileId AND file.userId (ownership) (R-OB-10)', async () => {
    const { db } = await import('@/lib/db')
    const terminalChain = makeWhereTerminalChain([{ firstMonth: null, lastMonth: null }])
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementationOnce((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return terminalChain
    })

    await getFileCoveredMonths('file-abc', 'user-xyz')

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.op).toBe('and')
    expect(where.args).toEqual(
      expect.arrayContaining([
        { op: 'eq', left: 'transaction.fileId', right: 'file-abc' },
        { op: 'eq', left: 'file.userId', right: 'user-xyz' },
      ]),
    )
  })

  it('returns null when MIN(occurredAt) is null (no transactions for this file) (R-OB-10)', async () => {
    const { db } = await import('@/lib/db')
    const terminalChain = makeWhereTerminalChain([{ firstMonth: null, lastMonth: null }])
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementationOnce((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return terminalChain
    })

    const result = await getFileCoveredMonths('file-empty', 'user-1')

    expect(result).toBeNull()
  })

  it('returns { firstMonth, lastMonth } as Date instances when both present (R-OB-10)', async () => {
    const { db } = await import('@/lib/db')
    const first = new Date(2026, 0, 1) // January 2026
    const last = new Date(2026, 4, 1)  // May 2026
    const terminalChain = makeWhereTerminalChain([{ firstMonth: first, lastMonth: last }])
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementationOnce((shape: unknown) => {
      mocks.selectedShapes.push(shape)
      return terminalChain
    })

    const result = await getFileCoveredMonths('file-1', 'user-1')

    expect(result).not.toBeNull()
    expect(result!.firstMonth).toBe(first)
    expect(result!.lastMonth).toBe(last)
  })
})

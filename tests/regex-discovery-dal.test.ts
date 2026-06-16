import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  whereArgs: [] as unknown[],
  leftJoinCount: 0,
  innerJoinCount: 0,
  selectDistinctCount: 0,
  uncategorizedRows: [
    {
      id: 'exp-1',
      title: 'Bonifico Andrea Bernardini causale stipendio marzo',
      descriptionHash: 'hash-1',
      descriptionStripPattern: null,
    },
    {
      id: 'exp-2',
      title: 'Bonifico Andrea Bernardini causale stipendio maggio',
      descriptionHash: 'hash-2',
      descriptionStripPattern: null,
    },
  ],
  manualHistoryRows: [] as Array<{ descriptionHash: string | null }>,
}))

function makeQueryChain(finalValue: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => {
      mocks.leftJoinCount++
      return chain
    }),
    innerJoin: vi.fn(() => {
      mocks.innerJoinCount++
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return Promise.resolve(finalValue)
    }),
  }

  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  db: {
    select: (_shape: unknown) => makeQueryChainWithFixture(mocks.uncategorizedRows),
    selectDistinct: (_shape: unknown) => {
      mocks.selectDistinctCount++
      return makeQueryChainWithFixture(mocks.manualHistoryRows)
    },
  },
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  inArray: (column: unknown, values: unknown[]) => ({ op: 'inArray', column, values }),
  isNull: (column: unknown) => ({ op: 'isNull', column }),
  isNotNull: (column: unknown) => ({ op: 'isNotNull', column }),
}))

vi.mock('@/lib/db/schema', () => ({
  expense: {
    id: 'expense.id',
    title: 'expense.title',
    descriptionHash: 'expense.descriptionHash',
    subCategoryId: 'expense.subCategoryId',
    userId: 'expense.userId',
    importedFromFileId: 'expense.importedFromFileId',
  },
  expenseClassificationHistory: {
    expenseId: 'expenseClassificationHistory.expenseId',
    userId: 'expenseClassificationHistory.userId',
    source: 'expenseClassificationHistory.source',
  },
  file: {
    id: 'file.id',
    importFormatVersionId: 'file.importFormatVersionId',
  },
  importFormatVersion: {
    id: 'importFormatVersion.id',
    platformId: 'importFormatVersion.platformId',
  },
  platform: {
    id: 'platform.id',
    descriptionStripPattern: 'platform.descriptionStripPattern',
  },
}))

function makeQueryChainWithFixture(finalValue: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => {
      mocks.leftJoinCount++
      return chain
    }),
    innerJoin: vi.fn(() => {
      mocks.innerJoinCount++
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return Promise.resolve(finalValue)
    }),
  }

  return chain
}

const { getUncategorizedExpensesForDiscovery, getManuallyCategorizedHashes } = await import(
  '../lib/dal/regex-discovery'
)

describe('getUncategorizedExpensesForDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.whereArgs.length = 0
    mocks.leftJoinCount = 0
    mocks.innerJoinCount = 0
    mocks.selectDistinctCount = 0
    mocks.manualHistoryRows = []
  })

  it('returns the array the mocked chain resolves to', async () => {
    const result = await getUncategorizedExpensesForDiscovery('user-1', 7)

    expect(result).toEqual(mocks.uncategorizedRows)
  })

  it('performs exactly three leftJoins (file, importFormatVersion, platform)', async () => {
    await getUncategorizedExpensesForDiscovery('user-1', 7)

    expect(mocks.leftJoinCount).toBe(3)
  })

  it('passes userId condition to WHERE clause (cross-user isolation T-51-03)', async () => {
    await getUncategorizedExpensesForDiscovery('user-1', 7)

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.op).toBe('and')
    expect(where.args).toContainEqual({
      op: 'eq',
      left: 'expense.userId',
      right: 'user-1',
    })
  })

  it('passes platformId condition to WHERE clause (cross-platform isolation T-51-04)', async () => {
    await getUncategorizedExpensesForDiscovery('user-1', 7)

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.op).toBe('and')
    expect(where.args).toContainEqual({
      op: 'eq',
      left: 'platform.id',
      right: 7,
    })
  })

  it('filters Set B via isNull(expense.subCategoryId) — categorized expenses excluded (PIPE-01)', async () => {
    await getUncategorizedExpensesForDiscovery('user-1', 7)

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.op).toBe('and')
    expect(where.args).toContainEqual({
      op: 'isNull',
      column: 'expense.subCategoryId',
    })
  })
})

describe('getManuallyCategorizedHashes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.whereArgs.length = 0
    mocks.leftJoinCount = 0
    mocks.innerJoinCount = 0
    mocks.selectDistinctCount = 0
    mocks.manualHistoryRows = []
  })

  it('short-circuits empty input without querying the database', async () => {
    const result = await getManuallyCategorizedHashes('user-1', [])

    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(0)
    expect(mocks.selectDistinctCount).toBe(0)
    expect(mocks.whereArgs).toHaveLength(0)
  })

  it('returns a Set of matched manual-history hashes', async () => {
    mocks.manualHistoryRows = [{ descriptionHash: 'h1' }, { descriptionHash: 'h2' }]

    const result = await getManuallyCategorizedHashes('user-1', ['h1', 'h2', 'h3'])

    expect(result).toBeInstanceOf(Set)
    expect(result.has('h1')).toBe(true)
    expect(result.has('h2')).toBe(true)
    expect(result.has('h3')).toBe(false)
  })

  it('filters null hashes from the returned Set', async () => {
    mocks.manualHistoryRows = [{ descriptionHash: 'h1' }, { descriptionHash: null }]

    const result = await getManuallyCategorizedHashes('user-1', ['h1'])

    expect([...result]).toEqual(['h1'])
  })

  it('passes userId condition to WHERE clause (cross-user isolation T-52-03)', async () => {
    await getManuallyCategorizedHashes('user-1', ['h1'])

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.op).toBe('and')
    expect(where.args).toContainEqual({
      op: 'eq',
      left: 'expenseClassificationHistory.userId',
      right: 'user-1',
    })
  })

  it('passes manual source marker to WHERE clause', async () => {
    await getManuallyCategorizedHashes('user-1', ['h1'])

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.op).toBe('and')
    expect(where.args).toContainEqual({
      op: 'eq',
      left: 'expenseClassificationHistory.source',
      right: 'manual',
    })
  })

  it('filters by non-null input description hashes', async () => {
    await getManuallyCategorizedHashes('user-1', ['h1', 'h2'])

    const where = mocks.whereArgs[0] as { op: string; args: unknown[] }
    expect(where.op).toBe('and')
    expect(where.args).toContainEqual({
      op: 'isNotNull',
      column: 'expense.descriptionHash',
    })
    expect(where.args).toContainEqual({
      op: 'inArray',
      column: 'expense.descriptionHash',
      values: ['h1', 'h2'],
    })
  })

  it('uses exactly one innerJoin for the manual-history lookup', async () => {
    await getManuallyCategorizedHashes('user-1', ['h1'])

    expect(mocks.innerJoinCount).toBe(1)
  })
})

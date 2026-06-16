import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  whereArgs: [] as unknown[],
  leftJoinCount: 0,
}))

function makeQueryChain(finalValue: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => {
      mocks.leftJoinCount++
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
    select: (_shape: unknown) => makeQueryChain([]),
  },
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  isNull: (column: unknown) => ({ op: 'isNull', column }),
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

const fixtureRows = [
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
]

// Override makeQueryChain to return fixture rows for where() calls
vi.mock('@/lib/db', () => ({
  db: {
    select: (_shape: unknown) => makeQueryChainWithFixture(fixtureRows),
  },
}))

function makeQueryChainWithFixture(finalValue: unknown[] = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => {
      mocks.leftJoinCount++
      return chain
    }),
    where: vi.fn((arg: unknown) => {
      mocks.whereArgs.push(arg)
      return Promise.resolve(finalValue)
    }),
  }

  return chain
}

const { getUncategorizedExpensesForDiscovery } = await import('../lib/dal/regex-discovery')

describe('getUncategorizedExpensesForDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.whereArgs.length = 0
    mocks.leftJoinCount = 0
  })

  it('returns the array the mocked chain resolves to', async () => {
    const result = await getUncategorizedExpensesForDiscovery('user-1', 7)

    expect(result).toEqual(fixtureRows)
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
